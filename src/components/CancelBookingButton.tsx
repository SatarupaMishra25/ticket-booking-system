"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { btnGhost } from "@/components/ui";

/**
 * Cancelling frees the seats and immediately offers them to the waitlist, so
 * the confirmation spells out that it cannot be undone.
 */
export function CancelBookingButton({
  bookingId,
  reference,
}: {
  bookingId: string;
  reference: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ offersSent: number }>(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
      });
      router.refresh();
      if (res.offersSent > 0) {
        // Useful during a demo: shows the waitlist handover actually fired.
        console.info(`${res.offersSent} waitlist offer(s) sent for ${reference}`);
      }
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      setConfirming(false);
    }
  }

  if (error) {
    return <p className="text-xs font-medium text-rose-300">{error}</p>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`${btnGhost} px-3 py-1.5 text-xs`}
      >
        Cancel booking
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="opacity-60">Cancel {reference}?</span>
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-40"
      >
        {busy ? "Cancelling..." : "Yes, cancel"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="opacity-60 hover:opacity-100"
      >
        Keep it
      </button>
    </div>
  );
}
