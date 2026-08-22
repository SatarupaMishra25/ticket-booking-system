/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { renderQrDataUrl } from "@/lib/email";
import { money, dateTime } from "@/lib/format";
import { Alert, btnGhost } from "@/components/ui";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params; const { new: isNew } = await searchParams;
  const session = await getSession(); if (!session) redirect(`/login?next=/bookings/${id}`);
  const booking = await prisma.booking.findUnique({ where: { id }, include: { event: { include: { venue: true } }, seats: { include: { venueSeat: { include: { category: true } } } }, user: { select: { name: true, email: true } } } });
  if (!booking || (booking.userId !== session.userId && session.role !== "ADMIN")) notFound();
  const qr = await renderQrDataUrl(booking.reference);
  const seats = booking.seats.map((seat) => ({ label: `${seat.venueSeat.rowLabel}${seat.venueSeat.colNumber}`, row: seat.venueSeat.rowLabel, number: seat.venueSeat.colNumber, category: seat.venueSeat.category.name })).sort((a,b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const cancelled = booking.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-[920px] py-4 sm:py-8">
      {isNew && !cancelled && <div className="mb-6"><Alert kind="success"><span className="inline-flex items-start gap-2"><Icon name="check" size={20}/><span><strong className="block">Booking confirmed</strong>Your QR ticket has also been sent to {booking.user.email}.</span></span></Alert></div>}
      {cancelled && <div className="mb-6"><Alert>This booking was cancelled{booking.cancelledAt ? ` on ${dateTime(booking.cancelledAt)}` : ""}. This ticket is no longer valid.</Alert></div>}

      <div className={`ambient-card overflow-hidden rounded-2xl border border-white/10 bg-[#151b2d]/85 backdrop-blur-xl ${cancelled ? "opacity-60 grayscale" : ""}`}>
        <div className="grid md:grid-cols-[minmax(0,1fr)_300px]">
          <section className="relative p-6 sm:p-9">
            <div className="flex items-start justify-between gap-4"><span className="rounded-md border border-[#ec4899]/30 bg-[#ec4899]/10 px-2.5 py-1.5 text-xs font-black uppercase tracking-[.08em] text-[#ffb0cd]">{seats[0]?.category ?? "Admission"}</span><span className="font-mono text-sm font-bold text-[#a5aabc]">#{booking.reference}</span></div>
            <p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-[#8d909d]">Admit {seats.length || 1}</p>
            <h1 className="mt-2 text-4xl font-black leading-tight tracking-[-.04em]">{booking.event.title}</h1>
            <p className="mt-2 text-lg text-[#a5aabc]">Presented by TBS Live</p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-[.12em] text-[#8d909d]">Date & time</p><p className="mt-2 flex items-start gap-2 font-bold"><Icon name="calendar" size={19} className="mt-0.5 text-[#7bd0ff]"/>{dateTime(booking.event.startsAt)}</p></div><div><p className="text-xs font-black uppercase tracking-[.12em] text-[#8d909d]">Venue</p><p className="mt-2 flex items-start gap-2 font-bold"><Icon name="pin" size={19} className="mt-0.5 text-[#7bd0ff]"/>{booking.event.venue.name}, {booking.event.venue.city}</p></div></div>
            <div className="mt-8 grid grid-cols-3 rounded-xl border border-white/8 bg-white/[.035] p-5"><div><p className="text-xs font-bold uppercase text-[#8d909d]">Section</p><p className="mt-1 text-lg font-black">{seats[0]?.category ?? "General"}</p></div><div><p className="text-xs font-bold uppercase text-[#8d909d]">Row</p><p className="mt-1 text-lg font-black">{[...new Set(seats.map((seat) => seat.row))].join(", ")}</p></div><div><p className="text-xs font-bold uppercase text-[#8d909d]">Seats</p><p className="mt-1 text-lg font-black text-[#ec4899]">{seats.map((seat) => seat.number).join(", ")}</p></div></div>
            <div className="mt-6 flex items-center justify-between border-t border-white/8 pt-5 text-sm"><span className="text-[#a5aabc]">Booked for <strong className="text-[#e1e2ec]">{booking.user.name}</strong></span><span className="font-bold">{money(booking.totalAmount)}</span></div>
          </section>
          <aside className="ticket-notch relative flex flex-col items-center justify-center border-t border-dashed border-white/15 bg-[#0c1324]/60 p-7 md:border-l md:border-t-0"><p className="text-xs font-black uppercase tracking-[.14em] text-[#8d909d]">Scan at entrance</p><div className="mt-5 rounded-xl border border-white/10 bg-white p-4 shadow-[0_0_34px_-18px_rgba(123,208,255,.45)]"><img src={qr} alt={`QR code for ${booking.reference}`} width={190} height={190} className="block"/></div><p className="mt-5 font-mono text-sm font-bold tracking-[.08em]">{booking.reference}</p><p className="mt-2 text-center text-xs text-[#8d909d]">Keep your screen brightness high for a faster scan.</p></aside>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/bookings" className={btnGhost}>← All bookings</Link><Link href="/events" className={btnGhost}>Find another event</Link></div>
    </div>
  );
}
