import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { money, dateTime } from "@/lib/format";
import { Empty, btn } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { DeleteEventButton } from "@/components/DeleteEventButton";

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
    <div className="grid gap-7 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="ambient-card hidden h-fit rounded-xl border border-white/8 bg-[#151b2d]/75 p-6 backdrop-blur-xl lg:block">
        <h2 className="text-2xl font-bold">{session.role === "ADMIN" ? "Admin Portal" : "Organiser Portal"}</h2>
        <nav className="mt-8 space-y-3 text-sm font-bold">
          <Link href="/organiser" className="flex items-center gap-3 rounded-lg border border-[#8b5cf6]/40 bg-[#8b5cf6]/15 px-4 py-3 text-violet-300"><Icon name="grid" size={19}/>Overview</Link>
          <Link href="/organiser/events/new" className="flex items-center gap-3 rounded-lg px-4 py-3 text-[#a5aabc] hover:bg-white/5 hover:text-white"><Icon name="calendar" size={19}/>Manage events</Link>
          <Link href="/bookings" className="flex items-center gap-3 rounded-lg px-4 py-3 text-[#a5aabc] hover:bg-white/5 hover:text-white"><Icon name="ticket" size={19}/>Bookings</Link>
          <Link href="/organiser" className="flex items-center gap-3 rounded-lg px-4 py-3 text-[#a5aabc] hover:bg-white/5 hover:text-white"><Icon name="chart" size={19}/>Reports</Link>
          {session.role === "ADMIN" && <Link href="/admin/venues" className="mt-8 flex items-center gap-3 rounded-lg px-4 py-3 text-[#a5aabc] hover:bg-white/5 hover:text-white"><Icon name="pin" size={19}/>Venues</Link>}
        </nav>
      </aside>

      <div>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#ec4899]">{session.role === "ADMIN" ? "System overview" : "Organiser workspace"}</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em]">Dashboard</h1><p className="mt-2 text-[#a5aabc]">Performance and live inventory at a glance.</p></div><Link href="/organiser/events/new" className={btn}><Icon name="plus" size={18}/>New event</Link></div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[{ label: "Total revenue", value: money(grandTotal), detail: "Confirmed sales", icon: "chart" as const, tone: "text-violet-300 bg-violet-400/15", glow: "bg-violet-500/20" }, { label: "Total bookings", value: bookingCount.toLocaleString(), detail: "Across active events", icon: "ticket" as const, tone: "text-[#ffb0cd] bg-[#ec4899]/15", glow: "bg-[#ec4899]/20" }, { label: "Active events", value: events.filter((event) => event.startsAt > new Date()).length.toString(), detail: "Currently selling", icon: "spark" as const, tone: "text-[#7bd0ff] bg-[#38bdf8]/15", glow: "bg-[#38bdf8]/20" }].map((stat) => <div key={stat.label} className="ambient-card relative overflow-hidden rounded-xl border border-white/8 bg-[#151b2d]/75 p-6 backdrop-blur"><div className={`mb-5 grid h-10 w-10 place-items-center rounded-lg ${stat.tone}`}><Icon name={stat.icon} size={20}/></div><p className="text-sm font-semibold text-[#a5aabc]">{stat.label}</p><p className="mt-1 text-3xl font-black tracking-tight">{stat.value}</p><p className="mt-3 text-xs text-[#8d909d]">{stat.detail}</p><span className={`absolute -right-8 -top-8 h-28 w-28 rounded-full blur-xl ${stat.glow}`}/></div>)}
        </div>

        <section className="mt-10"><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-bold tracking-tight">Active events</h2><span className="text-sm text-[#8d909d]">{events.length} total</span></div>
          {events.length === 0 ? <Empty>No events yet. <Link href="/organiser/events/new" className="font-bold text-[#7bd0ff] underline">Create your first one</Link></Empty> : <div className="grid gap-5 xl:grid-cols-2">{events.map((event, index) => {
            const row = revenueBy.get(event.id) ?? { total: 0, bookings: 0 };
            const seatsSold = soldBy.get(event.id) ?? 0;
            const percentage = event._count.seats ? Math.round((seatsSold / event._count.seats) * 100) : 0;
            return <article key={event.id} className="ambient-card overflow-hidden rounded-xl border border-white/8 bg-[#151b2d]/75"><div className="relative h-48 bg-[#07101f]"><Image src={event.type === "MOVIE" ? images[2] : images[index % 2]} alt="" fill sizes="(max-width: 1280px) 100vw, 40vw" className="object-cover opacity-80"/><span className="absolute right-3 top-3 rounded bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">{event.type}</span></div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{event.title}</h3><p className="mt-2 flex items-center gap-2 text-xs text-[#a5aabc]"><Icon name="calendar" size={15} className="text-[#7bd0ff]"/>{dateTime(event.startsAt)}</p></div><p className="text-lg font-black">{money(row.total)}</p></div><div className="mt-7 flex items-center justify-between text-xs text-[#c4c6d4]"><span>{percentage}% sold ({seatsSold}/{event._count.seats} seats)</span><span>{row.bookings} bookings</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#ec4899]" style={{ width: `${percentage}%` }}/></div><div className="mt-5 flex items-end justify-between gap-3">{session.role === "ADMIN" ? <span className="text-xs text-[#8d909d]">by {event.organiser.name}</span> : <span/>}<div className="flex items-start gap-2"><DeleteEventButton eventId={event.id} eventTitle={event.title}/><Link href={`/organiser/events/${event.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-[#8b5cf6]/50 bg-[#8b5cf6]/10 px-4 py-2 text-sm font-bold text-violet-300 hover:bg-[#8b5cf6]/20">Manage</Link></div></div></div></article>;
          })}</div>}
        </section>
      </div>
    </div>
  );
}
