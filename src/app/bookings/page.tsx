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
      <div className="mb-8 flex gap-2 overflow-x-auto border-b border-[#d8d4e4] pb-4">{tabs.map((tab) => <Link key={tab.key} href={tab.key === "all" ? "/bookings" : `/bookings?status=${tab.key}`} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${filter === tab.key ? "border border-[#b9b2ff] bg-[#e3dfff] text-[#2a14b4]" : "text-[#565564] hover:bg-white"}`}>{tab.label}</Link>)}</div>
      {visible.length === 0 ? <Empty>No {filter === "all" ? "" : filter} bookings found. <Link href="/events" className="font-bold text-[#2a14b4] underline">Browse events</Link></Empty> : (
        <div className="grid gap-5 lg:grid-cols-2">
          {visible.map((booking) => {
            const cancelled = booking.status === "CANCELLED";
            const past = booking.started && !cancelled;
            const status = cancelled ? "Cancelled" : past ? "Past event" : "Confirmed";
            return <article key={booking.id} className={`ambient-card rounded-xl border bg-white p-5 sm:p-6 ${cancelled ? "border-[#dedce3] opacity-65" : "border-[#c7c4d7]"}`}>
              <div className="flex items-start justify-between gap-3"><div><p className={`text-xs font-mono text-[#777586] ${cancelled ? "line-through" : ""}`}>{booking.reference}</p><h2 className="mt-2 text-xl font-bold tracking-[-.025em]">{booking.event.title}</h2><p className="mt-2 flex items-center gap-2 text-sm text-[#565564]"><Icon name="pin" size={16}/>{booking.event.venue}</p></div><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${cancelled ? "bg-zinc-100 text-zinc-600" : past ? "bg-[#f0ecf8] text-[#565564]" : "bg-emerald-100 text-emerald-800"}`}><span className={`h-1.5 w-1.5 rounded-full ${cancelled || past ? "bg-zinc-500" : "bg-emerald-600"}`}/>{status}</span></div>
              <div className={`mt-5 grid grid-cols-2 gap-4 rounded-lg p-4 ${cancelled ? "border border-dashed border-[#c7c4d7]" : "bg-[#f0ecf8]"}`}><div><p className="text-xs text-[#777586]">Date & time</p><p className={`mt-1 text-sm font-bold ${cancelled ? "line-through" : ""}`}>{dateTime(booking.event.startsAt)}</p></div><div><p className="text-xs text-[#777586]">Tickets</p><p className="mt-1 text-sm font-bold">{booking.seats.length}× {booking.seats[0]?.category ?? "Admission"}</p></div><div><p className="text-xs text-[#777586]">Seats</p><p className="mt-1 text-sm font-bold">{booking.seats.map((seat) => seat.label).join(", ") || "Unreserved"}</p></div><div><p className="text-xs text-[#777586]">Total paid</p><p className="mt-1 text-sm font-bold">{money(booking.totalAmount)}</p></div></div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">{!cancelled && <Link href={`/bookings/${booking.id}`} className={`${btn} flex-1`}><Icon name="ticket" size={17}/>{past ? "View receipt" : "View ticket"}</Link>}{booking.cancellable && <div className="flex-1 [&>button]:w-full"><CancelBookingButton bookingId={booking.id} reference={booking.reference}/></div>}{cancelled && <div className="w-full rounded-lg bg-[#f6f2fe] py-3 text-center text-sm font-bold text-[#9a96a8]">Booking cancelled</div>}</div>
            </article>;
          })}
        </div>
      )}
    </div>
  );
}
