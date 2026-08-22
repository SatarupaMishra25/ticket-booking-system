import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getWaitlistForUser } from "@/lib/waitlist";
import { dateTime } from "@/lib/format";
import { LeaveWaitlistButton } from "@/components/LeaveWaitlistButton";
import { Badge, Card, Empty, PageTitle, btn } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  WAITING: "border border-sky-400/25 bg-sky-400/10 text-sky-300",
  OFFERED: "border border-amber-400/25 bg-amber-400/10 text-amber-300",
  CONVERTED: "border border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  EXPIRED: "border border-white/10 bg-white/5 text-[#8d909d]",
  CANCELLED: "border border-white/10 bg-white/5 text-[#8d909d]",
};

export default async function WaitlistPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/waitlist");

  const entries = await getWaitlistForUser(session.userId);

  return (
    <div>
      <PageTitle
        title="Waitlist"
        subtitle="When a seat frees up, the person at the front of the queue is emailed a time-limited link."
      />

      {entries.length === 0 ? (
        <Empty>
          You are not on any waitlists.{" "}
          <Link href="/events" className="underline">
            Find a sold-out show
          </Link>
        </Empty>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <Card key={e.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge colour={e.category.colour}>{e.category.name}</Badge>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        STATUS_STYLE[e.status] ?? ""
                      }`}
                    >
                      {e.status}
                    </span>
                  </div>

                  <h2 className="mt-2 font-semibold leading-snug">{e.event.title}</h2>
                  <p className="mt-1 text-sm opacity-60">
                    {e.event.venue} · {dateTime(e.event.startsAt)}
                  </p>

                  {e.status === "WAITING" && (
                    <p className="mt-2 text-sm">
                      You are <strong>number {e.position}</strong> in the queue.
                    </p>
                  )}
                  {e.offerLive && e.offerExpiresAt && (
                    <p className="mt-2 text-sm text-amber-300">
                      A seat is being held for you until {dateTime(e.offerExpiresAt)}.
                    </p>
                  )}
                  {e.status === "EXPIRED" && (
                    <p className="mt-2 text-sm opacity-60">
                      Your offer ran out and the seat moved to the next person.
                    </p>
                  )}
                  {e.status === "CONVERTED" && (
                    <p className="mt-2 text-sm opacity-60">
                      You claimed this seat —{" "}
                      <Link href="/bookings" className="underline">
                        see your booking
                      </Link>
                      .
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  {e.offerLive && e.offerToken && (
                    <Link href={`/offer/${e.offerToken}`} className={`${btn} px-3 py-1.5 text-xs`}>
                      Claim your seat
                    </Link>
                  )}
                  {(e.status === "WAITING" || e.status === "OFFERED") && (
                    <LeaveWaitlistButton id={e.id} />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
