import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TBS — Fair, fast ticket booking", template: "%s · TBS" },
  description: "Book live events with race-proof seat holds, automatic waitlists, and secure QR tickets.",
};

function navFor(role: string | undefined) {
  const common = [{ href: "/events", label: "Events" }];
  if (role === "ADMIN") return [...common, { href: "/bookings", label: "Bookings" }, { href: "/organiser", label: "Dashboard" }, { href: "/admin/venues", label: "Venues" }];
  if (role === "ORGANISER") return [...common, { href: "/organiser", label: "Dashboard" }];
  if (role === "CUSTOMER") return [...common, { href: "/bookings", label: "My Bookings" }, { href: "/waitlist", label: "Waitlist" }];
  return common;
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <AppHeader nav={navFor(session?.role)} user={session ? { name: session.name, role: session.role } : null} />
        <main className="mx-auto min-h-[calc(100vh-150px)] max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">{children}</main>
        <footer className="border-t border-white/10 bg-[#151b2d]">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-7 text-sm text-[#a5aabc] sm:flex-row sm:items-center sm:px-8">
            <Link href="/" className="font-black tracking-tight text-[#ec4899]">TBS</Link>
            <p className="sm:ml-auto">© 2026 Ticket Booking System. Built for scale and fairness.</p>
            <div className="flex gap-5"><Link href="/">About</Link><Link href="/">Support</Link><Link href="/">Privacy</Link></div>
          </div>
        </footer>
      </body>
    </html>
  );
}
