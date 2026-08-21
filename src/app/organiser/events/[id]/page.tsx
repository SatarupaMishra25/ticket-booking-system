import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { money, dateTime } from "@/lib/format";
import { Badge, Card, Empty, PageTitle, btnGhost } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Booking summary and revenue breakdown for one event. */
export default async function EventSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/organiser/events/${id}`);
  if (session.role === "CUSTOMER") redirect("/events");

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      venue: { include: { categories: { orderBy: { name: "asc" } } } },
      pricing: true,
      organiser: { select: { name: true } },
    },
  });
  if (!event) notFound();
  if (session.role === "ORGANISER" && event.organiserId !== session.userId) notFound();

  const bookings = await prisma.booking.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      seats: { include: { venueSeat: { include: { category: true } } } },
    },
  });

  const confirmed = bookings.filter((b) => b.status === "CONFIRMED");

  const perCategory = event.venue.categories.map((c) => {
    const seats = confirmed.flatMap((b) => b.seats.filter((s) => s.venueSeat.categoryId === c.id));
    const price = event.pricing.find((p) => p.categoryId === c.id)?.price ?? 0;
    return {
      ...c,
      price,
      seatsSold: seats.length,
      revenue: seats.length * price,
    };
  });

  const seatTotals = await prisma.seat.groupBy({
    by: ["status"],
    where: { eventId: id },
    _count: { _all: true },
  });
  const countOf = (s: string) => seatTotals.find((t) => t.status === s)?._count._all ?? 0;
  const seatsTotal = seatTotals.reduce((s, t) => s + t._count._all, 0);

  const waitlist = await prisma.waitlist.groupBy({
    by: ["categoryId", "status"],
    where: { eventId: id },
    _count: { _all: true },
  });
  const wl = (cid: string, status: string) =>
    waitlist.find((w) => w.categoryId === cid && w.status === status)?._count._all ?? 0;

  const revenue = perCategory.reduce((s, c) => s + c.revenue, 0);

  const stats = [
    { label: "Revenue", value: money(revenue) },
    { label: "Confirmed bookings", value: String(confirmed.length) },
    { label: "Cancelled", value: String(bookings.length - confirmed.length) },
    { label: "Seats sold", value: `${countOf("BOOKED")}/${seatsTotal}` },
  ];

  return (
    <div>
      <Link href="/organiser" className="mb-5 inline-block text-sm opacity-60 hover:opacity-100">
        &larr; Dashboard
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge>{event.type}</Badge>
          <PageTitle
            title={event.title}
            subtitle={`${event.venue.name}, ${event.venue.city} · ${dateTime(event.startsAt)}`}
          />
        </div>
        <Link href={`/events/${event.id}`} className={btnGhost}>
          View seat map
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-xs uppercase tracking-wide opacity-50">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold">{s.value}</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide opacity-60">
        Revenue by category
      </h2>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 text-left dark:border-white/10">
            <tr className="opacity-55">
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Price</th>
              <th className="px-5 py-3 font-medium">Sold</th>
              <th className="px-5 py-3 font-medium">Waiting</th>
              <th className="px-5 py-3 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {perCategory.map((c) => (
              <tr key={c.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.colour }} />
                    {c.name}
                  </span>
                </td>
                <td className="px-5 py-3">{money(c.price)}</td>
                <td className="px-5 py-3">{c.seatsSold}</td>
                <td className="px-5 py-3">
                  {wl(c.id, "WAITING")}
                  {wl(c.id, "OFFERED") > 0 && (
                    <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                      {wl(c.id, "OFFERED")} offered
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right font-medium">{money(c.revenue)}</td>
              </tr>
            ))}
            <tr className="bg-black/[0.03] font-semibold dark:bg-white/5">
              <td className="px-5 py-3" colSpan={4}>
                Total
              </td>
              <td className="px-5 py-3 text-right">{money(revenue)}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide opacity-60">
        Bookings
      </h2>
      {bookings.length === 0 ? (
        <Empty>No bookings yet.</Empty>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-black/10 text-left dark:border-white/10">
              <tr className="opacity-55">
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Seats</th>
                <th className="px-5 py-3 font-medium">Booked</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr
                  key={b.id}
                  className={`border-b border-black/5 last:border-0 dark:border-white/5 ${
                    b.status === "CANCELLED" ? "opacity-45" : ""
                  }`}
                >
                  <td className="px-5 py-3 font-mono text-xs">{b.reference}</td>
                  <td className="px-5 py-3">
                    <div>{b.user.name}</div>
                    <div className="text-xs opacity-50">{b.user.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    {b.seats
                      .map((s) => `${s.venueSeat.rowLabel}${s.venueSeat.colNumber}`)
                      .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
                      .join(", ")}
                  </td>
                  <td className="px-5 py-3 text-xs opacity-60">{dateTime(b.createdAt)}</td>
                  <td className="px-5 py-3">{b.status}</td>
                  <td className="px-5 py-3 text-right">{money(b.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
