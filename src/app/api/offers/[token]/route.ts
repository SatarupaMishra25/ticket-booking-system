import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getOffer, redeemOffer } from "@/lib/waitlist";
import { maybeSweep } from "@/lib/sweep";
import { ok, fail, route } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/** Details behind a time-limited offer link. */
export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  const { token } = await ctx.params;
  maybeSweep();
  const offer = await getOffer(token);

  if (!offer) return fail("This offer link is not valid or has already been used.", 404);

  const session = await getSession();

  return ok({
    expired: offer.expired,
    expiresAt: offer.entry.offerExpiresAt,
    seatLabel: offer.label,
    price: offer.price,
    category: { id: offer.entry.categoryId, name: offer.entry.category.name, colour: offer.entry.category.colour },
    event: {
      id: offer.entry.eventId,
      title: offer.entry.event.title,
      type: offer.entry.event.type,
      startsAt: offer.entry.event.startsAt,
      venue: `${offer.entry.event.venue.name}, ${offer.entry.event.venue.city}`,
    },
    /** The offer is personal; the page uses this to prompt the right sign-in. */
    forEmail: offer.entry.user.email,
    isYours: session?.userId === offer.entry.userId,
    signedIn: !!session,
  });
});

/** Redeems the offer, producing a real booking and a QR ticket email. */
export const POST = route(async (_req: NextRequest, ctx: Ctx) => {
  const { token } = await ctx.params;
  const session = await getSession();
  if (!session) return fail("Sign in to claim this seat.", 401);

  const { bookingId, reference } = await redeemOffer(token, session.userId);
  return ok({ bookingId, reference }, 201);
});
