/**
 * Seeds demo data: one admin, one organiser, two customers, a venue with a
 * seat layout, and two events (a movie and a concert).
 *
 * Run with:  npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";

/** Layout: rows A-B are Premium, C-F are Standard, 10 seats per row. */
const LAYOUT = [
  { rows: ["A", "B"], category: "Premium", colour: "#a855f7", cols: 10 },
  { rows: ["C", "D", "E", "F"], category: "Standard", colour: "#0ea5e9", cols: 10 },
];

async function main() {
  console.log("Clearing existing data...");
  await prisma.waitlist.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.eventPricing.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venueSeat.deleteMany();
  await prisma.seatCategory.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  console.log("Creating users...");
  const admin = await prisma.user.create({
    data: { email: "admin@demo.com", name: "Admin User", role: "ADMIN", passwordHash },
  });
  const organiser = await prisma.user.create({
    data: { email: "organiser@demo.com", name: "Organiser User", role: "ORGANISER", passwordHash },
  });
  const customer = await prisma.user.create({
    data: { email: "customer@demo.com", name: "Customer One", role: "CUSTOMER", passwordHash },
  });
  const customer2 = await prisma.user.create({
    data: { email: "customer2@demo.com", name: "Customer Two", role: "CUSTOMER", passwordHash },
  });

  console.log("Creating venue and seat layout...");
  const venue = await prisma.venue.create({
    data: { name: "PVR Grand Cinema", city: "Bengaluru", address: "MG Road, Bengaluru 560001" },
  });

  const categoryByName = new Map<string, string>();
  for (const block of LAYOUT) {
    const category = await prisma.seatCategory.upsert({
      where: { venueId_name: { venueId: venue.id, name: block.category } },
      update: {},
      create: { venueId: venue.id, name: block.category, colour: block.colour },
    });
    categoryByName.set(block.category, category.id);

    await prisma.venueSeat.createMany({
      data: block.rows.flatMap((rowLabel) =>
        Array.from({ length: block.cols }, (_, i) => ({
          venueId: venue.id,
          categoryId: category.id,
          rowLabel,
          colNumber: i + 1,
        })),
      ),
    });
  }

  const venueSeats = await prisma.venueSeat.findMany({ where: { venueId: venue.id } });
  console.log(`  ${venueSeats.length} seats in layout`);

  console.log("Creating events...");
  const events = [
    {
      title: "Interstellar — IMAX Re-release",
      type: "MOVIE" as const,
      description: "Christopher Nolan's space epic, back on the big screen.",
      startsAt: new Date(Date.now() + 3 * 24 * 3600_000),
      prices: { Premium: 45000, Standard: 25000 },
    },
    {
      title: "Coldplay — Music of the Spheres",
      type: "CONCERT" as const,
      description: "The world tour lands in Bengaluru for one night only.",
      startsAt: new Date(Date.now() + 10 * 24 * 3600_000),
      prices: { Premium: 900000, Standard: 450000 },
    },
  ];

  for (const e of events) {
    const event = await prisma.event.create({
      data: {
        organiserId: organiser.id,
        venueId: venue.id,
        title: e.title,
        type: e.type,
        description: e.description,
        startsAt: e.startsAt,
      },
    });

    await prisma.eventPricing.createMany({
      data: Object.entries(e.prices).map(([name, price]) => ({
        eventId: event.id,
        categoryId: categoryByName.get(name)!,
        price,
      })),
    });

    // Materialise one bookable seat per venue seat.
    await prisma.seat.createMany({
      data: venueSeats.map((vs) => ({ eventId: event.id, venueSeatId: vs.id })),
    });
    console.log(`  ${e.title} — ${venueSeats.length} seats`);
  }

  console.log("\nDone. Demo logins (password: " + DEMO_PASSWORD + ")");
  console.table([
    { role: "ADMIN", email: admin.email },
    { role: "ORGANISER", email: organiser.email },
    { role: "CUSTOMER", email: customer.email },
    { role: "CUSTOMER", email: customer2.email },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
