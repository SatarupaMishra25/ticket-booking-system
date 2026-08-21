"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Alert, btn, input, label } from "@/components/ui";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "CUSTOMER" as "CUSTOMER" | "ORGANISER",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await api<{ role: string }>(`/api/auth/${mode}`, {
        method: "POST",
        json:
          mode === "register"
            ? form
            : { email: form.email, password: form.password },
      });

      // Send each role somewhere useful rather than always to the home page.
      const home =
        next ??
        (user.role === "ADMIN"
          ? "/admin/venues"
          : user.role === "ORGANISER"
            ? "/organiser"
            : "/events");

      router.push(home);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}

      {mode === "register" && (
        <div>
          <label className={label} htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            className={input}
            value={form.name}
            onChange={set("name")}
            required
            minLength={2}
            autoComplete="name"
          />
        </div>
      )}

      <div>
        <label className={label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className={input}
          value={form.email}
          onChange={set("email")}
          required
          autoComplete="email"
        />
      </div>

      <div>
        <label className={label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className={input}
          value={form.password}
          onChange={set("password")}
          required
          minLength={mode === "register" ? 8 : 1}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
        />
        {mode === "register" && (
          <p className="mt-1 text-xs opacity-50">At least 8 characters.</p>
        )}
      </div>

      {mode === "register" && (
        <div>
          <label className={label} htmlFor="role">
            I am a
          </label>
          <select id="role" className={input} value={form.role} onChange={set("role")}>
            <option value="CUSTOMER">Customer — book seats</option>
            <option value="ORGANISER">Organiser — list events</option>
          </select>
          <p className="mt-1 text-xs opacity-50">
            Admin accounts are created by seeding, not self-registration.
          </p>
        </div>
      )}

      <button type="submit" className={`${btn} w-full`} disabled={busy}>
        {busy ? "Please wait..." : mode === "register" ? "Create account" : "Sign in"}
      </button>

      <p className="text-center text-sm opacity-70">
        {mode === "register" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/register" className="underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
