import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ticket Booking System",
  description:
    "Book movie and concert seats from a live seat map, with held-seat expiry, waitlists and QR tickets.",
};

/** Nav links differ per role, so the header is rendered on the server. */
function navFor(role: string | undefined) {
  const common = [{ href: "/events", label: "Events" }];
  if (role === "ADMIN")
    return [
      ...common,
      { href: "/admin/venues", label: "Venues" },
      { href: "/organiser", label: "Dashboard" },
    ];
  if (role === "ORGANISER") return [...common, { href: "/organiser", label: "Dashboard" }];
  if (role === "CUSTOMER")
    return [
      ...common,
      { href: "/bookings", label: "My bookings" },
      { href: "/waitlist", label: "Waitlist" },
    ];
  return common;
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-black/10 dark:border-white/10 sticky top-0 z-20 backdrop-blur bg-[var(--background)]/85">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
            <Link href="/" className="font-semibold tracking-tight">
              Ticket<span className="opacity-50">Booking</span>
            </Link>

            <nav className="flex items-center gap-5 text-sm">
              {navFor(session?.role).map((l) => (
                <Link key={l.href} href={l.href} className="opacity-70 hover:opacity-100">
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-3 text-sm">
              {session ? (
                <>
                  <span className="hidden sm:inline opacity-60">
                    {session.name}
                    <span className="ml-2 rounded-full border border-current/20 px-2 py-0.5 text-[10px] uppercase tracking-wide opacity-70">
                      {session.role}
                    </span>
                  </span>
                  <SignOutButton />
                </>
              ) : (
                <>
                  <Link href="/login" className="opacity-70 hover:opacity-100">
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-white dark:bg-white dark:text-zinc-900"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>

        <footer className="mx-auto max-w-6xl px-5 pb-10 pt-4 text-xs opacity-45">
          Seat holds expire automatically. Cancelled seats are offered to the waitlist in order.
        </footer>
      </body>
    </html>
  );
}
