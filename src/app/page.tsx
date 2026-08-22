import Link from "next/link";
import { getSession } from "@/lib/auth";
import { SEAT_HOLD_TTL_MINUTES, WAITLIST_OFFER_TTL_MINUTES } from "@/lib/config";
import { btn, btnGhost } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";

export const dynamic = "force-dynamic";

const FEATURES: { icon: IconName; title: string; body: string; tone: string }[] = [
  { icon: "shield", title: "Stampede protection", body: "Database-level row locks make sure every seat has exactly one winner, even under pressure.", tone: "bg-[#ec4899]/15 text-[#ffb0cd]" },
  { icon: "clock", title: "Smart holds", body: `Seats are secured for ${SEAT_HOLD_TTL_MINUTES} minutes during checkout, then release themselves automatically.`, tone: "bg-[#38bdf8]/15 text-[#7bd0ff]" },
  { icon: "refresh", title: "No seat wasted", body: `Cancelled seats go to the next waitlisted customer with a ${WAITLIST_OFFER_TTL_MINUTES}-minute offer.`, tone: "bg-amber-400/15 text-amber-300" },
  { icon: "grid", title: "Live seat map", body: "Availability refreshes every three seconds, so everyone sees a synchronized view of the venue.", tone: "bg-violet-400/15 text-violet-300" },
  { icon: "lock", title: "Role-based control", body: "Purpose-built customer, organiser, and admin workspaces keep powerful utilities safely separated.", tone: "bg-[#38bdf8]/15 text-[#7bd0ff]" },
  { icon: "ticket", title: "Instant QR tickets", body: "Every confirmed booking produces a secure scannable ticket and email-ready booking reference.", tone: "bg-[#ec4899]/15 text-[#ffb0cd]" },
];

const demo = [
  ["Admin", "admin@demo.com"],
  ["Organiser", "organiser@demo.com"],
  ["Customer", "customer@demo.com"],
];

export default async function HomePage() {
  const session = await getSession();
  return (
    <div className="-mx-5 -my-8 sm:-mx-8 sm:-my-10">
      <section className="app-grid border-b border-white/10 px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-[1280px] items-center gap-14 lg:grid-cols-[1.02fr_.98fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#7bd0ff]/20 bg-[#7bd0ff]/5 px-3 py-1.5 text-xs font-bold text-[#7bd0ff] shadow-sm"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Live inventory · Zero double-bookings</div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.06] tracking-[-0.045em] text-[#e1e2ec] sm:text-6xl">
              Tickets built for<br/><span className="bg-gradient-to-r from-[#ec4899] to-[#7bd0ff] bg-clip-text text-transparent">scale and fairness.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#a5aabc]">Book the seat you actually want. Real-time availability, transparent holds, fair waitlists, and QR tickets in one fast experience.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/events" className={btn}>Explore events <Icon name="arrow" size={18} /></Link>
              {session ? <Link href={session.role === "CUSTOMER" ? "/bookings" : "/organiser"} className={btnGhost}>Open your workspace</Link> : <Link href="/login" className={btnGhost}>View live demo</Link>}
            </div>
            <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#a5aabc]">
              <span className="inline-flex items-center gap-2"><Icon name="check" size={16} className="text-emerald-600" /> No booking fees hidden</span>
              <span className="inline-flex items-center gap-2"><Icon name="check" size={16} className="text-emerald-600" /> Seats held securely</span>
              <span className="inline-flex items-center gap-2"><Icon name="check" size={16} className="text-emerald-600" /> Mobile-ready tickets</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[590px]">
            <div className="absolute -inset-5 rounded-[2rem] bg-[#ec4899]/15 blur-2xl" />
            <div className="ambient-card relative overflow-hidden rounded-2xl border border-white/10 bg-[#151b2d]/75 p-5 backdrop-blur-xl sm:p-7">
              <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#8d909d]">Grand Concert Hall</p><p className="mt-1 text-sm font-bold">Midnight Symphony · 8:00 PM</p></div><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 shadow-sm"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Live sync</span></div>
              <div className="rounded-xl bg-[#0f172a] px-5 pb-7 pt-8 shadow-2xl">
                <div className="screen mx-auto w-4/5"/><p className="mt-1 text-center text-[9px] font-bold tracking-[.25em] text-slate-400">STAGE</p>
                <div className="mx-auto mt-8 grid max-w-[390px] grid-cols-8 gap-2">
                  {Array.from({ length: 48 }, (_, i) => <span key={i} className={`aspect-square rounded-[5px] border border-white/10 shadow-inner ${[2, 12, 21, 22, 29].includes(i) ? "bg-slate-600/30" : [18,19,20].includes(i) ? "bg-[#f59e0b] ring-2 ring-white" : i % 7 === 0 ? "bg-[#3b82f6]" : "bg-[#7c3aed]"}`} />)}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-white/8 bg-white/5 px-4 py-3 shadow-sm"><div><p className="text-xs text-[#8d909d]">3 seats selected</p><p className="font-black">₹1,497</p></div><span className="rounded-lg bg-[#ec4899] px-4 py-2 text-xs font-bold text-white shadow-[0_0_20px_-8px_rgba(236,72,153,.8)]">Continue</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="app-grid bg-[#0c1324] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#ec4899]">Core infrastructure</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-.03em] sm:text-4xl">Every utility you need. Nothing you don’t.</h2>
          <p className="mt-3 max-w-2xl text-[#a5aabc]">Designed for high-demand drops without compromising speed, transparency, or system integrity.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => <article key={feature.title} className="ambient-card rounded-xl border border-white/8 bg-[#151b2d]/70 p-6 backdrop-blur-xl transition hover:-translate-y-1 hover:border-[#ec4899]/35"><span className={`grid h-10 w-10 place-items-center rounded-lg ${feature.tone}`}><Icon name={feature.icon} size={19}/></span><h3 className="mt-5 text-lg font-bold tracking-[-.02em]">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-[#a5aabc]">{feature.body}</p></article>)}
          </div>
        </div>
      </section>

      {!session && <section className="px-5 py-16 sm:px-8 sm:py-20"><div className="mx-auto grid max-w-[920px] items-center gap-10 rounded-2xl border border-white/10 bg-gradient-to-br from-[#151b2d] via-[#151b2d] to-[#30172d] p-7 sm:p-10 lg:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#ec4899]">Try every role</p><h2 className="mt-3 text-3xl font-bold tracking-tight">Evaluate the complete system.</h2><p className="mt-3 text-sm leading-6 text-[#a5aabc]">Explore customer booking, organiser reporting, and admin venue management with seeded demo access.</p><Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#7bd0ff]">Open demo login <Icon name="arrow" size={17}/></Link></div><div className="rounded-xl border border-white/10 bg-[#0c1324]/60 p-5 shadow-sm backdrop-blur"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[.14em] text-[#8d909d]">Demo credentials</p><Icon name="shield" size={17} className="text-[#ec4899]"/></div>{demo.map(([role,email]) => <div key={role} className="flex items-center justify-between border-b border-white/8 py-3 last:border-0"><span className="text-sm font-semibold">{role}</span><code className="rounded bg-white/5 px-2 py-1 text-xs text-[#ffb0cd]">{email}</code></div>)}<div className="mt-3 rounded-md bg-white/5 p-2 text-center text-xs text-[#a5aabc]">Password: <strong>Password123!</strong></div></div></div></section>}
    </div>
  );
}
