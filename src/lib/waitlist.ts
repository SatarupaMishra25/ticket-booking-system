import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { WAITLIST_OFFER_TTL_MINUTES, minutesFromNow } from "@/lib/config";
import { sendWaitlistOfferEmail } from "@/lib/email";
import { seatLabel } from "@/lib/bookings";

export class WaitlistError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Prefix that marks a hold created by a waitlist offer rather than checkout. */
export const OFFER_HOLD_PREFIX = "offer_";

const newToken = () => randomBytes(24).toString("base64url");

/** Puts a customer on the queue for one seat category of one event. */
export async function joinWaitlist(opts: {
  eventId: string;
  categoryId: string;
  userId: string;
}) {
  const { eventId, categoryId, userId } = opts;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { venue: { include: { categories: true } } },
  });
  if (!event) throw new WaitlistError("Event not found.", 404);
  if (!event.venue.categories.some((c) => c.id === categoryId)) {
    throw new WaitlistError("That seat category does not belong to this event.", 400);
  }
  if (event.startsAt.getTime() <= Date.now()) {
    throw new WaitlistError("This event has already started.", 409);
  }

  const existing = await prisma.waitlist.findUnique({
    where: { eventId_categoryId_userId: { eventId, categoryId, userId } },
  });

  if (existing && ["WAITING", "OFFERED"].includes(existing.status)) {
    throw new WaitlistError("You are already on the waitlist for this category.", 409);
  }

  // Re-joining after a previous entry expired or was cancelled sends the
  // customer to the back of the queue, which is what `createdAt` encodes.
  const entry = existing
    ? await prisma.waitlist.update({
        where: { id: existing.id },
        data: {
          status: "WAITING",
          createdAt: new Date(),
          offerToken: null,
          offerSeatId: null,
          offerExpiresAt: null,
        },
      })
    : await prisma.waitlist.create({ data: { eventId, categoryId, userId } });

  return { entry, position: await positionOf(entry.id) };
}

/** 1-based place in the queue, counting only people still WAITING. */
export async function positionOf(waitlistId: string): Promise<number> {
  const entry = await prisma.waitlist.findUnique({ where: { id: waitlistId } });
  if (!entry || entry.status !== "WAITING") return 0;
  const ahead = await prisma.waitlist.count({
    where: {
      eventId: entry.eventId,
      categoryId: entry.categoryId,
      status: "WAITING",
      createdAt: { lt: entry.createdAt },
    },
  });
  return ahead + 1;
}

export async function leaveWaitlist(waitlistId: string, userId: string) {
  const updated = await prisma.waitlist.updateMany({
    where: { id: waitlistId, userId, status: { in: ["WAITING", "OFFERED"] } },
    data: { status: "CANCELLED", offerToken: null, offerSeatId: null, offerExpiresAt: null },
  });
  if (updated.count === 0) throw new WaitlistError("Waitlist entry not found.", 404);
}

/**
 * Offers each freed seat to the next person waiting for that seat category.
 *
 * The offer *is* a seat hold - same `seats` columns, same lazy-expiry rule -
 * so an unclaimed offer frees the seat automatically, exactly like an
 * abandoned checkout.  One mechanism, two entry points.
 *
 * Returns the number of offers actually sent.
 */
export async function offerSeatsToWaitlist(seatIds: string[]): Promise<number> {
  let sent = 0;

  for (const seatId of seatIds) {
    const seat = await prisma.seat.findUnique({
      where: { id: seatId },
      include: { venueSeat: true, event: true },
    });

    // Skip anything already re-taken by a normal customer in the meantime.
    if (!seat || seat.status !== "AVAILABLE") continue;
    if (seat.event.startsAt.getTime() <= Date.now()) continue;

    const claimed = await offerOneSeat(seat.id, seat.eventId, seat.venueSeat.categoryId);
    if (claimed) sent++;
  }

  return sent;
}

/**
 * Walks the queue for one (event, category) until somebody is successfully
 * offered the seat, or the queue runs dry.
 */
async function offerOneSeat(
  seatId: string,
  eventId: string,
  categoryId: string,
): Promise<boolean> {
  // Bounded so a queue full of unusable entries cannot spin forever.
  for (let attempt = 0; attempt < 25; attempt++) {
    const next = await prisma.waitlist.findFirst({
      where: { eventId, categoryId, status: "WAITING" },
      orderBy: { createdAt: "asc" },
      include: { user: true, category: true, event: true },
    });
    if (!next) return false;

    const token = newToken();
    const expiresAt = minutesFromNow(WAITLIST_OFFER_TTL_MINUTES);

    // Claim this queue entry.  `status: "WAITING"` in the WHERE means two
    // concurrent cancellations cannot hand the same person two seats.
    const claimedEntry = await prisma.waitlist.updateMany({
      where: { id: next.id, status: "WAITING" },
      data: { status: "OFFERED", offerToken: token, offerSeatId: seatId, offerExpiresAt: expiresAt },
    });
    if (claimedEntry.count === 0) continue; // someone else took it; try the next person

    // Reserve the seat for them, reusing the ordinary hold columns.
    const claimedSeat = await prisma.$executeRaw`
      UPDATE seats
         SET status = 'HELD'::"SeatStatus",
             "heldByUserId"  = ${next.userId},
             "holdRef"       = ${OFFER_HOLD_PREFIX + token},
             "holdExpiresAt" = ${expiresAt}
       WHERE id = ${seatId}
         AND status = 'AVAILABLE'::"SeatStatus"
    `;

    if (claimedSeat === 0) {
      // Seat vanished between the two statements - put the person back in the
      // queue with their original place intact.
      await prisma.waitlist.update({
        where: { id: next.id },
        data: { status: "WAITING", offerToken: null, offerSeatId: null, offerExpiresAt: null },
      });
      return false;
    }

    const seat = await prisma.seat.findUniqueOrThrow({
      where: { id: seatId },
      include: { venueSeat: true },
    });

    await sendWaitlistOfferEmail({
      to: next.user.email,
      name: next.user.name,
      eventTitle: next.event.title,
      categoryName: next.category.name,
      seatLabel: seatLabel(seat.venueSeat.rowLabel, seat.venueSeat.colNumber),
      token,
      expiresAt,
    });

    return true;
  }
  return false;
}

/** Looks up an offer for the /offer/[token] page. */
export async function getOffer(token: string) {
  const entry = await prisma.waitlist.findUnique({
    where: { offerToken: token },
    include: { event: { include: { venue: true } }, category: true, user: true },
  });
  if (!entry || entry.status !== "OFFERED" || !entry.offerSeatId) return null;

  const expired = !entry.offerExpiresAt || entry.offerExpiresAt.getTime() <= Date.now();
  const seat = await prisma.seat.findUnique({
    where: { id: entry.offerSeatId },
    include: { venueSeat: { include: { category: true } } },
  });
  const pricing = await prisma.eventPricing.findUnique({
    where: { eventId_categoryId: { eventId: entry.eventId, categoryId: entry.categoryId } },
  });

  return {
    entry,
    seat,
    expired,
    price: pricing?.price ?? 0,
    label: seat ? seatLabel(seat.venueSeat.rowLabel, seat.venueSeat.colNumber) : "",
  };
}

/**
 * Converts an offer into a booking.  Delegates to `confirmBooking`, which
 * re-validates the underlying hold, so an offer that expired between the click
 * and the request is rejected by the same check that guards checkout.
 */
export async function redeemOffer(token: string, userId: string) {
  const entry = await prisma.waitlist.findUnique({ where: { offerToken: token } });

  if (!entry) throw new WaitlistError("This offer link is not valid.", 404);
  if (entry.userId !== userId) throw new WaitlistError("This offer belongs to another account.", 403);
  if (entry.status === "CONVERTED") throw new WaitlistError("You have already claimed this offer.", 409);
  if (entry.status !== "OFFERED") throw new WaitlistError("This offer is no longer available.", 409);
  if (!entry.offerExpiresAt || entry.offerExpiresAt.getTime() <= Date.now()) {
    throw new WaitlistError("This offer has expired and the seat went to the next person.", 409);
  }

  const { confirmBooking } = await import("@/lib/bookings");
  const result = await confirmBooking({ holdRef: OFFER_HOLD_PREFIX + token, userId });

  await prisma.waitlist.update({
    where: { id: entry.id },
    data: { status: "CONVERTED", offerToken: null, offerExpiresAt: null },
  });

  return result;
}

/**
 * Expires stale offers and passes each seat down the queue.  Run by the cron
 * endpoint; also safe to call inline.
 */
export async function sweepExpiredOffers(): Promise<{ expired: number; reoffered: number }> {
  const stale = await prisma.waitlist.findMany({
    where: { status: "OFFERED", offerExpiresAt: { lte: new Date() } },
  });
  if (stale.length === 0) return { expired: 0, reoffered: 0 };

  const seatIds: string[] = [];

  for (const entry of stale) {
    const token = entry.offerToken;
    const claimed = await prisma.waitlist.updateMany({
      where: { id: entry.id, status: "OFFERED" },
      data: { status: "EXPIRED", offerToken: null, offerSeatId: null, offerExpiresAt: null },
    });
    if (claimed.count === 0) continue;

    if (entry.offerSeatId && token) {
      // Free the seat only if it is still sitting under *this* offer's hold.
      await prisma.$executeRaw`
        UPDATE seats
           SET status = 'AVAILABLE'::"SeatStatus",
               "heldByUserId" = NULL, "holdRef" = NULL, "holdExpiresAt" = NULL
         WHERE id = ${entry.offerSeatId}
           AND "holdRef" = ${OFFER_HOLD_PREFIX + token}
      `;
      seatIds.push(entry.offerSeatId);
    }
  }

  const reoffered = await offerSeatsToWaitlist(seatIds);
  return { expired: stale.length, reoffered };
}

/**
 * A customer's waitlist entries with live queue positions and an
 * already-evaluated `offerLive` flag, so pages need no clock of their own.
 */
export async function getWaitlistForUser(userId: string) {
  const entries = await prisma.waitlist.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { event: { include: { venue: true } }, category: true },
  });

  const now = Date.now();

  return Promise.all(
    entries.map(async (e) => ({
      id: e.id,
      status: e.status,
      createdAt: e.createdAt,
      position: e.status === "WAITING" ? await positionOf(e.id) : null,
      offerExpiresAt: e.offerExpiresAt,
      offerToken: e.status === "OFFERED" ? e.offerToken : null,
      offerLive:
        e.status === "OFFERED" && !!e.offerExpiresAt && e.offerExpiresAt.getTime() > now,
      category: { id: e.categoryId, name: e.category.name, colour: e.category.colour },
      event: {
        id: e.event.id,
        title: e.event.title,
        type: e.event.type,
        startsAt: e.event.startsAt,
        venue: `${e.event.venue.name}, ${e.event.venue.city}`,
      },
    })),
  );
}
