import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getSeatMap } from "@/lib/seats";
import { maybeSweep } from "@/lib/sweep";
import { ok, fail, route } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Full seat map for one event.  The seat-map page polls this, which is how the
 * grid stays in step with other customers' holds, bookings and cancellations.
 */
export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const session = await getSession();

  // Throttled and not awaited - keeps lapsed offers moving down the queue on
  // hosts where a per-minute cron is unavailable.
  maybeSweep();

  const map = await getSeatMap(id, session?.userId);
  if (!map) return fail("Event not found.", 404);

  return ok(map);
});

/** Delete an owned event while preserving all historical bookings. */
export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const session = await requireRole("ORGANISER", "ADMIN");
  const event = await prisma.event.findUnique({
    where: { id },
    select: { organiserId: true, _count: { select: { bookings: true } } },
  });

  if (!event) return fail("Event not found.", 404);
  if (session.role === "ORGANISER" && event.organiserId !== session.userId) {
    return fail("You can only delete your own events.", 403);
  }
  if (event._count.bookings > 0) {
    return fail(
      "This event has booking history and cannot be deleted. Keep it for customer tickets and financial records.",
      409,
    );
  }

  await prisma.event.delete({ where: { id } });
  return ok({ deleted: true });
});
