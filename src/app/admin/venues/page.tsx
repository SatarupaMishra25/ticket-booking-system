import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { VenueForm } from "@/components/VenueForm";
import { Empty } from "@/components/ui";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function AdminVenuesPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/venues");
  if (session.role !== "ADMIN") redirect("/events");

  const venues = await prisma.venue.findMany({
    orderBy: { name: "asc" },
    include: {
      categories: {
        orderBy: { name: "asc" },
        include: { _count: { select: { seats: true } } },
      },
      _count: { select: { seats: true, events: true } },
    },
  });

  const totalCapacity = venues.reduce((sum, venue) => sum + venue._count.seats, 0);
  const scheduledEvents = venues.reduce((sum, venue) => sum + venue._count.events, 0);

  return (
    <div>
      <div className="mb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#ec4899]">Admin workspace</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.045em] sm:text-5xl">Venues &amp; seating</h1>
          <p className="mt-3 max-w-2xl text-[#a5aabc]">Build reusable venue layouts with clear ticket categories and a live seat-map preview.</p>
        </div>
      </div>

      <div className="mb-8 flex w-full justify-end"><VenueForm /></div>

      <div className="mb-9 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Configured venues", value: venues.length.toLocaleString(), icon: "pin" as const, colour: "text-[#ec4899] bg-[#ec4899]/12" },
          { label: "Total seat capacity", value: totalCapacity.toLocaleString(), icon: "users" as const, colour: "text-[#7bd0ff] bg-[#38bdf8]/12" },
          { label: "Scheduled events", value: scheduledEvents.toLocaleString(), icon: "calendar" as const, colour: "text-violet-300 bg-violet-400/12" },
        ].map((stat) => (
          <div key={stat.label} className="ambient-card flex items-center gap-4 rounded-xl border border-white/8 bg-[#11182a]/75 p-5">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${stat.colour}`}><Icon name={stat.icon} size={21} /></span>
            <div><p className="text-xs font-bold uppercase tracking-wider text-[#8d909d]">{stat.label}</p><p className="mt-1 text-2xl font-black tracking-tight">{stat.value}</p></div>
          </div>
        ))}
      </div>

      {venues.length === 0 ? (
        <Empty>No venues yet. Open the venue architect to create your first seating layout.</Empty>
      ) : (
        <section>
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black tracking-tight">Venue library</h2><span className="text-xs font-bold text-[#8d909d]">{venues.length} total</span></div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {venues.map((venue) => (
              <article key={venue.id} className="ambient-card group overflow-hidden rounded-2xl border border-white/10 bg-[#11182a]/80 transition duration-300 hover:-translate-y-1 hover:border-[#38bdf8]/35">
                <div className="relative overflow-hidden border-b border-white/8 bg-[#07101f] px-5 py-7">
                  <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[#38bdf8]/10 blur-2xl transition group-hover:bg-[#38bdf8]/18" />
                  <div className="relative flex items-start justify-between gap-4">
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#38bdf8]/20 bg-[#38bdf8]/10 text-[#7bd0ff]"><Icon name="pin" size={21} /></span>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/8 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">Ready</span>
                  </div>
                  <h3 className="relative mt-5 text-xl font-black tracking-tight">{venue.name}</h3>
                  <p className="relative mt-1 text-sm text-[#a5aabc]">{venue.city} · {venue.address}</p>
                </div>

                <div className="p-5">
                  <div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-[#8d909d]">Capacity</p><p className="mt-1 text-3xl font-black tracking-tight">{venue._count.seats.toLocaleString()}</p></div><div className="text-right"><p className="text-lg font-black text-[#7bd0ff]">{venue._count.events}</p><p className="text-xs text-[#8d909d]">scheduled events</p></div></div>

                  <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-white/8">
                    {venue.categories.map((category) => <span key={category.id} style={{ width: venue._count.seats ? `${(category._count.seats / venue._count.seats) * 100}%` : "0%", background: category.colour }} />)}
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {venue.categories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between gap-3 text-sm"><span className="inline-flex min-w-0 items-center gap-2 font-semibold text-[#c4c6d4]"><span className="h-3 w-3 shrink-0 rounded" style={{ background: category.colour }} />{category.name}</span><span className="text-xs font-bold text-[#8d909d]">{category._count.seats} seats</span></div>
                    ))}
                    {venue.categories.length === 0 && <p className="text-xs text-amber-300">No seat categories — this venue cannot host events yet.</p>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
