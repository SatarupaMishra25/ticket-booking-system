import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getSeatMap } from "@/lib/seats";
import { ok, fail, route } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Full seat map for one event.  The seat-map page polls this, which is how the
 * grid stays in step with other customers' holds, bookings and cancellations.
 */
export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const session = await getSession();

  const map = await getSeatMap(id, session?.userId);
  if (!map) return fail("Event not found.", 404);

  return ok(map);
});
