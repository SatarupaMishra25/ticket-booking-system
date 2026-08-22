import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getBookingHistory } from "@/lib/bookings";
import { money, dateTime } from "@/lib/format";
import { CancelBookingButton } from "@/components/CancelBookingButton";
import { Empty, PageTitle, btn } from "@/components/ui";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
type Filter = "all" | "upcoming" | "past" | "cancelled";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/bookings");
  const bookings = await getBookingHistory(session.userId);
  const value = (await searchParams).status;
  const filter: Filter = value === "upcoming" || value === "past" || value === "cancelled" ? value : "all";
  const visible = bookings.filter((booking) => filter === "all" || filter === "upcoming" ? (filter === "all" ? true : !booking.started && booking.status !== "CANCELLED") : filter === "past" ? booking.started && booking.status !== "CANCELLED" : booking.status === "CANCELLED");
  const tabs: { key: Filter; label: string }[] = [{ key: "all", label: "All bookings" }, { key: "upcoming", label: "Upcoming" }, { key: "past", label: "Past" }, { key: "cancelled", label: "Cancelled" }];

  return (
    <div>
      <PageTitle title="My bookings" subtitle="View and manage your upcoming and past event reservations." />
      <div className="mb-8 flex gap-2 overflow-x-auto border-b border-white/10 pb-4">{tabs.map((tab) => <Link key={tab.key} href={tab.key === "all" ? "/bookings" : `/bookings?status=${tab.key}`} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${filter === tab.key ? "border border-[#ec4899]/45 bg-[#ec4899]/10 text-[#ffb0cd]" : "text-[#a5aabc] hover:bg-white/5 hover:text-white"}`}>{tab.label}</Link>)}</div>
      {visible.length === 0 ? <Empty>No {filter === "all" ? "" : filter} bookings found. <Link href="/events" className="font-bold text-[#7bd0ff] underline">Browse events</Link></Empty> : (
        <div className="grid gap-5 lg:grid-cols-2">
          {visible.map((booking) => {
            const cancelled = booking.status === "CANCELLED";
            const past = booking.started && !cancelled;
            const status = cancelled ? "Cancelled" : past ? "Past event" : "Confirmed";
            return <article key={booking.id} className={`ambient-card rounded-xl border bg-[#151b2d]/75 p-5 backdrop-blur sm:p-6 ${cancelled ? "border-white/5 opacity-65" : "border-white/8"}`}>
              <div className="flex items-start justify-between gap-3"><div><p className={`text-xs font-mono text-[#8d909d] ${cancelled ? "line-through" : ""}`}>{booking.reference}</p><h2 className="mt-2 text-xl font-bold tracking-[-.025em]">{booking.event.title}</h2><p className="mt-2 flex items-center gap-2 text-sm text-[#a5aabc]"><Icon name="pin" size={16} className="text-[#7bd0ff]"/>{booking.event.venue}</p></div><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${cancelled ? "border-white/10 bg-white/5 text-[#8d909d]" : past ? "border-violet-400/25 bg-violet-400/10 text-violet-300" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${cancelled || past ? "bg-[#8d909d]" : "bg-emerald-400"}`}/>{status}</span></div>
              <div className={`mt-5 grid grid-cols-2 gap-4 rounded-lg p-4 ${cancelled ? "border border-dashed border-white/10" : "bg-white/[.035]"}`}><div><p className="text-xs text-[#8d909d]">Date & time</p><p className={`mt-1 text-sm font-bold ${cancelled ? "line-through" : ""}`}>{dateTime(booking.event.startsAt)}</p></div><div><p className="text-xs text-[#8d909d]">Tickets</p><p className="mt-1 text-sm font-bold">{booking.seats.length}× {booking.seats[0]?.category ?? "Admission"}</p></div><div><p className="text-xs text-[#8d909d]">Seats</p><p className="mt-1 text-sm font-bold">{booking.seats.map((seat) => seat.label).join(", ") || "Unreserved"}</p></div><div><p className="text-xs text-[#8d909d]">Total paid</p><p className="mt-1 text-sm font-bold">{money(booking.totalAmount)}</p></div></div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">{!cancelled && <Link href={`/bookings/${booking.id}`} className={`${btn} flex-1`}><Icon name="ticket" size={17}/>{past ? "View receipt" : "View ticket"}</Link>}{booking.cancellable && <div className="flex-1 [&>button]:w-full"><CancelBookingButton bookingId={booking.id} reference={booking.reference}/></div>}{cancelled && <div className="w-full rounded-lg bg-white/[.035] py-3 text-center text-sm font-bold text-[#8d909d]">Booking cancelled</div>}</div>
            </article>;
          })}
        </div>
      )}
    </div>
  );
}
