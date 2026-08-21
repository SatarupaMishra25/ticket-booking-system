import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { joinWaitlist, getWaitlistForUser } from "@/lib/waitlist";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

/** The signed-in customer's waitlist entries. */
export const GET = route(async () => {
  const session = await requireUser();
  return ok({ entries: await getWaitlistForUser(session.userId) });
});

const Body = z.object({
  eventId: z.string().min(1),
  categoryId: z.string().min(1),
});

/** Joins the queue for one seat category of one event. */
export const POST = route(async (req: NextRequest) => {
  const session = await requireUser();
  const { eventId, categoryId } = Body.parse(await req.json());

  const { entry, position } = await joinWaitlist({
    eventId,
    categoryId,
    userId: session.userId,
  });

  return ok({ id: entry.id, status: entry.status, position }, 201);
});
