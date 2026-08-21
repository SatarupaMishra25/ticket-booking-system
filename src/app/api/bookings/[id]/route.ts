import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { renderQrDataUrl } from "@/lib/email";
import { ok, fail, route } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** One booking, including the QR code, for the confirmation / ticket page. */
export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const session = await requireUser();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      event: { include: { venue: true } },
      seats: { include: { venueSeat: { include: { category: true } } } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!booking) return fail("Booking not found.", 404);
  if (booking.userId !== session.userId && session.role !== "ADMIN") {
    return fail("That is not your booking.", 403);
  }

  return ok({
    booking: {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      totalAmount: booking.totalAmount,
      createdAt: booking.createdAt,
      customer: booking.user,
      event: {
        id: booking.event.id,
        title: booking.event.title,
        type: booking.event.type,
        startsAt: booking.event.startsAt,
        venue: `${booking.event.venue.name}, ${booking.event.venue.city}`,
      },
      seats: booking.seats
        .map((s) => ({
          label: `${s.venueSeat.rowLabel}${s.venueSeat.colNumber}`,
          category: s.venueSeat.category.name,
          colour: s.venueSeat.category.colour,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    },
    // The QR encodes the booking reference, exactly as the emailed ticket does.
    qrDataUrl: await renderQrDataUrl(booking.reference),
  });
});
