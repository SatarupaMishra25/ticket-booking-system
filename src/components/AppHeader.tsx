"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { SignOutButton } from "@/components/SignOutButton";

type NavItem = { href: string; label: string };
type User = { name: string; role: string } | null;

export function AppHeader({ nav, user }: { nav: NavItem[]; user: User }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[#d8d4e4] bg-[#fcf8ff]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-8 px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="TBS home">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#2a14b4] text-white shadow-sm transition group-hover:rotate-[-4deg]">
            <Icon name="ticket" size={19} />
          </span>
          <span className="text-xl font-black tracking-[-0.04em] text-[#2a14b4]">TBS</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Main navigation">
          <Link href="/" className={`border-b-2 py-6 text-sm font-semibold transition ${path === "/" ? "border-[#2a14b4] text-[#2a14b4]" : "border-transparent text-[#464554] hover:text-[#2a14b4]"}`}>Home</Link>
          {nav.map((item) => {
            const active = path === item.href || (item.href !== "/" && path.startsWith(`${item.href}/`));
            return <Link key={item.href} href={item.href} className={`border-b-2 py-6 text-sm font-semibold transition ${active ? "border-[#2a14b4] text-[#2a14b4]" : "border-transparent text-[#464554] hover:text-[#2a14b4]"}`}>{item.label}</Link>;
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          <Link href="/events" className="grid h-10 w-10 place-items-center rounded-full text-[#464554] transition hover:bg-[#f0ecf8] hover:text-[#2a14b4]" aria-label="Search events"><Icon name="search" /></Link>
          {user && <Link href={user.role === "CUSTOMER" ? "/waitlist" : "/organiser"} className="relative grid h-10 w-10 place-items-center rounded-full text-[#464554] transition hover:bg-[#f0ecf8] hover:text-[#2a14b4]" aria-label="Notifications"><Icon name="bell" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#f59e0b]" /></Link>}
          {user ? (
            <div className="flex items-center gap-2 border-l border-[#d8d4e4] pl-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#e3dfff] text-[#2a14b4]" title={`${user.name} · ${user.role}`}><Icon name="user" size={18} /></div>
              <SignOutButton />
            </div>
          ) : (
            <><Link href="/login" className="px-2 py-2 text-sm font-bold text-[#302f39] hover:text-[#2a14b4]">Sign in</Link><Link href="/register" className="rounded-lg bg-[#2a14b4] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#4338ca]">Get started</Link></>
          )}
        </div>

        <button type="button" className="ml-auto grid h-10 w-10 place-items-center rounded-lg border border-[#c7c4d7] bg-white md:hidden" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Toggle navigation"><Icon name={open ? "x" : "menu"} /></button>
      </div>

      {open && (
        <div className="border-t border-[#ded9e8] bg-white px-5 py-4 md:hidden">
          <nav className="grid gap-1" aria-label="Mobile navigation">
            {[{ href: "/", label: "Home" }, ...nav].map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#302f39] hover:bg-[#f6f2fe]">{item.label}</Link>)}
            <div className="mt-2 border-t border-[#e4e1ed] pt-3">
              {user ? <SignOutButton /> : <div className="grid grid-cols-2 gap-2"><Link href="/login" className="rounded-lg border border-[#777586] px-4 py-2 text-center text-sm font-bold">Sign in</Link><Link href="/register" className="rounded-lg bg-[#2a14b4] px-4 py-2 text-center text-sm font-bold text-white">Register</Link></div>}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
