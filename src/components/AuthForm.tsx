"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Alert, btn, input, label } from "@/components/ui";
import { Icon } from "@/components/Icon";

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

  const fillDemo = (email: string) => {
    setForm((current) => ({ ...current, email, password: "Password123!" }));
    setError(null);
  };

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
        {busy ? "Please wait..." : mode === "register" ? "Create account" : "Sign in securely"}
        {!busy && <Icon name="arrow" size={17} />}
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

      {mode === "login" && (
        <div className="pt-3">
          <div className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.12em] text-[#8d909d]"><span className="h-px flex-1 bg-white/10"/>Demo credentials<span className="h-px flex-1 bg-white/10"/></div>
          <div className="rounded-lg border border-white/10 bg-white/[.025] p-3">
            <p className="mb-2 text-xs text-[#a5aabc]">Choose a role. Password is filled automatically.</p>
            {[['Admin','admin@demo.com','shield'],['Organiser','organiser@demo.com','calendar'],['Customer','customer@demo.com','user']].map(([role,email,icon]) => (
              <button key={email} type="button" onClick={() => fillDemo(email)} className="mb-2 flex w-full items-center gap-3 rounded-md border border-white/10 bg-[#0c1324] px-3 py-2.5 text-left last:mb-0 hover:border-[#ec4899]/60">
                <span className="text-[#ec4899]"><Icon name={icon as 'shield' | 'calendar' | 'user'} size={18}/></span><span className="flex-1"><strong className="block text-sm">{role}</strong><span className="text-xs text-[#8d909d]">{email}</span></span><span className="text-xs font-bold text-[#7bd0ff]">Use</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
