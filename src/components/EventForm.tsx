"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Card, btn, input, label } from "@/components/ui";

type Venue = {
  id: string;
  name: string;
  city: string;
  seatCount: number;
  categories: { id: string; name: string; colour: string }[];
};

export function EventForm({ venues }: { venues: Venue[] }) {
  const router = useRouter();
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const [form, setForm] = useState({
    title: "",
    type: "MOVIE" as "MOVIE" | "CONCERT",
    description: "",
    startsAt: "",
  });
  /** Prices are typed in rupees and converted to paise on submit. */
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const venue = venues.find((v) => v.id === venueId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!venue) return setError("Pick a venue.");

    const pricing: Record<string, number> = {};
    for (const c of venue.categories) {
      const rupees = Number(prices[c.id]);
      if (!Number.isFinite(rupees) || rupees < 0) {
        return setError(`Enter a valid price for ${c.name}.`);
      }
      pricing[c.id] = Math.round(rupees * 100);
    }

    setBusy(true);
    try {
      await api("/api/events", {
        method: "POST",
        json: {
          venueId,
          title: form.title,
          type: form.type,
          description: form.description,
          // datetime-local has no timezone; treat it as the browser's local time.
          startsAt: new Date(form.startsAt).toISOString(),
          pricing,
        },
      });
      router.push("/organiser");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (venues.length === 0) {
    return (
      <Alert kind="warn">
        There are no venues with a seat layout yet. An admin needs to create one before events can
        be listed.
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <Card className="space-y-4">
        <div>
          <label className={label} htmlFor="title">
            Title
          </label>
          <input
            id="title"
            className={input}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            minLength={2}
            placeholder="e.g. Dune: Part Three"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="type">
              Type
            </label>
            <select
              id="type"
              className={input}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "MOVIE" | "CONCERT" })}
            >
              <option value="MOVIE">Movie</option>
              <option value="CONCERT">Concert</option>
            </select>
          </div>

          <div>
            <label className={label} htmlFor="startsAt">
              Starts at
            </label>
            <input
              id="startsAt"
              type="datetime-local"
              className={input}
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <label className={label} htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className={`${input} min-h-20`}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={1000}
            placeholder="A short blurb shown on the event card."
          />
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <label className={label} htmlFor="venue">
            Venue
          </label>
          <select
            id="venue"
            className={input}
            value={venueId}
            onChange={(e) => {
              setVenueId(e.target.value);
              setPrices({});
            }}
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}, {v.city} — {v.seatCount} seats
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs opacity-50">
            One bookable seat is created per seat in the venue layout when you publish.
          </p>
        </div>

        {venue && (
          <div>
            <p className={label}>Price per category (₹)</p>
            <div className="space-y-2">
              {venue.categories.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="inline-flex min-w-28 items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.colour }} />
                    {c.name}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={input}
                    value={prices[c.id] ?? ""}
                    onChange={(e) => setPrices({ ...prices, [c.id]: e.target.value })}
                    required
                    placeholder="0.00"
                    aria-label={`Price for ${c.name}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <button type="submit" className={`${btn} w-full`} disabled={busy}>
        {busy ? "Publishing..." : "Publish event"}
      </button>
    </form>
  );
}
