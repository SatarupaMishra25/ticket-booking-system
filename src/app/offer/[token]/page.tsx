import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getOffer } from "@/lib/waitlist";
import { money, dateTime } from "@/lib/format";
import { OfferClaim } from "@/components/OfferClaim";
import { Alert, Badge, Card, PageTitle, btn } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Landing page for the time-limited link emailed to a waitlisted customer.
 * The token is the only credential in the URL, so the page still checks that
 * the signed-in account is the one the offer was made to.
 */
export default async function OfferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [offer, session] = await Promise.all([getOffer(token), getSession()]);

  if (!offer) {
    return (
      <div className="mx-auto max-w-lg">
        <PageTitle title="Seat offer" />
        <Alert>
          This offer link is not valid, or the seat has already been claimed.{" "}
          <Link href="/waitlist" className="underline">
            Check your waitlist
          </Link>
          .
        </Alert>
      </div>
    );
  }

  const { entry, event, category } = { entry: offer.entry, event: offer.entry.event, category: offer.entry.category };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageTitle
        title="A seat opened up"
        subtitle="You were next on the waitlist for this category."
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{event.type}</Badge>
          <Badge colour={category.colour}>{category.name}</Badge>
        </div>

        <h2 className="mt-3 text-lg font-semibold leading-snug">{event.title}</h2>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="opacity-55">Seat</dt>
            <dd className="font-medium">{offer.label}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="opacity-55">When</dt>
            <dd>{dateTime(event.startsAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="opacity-55">Venue</dt>
            <dd className="text-right">
              {event.venue.name}, {event.venue.city}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-white/10 pt-2 font-semibold">
            <dt>Price</dt>
            <dd>{money(offer.price)}</dd>
          </div>
        </dl>

        <div className="mt-5">
          {offer.expired ? (
            <Alert>
              This offer has expired and the seat has moved on to the next person in the queue.
            </Alert>
          ) : !session ? (
            <div className="space-y-3">
              <Alert kind="info">
                Sign in as <strong>{offer.entry.user.email}</strong> to claim this seat. The
                countdown keeps running while you do.
              </Alert>
              <Link href={`/login?next=/offer/${token}`} className={`${btn} w-full`}>
                Sign in to claim
              </Link>
            </div>
          ) : session.userId !== entry.userId ? (
            <Alert>
              This offer belongs to {offer.entry.user.email}. You are signed in as{" "}
              {session.email}.
            </Alert>
          ) : (
            <OfferClaim
              token={token}
              expiresAt={entry.offerExpiresAt!.toISOString()}
              price={offer.price}
            />
          )}
        </div>
      </Card>

      <p className="text-center text-xs opacity-45">
        Seat offers are made in queue order. If you do not claim in time, the seat is offered to
        the next person automatically.
      </p>
    </div>
  );
}
