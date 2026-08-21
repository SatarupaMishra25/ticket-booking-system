import Link from "next/link";
import { getSession } from "@/lib/auth";
import { SEAT_HOLD_TTL_MINUTES, WAITLIST_OFFER_TTL_MINUTES } from "@/lib/config";
import { btn, btnGhost, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    title: "Live seat map",
    body: "Every show has its own seat grid. Available, held and booked seats are colour-coded and refresh while you browse, so you see what other customers are doing.",
  },
  {
    title: `Holds expire in ${SEAT_HOLD_TTL_MINUTES} minutes`,
    body: "Selecting seats reserves them just long enough to check out. Walk away and they return to the pool on their own — no seat is ever stranded.",
  },
  {
    title: "One seat, one winner",
    body: "Two people clicking the same seat at the same instant is resolved in the database, not in the app. Exactly one succeeds; the other is told immediately.",
  },
  {
    title: "Waitlists that act on their own",
    body: `Sold out? Join the queue. When somebody cancels, the seat is offered to whoever is next, by email, for ${WAITLIST_OFFER_TTL_MINUTES} minutes — then it moves down the line.`,
  },
  {
    title: "QR tickets by email",
    body: "Confirmed bookings send a ticket whose QR code encodes the booking reference, ready to scan at the gate.",
  },
  {
    title: "Built for three roles",
    body: "Admins shape venues and seat categories, organisers publish shows and watch revenue, customers book and cancel.",
  },
];

export default async function HomePage() {
  const session = await getSession();

  return (
    <div className="space-y-12">
      <section className="pt-6">
        <p className="text-xs uppercase tracking-[0.2em] opacity-50">Movies &amp; concerts</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Pick your seat.
          <br />
          <span className="opacity-45">We hold it while you decide.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed opacity-70">
          A ticket booking platform with a real seat map, seat holds that expire on their own,
          and a waitlist that hands cancelled seats to the next person automatically.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/events" className={btn}>
            Browse events
          </Link>
          {!session && (
            <Link href="/register" className={btnGhost}>
              Create an account
            </Link>
          )}
          {session?.role === "ORGANISER" && (
            <Link href="/organiser" className={btnGhost}>
              Organiser dashboard
            </Link>
          )}
          {session?.role === "ADMIN" && (
            <Link href="/admin/venues" className={btnGhost}>
              Manage venues
            </Link>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <h2 className="text-sm font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed opacity-65">{f.body}</p>
          </Card>
        ))}
      </section>

      {!session && (
        <section className="rounded-xl border border-dashed border-black/15 p-5 text-sm dark:border-white/15">
          <p className="font-medium">Demo accounts</p>
          <p className="mt-1 opacity-60">
            Seeded by <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">npm run db:seed</code>.
            Password for all of them:{" "}
            <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">Password123!</code>
          </p>
          <ul className="mt-3 grid gap-1 opacity-70 sm:grid-cols-3">
            <li>admin@demo.com — admin</li>
            <li>organiser@demo.com — organiser</li>
            <li>customer@demo.com — customer</li>
          </ul>
        </section>
      )}
    </div>
  );
}
