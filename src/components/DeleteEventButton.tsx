"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Icon } from "@/components/Icon";

export function DeleteEventButton({ eventId, eventTitle, redirectAfterDelete = false }: { eventId: string; eventTitle: string; redirectAfterDelete?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const confirmed = window.confirm(`Delete “${eventTitle}”?\n\nThis permanently removes its seats, pricing, holds and waitlist. Events with booking history are protected and cannot be deleted.`);
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/events/${eventId}`, { method: "DELETE" });
      if (redirectAfterDelete) router.push("/organiser");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button type="button" onClick={remove} disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rose-400/35 bg-rose-500/8 px-4 py-2 text-sm font-bold text-rose-300 transition hover:border-rose-400/70 hover:bg-rose-500/15 disabled:pointer-events-none disabled:opacity-45">
        <Icon name="trash" size={17} />{busy ? "Deleting…" : "Delete"}
      </button>
      {error && <p role="alert" className="max-w-64 text-right text-xs leading-4 text-rose-300">{error}</p>}
    </div>
  );
}
