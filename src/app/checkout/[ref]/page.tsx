import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getHoldForCheckout } from "@/lib/seats";
import { Checkout } from "@/components/Checkout";
import { Alert, PageTitle } from "@/components/ui";
import { Icon } from "@/components/Icon";

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
      <div className="ambient-card mb-8 grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-[#151b2d]/80 px-5 py-4 text-xs font-bold sm:px-8 sm:py-5 sm:text-sm">
        <span className="inline-flex items-center gap-2 text-emerald-300"><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-400/15"><Icon name="check" size={16} /></span><span className="hidden sm:inline">Seats</span></span>
        <span className="h-px bg-gradient-to-r from-emerald-400 to-[#ec4899]" />
        <span className="inline-flex items-center gap-2 text-[#ffb0cd]"><span className="grid h-8 w-8 place-items-center rounded-full border border-[#ec4899] bg-[#ec4899]/15">2</span><span className="hidden sm:inline">Payment</span></span>
        <span className="h-px bg-white/15" />
        <span className="inline-flex items-center gap-2 text-[#6f7486]"><span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5">3</span><span className="hidden sm:inline">Confirm</span></span>
      </div>
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
