import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dateTime, money } from "@/lib/format";
import { eventArtwork } from "@/lib/artwork";
import { Badge, btn } from "@/components/ui";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function EventDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      venue: true,
      organiser: { select: { name: true } },
      pricing: { include: { category: true } },
      _count: { select: { seats: true } },
    },
  });
  if (!event) notFound();

  const [available, similar] = await Promise.all([
    prisma.seat.count({ where: { eventId: id, OR: [{ status: "AVAILABLE" }, { status: "HELD", holdExpiresAt: { lte: now } }] } }),
    prisma.event.findMany({
      where: { id: { not: id }, type: event.type, startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 3,
      include: { venue: true, pricing: true },
    }),
  ]);

  const cheapest = event.pricing.length ? Math.min(...event.pricing.map((price) => price.price)) : 0;
  const soldOut = event._count.seats > 0 && available === 0;
  const description = event.description.trim() || "The organiser is finalising the programme. Reserve your preferred seats while live inventory is available.";

  return (
    <div className="space-y-16 pb-6">
      <section className="relative isolate min-h-[500px] overflow-hidden rounded-2xl border border-white/10 bg-[#07101f] shadow-[0_34px_100px_-55px_rgba(56,189,248,.45)]">
        <Image src={eventArtwork(event)} alt={`${event.title} event artwork`} fill priority sizes="(max-width: 1440px) 100vw, 1376px" className="object-cover opacity-75" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/72 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/30" />
        <div className="relative flex min-h-[500px] max-w-3xl flex-col justify-end p-7 sm:p-10 lg:p-14">
          <Badge>{event.type === "MOVIE" ? "Cinema event" : "Live concert"}</Badge>
          <h1 className="mt-5 text-4xl font-black leading-[1.02] tracking-[-.055em] text-white sm:text-6xl">{event.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#c4c6d4] sm:text-lg">{description}</p>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#dce1fb]">
            <span className="inline-flex items-center gap-2"><Icon name="calendar" size={18} className="text-[#7bd0ff]" />{dateTime(event.startsAt)}</span>
            <span className="inline-flex items-center gap-2"><Icon name="pin" size={18} className="text-[#7bd0ff]" />{event.venue.name}, {event.venue.city}</span>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-12">
          <section>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#ec4899]">The experience</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-.04em]">About the event</h2>
            <p className="mt-5 max-w-3xl whitespace-pre-line text-base leading-8 text-[#aeb3c8]">{description}</p>
          </section>

          <section>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#7bd0ff]">Where you are going</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-.04em]">Venue information</h2>
            <div className="ambient-card mt-5 grid overflow-hidden rounded-xl border border-white/10 bg-[#0c1324]/85 md:grid-cols-[1fr_.85fr]">
              <div className="p-6 sm:p-8"><h3 className="text-xl font-bold">{event.venue.name}</h3><p className="mt-3 max-w-md leading-7 text-[#a5aabc]">{event.venue.address}<br />{event.venue.city}</p><p className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#7bd0ff]"><Icon name="pin" size={17} />Assigned seating venue</p></div>
              <div className="app-grid grid min-h-48 place-items-center border-t border-white/10 bg-[#151b2d] md:border-l md:border-t-0"><div className="grid h-20 w-20 place-items-center rounded-full border border-[#7bd0ff]/25 bg-[#7bd0ff]/8 text-[#7bd0ff] shadow-[0_0_45px_-16px_rgba(56,189,248,.7)]"><Icon name="pin" size={34} /></div></div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-black tracking-[-.035em]">Booking with confidence</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { icon: "refresh" as const, title: "Live inventory", body: "Seat status refreshes every three seconds while you choose." },
                { icon: "clock" as const, title: "Fair waitlist", body: "Released seats are offered automatically in queue order." },
                { icon: "ticket" as const, title: "Instant QR ticket", body: "Confirmed bookings include a secure entry code." },
              ].map((item) => <article key={item.title} className="ambient-card rounded-xl border border-white/8 bg-[#151b2d]/70 p-5"><Icon name={item.icon} className="text-[#ec4899]" /><h3 className="mt-4 font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#8d909d]">{item.body}</p></article>)}
            </div>
          </section>
        </div>

        <aside className="ambient-card overflow-hidden rounded-2xl border border-white/10 bg-[#151b2d]/90 backdrop-blur-xl lg:sticky lg:top-24">
          <div className="border-b border-white/10 p-6"><p className="text-xs font-black uppercase tracking-[.15em] text-[#8d909d]">Starting from</p><p className="mt-1 text-4xl font-black tracking-[-.045em]">{money(cheapest)}</p></div>
          <div className="space-y-4 p-6 text-sm">
            <p className="flex gap-3"><Icon name="calendar" className="shrink-0 text-[#7bd0ff]" /><span><strong className="block">{dateTime(event.startsAt)}</strong><span className="text-[#8d909d]">Schedule confirmed by {event.organiser.name}</span></span></p>
            <p className="flex gap-3"><Icon name="ticket" className="shrink-0 text-[#ec4899]" /><span><strong className={`block ${soldOut ? "text-amber-300" : "text-emerald-300"}`}>{soldOut ? "Waitlist available" : `${available} seats available`}</strong><span className="text-[#8d909d]">{event._count.seats} seats in this venue</span></span></p>
          </div>
          <div className="border-t border-white/10 bg-[#0c1324]/75 p-6"><Link href={`/events/${event.id}/seats`} className={`${btn} w-full`}>{soldOut ? "View seats & waitlist" : "Choose seats"}<Icon name="arrow" size={18} /></Link><p className="mt-3 text-center text-[11px] text-[#8d909d]"><Icon name="lock" size={12} className="mr-1 inline" />Secure, race-proof checkout</p></div>
        </aside>
      </div>

      {similar.length > 0 && <section><div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#ec4899]">More to explore</p><h2 className="mt-2 text-3xl font-black tracking-[-.04em]">Similar events</h2></div><Link href={`/events?type=${event.type}`} className="text-sm font-bold text-[#7bd0ff]">View all <span aria-hidden>→</span></Link></div><div className="mt-6 grid gap-5 md:grid-cols-3">{similar.map((item) => { const price = item.pricing.length ? Math.min(...item.pricing.map((row) => row.price)) : 0; return <Link key={item.id} href={`/events/${item.id}`} className="group overflow-hidden rounded-xl border border-white/10 bg-[#0c1324]/85 transition hover:-translate-y-1 hover:border-[#ec4899]/40"><div className="relative aspect-[16/9] overflow-hidden"><Image src={eventArtwork(item)} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#0c1324] to-transparent" /></div><div className="p-5"><h3 className="text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm text-[#8d909d]">{dateTime(item.startsAt)} · {item.venue.city}</p><p className="mt-4 font-black text-[#7bd0ff]">From {money(price)}</p></div></Link>; })}</div></section>}
    </div>
  );
}
