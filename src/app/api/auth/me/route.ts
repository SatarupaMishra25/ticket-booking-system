import { getSession } from "@/lib/auth";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const session = await getSession();
  return ok({ user: session });
});
