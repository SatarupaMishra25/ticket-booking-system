# System Design Write-up

Ticket Booking System — seat holds, concurrency, and waitlist auto-assignment.

## The central decision

Seat state lives in **one table, one row per bookable seat**, and every rule about that state is
expressed as a SQL predicate rather than as application logic or a background job. Everything
below follows from that.

```prisma
model Seat {
  status        SeatStatus  // AVAILABLE | HELD | BOOKED
  heldByUserId  String?
  holdRef       String?     // groups seats held in one checkout
  holdExpiresAt DateTime?
  bookingId     String?
  @@unique([eventId, venueSeatId])
}
```

A separate `VenueSeat` table stores the physical layout as a template; `Seat` rows are
materialised per event when an organiser publishes it. That split lets one venue host many shows
without duplicating layout data, and gives the frontend a simple `(rowLabel, colNumber)` grid to
render.

## Seat hold and TTL

Selecting seats writes `status = HELD`, the holder, a `holdRef` grouping the selection, and
`holdExpiresAt = now() + TTL` (configurable, default 10 minutes).

The mechanism rests on a single rule applied identically everywhere a seat is read or written:

```sql
status = 'AVAILABLE' OR (status = 'HELD' AND "holdExpiresAt" <= now())
```

Because expiry is a **query condition rather than a scheduled mutation**, a lapsed hold is never
observable as taken — not by the seat map, not by another customer's hold attempt, not by the
availability counts on the events list. There is no window in which a stale row misleads anyone.

This is the design's main leverage. The obvious alternative — a cron job that flips expired rows
back to `AVAILABLE` — makes correctness depend on a job running on time. If the scheduler is
late, seats sit stranded and customers see false sell-outs. Here the sweeper exists
(`/api/cron/sweep`, every minute) but only tidies stale columns for admin readability. **Switching
it off does not break booking.**

Abandonment therefore needs no detection: the customer simply stops, and the TTL elapses. The
checkout page shows a countdown, but that is presentation — the server re-validates the hold on
submit, so a drifting client clock buys nobody extra time.

## Concurrency protection

Two customers clicking the same seat simultaneously is resolved in Postgres, not in Node.

```sql
UPDATE seats
   SET status = 'HELD', "heldByUserId" = $1, "holdRef" = $2, "holdExpiresAt" = $3
 WHERE "eventId" = $4 AND id IN ($5...)
   AND (status = 'AVAILABLE' OR (status = 'HELD' AND "holdExpiresAt" <= now()))
RETURNING id;
```

Two guarantees stack:

1. **Row locks.** The `UPDATE` locks each matched row. A competing transaction blocks until the
   first commits, then re-evaluates its `WHERE` clause against the new row version, sees a live
   hold, and matches zero rows. Postgres serialises the race; no application-level mutex, queue,
   or optimistic-retry loop is involved.
2. **All-or-nothing.** If `RETURNING` yields fewer rows than requested, the handler throws, rolling
   the statement back. A partial hold — three seats asked for, two won — is never committed. The
   loser gets `409` and re-picks against a refreshed map.

The identical predicate guards the hold-to-booking conversion, so a hold that lapsed between
rendering checkout and clicking confirm cannot be converted. A repeated identical hold request
(double-click, retry after a dropped response) is made idempotent by returning the caller's
existing hold instead of a spurious conflict.

A verification script races eight distinct customers for the same seats and asserts exactly one
winner, seven clean rejections, zero crashes, and one surviving `holdRef`.

## Waitlist and time-limited offers

Each `(event, seatCategory)` has a FIFO queue ordered by `createdAt`. When a booking is cancelled,
its seats are freed and each is walked down the queue.

The key move: **an offer is a seat hold.** Claiming a queue entry writes the same four columns as
an ordinary checkout, with `holdRef = "offer_<token>"` and `holdExpiresAt` set to the offer
deadline. Consequences fall out for free — an unclaimed offer expires by the same predicate as an
abandoned checkout, the seat map already renders it correctly as unavailable, and redeeming an
offer runs through the same `confirmBooking` path with the same re-validation. One mechanism, two
entry points, no duplicated expiry logic.

Queue integrity uses the same conditional-update trick: `UPDATE waitlist ... WHERE status =
'WAITING'` means two concurrent cancellations cannot hand one person two seats. If the seat
vanishes between claiming the entry and holding the seat, the person is restored to their original
position rather than losing their place.

Offer expiry is the one part that genuinely needs the scheduler — no user request happens when an
offer simply lapses. The sweep marks the entry `EXPIRED`, frees the seat only if it still carries
that offer's `holdRef`, and re-offers it to the next person, repeating until the queue is dry.

**Word count: 776** (693 excluding code blocks)
