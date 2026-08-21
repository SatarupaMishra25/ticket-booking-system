import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { confirmBooking, getBookingHistory } from "@/lib/bookings";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

/** The signed-in customer's booking history, newest first. */
export const GET = route(async () => {
  const session = await requireUser();
  return ok({ bookings: await getBookingHistory(session.userId) });
});

const Body = z.object({ holdRef: z.string().min(1) });

/** Converts a live hold into a confirmed booking and emails the QR ticket. */
export const POST = route(async (req: NextRequest) => {
  const session = await requireUser();
  const { holdRef } = Body.parse(await req.json());

  const { bookingId, reference } = await confirmBooking({
    holdRef,
    userId: session.userId,
  });

  return ok({ bookingId, reference }, 201);
});
