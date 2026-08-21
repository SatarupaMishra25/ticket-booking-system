import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { money, dateTime } from "@/lib/format";
import { Badge, Card, Empty, PageTitle, btn } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OrganiserPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/organiser");
  if (session.role === "CUSTOMER") redirect("/events");

  // Admins oversee every event; organisers see only their own.
  const events = await prisma.event.findMany({
    where: session.role === "ORGANISER" ? { organiserId: session.userId } : {},
    orderBy: { startsAt: "asc" },
    include: {
      venue: true,
      pricing: true,
      organiser: { select: { name: true } },
      _count: { select: { seats: true } },
    },
  });

  // Revenue per event, from confirmed bookings only.
  const revenue = await prisma.booking.groupBy({
    by: ["eventId"],
    where: { eventId: { in: events.map((e) => e.id) }, status: "CONFIRMED" },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });
  const revenueBy = new Map(
    revenue.map((r) => [r.eventId, { total: r._sum.totalAmount ?? 0, bookings: r._count._all }]),
  );

  const sold = await prisma.seat.groupBy({
    by: ["eventId"],
    where: { eventId: { in: events.map((e) => e.id) }, status: "BOOKED" },
    _count: { _all: true },
  });
  const soldBy = new Map(sold.map((s) => [s.eventId, s._count._all]));

  const grandTotal = [...revenueBy.values()].reduce((s, r) => s + r.total, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title={session.role === "ADMIN" ? "All events" : "Your events"}
          subtitle="Bookings and revenue at a glance."
        />
        <Link href="/organiser/events/new" className={btn}>
          Create event
        </Link>
      </div>

      {events.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-xs uppercase tracking-wide opacity-50">Events</p>
            <p className="mt-1 text-2xl font-semibold">{events.length}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide opacity-50">Confirmed bookings</p>
            <p className="mt-1 text-2xl font-semibold">
              {[...revenueBy.values()].reduce((s, r) => s + r.bookings, 0)}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide opacity-50">Revenue</p>
            <p className="mt-1 text-2xl font-semibold">{money(grandTotal)}</p>
          </Card>
        </div>
      )}

      {events.length === 0 ? (
        <Empty>
          No events yet.{" "}
          <Link href="/organiser/events/new" className="underline">
            Create your first one
          </Link>
        </Empty>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const r = revenueBy.get(e.id) ?? { total: 0, bookings: 0 };
            const seatsSold = soldBy.get(e.id) ?? 0;
            const pct = e._count.seats ? Math.round((seatsSold / e._count.seats) * 100) : 0;

            return (
              <Link key={e.id} href={`/organiser/events/${e.id}`} className="block">
                <Card className="transition hover:border-black/25 dark:hover:border-white/25">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{e.type}</Badge>
                        {session.role === "ADMIN" && (
                          <span className="text-[11px] opacity-50">by {e.organiser.name}</span>
                        )}
                      </div>
                      <h2 className="mt-2 font-semibold leading-snug">{e.title}</h2>
                      <p className="mt-1 text-sm opacity-60">
                        {e.venue.name}, {e.venue.city} · {dateTime(e.startsAt)}
                      </p>
                    </div>

                    <div className="text-right text-sm">
                      <p className="font-semibold">{money(r.total)}</p>
                      <p className="opacity-55">{r.bookings} bookings</p>
                      <p className="mt-1 opacity-55">
                        {seatsSold}/{e._count.seats} seats ({pct}%)
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
