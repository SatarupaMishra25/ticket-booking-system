"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, btn, btnGhost, input, label } from "@/components/ui";
import { Icon } from "@/components/Icon";

type CategoryDraft = {
  name: string;
  colour: string;
  /** Comma-separated row labels, e.g. "A, B, C". */
  rows: string;
  seatsPerRow: number;
};

const PALETTE = ["#ec4899", "#38bdf8", "#8b5cf6", "#f59e0b", "#10b981", "#f97316"];

const blank = (index: number): CategoryDraft => ({
  name: "",
  colour: PALETTE[index % PALETTE.length],
  rows: "",
  seatsPerRow: 10,
});

const initialCategories = (): CategoryDraft[] => [
  { ...blank(0), name: "Premium", rows: "A, B" },
  { ...blank(1), name: "Standard", rows: "C, D, E, F" },
];

/** Turns "a,b, c" into ["A","B","C"]. */
const parseRows = (raw: string) =>
  raw
    .split(",")
    .map((row) => row.trim().toUpperCase())
    .filter(Boolean);

export function VenueForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [venue, setVenue] = useState({ name: "", city: "", address: "" });
  const [categories, setCategories] = useState<CategoryDraft[]>(initialCategories);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const layout = useMemo(
    () =>
      categories.flatMap((category, categoryIndex) =>
        parseRows(category.rows).map((rowLabel) => ({
          rowLabel,
          categoryIndex,
          category,
          seats: Math.max(0, Number(category.seatsPerRow) || 0),
        })),
      ),
    [categories],
  );

  const totalSeats = layout.reduce((sum, row) => sum + row.seats, 0);
  const maxSeatsPerRow = Math.max(1, ...layout.map((row) => row.seats));
  const allRows = layout.map((row) => row.rowLabel);
  const duplicateRows = [...new Set(allRows.filter((row, index) => allRows.indexOf(row) !== index))];
  const categoryTotals = categories.map((category) => ({
    ...category,
    seats: parseRows(category.rows).length * (Number(category.seatsPerRow) || 0),
  }));

  function update(index: number, patch: Partial<CategoryDraft>) {
    setCategories((current) =>
      current.map((category, categoryIndex) =>
        categoryIndex === index ? { ...category, ...patch } : category,
      ),
    );
  }

  function reset() {
    setVenue({ name: "", city: "", address: "" });
    setCategories(initialCategories());
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const payload = categories.map((category) => ({
      name: category.name.trim(),
      colour: category.colour,
      rows: parseRows(category.rows),
      seatsPerRow: Number(category.seatsPerRow),
    }));

    if (payload.some((category) => !category.name)) return setError("Every category needs a name.");
    if (payload.some((category) => category.rows.length === 0)) return setError("Every category needs at least one row, such as A, B.");
    if (payload.some((category) => !category.rows.every((row) => /^[A-Z]{1,2}$/.test(row)))) return setError("Row labels must use letters only, such as A, B or AA.");
    if (duplicateRows.length > 0) return setError(`Rows ${duplicateRows.join(", ")} are assigned more than once.`);

    setBusy(true);
    try {
      await api("/api/venues", { method: "POST", json: { ...venue, categories: payload } });
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btn}>
        <Icon name="plus" size={18} /> Build a venue
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#ec4899]">Live layout editor</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-.035em] sm:text-4xl">Venue architect</h2>
          <p className="mt-2 text-[#a5aabc]">Design category rows and preview every seat before saving.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={reset} className={btnGhost} disabled={busy}><Icon name="refresh" size={17} /> Reset</button>
          <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-bold text-[#a5aabc] hover:bg-white/5 hover:text-white" disabled={busy}>Cancel</button>
          <button type="submit" className={btn} disabled={busy || totalSeats === 0}><Icon name="check" size={18} /> {busy ? "Saving…" : "Save venue"}</button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <section className="ambient-card rounded-2xl border border-white/10 bg-[#11182a]/85 p-5 backdrop-blur-xl sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#38bdf8]/12 text-[#7bd0ff]"><Icon name="pin" size={20} /></span>
          <div><h3 className="font-bold">Venue details</h3><p className="text-xs text-[#8d909d]">The identity customers see throughout booking.</p></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div><label className={label} htmlFor="vname">Venue name</label><input id="vname" className={input} value={venue.name} onChange={(event) => setVenue({ ...venue, name: event.target.value })} required minLength={2} placeholder="Deep Sea Arena" /></div>
          <div><label className={label} htmlFor="vcity">City</label><input id="vcity" className={input} value={venue.city} onChange={(event) => setVenue({ ...venue, city: event.target.value })} required minLength={2} placeholder="Bengaluru" /></div>
          <div><label className={label} htmlFor="vaddr">Address</label><input id="vaddr" className={input} value={venue.address} onChange={(event) => setVenue({ ...venue, address: event.target.value })} required minLength={4} placeholder="MG Road, Bengaluru 560001" /></div>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="ambient-card overflow-hidden rounded-2xl border border-white/10 bg-[#07101f]/95">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4 sm:px-6">
            <div><h3 className="font-bold">Live seating map</h3><p className="mt-1 text-xs text-[#8d909d]">Updates instantly as category rows and capacity change.</p></div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-3 py-1.5 text-xs font-bold text-emerald-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Live preview</div>
          </div>

          <div className="min-h-[620px] overflow-x-auto px-4 py-10 sm:px-8">
            <div className="mx-auto min-w-[650px] max-w-[920px]">
              <div className="mx-auto mb-16 max-w-[78%] text-center">
                <div className="h-20 rounded-[50%_50%_12%_12%] border-t-2 border-[#38bdf8] bg-gradient-to-b from-[#38bdf8]/28 via-[#14233a]/35 to-transparent shadow-[0_-12px_40px_-8px_rgba(56,189,248,.45)]" />
                <p className="-mt-6 text-xs font-black uppercase tracking-[.25em] text-[#38bdf8]">Stage / screen</p>
              </div>

              {layout.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 px-8 py-24 text-center text-sm text-[#8d909d]">Add row labels in the category panel to generate the seating map.</div>
              ) : (
                <div className="space-y-2.5">
                  {layout.map((row, rowIndex) => (
                    <div key={`${row.categoryIndex}-${row.rowLabel}-${rowIndex}`} className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-3">
                      <span className="text-right text-xs font-black text-[#a5aabc]">{row.rowLabel}</span>
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${maxSeatsPerRow}, minmax(17px, 1fr))` }}>
                        {Array.from({ length: row.seats }, (_, seatIndex) => (
                          <span key={seatIndex} title={`${row.category.name || "Unlabelled"} · Seat ${row.rowLabel}${seatIndex + 1}`} className="group relative aspect-square min-h-5 max-h-9 rounded-[5px_5px_3px_3px] border border-white/15 shadow-[inset_0_-3px_0_rgba(0,0,0,.18)] transition duration-150 hover:-translate-y-1 hover:scale-110 hover:brightness-125 hover:shadow-[0_7px_16px_rgba(0,0,0,.5)]" style={{ backgroundColor: row.category.colour }}><span className="pointer-events-none absolute inset-x-0 -top-7 z-20 hidden rounded bg-black/90 px-1 py-1 text-center text-[9px] font-bold text-white group-hover:block">{row.rowLabel}{seatIndex + 1}</span></span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-xl border border-white/10 bg-[#11182a]/80 px-4 py-3">
                {categoryTotals.map((category, index) => <span key={index} className="inline-flex items-center gap-2 text-xs font-semibold text-[#c4c6d4]"><span className="h-3 w-3 rounded" style={{ background: category.colour }} />{category.name || `Category ${index + 1}`} · {category.seats}</span>)}
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-5 xl:sticky xl:top-24">
          <section className="ambient-card rounded-2xl border border-white/10 bg-[#11182a]/90 p-5 backdrop-blur-xl">
            <div className="flex items-start justify-between border-b border-white/8 pb-4"><div><h3 className="text-xl font-black tracking-tight">Category configuration</h3><p className="mt-1 text-xs text-[#8d909d]">Assign complete rows to a ticket class.</p></div><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-[#a5aabc]">{categories.length}</span></div>

            <div className="mt-5 space-y-4">
              {categories.map((category, index) => (
                <fieldset key={index} className="rounded-xl border border-white/10 bg-[#0c1324]/80 p-4">
                  <div className="mb-4 flex items-center gap-3">
                    <label className="relative grid h-8 w-8 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-white/15" style={{ background: category.colour }} title="Change category colour"><input type="color" value={category.colour} onChange={(event) => update(index, { colour: event.target.value })} className="absolute inset-0 h-12 w-12 cursor-pointer opacity-0" aria-label={`Colour for ${category.name || `category ${index + 1}`}`} /></label>
                    <input value={category.name} onChange={(event) => update(index, { name: event.target.value })} className="min-w-0 flex-1 border-0 bg-transparent text-sm font-black uppercase tracking-[.08em] outline-none placeholder:text-[#6f7486]" placeholder={`Category ${index + 1}`} required />
                    {categories.length > 1 && <button type="button" onClick={() => setCategories((current) => current.filter((_, categoryIndex) => categoryIndex !== index))} className="grid h-8 w-8 place-items-center rounded-lg text-[#8d909d] hover:bg-rose-500/10 hover:text-rose-300" aria-label={`Remove ${category.name || "category"}`}><Icon name="trash" size={17} /></button>}
                  </div>
                  <div className="grid grid-cols-[1fr_110px] gap-3">
                    <div><label className="mb-1.5 block text-xs font-bold text-[#a5aabc]">Rows</label><input className={input} value={category.rows} onChange={(event) => update(index, { rows: event.target.value })} placeholder="A, B" required /></div>
                    <div><label className="mb-1.5 block text-xs font-bold text-[#a5aabc]">Seats / row</label><input type="number" min={1} max={40} className={input} value={category.seatsPerRow} onChange={(event) => update(index, { seatsPerRow: Number(event.target.value) })} required /></div>
                  </div>
                  <p className="mt-3 text-xs text-[#8d909d]">{parseRows(category.rows).length} rows · {categoryTotals[index].seats} seats</p>
                </fieldset>
              ))}
            </div>

            <button type="button" onClick={() => setCategories((current) => [...current, blank(current.length)])} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#ec4899]/35 text-sm font-bold text-[#ffb0cd] transition hover:border-[#ec4899] hover:bg-[#ec4899]/8"><Icon name="plus" size={18} />Add category</button>
            {duplicateRows.length > 0 && <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/8 px-3 py-2 text-xs text-amber-200">Rows assigned twice: {duplicateRows.join(", ")}</p>}
          </section>

          <section className="ambient-card rounded-2xl border border-white/10 bg-[#11182a]/90 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/8 pb-4"><div><h3 className="text-xl font-black tracking-tight">Capacity overview</h3><p className="mt-1 text-xs text-[#8d909d]">Live distribution across the venue.</p></div><Icon name="chart" className="text-[#7bd0ff]" /></div>
            <div className="mt-5 flex items-baseline justify-between"><span className="text-sm font-semibold text-[#a5aabc]">Total capacity</span><span className="text-3xl font-black">{totalSeats.toLocaleString()} <small className="text-xs text-[#a5aabc]">seats</small></span></div>
            <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-white/8">{categoryTotals.map((category, index) => <span key={index} style={{ width: totalSeats ? `${(category.seats / totalSeats) * 100}%` : "0%", background: category.colour }} />)}</div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {categoryTotals.map((category, index) => <div key={index} className="rounded-lg bg-white/[.035] p-3"><p className="text-xl font-black" style={{ color: category.colour }}>{category.seats}</p><p className="mt-1 truncate text-[10px] font-black uppercase tracking-wider text-[#a5aabc]">{category.name || `Category ${index + 1}`}</p></div>)}
            </div>
            <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-[#8d909d]"><Icon name="spark" size={16} className="mt-0.5 shrink-0 text-[#ec4899]" />Ticket prices are configured per event, so the same venue can support different pricing for every show.</p>
          </section>
        </aside>
      </div>
    </form>
  );
}
