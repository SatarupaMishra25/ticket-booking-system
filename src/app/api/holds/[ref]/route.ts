import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { releaseHold, getHoldForCheckout } from "@/lib/seats";
import { ok, fail, route } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ref: string }> };

/** Details of a live hold, used to render the checkout page. */
export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  const { ref } = await ctx.params;
  const session = await requireUser();

  const hold = await getHoldForCheckout(ref, session.userId);
  if (!hold) return fail("This hold has expired or does not exist.", 410);

  return ok(hold);
});

/** Explicitly abandon a hold, returning the seats immediately. */
export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const { ref } = await ctx.params;
  const session = await requireUser();

  const released = await releaseHold(ref, session.userId);
  return ok({ released });
});
