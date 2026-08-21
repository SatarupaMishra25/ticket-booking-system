# Ticket Booking System

A ticket booking platform for movies and concerts. Customers pick seats from a live seat map,
held seats release themselves if checkout is abandoned, sold-out shows have a waitlist that
hands cancelled seats to the next person automatically, and every confirmed booking emails a
QR-code ticket.

**Live demo:** _(add your deployed URL here)_

---

## Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Demo accounts](#demo-accounts)
- [Verifying the hard parts](#verifying-the-hard-parts)
- [Seat hold and TTL](#seat-hold-and-ttl)
- [Concurrency protection](#concurrency-protection)
- [Waitlist and time-limited offers](#waitlist-and-time-limited-offers)
- [Database schema](#database-schema)
- [API reference](#api-reference)
- [Project layout](#project-layout)
- [Deployment](#deployment)

---

## What it does

| Role          | Can do                                                                              |
| ------------- | ----------------------------------------------------------------------------------- |
| **Admin**     | Create venues, define seat categories (Premium / Standard / …) and the seat layout.  |
| **Organiser** | Publish movie or concert listings against a venue, set price per category, see bookings and revenue. |
| **Customer**  | Browse and filter events, pick seats on a visual map, check out, get a QR ticket by email, view history, cancel, join waitlists. |

Core behaviours:

- Selecting seats places a **hold with a configurable TTL** (default 10 minutes). Held seats show
  as unavailable to everyone else.
- Abandoning checkout **auto-releases** the seats — no background job required for correctness.
- Two customers cannot hold or book the same seat. Simultaneous attempts resolve to **exactly one
  winner**.
- A sold-out category can be **joined as a waitlist**, one queue per (event, category).
- Cancelling a booking **offers the freed seat to the next person in the queue** by email, with a
  time-limited link. If they do not act, it passes to the next person.
- Confirmed bookings **email a QR code** that encodes the booking reference.

---

## Tech stack

| Layer      | Choice                                       | Why                                                            |
| ---------- | -------------------------------------------- | -------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router), React 19, TypeScript | One codebase for API + UI, one deploy target                    |
| Database   | PostgreSQL (Neon) via Prisma                 | Row locks give the concurrency guarantee for free               |
| Auth       | bcrypt + JWT in an httpOnly cookie (`jose`)  | Role-based, no third-party dependency                           |
| Styling    | Tailwind CSS v4                              | No component library needed                                     |
| QR codes   | `qrcode`                                     | PNG for email, data URI for the browser                         |
| Email      | Nodemailer (SMTP) or Resend                  | SMTP reaches any recipient; Resend is the zero-setup fallback   |

Dependency count is deliberately small — no state manager, no UI kit, no ORM plugins.

---

## Setup

**Prerequisites:** Node.js 20+ and a PostgreSQL database. A free [Neon](https://neon.tech) project
works and needs no local install.

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env
#    then edit .env — at minimum set DATABASE_URL and JWT_SECRET

# 3. create the tables
npm run db:push

# 4. load demo data (venue, seat layout, two events, four users)
npm run db:seed

# 5. run
npm run dev
```

Open <http://localhost:3000>.

### Scripts

| Command                 | What it does                                                  |
| ----------------------- | ------------------------------------------------------------- |
| `npm run dev`           | Development server                                            |
| `npm run build`         | Generate the Prisma client and build for production           |
| `npm run start`         | Serve the production build                                    |
| `npm run db:push`       | Sync `schema.prisma` to the database                          |
| `npm run db:seed`       | Reset and reload demo data                                    |
| `npm run db:studio`     | Prisma Studio, a table browser                                |
| `npm run test:concurrency` | Race N customers for the same seats and assert one winner  |
| `npm run test:waitlist` | End-to-end waitlist offer / expiry / re-offer run             |
| `npm run test:email`    | Send one real ticket email to check credentials               |

---

## Environment variables

Every variable, with its purpose, lives in [`.env.example`](./.env.example). Summary:

| Variable                     | Required | Notes                                                          |
| ---------------------------- | -------- | -------------------------------------------------------------- |
| `DATABASE_URL`               | yes      | Postgres connection string. Use Neon's **pooled** string.       |
| `JWT_SECRET`                 | yes      | Long random string used to sign session cookies.                |
| `CRON_SECRET`                | yes      | Guards `/api/cron/sweep` from public access.                    |
| `EMAIL_PROVIDER`             | no       | `smtp` or `resend`. Auto-detects when unset.                    |
| `SMTP_HOST` / `SMTP_PORT`    | no       | Defaults to `smtp.gmail.com` / `465`.                           |
| `SMTP_USER` / `SMTP_PASS`    | no       | For Gmail, `SMTP_PASS` is a 16-character **App Password**.      |
| `RESEND_API_KEY`             | no       | Alternative to SMTP.                                            |
| `EMAIL_FROM`                 | no       | Sender identity.                                                |
| `NEXT_PUBLIC_APP_URL`        | yes      | Used to build the waitlist offer link inside emails.            |
| `SEAT_HOLD_TTL_MINUTES`      | no       | Default `10`.                                                   |
| `WAITLIST_OFFER_TTL_MINUTES` | no       | Default `30`.                                                   |

Generate the secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> **Email note.** With no provider configured the app still runs — it logs what it would have sent
> and bookings succeed normally. Email failure never rolls back a committed booking.
>
> Resend's free tier, without a verified domain, only delivers to the address that owns the Resend
> account. Use SMTP if you need tickets to reach arbitrary recipients.

---

## Demo accounts

Created by `npm run db:seed`. Password for all of them: `Password123!`

| Email                 | Role      |
| --------------------- | --------- |
| `admin@demo.com`      | ADMIN     |
| `organiser@demo.com`  | ORGANISER |
| `customer@demo.com`   | CUSTOMER  |
| `customer2@demo.com`  | CUSTOMER  |

Admin accounts cannot be self-registered; they are seeded.

---

## Verifying the hard parts

Two scripts assert the behaviours that are easiest to get wrong. Both run against the real
database.

```bash
npm run test:concurrency
```

```
TEST 1 — 8 DIFFERENT customers race for the same seats
    winners=1  rejected=7  crashed=0
    seats end up under 1 holdRef held by 1 user
    PASS

TEST 2 — the SAME customer retries concurrently (idempotency)
    succeeded=5/5  distinct holdRefs returned=1
    PASS
```

```bash
npm run test:waitlist
```

Walks the full flow: book → two customers join the queue → cancel → auto-offer to first in line →
let it expire → auto-re-offer to the second → redeem → confirm a stale link is refused.

To see a hold expire by hand, set `SEAT_HOLD_TTL_MINUTES="1"`, select seats, and leave the
checkout page open.

---

## Seat hold and TTL

A hold is **two columns on the seat row**, not a separate table and not an in-memory timer:

```prisma
status        SeatStatus   // AVAILABLE | HELD | BOOKED
heldByUserId  String?
holdRef       String?      // groups the seats held in one checkout
holdExpiresAt DateTime?
```

The whole mechanism rests on one rule, applied identically in every read and every write:

```sql
-- a seat is free when...
status = 'AVAILABLE'
   OR (status = 'HELD' AND "holdExpiresAt" <= now())
```

Because expiry is a **query condition** rather than a scheduled mutation, a lapsed hold is *never*
observable as taken — not by the seat map, not by another customer's hold attempt, not by the
availability counts on the events list. There is no window in which a stale row misleads anyone,
so nothing depends on a job running on time.

`/api/cron/sweep` still runs every minute (see [`vercel.json`](./vercel.json)) but only to blank
out stale columns so the rows read cleanly in admin views. **Turning the cron off does not break
booking.** It *is* load-bearing for waitlist offers — see below.

### Lifecycle

```
        select seats
             |
             v
   +---------------------+   confirm    +-----------+
   |  HELD (TTL running) | -----------> |  BOOKED   |
   +---------------------+              +-----------+
      |            |                          |
      | TTL lapses | customer clicks          | customer cancels
      | or abandon | "release seats"          v
      v            v                    +-----------+
        AVAILABLE  <-------------------  offered to |
                                        | waitlist  |
                                        +-----------+
```

---

## Concurrency protection

Two customers clicking the same seat at the same instant is resolved **in Postgres**, not in
application code.

```sql
UPDATE seats
   SET status = 'HELD', "heldByUserId" = $1,
       "holdRef" = $2, "holdExpiresAt" = $3
 WHERE "eventId" = $4
   AND id IN ($5...)
   AND (status = 'AVAILABLE'
        OR (status = 'HELD' AND "holdExpiresAt" <= now()))
RETURNING id;
```

Two protections stack:

1. **Row locks.** The `UPDATE` takes a lock on each matched row. A second transaction targeting the
   same seat blocks until the first commits, then re-evaluates the `WHERE` clause against the new
   row version, sees a live hold, and matches nothing.
2. **All-or-nothing.** If `RETURNING` yields fewer rows than were requested, the handler throws,
   which rolls the statement back. A partial hold — three seats requested, two won — is never
   committed.

The loser receives `409` and a plain message; the seat map refreshes and they pick again.

The same guard runs again at booking time, so a hold that lapsed between checkout rendering and the
confirm click cannot be converted:

```sql
UPDATE seats SET status = 'BOOKED', "bookingId" = $1
 WHERE "holdRef" = $2 AND "heldByUserId" = $3
   AND status = 'HELD' AND "holdExpiresAt" > now()
RETURNING id;
```

Retrying an identical hold request (double-click, retried request after a dropped response) is
**idempotent**: the original hold is returned rather than a spurious conflict.

---

## Waitlist and time-limited offers

One FIFO queue per `(event, seatCategory)`, ordered by `createdAt`.

```
booking cancelled
       |
       v
 seats freed  --->  for each seat: find next WAITING entry for its category
                              |
                              v
              claim the queue entry   (UPDATE ... WHERE status='WAITING')
                              |
                              v
              hold the seat for them  (the SAME hold columns, holdRef = "offer_<token>")
                              |
                              v
              email a link /offer/<token>, valid WAITLIST_OFFER_TTL_MINUTES
                     |                              |
              claimed in time                 not claimed
                     |                              |
                     v                              v
             CONVERTED -> booking          cron marks EXPIRED,
                                           frees the seat, offers
                                           it to the next person
```

The design point worth noting: **an offer is a seat hold.** It writes the same `status`,
`heldByUserId`, `holdRef` and `holdExpiresAt` columns as an ordinary checkout, with the `holdRef`
prefixed `offer_`. So an unclaimed offer expires by exactly the same rule as an abandoned
checkout, and redeeming an offer runs through exactly the same `confirmBooking` path. One
mechanism, two entry points, no duplicated expiry logic.

Ordering is protected the same way holds are: `UPDATE ... WHERE status = 'WAITING'` means two
concurrent cancellations cannot hand one person two seats, and the sweep re-reads the queue after
each claim.

**This is the part that needs the cron.** Nobody makes a request when an offer lapses, so
`/api/cron/sweep` is what walks the seat down the queue. Without it, an ignored offer would hold
its seat until the sweeper eventually ran.

---

## Database schema

```
users ──< bookings >── events ──> venues ──< seat_categories
  │                       │          │              │
  │                       │          └──< venue_seats >┘
  │                       │                   │
  └──< waitlist >─────────┘                   │
                          events ──< seats >──┘
```

| Table             | Purpose                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| `users`           | Account + `role` (CUSTOMER / ORGANISER / ADMIN), bcrypt password hash.          |
| `venues`          | A physical place. Owned by admins.                                             |
| `seat_categories` | A seat class within a venue (Premium, Standard). Carries a display colour.      |
| `venue_seats`     | The seat **layout template** — one row per physical seat (`rowLabel`, `colNumber`). Not bookable. |
| `events`          | A show: organiser, venue, type (MOVIE / CONCERT), `startsAt`.                   |
| `event_pricing`   | Price of one category for one event, in paise.                                 |
| `seats`           | **One bookable seat per (event, venue seat).** Holds the status and hold columns. |
| `bookings`        | A confirmed or cancelled purchase, with a unique `reference` (the QR payload).  |
| `waitlist`        | One queue entry per (event, category, user), plus the offer token and expiry.   |

Key constraints and indexes:

| Constraint                                            | Why                                              |
| ----------------------------------------------------- | ------------------------------------------------ |
| `seats @@unique([eventId, venueSeatId])`               | A seat cannot be duplicated within an event.      |
| `seats @@index([eventId, status])`                     | Seat map and availability counts.                 |
| `seats @@index([holdExpiresAt])`                       | The expiry sweep and the free-seat predicate.     |
| `waitlist @@unique([eventId, categoryId, userId])`     | One queue place per person per category.          |
| `waitlist @@index([eventId, categoryId, status, createdAt])` | Finding the next person in FIFO order.     |
| `waitlist.offerToken @unique`                          | The offer link is looked up by token.             |
| `bookings.reference @unique`                           | The QR payload must resolve to one booking.       |

Money is stored as **integer paise**, never floats.

The authoritative definition is [`prisma/schema.prisma`](./prisma/schema.prisma).

---

## API reference

All responses are JSON. Errors are uniformly `{ "error": "human readable message" }` with a
meaningful status. Auth is a signed httpOnly cookie set at login.

### Auth

| Method | Path                 | Access | Body / notes                                             |
| ------ | -------------------- | ------ | -------------------------------------------------------- |
| `POST` | `/api/auth/register` | public | `{ name, email, password, role? }` — role is CUSTOMER or ORGANISER |
| `POST` | `/api/auth/login`    | public | `{ email, password }`                                     |
| `POST` | `/api/auth/logout`   | any    | —                                                         |
| `GET`  | `/api/auth/me`       | any    | Current session, or `{ user: null }`                      |

### Venues

| Method | Path           | Access | Body / notes                                                        |
| ------ | -------------- | ------ | ------------------------------------------------------------------- |
| `GET`  | `/api/venues`  | public | Venues with categories and seat counts                              |
| `POST` | `/api/venues`  | ADMIN  | `{ name, city, address, categories: [{ name, colour, rows[], seatsPerRow }] }` |

Creating a venue generates its `venue_seats` rows. Each row label may belong to only one category.

### Events

| Method | Path                        | Access            | Body / notes                                          |
| ------ | --------------------------- | ----------------- | ----------------------------------------------------- |
| `GET`  | `/api/events`               | public            | Filters: `?q=`, `?type=MOVIE\|CONCERT`, `?city=`, `?mine=1`, `?past=1` |
| `POST` | `/api/events`               | ORGANISER / ADMIN | `{ venueId, title, type, description, startsAt, pricing: { categoryId: paise } }` |
| `GET`  | `/api/events/:id`           | public            | **Full seat map.** Polled by the seat map page.        |
| `GET`  | `/api/events/:id/summary`   | owning ORGANISER / ADMIN | Revenue, seat totals, waitlist counts, booking list |

Publishing an event materialises one `seats` row per venue seat.

The seat map returns per-seat `status` of `AVAILABLE`, `HELD`, `BOOKED`, or `HELD_BY_ME` — the
caller's own holds are distinguishable from other people's.

### Holds

| Method   | Path              | Access   | Body / notes                                        |
| -------- | ----------------- | -------- | --------------------------------------------------- |
| `POST`   | `/api/holds`      | signed in | `{ eventId, seatIds[] }` → `{ holdRef, expiresAt, ttlMinutes }`. `409` if any seat was taken. Max 10 seats. |
| `GET`    | `/api/holds/:ref` | owner    | Checkout lines and total. `410` once expired.        |
| `DELETE` | `/api/holds/:ref` | owner    | Release immediately                                  |

### Bookings

| Method | Path                        | Access          | Body / notes                                        |
| ------ | --------------------------- | --------------- | --------------------------------------------------- |
| `GET`  | `/api/bookings`             | signed in       | The caller's booking history                        |
| `POST` | `/api/bookings`             | signed in       | `{ holdRef }` → `{ bookingId, reference }`; emails the QR ticket. `409` if the hold lapsed. |
| `GET`  | `/api/bookings/:id`         | owner / ADMIN   | One booking plus `qrDataUrl`                        |
| `POST` | `/api/bookings/:id/cancel`  | owner / ADMIN   | → `{ released, offersSent }`; triggers waitlist handover |

### Waitlist

| Method   | Path                 | Access    | Body / notes                                   |
| -------- | -------------------- | --------- | ---------------------------------------------- |
| `GET`    | `/api/waitlist`      | signed in | The caller's entries, with live queue positions |
| `POST`   | `/api/waitlist`      | signed in | `{ eventId, categoryId }` → `{ id, position }`  |
| `DELETE` | `/api/waitlist/:id`  | owner     | Leave the queue                                 |

### Offers

| Method | Path                  | Access               | Body / notes                                   |
| ------ | --------------------- | -------------------- | ---------------------------------------------- |
| `GET`  | `/api/offers/:token`  | public               | Offer details, whether expired, whose it is    |
| `POST` | `/api/offers/:token`  | the offered customer | Redeem → `{ bookingId, reference }`            |

### Cron

| Method      | Path               | Access        | Body / notes                                    |
| ----------- | ------------------ | ------------- | ----------------------------------------------- |
| `GET/POST`  | `/api/cron/sweep`  | `CRON_SECRET` | Blanks lapsed holds; expires and re-offers stale waitlist offers |

Authenticate with `Authorization: Bearer $CRON_SECRET`, or `?secret=` for a manual run.

---

## Project layout

```
prisma/
  schema.prisma          database schema — the source of truth
  seed.ts                demo venue, layout, events, users
scripts/
  concurrency-test.ts    races N customers for the same seats
  waitlist-test.ts       end-to-end offer / expiry / re-offer
  email-test.ts          sends one real ticket email
src/
  lib/
    seats.ts             holds, the free-seat rule, seat map      <- core
    bookings.ts          confirm, cancel, reference generation    <- core
    waitlist.ts          queue, offers, expiry sweep              <- core
    auth.ts              bcrypt, JWT sessions, role guards
    email.ts             SMTP/Resend delivery + QR rendering
    api.ts               error mapping shared by every route
    config.ts            TTLs and app URL
  app/
    api/...              17 route handlers
    events/[id]/         seat map page
    checkout/[ref]/      hold countdown and confirm
    offer/[token]/       time-limited waitlist claim
    organiser/           dashboard and per-event revenue
    admin/venues/        venue and layout management
  components/            SeatMap, Checkout, forms, UI primitives
```

---

## Deployment

Deployed on Vercel; any Node host works.

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add every variable from `.env.example` under **Settings → Environment Variables**. Set
   `NEXT_PUBLIC_APP_URL` to the deployed URL, or waitlist offer links will point at localhost.
4. Deploy. `npm run build` runs `prisma generate` automatically.
5. Run `npm run db:push` and `npm run db:seed` once against the production database.

`vercel.json` registers the sweep cron at one-minute intervals. On other hosts, call
`/api/cron/sweep` from any scheduler, or omit it — only waitlist offer expiry depends on it.

---

## Licence

MIT — see [LICENSE](./LICENSE).
