import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getHoldForCheckout } from "@/lib/seats";
import { Checkout } from "@/components/Checkout";
import { Alert, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/checkout/${ref}`);

  const hold = await getHoldForCheckout(ref, session.userId);

  if (!hold) {
    return (
      <div className="mx-auto max-w-lg">
        <PageTitle title="Checkout" />
        <Alert>
          This hold has expired or does not exist, so the seats went back on sale.{" "}
          <Link href="/events" className="underline">
            Browse events
          </Link>{" "}
          and pick again.
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Complete your booking" subtitle="Review your selected seats and enter your details to finalize." />
      <Checkout
        customerEmail={session.email}
        hold={{
          holdRef: hold.holdRef,
          expiresAt: hold.expiresAt.toISOString(),
          event: {
            ...hold.event,
            startsAt: hold.event.startsAt.toISOString(),
          },
          seats: hold.seats,
          total: hold.total,
        }}
      />
    </div>
  );
}
