import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { money, dateTime } from "@/lib/format";
import { Empty, btn } from "@/components/ui";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
const images = ["/events/midnight-symphony.webp", "/events/modern-movements.webp", "/events/stellar-screening.webp"];

export default async function OrganiserPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/organiser");
  if (session.role === "CUSTOMER") redirect("/events");
  const events = await prisma.event.findMany({ where: session.role === "ORGANISER" ? { organiserId: session.userId } : {}, orderBy: { startsAt: "asc" }, include: { venue: true, pricing: true, organiser: { select: { name: true } }, _count: { select: { seats: true } } } });
  const revenue = await prisma.booking.groupBy({ by: ["eventId"], where: { eventId: { in: events.map((e) => e.id) }, status: "CONFIRMED" }, _sum: { totalAmount: true }, _count: { _all: true } });
  const revenueBy = new Map(revenue.map((row) => [row.eventId, { total: row._sum.totalAmount ?? 0, bookings: row._count._all }]));
  const sold = await prisma.seat.groupBy({ by: ["eventId"], where: { eventId: { in: events.map((e) => e.id) }, status: "BOOKED" }, _count: { _all: true } });
  const soldBy = new Map(sold.map((row) => [row.eventId, row._count._all]));
  const grandTotal = [...revenueBy.values()].reduce((sum, row) => sum + row.total, 0);
  const bookingCount = [...revenueBy.values()].reduce((sum, row) => sum + row.bookings, 0);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#4338ca]">{session.role === "ADMIN" ? "System overview" : "Organiser portal"}</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em]">Dashboard</h1><p className="mt-2 text-[#565564]">Performance and live inventory at a glance.</p></div><Link href="/organiser/events/new" className={btn}><Icon name="plus" size={18}/>New event</Link></div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[{ label: "Total revenue", value: money(grandTotal), detail: "Confirmed sales", icon: "chart" as const, tone: "text-[#2a14b4] bg-[#e3dfff]" }, { label: "Total bookings", value: bookingCount.toLocaleString(), detail: "Across active events", icon: "ticket" as const, tone: "text-orange-800 bg-orange-100" }, { label: "Active events", value: events.filter((event) => event.startsAt > new Date()).length.toString(), detail: "Currently selling", icon: "spark" as const, tone: "text-emerald-800 bg-emerald-100" }].map((stat) => <div key={stat.label} className="ambient-card relative overflow-hidden rounded-xl border border-[#c7c4d7] bg-white p-6"><div className={`mb-5 grid h-10 w-10 place-items-center rounded-lg ${stat.tone}`}><Icon name={stat.icon} size={20}/></div><p className="text-sm font-semibold text-[#565564]">{stat.label}</p><p className="mt-1 text-3xl font-black tracking-tight">{stat.value}</p><p className="mt-3 text-xs text-[#777586]">{stat.detail}</p><span className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#f0ecf8]"/></div>)}
      </div>

      <section className="mt-10"><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-bold tracking-tight">Active events</h2><span className="text-sm text-[#777586]">{events.length} total</span></div>
        {events.length === 0 ? <Empty>No events yet. <Link href="/organiser/events/new" className="font-bold text-[#2a14b4] underline">Create your first one</Link></Empty> : <div className="grid gap-5 xl:grid-cols-2">{events.map((event, index) => {
          const row = revenueBy.get(event.id) ?? { total: 0, bookings: 0 };
          const seatsSold = soldBy.get(event.id) ?? 0;
          const percentage = event._count.seats ? Math.round((seatsSold / event._count.seats) * 100) : 0;
          return <article key={event.id} className="ambient-card overflow-hidden rounded-xl border border-[#c7c4d7] bg-white sm:grid sm:grid-cols-[180px_1fr]"><div className="relative min-h-44 bg-[#0f172a]"><Image src={event.type === "MOVIE" ? images[2] : images[index % 2]} alt="" fill sizes="180px" className="object-cover"/></div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-[#4338ca]">{event.type}</p><h3 className="mt-1 text-lg font-bold">{event.title}</h3><p className="mt-2 flex items-center gap-2 text-xs text-[#565564]"><Icon name="calendar" size={15}/>{dateTime(event.startsAt)}</p></div><p className="text-lg font-black">{money(row.total)}</p></div><div className="mt-7 flex items-center justify-between text-xs"><span>{percentage}% sold ({seatsSold}/{event._count.seats} seats)</span><span className="font-semibold text-[#777586]">{row.bookings} bookings</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e4e1ed]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentage}%` }}/></div><div className="mt-5 flex items-center justify-between">{session.role === "ADMIN" ? <span className="text-xs text-[#777586]">by {event.organiser.name}</span> : <span/>}<Link href={`/organiser/events/${event.id}`} className="rounded-lg border border-[#2a14b4] px-4 py-2 text-sm font-bold text-[#2a14b4] hover:bg-[#f0ecf8]">View details</Link></div></div></article>;
        })}</div>}
      </section>
    </div>
  );
}
