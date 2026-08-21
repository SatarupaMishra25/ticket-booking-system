/** Formatting helpers shared by server and client components. */

/** Money is stored in paise; render it as rupees. */
export const money = (paise: number) =>
  `\u20B9${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const dateTime = (d: Date | string) =>
  new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export const dateOnly = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" });

/** "4:31" style countdown from a future timestamp. */
export function countdown(to: Date | string): string {
  const ms = new Date(to).getTime() - Date.now();
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
