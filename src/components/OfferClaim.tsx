"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { money, countdown } from "@/lib/format";
import { Alert, btn } from "@/components/ui";

/**
 * The claim half of a waitlist offer.  The countdown mirrors the server's
 * `offerExpiresAt`; the server re-validates it on submit either way, so a
 * clock that drifts cannot buy anybody extra time.
 */
export function OfferClaim({
  token,
  expiresAt,
  price,
}: {
  token: string;
  expiresAt: string;
  price: number;
}) {
  const router = useRouter();
  const [left, setLeft] = useState("--:--");
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tick = () => {
      setLeft(countdown(expiresAt));
      if (new Date(expiresAt).getTime() - Date.now() <= 0) {
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
  }, [expiresAt]);

  async function claim() {
    setError(null);
    setBusy(true);
    try {
      const { bookingId } = await api<{ bookingId: string }>(`/api/offers/${token}`, {
        method: "POST",
      });
      router.push(`/bookings/${bookingId}?new=1`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (expired) {
    return (
      <Alert>
        This offer has run out, so the seat has gone to the next person on the waitlist.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}

      <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
        Reserved for you for{" "}
        <strong className="font-mono tabular-nums">{left}</strong> — after that it passes to the
        next person in the queue.
      </div>

      <button type="button" onClick={claim} disabled={busy} className={`${btn} w-full`}>
        {busy ? "Confirming..." : `Claim this seat · ${money(price)}`}
      </button>
    </div>
  );
}
