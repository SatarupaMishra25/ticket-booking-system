import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { money, dateTime } from "@/lib/format";
import { Empty, input } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { PickerInput } from "@/components/PickerInput";
import { indiaDateRange } from "@/lib/dates";

export const dynamic = "force-dynamic";
type Search = { q?: string; type?: string; city?: string; date?: string };
const artwork = ["/events/midnight-symphony.webp", "/events/stellar-screening.webp", "/events/modern-movements.webp"];

export default async function EventsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const type = sp.type === "MOVIE" || sp.type === "CONCERT" ? sp.type : undefined;
  const city = sp.city?.trim() || undefined;
  const date = indiaDateRange(sp.date) ? sp.date : undefined;
  const selectedDay = indiaDateRange(date);
  const now = new Date();
  const startsAt = selectedDay
    ? { gte: selectedDay.start > now ? selectedDay.start : now, lt: selectedDay.end }
    : { gte: now };
  const events = await prisma.event.findMany({
    where: { startsAt, ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}), ...(type ? { type } : {}), ...(city ? { venue: { city: { equals: city, mode: "insensitive" as const } } } : {}) },
    orderBy: { startsAt: "asc" },
    include: { venue: { include: { categories: { orderBy: { name: "asc" } } } }, pricing: true, organiser: { select: { name: true } }, _count: { select: { seats: true } } },
  });
  const grouped = await prisma.seat.groupBy({ by: ["eventId"], where: { eventId: { in: events.map((e) => e.id) }, OR: [{ status: "AVAILABLE" }, { status: "HELD", holdExpiresAt: { lte: now } }] }, _count: { _all: true } });
  const availableBy = new Map(grouped.map((g) => [g.eventId, g._count._all]));
  const cities = await prisma.venue.findMany({ select: { city: true }, distinct: ["city"], orderBy: { city: "asc" } });

  return (
    <div>
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="mb-2 text-xs font-black uppercase tracking-[.18em] text-[#ec4899]">Live inventory</p><h1 className="text-4xl font-black tracking-[-.04em] text-[#e1e2ec] sm:text-5xl">Browse events</h1><p className="mt-3 text-lg text-[#a5aabc]">Find the best experiences in your city.</p></div>
        <form className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-[980px] lg:grid-cols-[1.35fr_.9fr_.9fr_1fr_auto]">
          <label className="relative"><span className="sr-only">Search events</span><Icon name="search" size={18} className="absolute left-3 top-3.5 text-[#8d909d]"/><input name="q" defaultValue={q} placeholder="Search events…" className={`${input} pl-10`} /></label>
          <select name="type" defaultValue={type ?? ""} className={input} aria-label="Event type"><option value="">All types</option><option value="MOVIE">Movies</option><option value="CONCERT">Concerts</option></select>
          <select name="city" defaultValue={city ?? ""} className={input} aria-label="City"><option value="">Any city</option>{cities.map((c) => <option key={c.city}>{c.city}</option>)}</select>
          <PickerInput type="date" name="date" defaultValue={date ?? ""} aria-label="Event date" />
          <button type="submit" className="min-h-11 rounded-lg border border-[#7bd0ff]/35 bg-[#7bd0ff]/5 px-5 text-sm font-bold text-[#7bd0ff] hover:border-[#7bd0ff] hover:bg-[#7bd0ff]/10">Filter</button>
        </form>
      </div>

      {events.length === 0 ? <Empty>No events match those filters. <Link href="/events" className="font-bold text-[#7bd0ff] underline">Clear filters</Link></Empty> : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event, index) => {
            const available = availableBy.get(event.id) ?? 0;
            const soldOut = available === 0;
            const cheapest = event.pricing.length ? Math.min(...event.pricing.map((p) => p.price)) : 0;
            const image = event.type === "MOVIE" ? artwork[1] : artwork[index % artwork.length === 1 ? 2 : index % artwork.length];
            return (
              <article key={event.id} className="ambient-card group overflow-hidden rounded-xl border border-white/10 bg-[#0c1324]/85 transition duration-300 hover:-translate-y-1 hover:border-[#ec4899]/45 hover:shadow-[0_18px_50px_-28px_rgba(236,72,153,.45)]">
                <Link href={`/events/${event.id}`} className="block">
                  <div className="relative aspect-[16/9] overflow-hidden bg-[#0f172a]">
                    <Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.035]" priority={index < 3}/>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/50 via-transparent to-black/10"/>
                    <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-xs font-black uppercase tracking-[.08em] text-white backdrop-blur">{event.type}</span>
                    {soldOut && <span className="absolute right-4 top-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1 text-xs font-black uppercase tracking-[.08em] text-rose-300 backdrop-blur">Sold out</span>}
                  </div>
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start gap-3"><h2 className="min-h-14 flex-1 text-xl font-bold leading-7 tracking-[-.025em] text-[#e1e2ec]">{event.title}</h2><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#a5aabc] transition group-hover:bg-[#ec4899]/10 group-hover:text-[#ec4899]"><Icon name="heart" size={20}/></span></div>
                    <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-[#8d909d]">{event.description}</p>
                    <div className="mt-5 space-y-2 text-sm text-[#a5aabc]"><p className="flex items-center gap-2"><Icon name="calendar" size={17} className="text-[#7bd0ff]"/>{dateTime(event.startsAt)}</p><p className="flex items-center gap-2"><Icon name="pin" size={17} className="text-[#7bd0ff]"/>{event.venue.name}, {event.venue.city}</p></div>
                    <div className="mt-6 flex items-end justify-between border-t border-white/8 pt-5"><div><p className="text-xs font-medium uppercase tracking-wider text-[#8d909d]">Starting at</p><p className="mt-1 text-2xl font-black tracking-tight">{money(cheapest)}</p></div><div className="text-right"><p className={`mb-2 text-xs font-bold ${soldOut ? "text-rose-400" : available < 20 ? "text-amber-300" : "text-[#7bd0ff]"}`}>{soldOut ? "Join the waitlist" : `${available} seats available`}</p><span className={`inline-flex rounded-lg px-4 py-2.5 text-sm font-bold ${soldOut ? "bg-white/5 text-[#8d909d]" : "bg-[#ec4899] text-white shadow-[0_0_22px_-9px_rgba(236,72,153,.8)]"}`}>{soldOut ? "View event" : "Get tickets"}</span></div></div>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      )}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-6 rounded-xl border border-white/8 bg-white/[.025] px-5 py-4 text-xs font-semibold text-[#a5aabc]"><span className="inline-flex items-center gap-2"><Icon name="refresh" size={16} className="text-[#7bd0ff]"/> Live availability</span><span className="inline-flex items-center gap-2"><Icon name="shield" size={16} className="text-[#ec4899]"/> Race-proof reservations</span><span className="inline-flex items-center gap-2"><Icon name="ticket" size={16} className="text-[#7bd0ff]"/> Instant QR tickets</span></div>
    </div>
  );
}
