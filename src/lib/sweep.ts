import { sweepExpiredHolds } from "@/lib/seats";
import { sweepExpiredOffers } from "@/lib/waitlist";

/**
 * Opportunistic housekeeping.
 *
 * Expiring a waitlist offer is the one part of the system that cannot wait for
 * a user request — nobody makes one when an offer simply lapses.  A scheduled
 * sweep is the proper answer, but free hosting tiers often cannot run a job
 * every minute (Vercel's Hobby plan allows one run per day), which would leave
 * offers sitting on seats far longer than their stated deadline.
 *
 * So read paths that care about offer freshness also nudge the sweep along,
 * throttled per server instance and never awaited, so it costs the request
 * nothing.  Correctness still does not depend on it: seat *availability* is a
 * query predicate (see `seats.ts`), and the scheduled sweep remains the
 * backstop for a completely idle site.
 */

const THROTTLE_MS = 60_000;

let lastRun = 0;
let inFlight = false;

export function maybeSweep(): void {
  const now = Date.now();
  if (inFlight || now - lastRun < THROTTLE_MS) return;

  lastRun = now;
  inFlight = true;

  void (async () => {
    try {
      await sweepExpiredOffers();
      await sweepExpiredHolds();
    } catch (err) {
      // Housekeeping must never surface as a request failure.
      console.error("[sweep] background pass failed:", err);
    } finally {
      inFlight = false;
    }
  })();
}
