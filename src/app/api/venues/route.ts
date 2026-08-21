import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, route } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Anyone may list venues; only ADMIN may create them. */
export const GET = route(async () => {
  const venues = await prisma.venue.findMany({
    orderBy: { name: "asc" },
    include: {
      categories: { orderBy: { name: "asc" } },
      _count: { select: { seats: true, events: true } },
    },
  });
  return ok({ venues });
});

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(4).max(240),
  categories: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        colour: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a hex code like #6366f1"),
        /** Row labels this category covers, e.g. ["A","B"]. */
        rows: z
          .array(z.string().trim().regex(/^[A-Z]{1,2}$/, "Row labels look like A, B or AA"))
          .min(1),
        seatsPerRow: z.number().int().min(1).max(40),
      }),
    )
    .min(1, "Add at least one seat category."),
});

export const POST = route(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const body = Body.parse(await req.json());

  // A row may only belong to one category, or the layout is ambiguous.
  const allRows = body.categories.flatMap((c) => c.rows);
  const duplicate = allRows.find((r, i) => allRows.indexOf(r) !== i);
  if (duplicate) {
    return fail(`Row ${duplicate} is listed in more than one category.`, 422);
  }

  const names = body.categories.map((c) => c.name.toLowerCase());
  if (new Set(names).size !== names.length) {
    return fail("Seat category names must be unique within a venue.", 422);
  }

  const venue = await prisma.$transaction(async (tx) => {
    const created = await tx.venue.create({
      data: { name: body.name, city: body.city, address: body.address },
    });

    for (const c of body.categories) {
      const category = await tx.seatCategory.create({
        data: { venueId: created.id, name: c.name, colour: c.colour },
      });
      await tx.venueSeat.createMany({
        data: c.rows.flatMap((rowLabel) =>
          Array.from({ length: c.seatsPerRow }, (_, i) => ({
            venueId: created.id,
            categoryId: category.id,
            rowLabel,
            colNumber: i + 1,
          })),
        ),
      });
    }

    return created;
  });

  const full = await prisma.venue.findUniqueOrThrow({
    where: { id: venue.id },
    include: { categories: true, _count: { select: { seats: true } } },
  });

  return ok({ venue: full }, 201);
});
