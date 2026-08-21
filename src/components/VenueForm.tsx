"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Card, btn, btnGhost, input, label } from "@/components/ui";

type CategoryDraft = {
  name: string;
  colour: string;
  /** Comma-separated row labels, e.g. "A, B, C". */
  rows: string;
  seatsPerRow: number;
};

const PALETTE = ["#a855f7", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#6366f1"];

const blank = (i: number): CategoryDraft => ({
  name: "",
  colour: PALETTE[i % PALETTE.length],
  rows: "",
  seatsPerRow: 10,
});

/** Turns "a,b, c" into ["A","B","C"]. */
const parseRows = (raw: string) =>
  raw
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);

export function VenueForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [venue, setVenue] = useState({ name: "", city: "", address: "" });
  const [categories, setCategories] = useState<CategoryDraft[]>([
    { ...blank(0), name: "Premium", rows: "A, B" },
    { ...blank(1), name: "Standard", rows: "C, D, E, F" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totalSeats = categories.reduce(
    (sum, c) => sum + parseRows(c.rows).length * (Number(c.seatsPerRow) || 0),
    0,
  );

  function update(i: number, patch: Partial<CategoryDraft>) {
    setCategories((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = categories.map((c) => ({
      name: c.name.trim(),
      colour: c.colour,
      rows: parseRows(c.rows),
      seatsPerRow: Number(c.seatsPerRow),
    }));

    if (payload.some((c) => !c.name)) return setError("Every category needs a name.");
    if (payload.some((c) => c.rows.length === 0))
      return setError("Every category needs at least one row, e.g. A, B.");
    if (payload.some((c) => !c.rows.every((r) => /^[A-Z]{1,2}$/.test(r))))
      return setError("Row labels must be letters only, like A, B or AA.");

    setBusy(true);
    try {
      await api("/api/venues", { method: "POST", json: { ...venue, categories: payload } });
      setOpen(false);
      setVenue({ name: "", city: "", address: "" });
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
        Add venue
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full space-y-4">
      {error && <Alert>{error}</Alert>}

      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="vname">
              Venue name
            </label>
            <input
              id="vname"
              className={input}
              value={venue.name}
              onChange={(e) => setVenue({ ...venue, name: e.target.value })}
              required
              minLength={2}
              placeholder="PVR Grand Cinema"
            />
          </div>
          <div>
            <label className={label} htmlFor="vcity">
              City
            </label>
            <input
              id="vcity"
              className={input}
              value={venue.city}
              onChange={(e) => setVenue({ ...venue, city: e.target.value })}
              required
              minLength={2}
              placeholder="Bengaluru"
            />
          </div>
        </div>

        <div>
          <label className={label} htmlFor="vaddr">
            Address
          </label>
          <input
            id="vaddr"
            className={input}
            value={venue.address}
            onChange={(e) => setVenue({ ...venue, address: e.target.value })}
            required
            minLength={4}
            placeholder="MG Road, Bengaluru 560001"
          />
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <p className={`${label} mb-0`}>Seat categories &amp; layout</p>
          <span className="text-xs opacity-55">{totalSeats} seats total</span>
        </div>

        {categories.map((c, i) => (
          <div
            key={i}
            className="grid gap-3 rounded-lg border border-black/10 p-3 sm:grid-cols-[1fr_auto_1.2fr_auto_auto] sm:items-end dark:border-white/10"
          >
            <div>
              <label className="mb-1 block text-xs opacity-55">Name</label>
              <input
                className={input}
                value={c.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Premium"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs opacity-55">Colour</label>
              <input
                type="color"
                className="h-9 w-14 cursor-pointer rounded border border-black/15 bg-transparent dark:border-white/15"
                value={c.colour}
                onChange={(e) => update(i, { colour: e.target.value })}
                aria-label={`Colour for ${c.name || "category"}`}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs opacity-55">Rows (comma separated)</label>
              <input
                className={input}
                value={c.rows}
                onChange={(e) => update(i, { rows: e.target.value })}
                placeholder="A, B"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs opacity-55">Seats / row</label>
              <input
                type="number"
                min={1}
                max={40}
                className={`${input} w-24`}
                value={c.seatsPerRow}
                onChange={(e) => update(i, { seatsPerRow: Number(e.target.value) })}
                required
              />
            </div>

            {categories.length > 1 && (
              <button
                type="button"
                onClick={() => setCategories((cs) => cs.filter((_, idx) => idx !== i))}
                className="h-9 rounded-lg border border-black/15 px-3 text-xs opacity-60 hover:opacity-100 dark:border-white/15"
              >
                Remove
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => setCategories((cs) => [...cs, blank(cs.length)])}
          className={`${btnGhost} py-1.5 text-xs`}
        >
          Add category
        </button>

        <p className="text-xs opacity-50">
          Each row belongs to exactly one category. Rows A and B as Premium with 10 seats per row
          creates seats A1–A10 and B1–B10.
        </p>
      </Card>

      <div className="flex gap-2">
        <button type="submit" className={btn} disabled={busy}>
          {busy ? "Creating..." : `Create venue · ${totalSeats} seats`}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
