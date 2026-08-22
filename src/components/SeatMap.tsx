"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { money, dateTime } from "@/lib/format";
import { Alert, btn } from "@/components/ui";
import { Icon } from "@/components/Icon";

type Seat = { id: string; rowLabel: string; colNumber: number; categoryId: string; categoryName: string; colour: string; price: number; status: "AVAILABLE" | "HELD" | "BOOKED" | "HELD_BY_ME" };
type Category = { id: string; name: string; colour: string; price: number; available: number; total: number };
type SeatMapData = { event: { id: string; title: string; type: string; description: string; startsAt: string; venueName: string; venueCity: string; organiser: string }; categories: Category[]; seats: Seat[]; soldOut: boolean };
const POLL_MS = 3000;

export function SeatMap({ initial, signedIn, canBook }: { initial: SeatMapData; signedIn: boolean; canBook: boolean }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [joined, setJoined] = useState<Record<string, number>>({});
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const refresh = useCallback(async () => {
    try {
      const next = await api<SeatMapData>(`/api/events/${initial.event.id}`);
      setData(next);
      const free = new Set(next.seats.filter((s) => s.status === "AVAILABLE").map((s) => s.id));
      const kept = selectedRef.current.filter((id) => free.has(id));
      if (kept.length !== selectedRef.current.length) { setSelected(kept); setError("Another guest secured one of those seats. Your selection has been refreshed."); }
    } catch { /* next poll retries */ }
  }, [initial.event.id]);

  useEffect(() => { const timer = setInterval(refresh, POLL_MS); window.addEventListener("focus", refresh); return () => { clearInterval(timer); window.removeEventListener("focus", refresh); }; }, [refresh]);

  const rows = useMemo(() => {
    const byRow = new Map<string, Seat[]>();
    for (const seat of data.seats) { if (!byRow.has(seat.rowLabel)) byRow.set(seat.rowLabel, []); byRow.get(seat.rowLabel)!.push(seat); }
    return [...byRow.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, seats]) => [label, seats.sort((a, b) => a.colNumber - b.colNumber)] as const);
  }, [data.seats]);
  const selectedSeats = data.seats.filter((seat) => selected.includes(seat.id)).sort((a,b) => `${a.rowLabel}${a.colNumber}`.localeCompare(`${b.rowLabel}${b.colNumber}`, undefined, { numeric: true }));
  const total = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
  const heldByMe = data.seats.filter((seat) => seat.status === "HELD_BY_ME");

  function toggle(seat: Seat) {
    if (seat.status !== "AVAILABLE") return;
    setError(null);
    setSelected((current) => current.includes(seat.id) ? current.filter((id) => id !== seat.id) : current.length >= 10 ? (setError("You can reserve up to 10 seats in one booking."), current) : [...current, seat.id]);
  }

  async function continueToCheckout() {
    setError(null); setBusy(true);
    try { const { holdRef } = await api<{ holdRef: string }>("/api/holds", { method: "POST", json: { eventId: data.event.id, seatIds: selected } }); router.push(`/checkout/${holdRef}`); }
    catch (err) { setError((err as Error).message); await refresh(); setBusy(false); }
  }

  async function joinWaitlist(categoryId: string) {
    setError(null); setJoining(categoryId);
    try { const result = await api<{ position: number }>("/api/waitlist", { method: "POST", json: { eventId: data.event.id, categoryId } }); setJoined((current) => ({ ...current, [categoryId]: result.position })); }
    catch (err) { setError((err as Error).message); } finally { setJoining(null); }
  }

  return (
    <div className="-mx-5 -my-8 grid min-h-[calc(100vh-72px)] lg:grid-cols-[minmax(0,1fr)_400px] sm:-mx-8 sm:-my-10">
      <section className="relative overflow-hidden bg-[#07101f] px-4 py-8 text-white sm:px-8 lg:px-10 lg:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(56,189,248,.13),transparent_34rem),radial-gradient(circle_at_75%_65%,rgba(236,72,153,.08),transparent_30rem)]" />
        <div className="relative mx-auto max-w-[980px]">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <Link href={`/events/${data.event.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white"><span aria-hidden>←</span> Event details</Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 shadow-lg backdrop-blur"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live sync · {POLL_MS / 1000}s</span>
          </div>

          <div className="mx-auto mt-10 max-w-[760px]">
            <div className="screen mx-auto w-[85%]"/><p className="mt-1 text-center text-[10px] font-black tracking-[.3em] text-slate-400">STAGE / SCREEN</p>
            <div className="mt-16 overflow-x-auto pb-7">
              <div className="mx-auto w-fit space-y-2.5 px-3">
                {rows.map(([label, seats]) => <div key={label} className="flex items-center gap-4"><span className="w-5 text-right text-xs font-bold text-slate-400">{label}</span><div className="flex gap-2">{seats.map((seat) => {
                  const isSelected = selected.includes(seat.id);
                  const stateClass = seat.status === "BOOKED" ? "seat seat-booked" : seat.status === "HELD" ? "seat seat-held" : seat.status === "HELD_BY_ME" ? "seat seat-held-by-me" : `seat seat-available${isSelected ? " seat-selected" : ""}`;
                  return <button key={seat.id} type="button" className={stateClass} style={{ background: seat.colour }} onClick={() => toggle(seat)} disabled={seat.status !== "AVAILABLE"} aria-pressed={isSelected} aria-label={`Seat ${seat.rowLabel}${seat.colNumber}, ${seat.categoryName}, ${seat.status.toLowerCase()}, ${money(seat.price)}`} title={`${seat.rowLabel}${seat.colNumber} · ${seat.categoryName} · ${money(seat.price)}`}>{seat.colNumber}</button>;
                })}</div></div>)}
              </div>
            </div>
          </div>

          <div className="mx-auto mt-12 flex max-w-[760px] flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-xl border border-white/10 bg-white/8 px-5 py-4 text-xs text-slate-300 backdrop-blur">
            {data.categories.map((category) => <span key={category.id} className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded" style={{ background: category.colour }}/>{category.name} · {money(category.price)}</span>)}
            <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-slate-500 opacity-30"/>Unavailable</span>
            <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-[#8b5cf6] ring-2 ring-white"/>Selected</span>
            <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded border-2 border-dashed border-[#ec4899] bg-[#8b5cf6]"/>Your hold</span>
          </div>
        </div>
      </section>

      <aside className="flex flex-col border-l border-white/10 bg-[#1b2638]/92 backdrop-blur-xl lg:max-h-[calc(100vh-72px)] lg:sticky lg:top-[72px]">
        <div className="border-b border-white/10 p-6">
          <div className="mb-3 flex items-center justify-between"><span className="rounded-full border border-[#ec4899]/30 bg-[#ec4899]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#ffb0cd]">{data.event.type}</span><span className="text-xs font-semibold text-emerald-300">{data.soldOut ? "Waitlist open" : "Booking open"}</span></div>
          <h1 className="text-2xl font-black tracking-[-.035em]">{data.event.title}</h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-[#c4c6d4]"><Icon name="calendar" size={17} className="text-[#7bd0ff]"/>{dateTime(data.event.startsAt)}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-[#c4c6d4]"><Icon name="pin" size={17} className="text-[#7bd0ff]"/>{data.event.venueName}, {data.event.venueCity}</p>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {error && <Alert>{error}</Alert>}
          {heldByMe.length > 0 && <Alert kind="warn">You already hold {heldByMe.map((seat) => `${seat.rowLabel}${seat.colNumber}`).join(", ")}. A new hold will release them.</Alert>}
          <div><div className="flex items-center justify-between"><h2 className="font-bold">Selection summary</h2>{selectedSeats.length > 0 && <button type="button" onClick={() => setSelected([])} className="text-xs font-bold text-[#7bd0ff]">Clear</button>}</div>
            {selectedSeats.length === 0 ? <div className="mt-3 rounded-lg border border-dashed border-white/15 bg-white/[.025] px-4 py-8 text-center"><Icon name="ticket" className="mx-auto text-[#8d909d]"/><p className="mt-2 text-sm text-[#a5aabc]">Choose up to 10 seats on the map.</p></div> : <ul className="mt-3 space-y-2">{selectedSeats.map((seat) => <li key={seat.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3.5 py-3"><div><p className="text-sm font-bold">Row {seat.rowLabel}, Seat {seat.colNumber}</p><p className="text-xs font-medium" style={{ color: seat.colour }}>{seat.categoryName}</p></div><span className="font-bold">{money(seat.price)}</span></li>)}</ul>}
          </div>

          {data.categories.some((category) => category.available === 0) && <div className="rounded-lg border border-amber-400/35 bg-amber-400/10 p-4"><p className="flex items-center gap-2 text-sm font-bold text-amber-300"><Icon name="clock" size={18}/> Sold-out categories</p>{data.categories.filter((category) => category.available === 0).map((category) => <div key={category.id} className="mt-3"><p className="text-xs text-amber-200/80">{category.name} has no seats left. Join the fair FIFO waitlist.</p>{joined[category.id] !== undefined ? <p className="mt-2 text-xs font-bold text-emerald-300">You’re in position {joined[category.id]}.</p> : signedIn ? <button type="button" onClick={() => joinWaitlist(category.id)} disabled={joining === category.id} className="mt-2 rounded-md border border-amber-400/50 bg-transparent px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-400/10">{joining === category.id ? "Joining…" : `Join ${category.name} waitlist`}</button> : <Link href={`/login?next=/events/${data.event.id}/seats`} className="mt-2 inline-block text-xs font-bold text-amber-300 underline">Sign in to join</Link>}</div>)}</div>}
        </div>

        <div className="border-t border-white/10 bg-[#151b2d] p-6 shadow-[0_-16px_36px_-30px_rgba(0,0,0,.85)]">
          <div className="mb-4 flex items-end justify-between"><div><p className="text-sm text-[#c4c6d4]">{selectedSeats.length} seat{selectedSeats.length === 1 ? "" : "s"} selected</p><p className="text-xs text-[#8d909d]">Taxes included</p></div><p className="text-3xl font-black tracking-tight">{money(total)}</p></div>
          {!signedIn ? <Link href={`/login?next=/events/${data.event.id}/seats`} className={`${btn} w-full`}>Sign in to book <Icon name="arrow" size={18}/></Link> : !canBook ? <p className="rounded-lg bg-white/5 p-3 text-xs text-[#a5aabc]">Switch to a customer account to make a booking.</p> : <button type="button" onClick={continueToCheckout} disabled={selectedSeats.length === 0 || busy} className={`${btn} w-full`}>{busy ? "Securing your seats…" : selectedSeats.length ? `Hold ${selectedSeats.length} seat${selectedSeats.length > 1 ? "s" : ""} & continue` : "Select seats to continue"}<Icon name="arrow" size={18}/></button>}
          <p className="mt-3 text-center text-[11px] text-[#8d909d]"><Icon name="lock" size={12} className="mr-1 inline"/> Seats are held securely for checkout</p>
        </div>
      </aside>
    </div>
  );
}
