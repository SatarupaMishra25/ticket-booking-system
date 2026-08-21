import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { money, dateTime } from "@/lib/format";
import { Badge, Card, Empty, PageTitle, input } from "@/components/ui";

export const dynamic = "force-dynamic";

type Search = { q?: string; type?: string; city?: string };

/**
 * Event browse with filters.  Rendered on the server and filtered through the
 * URL, so a filtered list is a shareable link and works without JavaScript.
 */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const type = sp.type === "MOVIE" || sp.type === "CONCERT" ? sp.type : undefined;
  const city = sp.city?.trim() || undefined;

  const events = await prisma.event.findMany({
    where: {
      startsAt: { gte: new Date() },
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
      ...(type ? { type } : {}),
      ...(city ? { venue: { city: { equals: city, mode: "insensitive" as const } } } : {}),
    },
    orderBy: { startsAt: "asc" },
    include: {
      venue: { include: { categories: { orderBy: { name: "asc" } } } },
      pricing: true,
      organiser: { select: { name: true } },
      _count: { select: { seats: true } },
    },
  });

  // Availability uses the same lazy-expiry rule as the seat map: a lapsed hold
  // counts as free.
  const now = new Date();
  const grouped = await prisma.seat.groupBy({
    by: ["eventId"],
    where: {
      eventId: { in: events.map((e) => e.id) },
      OR: [{ status: "AVAILABLE" }, { status: "HELD", holdExpiresAt: { lte: now } }],
    },
    _count: { _all: true },
  });
  const availableBy = new Map(grouped.map((g) => [g.eventId, g._count._all]));

  const cities = await prisma.venue.findMany({
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  });

  return (
    <div>
      <PageTitle title="Events" subtitle="Movies and concerts you can book right now." />

      <form className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by title..."
          className={input}
          aria-label="Search events"
        />
        <select name="type" defaultValue={type ?? ""} className={input} aria-label="Event type">
          <option value="">All types</option>
          <option value="MOVIE">Movies</option>
          <option value="CONCERT">Concerts</option>
        </select>
        <select name="city" defaultValue={city ?? ""} className={input} aria-label="City">
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.city} value={c.city}>
              {c.city}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
        >
          Filter
        </button>
      </form>

      {events.length === 0 ? (
        <Empty>
          No events match that.{" "}
          {(q || type || city) && (
            <Link href="/events" className="underline">
              Clear filters
            </Link>
          )}
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const available = availableBy.get(e.id) ?? 0;
            const soldOut = available === 0;
            const cheapest = Math.min(...e.pricing.map((p) => p.price));

            return (
              <Link key={e.id} href={`/events/${e.id}`} className="group">
                <Card className="h-full transition group-hover:border-black/25 dark:group-hover:border-white/25">
                  <div className="flex items-start justify-between gap-3">
                    <Badge>{e.type}</Badge>
                    {soldOut ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                        Sold out
                      </span>
                    ) : (
                      <span className="text-[11px] opacity-55">{available} seats left</span>
                    )}
                  </div>

                  <h2 className="mt-3 font-semibold leading-snug">{e.title}</h2>
                  <p className="mt-1.5 line-clamp-2 text-sm opacity-60">{e.description}</p>

                  <dl className="mt-4 space-y-1 text-sm opacity-70">
                    <div className="flex justify-between gap-3">
                      <dt className="opacity-70">When</dt>
                      <dd>{dateTime(e.startsAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="opacity-70">Venue</dt>
                      <dd className="truncate">
                        {e.venue.name}, {e.venue.city}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="opacity-70">From</dt>
                      <dd className="font-medium">{money(cheapest)}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {e.venue.categories.map((c) => (
                      <Badge key={c.id} colour={c.colour}>
                        {c.name}
                      </Badge>
                    ))}
                  </div>

                  <p className="mt-4 text-sm font-medium underline-offset-4 group-hover:underline">
                    {soldOut ? "Join the waitlist" : "Choose seats"} &rarr;
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
