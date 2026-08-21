"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { money, dateTime, countdown } from "@/lib/format";
import { Alert, Card, btn, btnGhost } from "@/components/ui";

type Hold = {
  holdRef: string;
  expiresAt: string;
  event: { id: string; title: string; type: string; startsAt: string; venue: string };
  seats: { seatId: string; label: string; category: string; colour: string; price: number }[];
  total: number;
};

export function Checkout({ hold, customerEmail }: { hold: Hold; customerEmail: string }) {
  const router = useRouter();
  const [left, setLeft] = useState("--:--");
  const [expired, setExpired] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The countdown is a display of the server's expiry, not a second source of
  // truth: the booking request re-checks the hold server-side regardless.
  useEffect(() => {
    const tick = () => {
      const ms = new Date(hold.expiresAt).getTime() - Date.now();
      setLeft(countdown(hold.expiresAt));
      setUrgent(ms > 0 && ms < 60_000);
      if (ms <= 0) {
        setExpired(true);
        return false;
      }
      return true;
    };
    tick();
    const t = setInterval(() => {
      if (!tick()) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [hold.expiresAt]);

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      const { bookingId } = await api<{ bookingId: string }>("/api/bookings", {
        method: "POST",
        json: { holdRef: hold.holdRef },
      });
      router.push(`/bookings/${bookingId}?new=1`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function release() {
    setBusy(true);
    try {
      await api(`/api/holds/${hold.holdRef}`, { method: "DELETE" });
    } catch {
      // Even if the release call fails the hold expires on its own.
    }
    router.push(`/events/${hold.event.id}`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {expired ? (
        <Alert>
          This hold has expired and the seats went back on sale.{" "}
          <Link href={`/events/${hold.event.id}`} className="underline">
            Pick seats again
          </Link>
          .
        </Alert>
      ) : (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            urgent
              ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
              : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          }`}
        >
          Seats held for{" "}
          <strong className="font-mono tabular-nums">{left}</strong> — after that they return to
          the pool automatically.
        </div>
      )}

      {error && <Alert>{error}</Alert>}

      <Card>
        <h2 className="font-semibold leading-snug">{hold.event.title}</h2>
        <p className="mt-1 text-sm opacity-60">
          {hold.event.venue} · {dateTime(hold.event.startsAt)}
        </p>

        <ul className="mt-5 space-y-2 text-sm">
          {hold.seats.map((s) => (
            <li key={s.seatId} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.colour }} />
                <strong className="font-medium">{s.label}</strong>
                <span className="opacity-50">{s.category}</span>
              </span>
              <span>{money(s.price)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-between border-t border-black/10 pt-4 font-semibold dark:border-white/10">
          <span>Total</span>
          <span>{money(hold.total)}</span>
        </div>

        <p className="mt-4 text-xs opacity-55">
          Your QR ticket will be emailed to {customerEmail}.
        </p>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={confirm}
            disabled={busy || expired}
            className={`${btn} w-full`}
          >
            {busy ? "Confirming..." : `Confirm booking · ${money(hold.total)}`}
          </button>
          <button type="button" onClick={release} disabled={busy} className={`${btnGhost} w-full`}>
            Release seats and go back
          </button>
        </div>
      </Card>

      <p className="text-center text-xs opacity-45">
        No payment is taken — this is a demonstration checkout.
      </p>
    </div>
  );
}
