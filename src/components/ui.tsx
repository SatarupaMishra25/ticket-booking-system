import type { ReactNode } from "react";

/** Small shared primitives, so pages stay about behaviour rather than classes. */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-black/10 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5 ${className}`}
    >
      {children}
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm opacity-60">{subtitle}</p>}
    </div>
  );
}

export function Alert({
  kind = "error",
  children,
}: {
  kind?: "error" | "info" | "success" | "warn";
  children: ReactNode;
}) {
  const styles = {
    error: "border-red-300 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900",
    info: "border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900",
    success:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
    warn: "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  }[kind];

  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function Badge({ children, colour }: { children: ReactNode; colour?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-current/20 px-2 py-0.5 text-[11px] uppercase tracking-wide opacity-80"
      style={colour ? { borderColor: `${colour}66` } : undefined}
    >
      {colour && (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: colour }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-black/15 px-6 py-14 text-center text-sm opacity-60 dark:border-white/15">
      {children}
    </div>
  );
}

/** Primary / secondary button styling, usable on <button> and <Link>. */
export const btn =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40 dark:bg-white dark:text-zinc-900";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/5 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/5";

export const input =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40";

export const label = "mb-1.5 block text-sm font-medium opacity-80";
