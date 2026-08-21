import Link from "next/link";
import { getSession } from "@/lib/auth";
import { SEAT_HOLD_TTL_MINUTES, WAITLIST_OFFER_TTL_MINUTES } from "@/lib/config";
import { btn, btnGhost } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";

export const dynamic = "force-dynamic";

const FEATURES: { icon: IconName; title: string; body: string; tone: string }[] = [
  { icon: "shield", title: "Stampede protection", body: "Database-level row locks make sure every seat has exactly one winner, even under pressure.", tone: "bg-violet-100 text-violet-700" },
  { icon: "clock", title: "Smart holds", body: `Seats are secured for ${SEAT_HOLD_TTL_MINUTES} minutes during checkout, then release themselves automatically.`, tone: "bg-blue-100 text-blue-700" },
  { icon: "refresh", title: "No seat wasted", body: `Cancelled seats go to the next waitlisted customer with a ${WAITLIST_OFFER_TTL_MINUTES}-minute offer.`, tone: "bg-orange-100 text-orange-700" },
  { icon: "grid", title: "Live seat map", body: "Availability refreshes every three seconds, so everyone sees a synchronized view of the venue.", tone: "bg-indigo-100 text-indigo-700" },
  { icon: "lock", title: "Role-based control", body: "Purpose-built customer, organiser, and admin workspaces keep powerful utilities safely separated.", tone: "bg-sky-100 text-sky-700" },
  { icon: "ticket", title: "Instant QR tickets", body: "Every confirmed booking produces a secure scannable ticket and email-ready booking reference.", tone: "bg-rose-100 text-rose-700" },
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
      <section className="app-grid border-b border-[#d8d4e4] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-[1280px] items-center gap-14 lg:grid-cols-[1.02fr_.98fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#cbc6e1] bg-white px-3 py-1.5 text-xs font-bold text-[#4338ca] shadow-sm"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live inventory · Zero double-bookings</div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.06] tracking-[-0.045em] text-[#17171f] sm:text-6xl">
              Tickets built for<br/><span className="text-[#2a14b4]">scale and fairness.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#565564]">Book the seat you actually want. Real-time availability, transparent holds, fair waitlists, and QR tickets in one fast experience.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/events" className={btn}>Explore events <Icon name="arrow" size={18} /></Link>
              {session ? <Link href={session.role === "CUSTOMER" ? "/bookings" : "/organiser"} className={btnGhost}>Open your workspace</Link> : <Link href="/login" className={btnGhost}>View live demo</Link>}
            </div>
            <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#565e74]">
              <span className="inline-flex items-center gap-2"><Icon name="check" size={16} className="text-emerald-600" /> No booking fees hidden</span>
              <span className="inline-flex items-center gap-2"><Icon name="check" size={16} className="text-emerald-600" /> Seats held securely</span>
              <span className="inline-flex items-center gap-2"><Icon name="check" size={16} className="text-emerald-600" /> Mobile-ready tickets</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[590px]">
            <div className="absolute -inset-5 rounded-[2rem] bg-[#c3c0ff]/30 blur-2xl" />
            <div className="ambient-card relative overflow-hidden rounded-2xl border border-[#c7c4d7] bg-[#f0ecf8] p-5 sm:p-7">
              <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#777586]">Grand Concert Hall</p><p className="mt-1 text-sm font-bold">Midnight Symphony · 8:00 PM</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-sm"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live sync</span></div>
              <div className="rounded-xl bg-[#0f172a] px-5 pb-7 pt-8 shadow-2xl">
                <div className="screen mx-auto w-4/5"/><p className="mt-1 text-center text-[9px] font-bold tracking-[.25em] text-slate-400">STAGE</p>
                <div className="mx-auto mt-8 grid max-w-[390px] grid-cols-8 gap-2">
                  {Array.from({ length: 48 }, (_, i) => <span key={i} className={`aspect-square rounded-[5px] border border-white/10 shadow-inner ${[2, 12, 21, 22, 29].includes(i) ? "bg-slate-600/30" : [18,19,20].includes(i) ? "bg-[#f59e0b] ring-2 ring-white" : i % 7 === 0 ? "bg-[#3b82f6]" : "bg-[#7c3aed]"}`} />)}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm"><div><p className="text-xs text-[#777586]">3 seats selected</p><p className="font-black">₹1,497</p></div><span className="rounded-lg bg-[#2a14b4] px-4 py-2 text-xs font-bold text-white">Continue</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f6f2fe] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#4338ca]">Core infrastructure</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-.03em] sm:text-4xl">Every utility you need. Nothing you don’t.</h2>
          <p className="mt-3 max-w-2xl text-[#565564]">Designed for high-demand drops without compromising speed, transparency, or system integrity.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => <article key={feature.title} className="ambient-card rounded-xl border border-[#d4d0df] bg-white p-6 transition hover:-translate-y-1 hover:border-[#9d97bc]"><span className={`grid h-10 w-10 place-items-center rounded-lg ${feature.tone}`}><Icon name={feature.icon} size={19}/></span><h3 className="mt-5 text-lg font-bold tracking-[-.02em]">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-[#565564]">{feature.body}</p></article>)}
          </div>
        </div>
      </section>

      {!session && <section className="px-5 py-16 sm:px-8 sm:py-20"><div className="mx-auto grid max-w-[920px] items-center gap-10 rounded-2xl border border-[#c7c4d7] bg-[#eae6f3] p-7 sm:p-10 lg:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#4338ca]">Try every role</p><h2 className="mt-3 text-3xl font-bold tracking-tight">Evaluate the complete system.</h2><p className="mt-3 text-sm leading-6 text-[#565564]">Explore customer booking, organiser reporting, and admin venue management with seeded demo access.</p><Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#2a14b4]">Open demo login <Icon name="arrow" size={17}/></Link></div><div className="rounded-xl border border-[#d4d0df] bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[.14em] text-[#777586]">Demo credentials</p><Icon name="shield" size={17} className="text-[#4338ca]"/></div>{demo.map(([role,email]) => <div key={role} className="flex items-center justify-between border-b border-[#e4e1ed] py-3 last:border-0"><span className="text-sm font-semibold">{role}</span><code className="rounded bg-[#f0ecf8] px-2 py-1 text-xs text-[#565564]">{email}</code></div>)}<div className="mt-3 rounded-md bg-[#f6f2fe] p-2 text-center text-xs text-[#565564]">Password: <strong>Password123!</strong></div></div></div></section>}
    </div>
  );
}
