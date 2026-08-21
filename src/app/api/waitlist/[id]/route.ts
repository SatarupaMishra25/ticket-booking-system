import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { leaveWaitlist } from "@/lib/waitlist";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Leaves the queue. */
export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const session = await requireUser();

  await leaveWaitlist(id, session.userId);
  return ok({ ok: true });
});
