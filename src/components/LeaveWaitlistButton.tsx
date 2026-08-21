"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function LeaveWaitlistButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/waitlist/${id}`, { method: "DELETE" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="text-xs opacity-55 underline-offset-2 hover:underline hover:opacity-100 disabled:opacity-30"
    >
      {busy ? "Leaving..." : "Leave queue"}
    </button>
  );
}
