import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { cancelBooking } from "@/lib/bookings";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Cancels a booking, frees its seats, and immediately offers each freed seat
 * to the next customer waiting for that seat category.
 */
export const POST = route(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const session = await requireUser();

  const { released, offersSent } = await cancelBooking({
    bookingId: id,
    userId: session.userId,
    isAdmin: session.role === "ADMIN",
  });

  return ok({ released, offersSent });
});
