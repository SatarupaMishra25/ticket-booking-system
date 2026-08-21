/** Runtime configuration, read once from the environment. */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** How long a seat stays HELD during checkout before it auto-releases. */
export const SEAT_HOLD_TTL_MINUTES = num("SEAT_HOLD_TTL_MINUTES", 10);

/** How long a waitlisted customer has to act on an offered seat. */
export const WAITLIST_OFFER_TTL_MINUTES = num("WAITLIST_OFFER_TTL_MINUTES", 30);

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export const minutesFromNow = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000);
