import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { renderQrDataUrl } from "@/lib/email";
import { money, dateTime } from "@/lib/format";
import { Alert, Badge, Card, PageTitle, btnGhost } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: isNew } = await searchParams;

  const session = await getSession();
  if (!session) redirect(`/login?next=/bookings/${id}`);

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      event: { include: { venue: true } },
      seats: { include: { venueSeat: { include: { category: true } } } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!booking) notFound();
  if (booking.userId !== session.userId && session.role !== "ADMIN") notFound();

  // The QR encodes the booking reference, matching the emailed ticket exactly.
  const qr = await renderQrDataUrl(booking.reference);

  const seats = booking.seats
    .map((s) => ({
      label: `${s.venueSeat.rowLabel}${s.venueSeat.colNumber}`,
      category: s.venueSeat.category.name,
      colour: s.venueSeat.category.colour,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  const cancelled = booking.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-lg">
      <PageTitle title={cancelled ? "Cancelled booking" : "Your ticket"} />

      {isNew && !cancelled && (
        <div className="mb-4">
          <Alert kind="success">
            Booking confirmed. A copy of this ticket has been emailed to {booking.user.email}.
          </Alert>
        </div>
      )}

      {cancelled && (
        <div className="mb-4">
          <Alert>
            This booking was cancelled
            {booking.cancelledAt ? ` on ${dateTime(booking.cancelledAt)}` : ""}. The seats have
            been released.
          </Alert>
        </div>
      )}

      <Card className={cancelled ? "opacity-60" : ""}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge>{booking.event.type}</Badge>
            <h2 className="mt-3 text-lg font-semibold leading-snug">{booking.event.title}</h2>
            <p className="mt-1 text-sm opacity-60">
              {booking.event.venue.name}, {booking.event.venue.city}
            </p>
          </div>
        </div>

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="opacity-55">When</dt>
            <dd>{dateTime(booking.event.startsAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="opacity-55">Name</dt>
            <dd>{booking.user.name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="opacity-55">Seats</dt>
            <dd className="text-right">
              {seats.map((s) => (
                <span key={s.label} className="ml-1.5 inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.colour }} />
                  {s.label}
                </span>
              ))}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="opacity-55">Booked</dt>
            <dd>{dateTime(booking.createdAt)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-black/10 pt-2 font-semibold dark:border-white/10">
            <dt>Total paid</dt>
            <dd>{money(booking.totalAmount)}</dd>
          </div>
        </dl>

        <div className="mt-6 rounded-xl bg-black/[0.03] p-6 text-center dark:bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`QR code encoding booking reference ${booking.reference}`}
            width={190}
            height={190}
            className="mx-auto rounded-lg bg-white p-2"
          />
          <p className="mt-3 font-mono text-base tracking-[0.15em]">{booking.reference}</p>
          <p className="mt-1 text-xs opacity-50">
            {cancelled ? "This ticket is no longer valid" : "Show this QR code at the gate"}
          </p>
        </div>
      </Card>

      <div className="mt-4 flex justify-center">
        <Link href="/bookings" className={btnGhost}>
          &larr; All bookings
        </Link>
      </div>
    </div>
  );
}
