import { NextRequest } from "next/server";
import { sweepExpiredHolds } from "@/lib/seats";
import { sweepExpiredOffers } from "@/lib/waitlist";
import { ok, fail, route } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Housekeeping sweep, run on a schedule (see vercel.json).
 *
 * Two jobs, with very different importance:
 *
 *   Expired holds  — purely cosmetic.  Availability is decided by a query
 *                    condition (`status = AVAILABLE OR holdExpiresAt <= now()`),
 *                    so a lapsed hold already reads as free everywhere.  This
 *                    only blanks the stale columns.
 *
 *   Expired offers — load-bearing.  A waitlist offer that nobody claimed has
 *                    to be walked down the queue to the next person, and only
 *                    a scheduled pass can do that with no user request to
 *                    piggyback on.
 *
 * Protected by CRON_SECRET, sent either as `Authorization: Bearer <secret>`
 * (what Vercel Cron does) or as `?secret=` for manual runs.
 */
async function handler(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("CRON_SECRET is not configured on the server.", 500);

  const header = req.headers.get("authorization");
  const provided = header?.startsWith("Bearer ")
    ? header.slice(7)
    : req.nextUrl.searchParams.get("secret");

  if (provided !== secret) return fail("Unauthorised.", 401);

  const holdsReleased = await sweepExpiredHolds();
  const { expired, reoffered } = await sweepExpiredOffers();

  return ok({
    holdsReleased,
    offersExpired: expired,
    seatsReoffered: reoffered,
    ranAt: new Date().toISOString(),
  });
}

export const GET = route(handler);
export const POST = route(handler);
