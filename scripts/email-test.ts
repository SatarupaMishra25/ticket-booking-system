/** Sends one real ticket email, to check the provider credentials work. */
import { sendTicketEmail } from "../src/lib/email";

const to = process.argv[2];
if (!to) {
  console.error("usage: npx tsx scripts/email-test.ts you@example.com");
  process.exit(1);
}

sendTicketEmail({
  to,
  name: "Test User",
  reference: "TBS-TESTMAIL",
  eventTitle: "Interstellar — IMAX Re-release",
  venue: "PVR Grand Cinema, Bengaluru",
  startsAt: new Date(Date.now() + 3 * 24 * 3600_000),
  seats: ["A1", "A2"],
  total: 90000,
}).then((r) => {
  console.log(r.sent ? `SENT to ${to}` : `NOT SENT — ${r.reason}`);
  process.exit(r.sent ? 0 : 1);
});
