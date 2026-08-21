import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTicketEmail, sendCancellationEmail } from "@/lib/email";

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Short, unambiguous, human-readable booking code (no O/0/I/1 confusion). */
function newReference(): string {
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `TBS-${out}`;
}

export const seatLabel = (rowLabel: string, colNumber: number) => `${rowLabel}${colNumber}`;

/**
 * Turns a live hold into a confirmed booking.
 *
 * The seat update is guarded by the same conditions that created the hold
 * (`holdRef` + owner + still HELD + not expired), so a hold that lapsed a
 * millisecond ago cannot be converted, and a hold that was swept cannot
 * either.  Mismatched row counts roll the whole transaction back.
 */
export async function confirmBooking(opts: {
  holdRef: string;
  userId: string;
}): Promise<{ bookingId: string; reference: string }> {
  const { holdRef, userId } = opts;

  const held = await prisma.seat.findMany({
    where: { holdRef, heldByUserId: userId, status: "HELD" },
    include: { venueSeat: true },
  });

  if (held.length === 0) {
    throw new BookingError("Your seat hold has expired. Please select seats again.", 409);
  }
  if (held.some((s) => !s.holdExpiresAt || s.holdExpiresAt.getTime() <= Date.now())) {
    throw new BookingError("Your seat hold has expired. Please select seats again.", 409);
  }

  const eventId = held[0].eventId;
  const pricing = await prisma.eventPricing.findMany({ where: { eventId } });
  const priceOf = new Map(pricing.map((p) => [p.categoryId, p.price]));
  const total = held.reduce((sum, s) => sum + (priceOf.get(s.venueSeat.categoryId) ?? 0), 0);

  const reference = newReference();

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: { reference, eventId, userId, totalAmount: total, status: "CONFIRMED" },
    });

    const converted = await tx.$queryRaw<{ id: string }[]>`
      UPDATE seats
         SET status = 'BOOKED'::"SeatStatus",
             "bookingId"     = ${created.id},
             "heldByUserId"  = NULL,
             "holdRef"       = NULL,
             "holdExpiresAt" = NULL
       WHERE "holdRef" = ${holdRef}
         AND "heldByUserId" = ${userId}
         AND status = 'HELD'::"SeatStatus"
         AND "holdExpiresAt" > now()
      RETURNING id
    `;

    if (converted.length !== held.length) {
      throw new BookingError("Your seat hold has expired. Please select seats again.", 409);
    }
    return created;
  });

  // Email is best-effort — the booking is already committed and must not be
  // rolled back because an inbox was unreachable.
  const [user, event] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.event.findUniqueOrThrow({ where: { id: eventId }, include: { venue: true } }),
  ]);

  await sendTicketEmail({
    to: user.email,
    name: user.name,
    reference,
    eventTitle: event.title,
    venue: `${event.venue.name}, ${event.venue.city}`,
    startsAt: event.startsAt,
    seats: held.map((s) => seatLabel(s.venueSeat.rowLabel, s.venueSeat.colNumber)).sort(),
    total,
  });

  return { bookingId: booking.id, reference };
}

/**
 * Cancels a confirmed booking, frees its seats, and hands each freed seat to
 * the waitlist.  Returns how many waitlist offers were sent.
 */
export async function cancelBooking(opts: {
  bookingId: string;
  userId: string;
  isAdmin?: boolean;
}): Promise<{ released: number; offersSent: number }> {
  const { bookingId, userId, isAdmin = false } = opts;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { seats: { include: { venueSeat: true } }, event: true, user: true },
  });

  if (!booking) throw new BookingError("Booking not found.", 404);
  if (!isAdmin && booking.userId !== userId) {
    throw new BookingError("That is not your booking.", 403);
  }
  if (booking.status === "CANCELLED") {
    throw new BookingError("This booking is already cancelled.", 409);
  }
  if (booking.event.startsAt.getTime() <= Date.now()) {
    throw new BookingError("This event has already started; it can no longer be cancelled.", 409);
  }

  const freedSeatIds = booking.seats.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.updateMany({
      where: { id: bookingId, status: "CONFIRMED" },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    // Guards against two cancel requests racing.
    if (updated.count === 0) throw new BookingError("This booking is already cancelled.", 409);

    await tx.seat.updateMany({
      where: { id: { in: freedSeatIds } },
      data: {
        status: "AVAILABLE",
        bookingId: null,
        heldByUserId: null,
        holdRef: null,
        holdExpiresAt: null,
      },
    });
  });

  await sendCancellationEmail({
    to: booking.user.email,
    name: booking.user.name,
    reference: booking.reference,
    eventTitle: booking.event.title,
  });

  // Hand the freed seats to whoever is waiting.  Imported lazily to keep the
  // two modules from forming an import cycle.
  const { offerSeatsToWaitlist } = await import("@/lib/waitlist");
  const offersSent = await offerSeatsToWaitlist(freedSeatIds);

  return { released: freedSeatIds.length, offersSent };
}

export type BookingHistoryRow = Awaited<ReturnType<typeof getBookingHistory>>[number];

/**
 * A customer's bookings, already annotated with the time-dependent flags the
 * UI needs.  Deriving these here rather than in the page keeps `Date.now()`
 * out of component render, and gives the page and the API route one source.
 */
export async function getBookingHistory(userId: string) {
  const bookings = await prisma.booking.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      event: { include: { venue: true } },
      seats: { include: { venueSeat: { include: { category: true } } } },
    },
  });

  const now = Date.now();

  return bookings.map((b) => ({
    id: b.id,
    reference: b.reference,
    status: b.status,
    totalAmount: b.totalAmount,
    createdAt: b.createdAt,
    cancelledAt: b.cancelledAt,
    started: b.event.startsAt.getTime() <= now,
    /** A past event, or an already-cancelled booking, cannot be cancelled. */
    cancellable: b.status === "CONFIRMED" && b.event.startsAt.getTime() > now,
    event: {
      id: b.event.id,
      title: b.event.title,
      type: b.event.type,
      startsAt: b.event.startsAt,
      venue: `${b.event.venue.name}, ${b.event.venue.city}`,
    },
    seats: b.seats
      .map((s) => ({
        label: seatLabel(s.venueSeat.rowLabel, s.venueSeat.colNumber),
        category: s.venueSeat.category.name,
        colour: s.venueSeat.category.colour,
      }))
      .sort((a, b2) => a.label.localeCompare(b2.label, undefined, { numeric: true })),
  }));
}
