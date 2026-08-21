# Keeping the sweep running

`/api/cron/sweep` does two things:

| Job                | Load-bearing? | Why                                                                 |
| ------------------ | ------------- | ------------------------------------------------------------------- |
| Release lapsed holds | No          | Availability is a query predicate, so a lapsed hold already reads as free. This only tidies the columns. |
| Expire waitlist offers | **Yes**   | Nobody makes a request when an offer simply lapses, so something has to walk the seat down the queue. |

## Three layers, so no single one has to be perfect

1. **Opportunistic sweep** (`src/lib/sweep.ts`). Read paths that care about offer
   freshness — the seat map poll, the waitlist page, the offer page — nudge the
   sweep along. Throttled to once a minute per instance and never awaited, so it
   costs the request nothing. While anyone is using the site, offers expire on time.

2. **Vercel Cron** (`vercel.json`). Set to once daily because **Vercel's Hobby plan
   only permits one cron run per day**. On Pro, change the schedule to `* * * * *`
   for a proper per-minute sweep.

3. **External pinger** (recommended on free hosting). Any uptime service can call
   the endpoint on a real schedule:

   ```
   URL:      https://YOUR-APP.vercel.app/api/cron/sweep?secret=YOUR_CRON_SECRET
   Method:   GET
   Interval: every 3-5 minutes
   ```

   Free options: [cron-job.org](https://cron-job.org) (1-minute granularity),
   [UptimeRobot](https://uptimerobot.com) (5-minute).

## Bonus: this also stops the database sleeping

Neon's free tier suspends a database after ~5 minutes idle, which adds a
one-off delay of a second or two to the next request. A pinger on a 3-5 minute
interval keeps the connection warm, so a visitor arriving at any hour gets a
fast first page rather than a cold start.

That is the main reason to set up layer 3 even though layer 1 already covers
offer expiry during normal use.
