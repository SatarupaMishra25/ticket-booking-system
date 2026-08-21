"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api("/api/auth/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-lg border border-current/20 px-3 py-1.5 opacity-70 hover:opacity-100 disabled:opacity-40"
    >
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
