import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, route } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Event browse with filters.
 *   ?q=       title search
 *   ?type=    MOVIE | CONCERT
 *   ?city=    venue city
 *   ?mine=1   the caller's own events (ORGANISER / ADMIN)
 *   ?past=1   include events that have already started
 */
export const GET = route(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const where: Prisma.EventWhereInput = {};

  const q = sp.get("q")?.trim();
  if (q) where.title = { contains: q, mode: "insensitive" };

  const type = sp.get("type");
  if (type === "MOVIE" || type === "CONCERT") where.type = type;

  const city = sp.get("city")?.trim();
  if (city) where.venue = { city: { equals: city, mode: "insensitive" } };

  if (sp.get("mine") === "1") {
    const session = await requireRole("ORGANISER", "ADMIN");
    if (session.role === "ORGANISER") where.organiserId = session.userId;
  } else if (sp.get("past") !== "1") {
    where.startsAt = { gte: new Date() };
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { startsAt: "asc" },
    include: {
      venue: { include: { categories: { orderBy: { name: "asc" } } } },
      pricing: true,
      organiser: { select: { name: true } },
      _count: { select: { seats: true } },
    },
  });

  // Availability counts use the same lazy-expiry rule as the seat map, so a
  // lapsed hold is never counted as unavailable.
  const now = new Date();
  const grouped = await prisma.seat.groupBy({
    by: ["eventId"],
    where: {
      eventId: { in: events.map((e) => e.id) },
      OR: [{ status: "AVAILABLE" }, { status: "HELD", holdExpiresAt: { lte: now } }],
    },
    _count: { _all: true },
  });
  const availableBy = new Map(grouped.map((g) => [g.eventId, g._count._all]));

  return ok({
    events: events.map((e) => {
      const available = availableBy.get(e.id) ?? 0;
      return {
        id: e.id,
        title: e.title,
        type: e.type,
        description: e.description,
        startsAt: e.startsAt,
        organiser: e.organiser.name,
        venue: { id: e.venueId, name: e.venue.name, city: e.venue.city },
        categories: e.venue.categories.map((c) => ({
          id: c.id,
          name: c.name,
          colour: c.colour,
          price: e.pricing.find((p) => p.categoryId === c.id)?.price ?? 0,
        })),
        totalSeats: e._count.seats,
        availableSeats: available,
        soldOut: available === 0,
      };
    }),
  });
});

const Body = z.object({
  venueId: z.string().min(1, "Pick a venue."),
  title: z.string().trim().min(2).max(160),
  type: z.enum(["MOVIE", "CONCERT"]),
  description: z.string().trim().max(1000).default(""),
  startsAt: z.coerce.date(),
  /** categoryId -> price in paise. Every category of the venue must be priced. */
  pricing: z.record(z.string(), z.number().int().min(0)),
});

export const POST = route(async (req: NextRequest) => {
  const session = await requireRole("ORGANISER", "ADMIN");
  const body = Body.parse(await req.json());

  if (body.startsAt.getTime() <= Date.now()) {
    return fail("The event must start in the future.", 422);
  }

  const venue = await prisma.venue.findUnique({
    where: { id: body.venueId },
    include: { categories: true, seats: true },
  });
  if (!venue) return fail("Venue not found.", 404);
  if (venue.seats.length === 0) return fail("That venue has no seat layout yet.", 422);

  const missing = venue.categories.filter((c) => body.pricing[c.id] === undefined);
  if (missing.length > 0) {
    return fail(`Set a price for: ${missing.map((c) => c.name).join(", ")}`, 422);
  }

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        organiserId: session.userId,
        venueId: venue.id,
        title: body.title,
        type: body.type,
        description: body.description,
        startsAt: body.startsAt,
      },
    });

    await tx.eventPricing.createMany({
      data: venue.categories.map((c) => ({
        eventId: created.id,
        categoryId: c.id,
        price: body.pricing[c.id],
      })),
    });

    // Materialise one bookable seat per seat in the venue layout.
    await tx.seat.createMany({
      data: venue.seats.map((vs) => ({ eventId: created.id, venueSeatId: vs.id })),
    });

    return created;
  });

  return ok({ event, seatsCreated: venue.seats.length }, 201);
});
