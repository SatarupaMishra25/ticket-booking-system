import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { holdSeats } from "@/lib/seats";
import { SEAT_HOLD_TTL_MINUTES } from "@/lib/config";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  eventId: z.string().min(1),
  seatIds: z.array(z.string().min(1)).min(1, "Select at least one seat.").max(10),
});

/**
 * Places an all-or-nothing hold on the selected seats.
 *
 * Returns 409 when any seat was taken first — `holdSeats` guarantees no
 * partial hold is ever committed, so the client can simply refresh the map
 * and let the customer pick again.
 */
export const POST = route(async (req: NextRequest) => {
  const session = await requireRole("CUSTOMER", "ORGANISER", "ADMIN");
  const { eventId, seatIds } = Body.parse(await req.json());

  const { holdRef, expiresAt } = await holdSeats({
    eventId,
    seatIds,
    userId: session.userId,
  });

  return ok({ holdRef, expiresAt, ttlMinutes: SEAT_HOLD_TTL_MINUTES }, 201);
});
