import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getBookingHistory } from "@/lib/bookings";
import { money, dateTime } from "@/lib/format";
import { CancelBookingButton } from "@/components/CancelBookingButton";
import { Badge, Card, Empty, PageTitle, btn } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/bookings");

  const bookings = await getBookingHistory(session.userId);

  return (
    <div>
      <PageTitle title="My bookings" subtitle="Your tickets, and anything you have cancelled." />

      {bookings.length === 0 ? (
        <Empty>
          Nothing booked yet.{" "}
          <Link href="/events" className="underline">
            Browse events
          </Link>
        </Empty>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const cancelled = b.status === "CANCELLED";

            return (
              <Card key={b.id} className={cancelled ? "opacity-55" : ""}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{b.event.type}</Badge>
                      {cancelled ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                          Cancelled
                        </span>
                      ) : b.started ? (
                        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          Past event
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Confirmed
                        </span>
                      )}
                    </div>

                    <h2 className="mt-2 font-semibold leading-snug">{b.event.title}</h2>
                    <p className="mt-1 text-sm opacity-60">
                      {b.event.venue} · {dateTime(b.event.startsAt)}
                    </p>
                    <p className="mt-2 text-sm">
                      <span className="opacity-55">Seats</span>{" "}
                      <span className="font-medium">
                        {b.seats.map((s) => s.label).join(", ")}
                      </span>
                      <span className="mx-2 opacity-25">|</span>
                      <span className="opacity-55">Ref</span>{" "}
                      <span className="font-mono">{b.reference}</span>
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="font-semibold">{money(b.totalAmount)}</span>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {!cancelled && (
                        <Link href={`/bookings/${b.id}`} className={`${btn} px-3 py-1.5 text-xs`}>
                          View ticket
                        </Link>
                      )}
                      {b.cancellable && (
                        <CancelBookingButton bookingId={b.id} reference={b.reference} />
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
