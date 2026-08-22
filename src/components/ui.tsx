import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ambient-card rounded-xl border border-white/8 bg-[#151b2d]/80 p-5 backdrop-blur-xl ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="mb-7"><h1 className="text-3xl font-bold tracking-[-0.025em] text-[#e1e2ec] sm:text-4xl">{title}</h1>{subtitle && <p className="mt-2 max-w-2xl text-base text-[#a5aabc]">{subtitle}</p>}</div>;
}

export function Alert({ kind = "error", children }: { kind?: "error" | "info" | "success" | "warn"; children: ReactNode }) {
  const styles = { error: "border-red-400/30 bg-red-500/10 text-red-200", info: "border-sky-400/30 bg-sky-500/10 text-sky-200", success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200", warn: "border-amber-400/30 bg-amber-500/10 text-amber-200" }[kind];
  return <div role="status" className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${styles}`}>{children}</div>;
}

export function Badge({ children, colour }: { children: ReactNode; colour?: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#c4c6d4]">{colour && <span className="h-2 w-2 rounded-full" style={{ background: colour }} aria-hidden />}{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/15 bg-white/[.025] px-6 py-16 text-center text-sm text-[#a5aabc]">{children}</div>;
}

export const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#ec4899] px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_28px_-10px_rgba(236,72,153,.85)] transition hover:-translate-y-0.5 hover:bg-[#f751a1] hover:shadow-[0_0_34px_-8px_rgba(236,72,153,.95)] disabled:pointer-events-none disabled:opacity-40";
export const btnGhost = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#7bd0ff]/40 bg-[#7bd0ff]/5 px-5 py-2.5 text-sm font-bold text-[#7bd0ff] transition hover:border-[#7bd0ff] hover:bg-[#7bd0ff]/15 disabled:pointer-events-none disabled:opacity-40";
export const input = "w-full min-h-11 rounded-lg border border-white/10 bg-[#070d1f] px-3.5 py-2.5 text-sm text-[#e1e2ec] shadow-sm outline-none placeholder:text-[#6f7486] focus:border-[#7bd0ff] focus:ring-4 focus:ring-[#38bdf8]/10";
export const label = "mb-1.5 block text-sm font-semibold text-[#c4c6d4]";
