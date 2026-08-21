import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ambient-card rounded-xl border border-[#c7c4d7] bg-white p-5 ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="mb-7"><h1 className="text-3xl font-bold tracking-[-0.025em] text-[#1b1b23] sm:text-4xl">{title}</h1>{subtitle && <p className="mt-2 max-w-2xl text-base text-[#565564]">{subtitle}</p>}</div>;
}

export function Alert({ kind = "error", children }: { kind?: "error" | "info" | "success" | "warn"; children: ReactNode }) {
  const styles = { error: "border-red-200 bg-red-50 text-red-800", info: "border-indigo-200 bg-indigo-50 text-indigo-900", success: "border-emerald-200 bg-emerald-50 text-emerald-900", warn: "border-amber-300 bg-amber-50 text-amber-900" }[kind];
  return <div role="status" className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${styles}`}>{children}</div>;
}

export function Badge({ children, colour }: { children: ReactNode; colour?: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c7c4d7] bg-[#f6f2fe] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#464554]">{colour && <span className="h-2 w-2 rounded-full" style={{ background: colour }} aria-hidden />}{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-[#b6b2c7] bg-white/70 px-6 py-16 text-center text-sm text-[#5c647a]">{children}</div>;
}

export const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#2a14b4] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-12px_rgba(42,20,180,.8)] transition hover:-translate-y-0.5 hover:bg-[#4338ca] disabled:pointer-events-none disabled:opacity-40";
export const btnGhost = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#777586] bg-white px-5 py-2.5 text-sm font-bold text-[#302f39] transition hover:border-[#2a14b4] hover:bg-[#f6f2fe] hover:text-[#2a14b4] disabled:pointer-events-none disabled:opacity-40";
export const input = "w-full min-h-11 rounded-lg border border-[#c7c4d7] bg-white px-3.5 py-2.5 text-sm text-[#1b1b23] shadow-sm outline-none placeholder:text-[#8b8997] focus:border-[#4338ca] focus:ring-4 focus:ring-[#4338ca]/10";
export const label = "mb-1.5 block text-sm font-semibold text-[#302f39]";
