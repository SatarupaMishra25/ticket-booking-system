"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { money, dateTime } from "@/lib/format";
import { Alert, Badge, Card, btn, btnGhost } from "@/components/ui";

type Seat = {
  id: string;
  rowLabel: string;
  colNumber: number;
  categoryId: string;
  categoryName: string;
  colour: string;
  price: number;
  status: "AVAILABLE" | "HELD" | "BOOKED" | "HELD_BY_ME";
};

type Category = {
  id: string;
  name: string;
  colour: string;
  price: number;
  available: number;
  total: number;
};

type SeatMapData = {
  event: {
    id: string;
    title: string;
    type: string;
    description: string;
    startsAt: string;
    venueName: string;
    venueCity: string;
    organiser: string;
  };
  categories: Category[];
  seats: Seat[];
  soldOut: boolean;
};

/** How often the map re-reads server state, in ms. */
const POLL_MS = 3000;

export function SeatMap({
  initial,
  signedIn,
  canBook,
}: {
  initial: SeatMapData;
  signedIn: boolean;
  canBook: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [joined, setJoined] = useState<Record<string, number>>({});

  // Kept in a ref so the poll callback never needs to be re-created.
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const refresh = useCallback(async () => {
    try {
      const next = await api<SeatMapData>(`/api/events/${initial.event.id}`);
      setData(next);

      // Drop any selection the server no longer considers free, so the
      // customer never clicks "continue" on a seat somebody else just took.
      const free = new Set(
        next.seats.filter((s) => s.status === "AVAILABLE").map((s) => s.id),
      );
      const kept = selectedRef.current.filter((id) => free.has(id));
      if (kept.length !== selectedRef.current.length) {
        setSelected(kept);
        setError("Some of your seats were taken by another customer.");
      }
    } catch {
      // A dropped poll is not worth surfacing; the next tick will retry.
    }
  }, [initial.event.id]);

  // Polling keeps the grid in step with other customers.  It is deliberately
  // simple: no sockets to keep alive, and it survives sleeping laptops.
  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const rows = useMemo(() => {
    const byRow = new Map<string, Seat[]>();
    for (const s of data.seats) {
      if (!byRow.has(s.rowLabel)) byRow.set(s.rowLabel, []);
      byRow.get(s.rowLabel)!.push(s);
    }
    return [...byRow.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, seats]) => [label, seats.sort((x, y) => x.colNumber - y.colNumber)] as const);
  }, [data.seats]);

  const selectedSeats = data.seats.filter((s) => selected.includes(s.id));
  const total = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  function toggle(seat: Seat) {
    if (seat.status !== "AVAILABLE") return;
    setError(null);
    setSelected((cur) =>
      cur.includes(seat.id)
        ? cur.filter((id) => id !== seat.id)
        : cur.length >= 10
          ? (setError("You can book at most 10 seats at once."), cur)
          : [...cur, seat.id],
    );
  }

  async function continueToCheckout() {
    setError(null);
    setBusy(true);
    try {
      const { holdRef } = await api<{ holdRef: string }>("/api/holds", {
        method: "POST",
        json: { eventId: data.event.id, seatIds: selected },
      });
      router.push(`/checkout/${holdRef}`);
    } catch (err) {
      setError((err as Error).message);
      await refresh();
      setBusy(false);
    }
  }

  async function joinWaitlist(categoryId: string) {
    setError(null);
    setJoining(categoryId);
    try {
      const res = await api<{ position: number }>("/api/waitlist", {
        method: "POST",
        json: { eventId: data.event.id, categoryId },
      });
      setJoined((j) => ({ ...j, [categoryId]: res.position }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setJoining(null);
    }
  }

  const heldByMe = data.seats.filter((s) => s.status === "HELD_BY_ME");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      {/* ---------------- seat grid ---------------- */}
      <div>
        <Card>
          <div className="mb-6">
            <div className="screen mx-auto w-2/3" />
            <p className="mt-2 text-center text-[11px] uppercase tracking-[0.25em] opacity-40">
              Screen / Stage
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="mx-auto w-fit space-y-1.5">
              {rows.map(([label, seats]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-5 text-right text-[11px] opacity-40">{label}</span>
                  <div className="flex gap-1.5">
                    {seats.map((s) => {
                      const isSelected = selected.includes(s.id);
                      const cls =
                        s.status === "BOOKED"
                          ? "seat seat-booked"
                          : s.status === "HELD"
                            ? "seat seat-held"
                            : s.status === "HELD_BY_ME"
                              ? "seat seat-held-by-me"
                              : `seat seat-available${isSelected ? " seat-selected" : ""}`;

                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={cls}
                          style={{ background: s.colour, color: "#fff" }}
                          onClick={() => toggle(s)}
                          disabled={s.status !== "AVAILABLE"}
                          aria-pressed={isSelected}
                          aria-label={`Seat ${s.rowLabel}${s.colNumber}, ${s.categoryName}, ${
                            s.status === "AVAILABLE" ? "available" : s.status.toLowerCase()
                          }, ${money(s.price)}`}
                          title={`${s.rowLabel}${s.colNumber} · ${s.categoryName} · ${money(s.price)}`}
                        >
                          {s.colNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-black/10 pt-4 text-[11px] opacity-70 dark:border-white/10">
            {data.categories.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded" style={{ background: c.colour }} />
                {c.name} · {money(c.price)}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-zinc-400 opacity-30" />
              Booked / held
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-zinc-400 outline-2 outline-dashed outline-amber-500" />
              Held by you
            </span>
          </div>

          <p className="mt-3 text-center text-[11px] opacity-40">
            Updating live every {POLL_MS / 1000} seconds
          </p>
        </Card>
      </div>

      {/* ---------------- side panel ---------------- */}
      <div className="space-y-4">
        <Card>
          <Badge>{data.event.type}</Badge>
          <h1 className="mt-3 text-lg font-semibold leading-snug">{data.event.title}</h1>
          <p className="mt-2 text-sm opacity-60">{data.event.description}</p>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="opacity-55">When</dt>
              <dd>{dateTime(data.event.startsAt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="opacity-55">Venue</dt>
              <dd className="text-right">
                {data.event.venueName}, {data.event.venueCity}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="opacity-55">By</dt>
              <dd>{data.event.organiser}</dd>
            </div>
          </dl>
        </Card>

        {error && <Alert>{error}</Alert>}

        {heldByMe.length > 0 && (
          <Alert kind="warn">
            You already hold {heldByMe.map((s) => `${s.rowLabel}${s.colNumber}`).join(", ")} for
            this event. Continuing with a new selection releases them.
          </Alert>
        )}

        <Card>
          <h2 className="text-sm font-semibold">Your selection</h2>

          {selectedSeats.length === 0 ? (
            <p className="mt-2 text-sm opacity-55">
              {data.soldOut
                ? "This show is sold out."
                : "Tap seats on the map to select them."}
            </p>
          ) : (
            <>
              <ul className="mt-3 space-y-1.5 text-sm">
                {selectedSeats
                  .slice()
                  .sort((a, b) =>
                    `${a.rowLabel}${a.colNumber}`.localeCompare(
                      `${b.rowLabel}${b.colNumber}`,
                      undefined,
                      { numeric: true },
                    ),
                  )
                  .map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: s.colour }}
                        />
                        {s.rowLabel}
                        {s.colNumber}
                        <span className="opacity-45">{s.categoryName}</span>
                      </span>
                      <span>{money(s.price)}</span>
                    </li>
                  ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-black/10 pt-3 text-sm font-semibold dark:border-white/10">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </>
          )}

          <div className="mt-4 space-y-2">
            {!signedIn ? (
              <Link
                href={`/login?next=/events/${data.event.id}`}
                className={`${btn} w-full`}
              >
                Sign in to book
              </Link>
            ) : !canBook ? (
              <p className="text-xs opacity-55">
                You are signed in as an organiser or admin. Booking is a customer action.
              </p>
            ) : (
              <button
                type="button"
                onClick={continueToCheckout}
                disabled={selectedSeats.length === 0 || busy}
                className={`${btn} w-full`}
              >
                {busy
                  ? "Holding seats..."
                  : selectedSeats.length === 0
                    ? "Select seats"
                    : `Hold ${selectedSeats.length} seat${selectedSeats.length > 1 ? "s" : ""} & continue`}
              </button>
            )}

            {selectedSeats.length > 0 && (
              <button type="button" onClick={() => setSelected([])} className={`${btnGhost} w-full`}>
                Clear selection
              </button>
            )}
          </div>
        </Card>

        {/* Waitlist appears per category as soon as that category runs dry. */}
        <Card>
          <h2 className="text-sm font-semibold">Availability</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {data.categories.map((c) => {
              const full = c.available === 0;
              return (
                <li key={c.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.colour }} />
                      {c.name}
                    </span>
                    <span className={full ? "text-red-600 dark:text-red-400" : "opacity-60"}>
                      {full ? "Sold out" : `${c.available} / ${c.total} free`}
                    </span>
                  </div>

                  {full &&
                    (joined[c.id] !== undefined ? (
                      <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                        On the waitlist — position {joined[c.id]}. We will email you if a seat
                        frees up.
                      </p>
                    ) : signedIn ? (
                      <button
                        type="button"
                        onClick={() => joinWaitlist(c.id)}
                        disabled={joining === c.id}
                        className={`${btnGhost} mt-2 w-full py-1.5 text-xs`}
                      >
                        {joining === c.id ? "Joining..." : `Join ${c.name} waitlist`}
                      </button>
                    ) : (
                      <Link
                        href={`/login?next=/events/${data.event.id}`}
                        className={`${btnGhost} mt-2 w-full py-1.5 text-xs`}
                      >
                        Sign in to join the waitlist
                      </Link>
                    ))}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
