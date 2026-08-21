import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SEAT_HOLD_TTL_MINUTES, minutesFromNow } from "@/lib/config";

/**
 * Seat availability rule used everywhere in this file.
 *
 * A seat is free when it is AVAILABLE, or when it is HELD but the hold has
 * already lapsed.  Expressing expiry as a *query condition* rather than a
 * background job means a lapsed hold is never observable as "taken", even if
 * the sweeper has not run yet.  The sweeper (see `sweepExpiredHolds`) is
 * therefore only housekeeping — correctness never depends on it.
 */
const IS_FREE = Prisma.sql`(
  status = 'AVAILABLE'::"SeatStatus"
  OR (status = 'HELD'::"SeatStatus" AND "holdExpiresAt" IS NOT NULL AND "holdExpiresAt" <= now())
)`;

export class SeatConflictError extends Error {
  constructor(message = "Some of those seats were just taken. Please pick again.") {
    super(message);
  }
}

export const newHoldRef = () =>
  `hold_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/**
 * Atomically place a hold on every requested seat, or none at all.
 *
 * Concurrency protection works in two layers:
 *
 *  1. A single conditional `UPDATE ... WHERE <seat is free> RETURNING id`.
 *     Postgres takes a row lock per matched row.  Two transactions racing for
 *     the same seat are serialised by that lock: the loser re-evaluates the
 *     WHERE clause after the winner commits, sees a live hold, and matches
 *     zero rows.
 *  2. An all-or-nothing check inside the transaction — if the number of rows
 *     returned is smaller than the number requested, we throw, which rolls the
 *     whole statement back.  A partial hold is never committed.
 */
export async function holdSeats(opts: {
  eventId: string;
  seatIds: string[];
  userId: string;
}): Promise<{ holdRef: string; expiresAt: Date }> {
  const { eventId, seatIds, userId } = opts;
  if (seatIds.length === 0) throw new SeatConflictError("Select at least one seat.");
  if (seatIds.length > 10) throw new SeatConflictError("You can book at most 10 seats at once.");

  // A repeat of a request this user already won (double-click, retry after a
  // dropped response) must return the original hold rather than fight it.
  const existing = await findOwnLiveHold(eventId, seatIds, userId);
  if (existing) return existing;

  const holdRef = newHoldRef();
  const expiresAt = minutesFromNow(SEAT_HOLD_TTL_MINUTES);

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.$queryRaw<{ id: string }[]>`
        UPDATE seats
           SET status = 'HELD'::"SeatStatus",
               "heldByUserId"  = ${userId},
               "holdRef"       = ${holdRef},
               "holdExpiresAt" = ${expiresAt}
         WHERE "eventId" = ${eventId}
           AND id IN (${Prisma.join(seatIds)})
           AND ${IS_FREE}
        RETURNING id
      `;

      // All-or-nothing: throwing rolls back the UPDATE, so a partial hold is
      // never committed.
      if (claimed.length !== seatIds.length) throw new SeatConflictError();
    });
  } catch (err) {
    if (err instanceof SeatConflictError) {
      // We may have lost a race against *ourselves*; if the winner was this
      // same user, hand back their hold instead of a spurious error.
      const own = await findOwnLiveHold(eventId, seatIds, userId);
      if (own) return own;
    }
    throw err;
  }

  // Now that the new hold is safely committed, drop any earlier hold this user
  // still had on this event (they changed their selection).  Doing this after
  // the claim - never before - keeps it from releasing the seats we just won.
  await prisma.$executeRaw`
    UPDATE seats
       SET status = 'AVAILABLE'::"SeatStatus",
           "heldByUserId" = NULL, "holdRef" = NULL, "holdExpiresAt" = NULL
     WHERE "eventId" = ${eventId}
       AND "heldByUserId" = ${userId}
       AND status = 'HELD'::"SeatStatus"
       AND "holdRef" IS DISTINCT FROM ${holdRef}
  `;

  return { holdRef, expiresAt };
}

/**
 * Returns this user's live hold when it covers exactly `seatIds`, else null.
 * Used to make `holdSeats` idempotent under retries.
 */
async function findOwnLiveHold(
  eventId: string,
  seatIds: string[],
  userId: string,
): Promise<{ holdRef: string; expiresAt: Date } | null> {
  const held = await prisma.seat.findMany({
    where: {
      eventId,
      heldByUserId: userId,
      status: "HELD",
      holdExpiresAt: { gt: new Date() },
    },
    select: { id: true, holdRef: true, holdExpiresAt: true },
  });
  if (held.length !== seatIds.length) return null;

  const wanted = new Set(seatIds);
  if (!held.every((s) => wanted.has(s.id))) return null;

  const refs = new Set(held.map((s) => s.holdRef));
  if (refs.size !== 1) return null;

  return { holdRef: held[0].holdRef!, expiresAt: held[0].holdExpiresAt! };
}

/** Drops a hold the customer owns (explicit "back"/abandon action). */
export async function releaseHold(holdRef: string, userId: string): Promise<number> {
  return prisma.$executeRaw`
    UPDATE seats
       SET status = 'AVAILABLE'::"SeatStatus",
           "heldByUserId" = NULL, "holdRef" = NULL, "holdExpiresAt" = NULL
     WHERE "holdRef" = ${holdRef}
       AND "heldByUserId" = ${userId}
       AND status = 'HELD'::"SeatStatus"
  `;
}

/**
 * Housekeeping sweep: blanks out lapsed holds so the rows read cleanly in the
 * admin views. Safe to run at any interval, or never — see `IS_FREE`.
 */
export async function sweepExpiredHolds(): Promise<number> {
  return prisma.$executeRaw`
    UPDATE seats
       SET status = 'AVAILABLE'::"SeatStatus",
           "heldByUserId" = NULL, "holdRef" = NULL, "holdExpiresAt" = NULL
     WHERE status = 'HELD'::"SeatStatus"
       AND "holdExpiresAt" IS NOT NULL
       AND "holdExpiresAt" <= now()
  `;
}

export type SeatMapSeat = {
  id: string;
  rowLabel: string;
  colNumber: number;
  categoryId: string;
  categoryName: string;
  colour: string;
  price: number;
  /** What this viewer is allowed to see: their own hold is distinguishable. */
  status: "AVAILABLE" | "HELD" | "BOOKED" | "HELD_BY_ME";
};

/**
 * The seat map for one event, with lapsed holds already presented as
 * available.  `viewerId` lets the caller's own held seats render differently
 * from someone else's.
 */
export async function getSeatMap(eventId: string, viewerId?: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      venue: { include: { categories: true } },
      pricing: true,
      organiser: { select: { name: true } },
    },
  });
  if (!event) return null;

  const priceOf = new Map(event.pricing.map((p) => [p.categoryId, p.price]));

  const rows = await prisma.seat.findMany({
    where: { eventId },
    include: { venueSeat: { include: { category: true } } },
    orderBy: [{ venueSeat: { rowLabel: "asc" } }, { venueSeat: { colNumber: "asc" } }],
  });

  const now = Date.now();
  const seats: SeatMapSeat[] = rows.map((s) => {
    const lapsed =
      s.status === "HELD" && (!s.holdExpiresAt || s.holdExpiresAt.getTime() <= now);

    let status: SeatMapSeat["status"];
    if (s.status === "BOOKED") status = "BOOKED";
    else if (lapsed) status = "AVAILABLE";
    else if (s.status === "HELD")
      status = viewerId && s.heldByUserId === viewerId ? "HELD_BY_ME" : "HELD";
    else status = "AVAILABLE";

    return {
      id: s.id,
      rowLabel: s.venueSeat.rowLabel,
      colNumber: s.venueSeat.colNumber,
      categoryId: s.venueSeat.categoryId,
      categoryName: s.venueSeat.category.name,
      colour: s.venueSeat.category.colour,
      price: priceOf.get(s.venueSeat.categoryId) ?? 0,
      status,
    };
  });

  const categories = event.venue.categories.map((c) => ({
    id: c.id,
    name: c.name,
    colour: c.colour,
    price: priceOf.get(c.id) ?? 0,
    available: seats.filter((s) => s.categoryId === c.id && s.status !== "BOOKED" && s.status !== "HELD").length,
    total: seats.filter((s) => s.categoryId === c.id).length,
  }));

  return {
    event: {
      id: event.id,
      title: event.title,
      type: event.type,
      description: event.description,
      startsAt: event.startsAt,
      venueName: event.venue.name,
      venueCity: event.venue.city,
      organiser: event.organiser.name,
    },
    categories,
    seats,
    soldOut: seats.every((s) => s.status === "BOOKED"),
  };
}

/**
 * Checkout view of a live hold, or null when it has lapsed or is not the
 * caller's.  The expiry comparison lives here rather than in the page so the
 * page body stays free of time-dependent calls.
 */
export async function getHoldForCheckout(holdRef: string, userId: string) {
  const seats = await prisma.seat.findMany({
    where: { holdRef, heldByUserId: userId, status: "HELD" },
    include: {
      venueSeat: { include: { category: true } },
      event: { include: { venue: true, pricing: true } },
    },
    orderBy: [{ venueSeat: { rowLabel: "asc" } }, { venueSeat: { colNumber: "asc" } }],
  });

  const expiresAt = seats[0]?.holdExpiresAt;
  if (seats.length === 0 || !expiresAt || expiresAt.getTime() <= Date.now()) return null;

  const event = seats[0].event;
  const priceOf = new Map(event.pricing.map((p) => [p.categoryId, p.price]));

  const lines = seats.map((s) => ({
    seatId: s.id,
    label: `${s.venueSeat.rowLabel}${s.venueSeat.colNumber}`,
    category: s.venueSeat.category.name,
    colour: s.venueSeat.category.colour,
    price: priceOf.get(s.venueSeat.categoryId) ?? 0,
  }));

  return {
    holdRef,
    expiresAt,
    event: {
      id: event.id,
      title: event.title,
      type: event.type,
      startsAt: event.startsAt,
      venue: `${event.venue.name}, ${event.venue.city}`,
    },
    seats: lines,
    total: lines.reduce((sum, l) => sum + l.price, 0),
  };
}
