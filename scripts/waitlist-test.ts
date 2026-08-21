/**
 * End-to-end proof of the waitlist flow:
 *
 *   1. A customer books a seat.
 *   2. Two other customers join the waitlist for that seat category, in order.
 *   3. The booking is cancelled -> the seat is auto-offered to customer A
 *      (first in the queue) with a time-limited token.
 *   4. A's offer is forced to expire -> the sweeper re-offers the seat to B.
 *   5. B redeems the offer -> a real booking with a QR reference is created.
 *
 * Run with:  npx tsx scripts/waitlist-test.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { holdSeats } from "../src/lib/seats";
import { confirmBooking, cancelBooking } from "../src/lib/bookings";
import {
  joinWaitlist,
  redeemOffer,
  sweepExpiredOffers,
  OFFER_HOLD_PREFIX,
} from "../src/lib/waitlist";

const prisma = new PrismaClient();

const checks: { label: string; ok: boolean; detail: string }[] = [];
function check(label: string, ok: boolean, detail = "") {
  checks.push({ label, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const event = await prisma.event.findFirstOrThrow({ orderBy: { startsAt: "asc" } });
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const mk = (n: string) =>
    prisma.user.upsert({
      where: { email: `wl-${n}@test.local` },
      update: {},
      create: { email: `wl-${n}@test.local`, name: `WL ${n}`, passwordHash },
    });

  const buyer = await mk("buyer");
  const alice = await mk("alice");
  const bob = await mk("bob");

  // A single seat we fully control.
  const seat = await prisma.seat.findFirstOrThrow({
    where: { eventId: event.id },
    include: { venueSeat: true },
  });
  await prisma.seat.update({
    where: { id: seat.id },
    data: { status: "AVAILABLE", bookingId: null, heldByUserId: null, holdRef: null, holdExpiresAt: null },
  });
  const categoryId = seat.venueSeat.categoryId;

  console.log(`Event: ${event.title}`);
  console.log(`Seat : ${seat.venueSeat.rowLabel}${seat.venueSeat.colNumber}\n`);

  // --- 1. buyer books the seat ---------------------------------------------
  console.log("STEP 1 — buyer holds and books the seat");
  const hold = await holdSeats({ eventId: event.id, seatIds: [seat.id], userId: buyer.id });
  const booking = await confirmBooking({ holdRef: hold.holdRef, userId: buyer.id });
  const booked = await prisma.seat.findUniqueOrThrow({ where: { id: seat.id } });
  check("seat is BOOKED", booked.status === "BOOKED");
  check("booking has a QR reference", /^TBS-[A-Z2-9]{8}$/.test(booking.reference), booking.reference);

  // --- 2. alice then bob join the waitlist ----------------------------------
  console.log("\nSTEP 2 — alice, then bob, join the waitlist");
  const a = await joinWaitlist({ eventId: event.id, categoryId, userId: alice.id });
  await new Promise((r) => setTimeout(r, 15)); // keep createdAt strictly ordered
  const b = await joinWaitlist({ eventId: event.id, categoryId, userId: bob.id });
  check("alice is position 1", a.position === 1, `got ${a.position}`);
  check("bob is position 2", b.position === 2, `got ${b.position}`);

  // --- 3. cancellation auto-offers to alice ---------------------------------
  console.log("\nSTEP 3 — buyer cancels; seat auto-offers to the front of the queue");
  const cancelled = await cancelBooking({ bookingId: booking.bookingId, userId: buyer.id });
  check("one offer was sent", cancelled.offersSent === 1, `sent ${cancelled.offersSent}`);

  const aliceEntry = await prisma.waitlist.findUniqueOrThrow({ where: { id: a.entry.id } });
  check("alice's entry is OFFERED", aliceEntry.status === "OFFERED");
  check("offer carries a token", !!aliceEntry.offerToken);
  check("offer carries an expiry", !!aliceEntry.offerExpiresAt);

  const heldForAlice = await prisma.seat.findUniqueOrThrow({ where: { id: seat.id } });
  check(
    "seat is HELD for alice under an offer hold",
    heldForAlice.status === "HELD" &&
      heldForAlice.heldByUserId === alice.id &&
      !!heldForAlice.holdRef?.startsWith(OFFER_HOLD_PREFIX),
  );

  const bobStillWaiting = await prisma.waitlist.findUniqueOrThrow({ where: { id: b.entry.id } });
  check("bob is still WAITING", bobStillWaiting.status === "WAITING");

  // --- 4. alice lets it lapse; sweeper passes it to bob ----------------------
  console.log("\nSTEP 4 — alice ignores it; the offer expires and passes to bob");
  await prisma.waitlist.update({
    where: { id: a.entry.id },
    data: { offerExpiresAt: new Date(Date.now() - 1000) },
  });
  const swept = await sweepExpiredOffers();
  check("one offer expired", swept.expired === 1, `expired ${swept.expired}`);
  check("seat was re-offered", swept.reoffered === 1, `reoffered ${swept.reoffered}`);

  const aliceAfter = await prisma.waitlist.findUniqueOrThrow({ where: { id: a.entry.id } });
  check("alice's entry is EXPIRED", aliceAfter.status === "EXPIRED");

  const bobAfter = await prisma.waitlist.findUniqueOrThrow({ where: { id: b.entry.id } });
  check("bob's entry is now OFFERED", bobAfter.status === "OFFERED");
  check("bob got a fresh token", !!bobAfter.offerToken && bobAfter.offerToken !== aliceEntry.offerToken);

  // --- 5. bob redeems -------------------------------------------------------
  console.log("\nSTEP 5 — bob redeems his offer");
  const bobBooking = await redeemOffer(bobAfter.offerToken!, bob.id);
  check("bob has a booking reference", /^TBS-/.test(bobBooking.reference), bobBooking.reference);

  const finalSeat = await prisma.seat.findUniqueOrThrow({ where: { id: seat.id } });
  check("seat is BOOKED for bob", finalSeat.status === "BOOKED" && finalSeat.bookingId === bobBooking.bookingId);

  const bobFinal = await prisma.waitlist.findUniqueOrThrow({ where: { id: b.entry.id } });
  check("bob's entry is CONVERTED", bobFinal.status === "CONVERTED");

  // An expired offer token must not be redeemable.
  console.log("\nSTEP 6 — a stale offer link is rejected");
  let rejected = false;
  try {
    await redeemOffer(aliceEntry.offerToken!, alice.id);
  } catch {
    rejected = true;
  }
  check("alice's expired link is refused", rejected);

  // --- cleanup --------------------------------------------------------------
  await prisma.waitlist.deleteMany({ where: { user: { email: { endsWith: "@test.local" } } } });
  await prisma.seat.updateMany({
    where: { id: seat.id },
    data: { status: "AVAILABLE", bookingId: null, heldByUserId: null, holdRef: null, holdExpiresAt: null },
  });
  await prisma.booking.deleteMany({ where: { user: { email: { endsWith: "@test.local" } } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local" } } });

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  console.log(failed.length === 0 ? "ALL TESTS PASSED" : "TESTS FAILED");
  process.exit(failed.length === 0 ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
