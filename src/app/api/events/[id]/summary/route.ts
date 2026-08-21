import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, route } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Booking + revenue summary for one event.  Owning organiser, or any admin. */
export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const session = await requireRole("ORGANISER", "ADMIN");

  const event = await prisma.event.findUnique({
    where: { id },
    include: { venue: { include: { categories: { orderBy: { name: "asc" } } } }, pricing: true },
  });
  if (!event) return fail("Event not found.", 404);
  if (session.role === "ORGANISER" && event.organiserId !== session.userId) {
    return fail("That is not your event.", 403);
  }

  const bookings = await prisma.booking.findMany({
    where: { eventId: id },
    include: {
      user: { select: { name: true, email: true } },
      seats: { include: { venueSeat: { include: { category: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const confirmed = bookings.filter((b) => b.status === "CONFIRMED");
  const cancelled = bookings.filter((b) => b.status === "CANCELLED");

  // Revenue per seat category, counting confirmed bookings only.
  const perCategory = event.venue.categories.map((c) => {
    const seats = confirmed.flatMap((b) =>
      b.seats.filter((s) => s.venueSeat.categoryId === c.id),
    );
    const price = event.pricing.find((p) => p.categoryId === c.id)?.price ?? 0;
    return {
      categoryId: c.id,
      name: c.name,
      colour: c.colour,
      price,
      seatsSold: seats.length,
      revenue: seats.length * price,
    };
  });

  const seatTotals = await prisma.seat.groupBy({
    by: ["status"],
    where: { eventId: id },
    _count: { _all: true },
  });
  const countOf = (s: string) => seatTotals.find((t) => t.status === s)?._count._all ?? 0;

  const waitlist = await prisma.waitlist.groupBy({
    by: ["categoryId", "status"],
    where: { eventId: id },
    _count: { _all: true },
  });
  const wl = (categoryId: string, status: string) =>
    waitlist.find((w) => w.categoryId === categoryId && w.status === status)?._count._all ?? 0;

  return ok({
    event: {
      id: event.id,
      title: event.title,
      type: event.type,
      startsAt: event.startsAt,
      venue: `${event.venue.name}, ${event.venue.city}`,
    },
    totals: {
      revenue: perCategory.reduce((s, c) => s + c.revenue, 0),
      confirmedBookings: confirmed.length,
      cancelledBookings: cancelled.length,
      seatsSold: countOf("BOOKED"),
      seatsHeld: countOf("HELD"),
      seatsAvailable: countOf("AVAILABLE"),
      seatsTotal: seatTotals.reduce((s, t) => s + t._count._all, 0),
    },
    perCategory,
    waitlist: event.venue.categories.map((c) => ({
      categoryId: c.id,
      name: c.name,
      waiting: wl(c.id, "WAITING"),
      offered: wl(c.id, "OFFERED"),
      converted: wl(c.id, "CONVERTED"),
    })),
    bookings: bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      status: b.status,
      customer: b.user.name,
      email: b.user.email,
      seats: b.seats.map((s) => `${s.venueSeat.rowLabel}${s.venueSeat.colNumber}`).sort(),
      totalAmount: b.totalAmount,
      createdAt: b.createdAt,
    })),
  });
});
