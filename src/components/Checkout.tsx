"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { money, dateTime, countdown } from "@/lib/format";
import { Alert, Card, btn, btnGhost, input, label } from "@/components/ui";
import { Icon } from "@/components/Icon";

type Hold = { holdRef: string; expiresAt: string; event: { id: string; title: string; type: string; startsAt: string; venue: string }; seats: { seatId: string; label: string; category: string; colour: string; price: number }[]; total: number };

export function Checkout({ hold, customerEmail }: { hold: Hold; customerEmail: string }) {
  const router = useRouter();
  const [left, setLeft] = useState("--:--");
  const [expired, setExpired] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState({ first: "", last: "", email: customerEmail, number: "", expiry: "", cvc: "" });

  useEffect(() => {
    const tick = () => { const ms = new Date(hold.expiresAt).getTime() - Date.now(); setLeft(countdown(hold.expiresAt)); setUrgent(ms > 0 && ms < 60_000); if (ms <= 0) { setExpired(true); return false; } return true; };
    tick(); const timer = setInterval(() => { if (!tick()) clearInterval(timer); }, 1000); return () => clearInterval(timer);
  }, [hold.expiresAt]);

  const set = (key: keyof typeof card) => (event: React.ChangeEvent<HTMLInputElement>) => setCard((current) => ({ ...current, [key]: event.target.value }));
  const ready = card.first.trim() && card.last.trim() && card.email.trim() && card.number.replace(/\s/g, "").length >= 12 && card.expiry.trim() && card.cvc.length >= 3;

  async function confirm() {
    if (!ready) { setError("Complete the attendee and payment details to continue."); return; }
    setError(null); setBusy(true);
    try { const { bookingId } = await api<{ bookingId: string }>("/api/bookings", { method: "POST", json: { holdRef: hold.holdRef } }); router.push(`/bookings/${bookingId}?new=1`); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  }

  async function release() { setBusy(true); try { await api(`/api/holds/${hold.holdRef}`, { method: "DELETE" }); } catch {} router.push(`/events/${hold.event.id}`); }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="space-y-6">
        {expired ? <Alert>This hold expired and the seats returned to the live map. <Link href={`/events/${hold.event.id}`} className="font-bold underline">Pick seats again</Link>.</Alert> : null}
        {error && <Alert>{error}</Alert>}

        <Card className="p-5 sm:p-7">
          <div className="flex items-center gap-3 border-b border-[#e4e1ed] pb-4"><span className="text-[#2a14b4]"><Icon name="user" size={24}/></span><div><h2 className="text-xl font-bold">Attendee information</h2><p className="text-sm text-[#777586]">Your ticket will be issued to these details.</p></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><label className={label} htmlFor="first">First name</label><input id="first" autoComplete="given-name" className={input} value={card.first} onChange={set("first")} placeholder="Jane"/></div><div><label className={label} htmlFor="last">Last name</label><input id="last" autoComplete="family-name" className={input} value={card.last} onChange={set("last")} placeholder="Doe"/></div><div className="sm:col-span-2"><label className={label} htmlFor="checkout-email">Email address for tickets</label><input id="checkout-email" type="email" autoComplete="email" className={input} value={card.email} onChange={set("email")}/></div></div>
        </Card>

        <Card className="p-5 sm:p-7">
          <div className="flex items-center gap-3 border-b border-[#e4e1ed] pb-4"><span className="text-[#2a14b4]"><Icon name="card" size={25}/></span><div><h2 className="text-xl font-bold">Payment method</h2><p className="text-sm text-[#777586]">Secure demo checkout — no card is charged.</p></div></div>
          <div className="mt-5 rounded-xl border-2 border-[#4338ca] bg-[#f6f2fe] p-4 sm:p-5">
            <div className="mb-5 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-bold"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#4338ca]"><span className="h-2 w-2 rounded-full bg-white"/></span> Credit or debit card</p><div className="flex gap-1"><span className="rounded bg-white px-2 py-1 text-[10px] font-black text-[#565564]">VISA</span><span className="rounded bg-white px-2 py-1 text-[10px] font-black text-[#565564]">MC</span></div></div>
            <div><label className={label} htmlFor="card-number">Card number</label><div className="relative"><Icon name="card" size={18} className="absolute left-3 top-3.5 text-[#777586]"/><input id="card-number" inputMode="numeric" autoComplete="cc-number" className={`${input} pl-10 font-mono tracking-wider`} value={card.number} onChange={(event) => setCard((current) => ({ ...current, number: event.target.value.replace(/\D/g, "").slice(0,16).replace(/(.{4})/g, "$1 ").trim() }))} placeholder="4242 4242 4242 4242"/></div></div>
            <div className="mt-4 grid grid-cols-2 gap-4"><div><label className={label} htmlFor="expiry">Expiry</label><input id="expiry" autoComplete="cc-exp" className={input} value={card.expiry} onChange={set("expiry")} placeholder="MM / YY" maxLength={7}/></div><div><label className={label} htmlFor="cvc">CVC</label><input id="cvc" inputMode="numeric" autoComplete="cc-csc" className={input} value={card.cvc} onChange={(event) => setCard((current) => ({ ...current, cvc: event.target.value.replace(/\D/g, "").slice(0,4) }))} placeholder="123"/></div></div>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-[#777586]"><Icon name="shield" size={16} className="text-emerald-600"/> Payment fields are for interface demonstration only; no card data is sent or stored.</p>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">
        {!expired && <div className={`flex items-center justify-between rounded-xl border px-5 py-4 ${urgent ? "border-red-300 bg-red-50 text-red-800" : "border-[#c7c4d7] bg-[#eae6f3] text-[#302f39]"}`}><span className="inline-flex items-center gap-2 text-sm font-bold"><Icon name="clock" size={22}/> Seats held for</span><strong className="rounded-lg bg-white px-3 py-2 font-mono text-xl tracking-widest text-[#2a14b4] shadow-sm">{left}</strong></div>}
        <Card className="overflow-hidden p-0">
          <div className="border-b border-[#d8d4e4] bg-[#f6f2fe] p-5"><div className="flex items-start justify-between"><div><h2 className="text-2xl font-black tracking-tight">Order summary</h2><p className="mt-1 text-sm text-[#565564]">{hold.event.title}</p><p className="mt-1 text-xs text-[#777586]">{hold.event.venue} · {dateTime(hold.event.startsAt)}</p></div><Icon name="ticket" className="text-[#777586]"/></div></div>
          <ul className="divide-y divide-[#e4e1ed] px-5">{hold.seats.map((seat) => <li key={seat.seatId} className="flex items-center justify-between py-4"><div><p className="font-bold">Seat {seat.label} <span className="ml-1 rounded bg-[#e3dfff] px-1.5 py-1 text-[9px] font-black uppercase text-[#2a14b4]">{seat.category}</span></p><p className="mt-1 text-xs text-[#777586]">Reserved admission</p></div><span className="font-mono font-bold">{money(seat.price)}</span></li>)}</ul>
          <div className="border-t border-[#d8d4e4] bg-[#f6f2fe] p-5"><div className="flex justify-between text-sm text-[#565564]"><span>Subtotal</span><span className="font-mono">{money(hold.total)}</span></div><div className="mt-2 flex justify-between text-sm text-[#565564]"><span>Service fee</span><span className="font-mono text-emerald-700">Included</span></div><div className="mt-4 flex items-end justify-between border-t border-[#c7c4d7] pt-4"><span className="text-lg font-bold">Total</span><span className="text-3xl font-black tracking-tight">{money(hold.total)}</span></div><button type="button" onClick={confirm} disabled={busy || expired} className={`${btn} mt-5 w-full`}><Icon name="check" size={19}/>{busy ? "Confirming booking…" : "Confirm booking"}</button><button type="button" onClick={release} disabled={busy} className={`${btnGhost} mt-2 w-full`}><Icon name="x" size={17}/>Release seats & go back</button></div>
        </Card>
      </aside>
    </div>
  );
}
