import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { EventForm } from "@/components/EventForm";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/organiser/events/new");
  if (session.role === "CUSTOMER") redirect("/events");

  const venues = await prisma.venue.findMany({
    orderBy: { name: "asc" },
    include: {
      categories: { orderBy: { name: "asc" } },
      _count: { select: { seats: true } },
    },
  });

  // A venue with no seat layout cannot host an event.
  const usable = venues
    .filter((v) => v._count.seats > 0 && v.categories.length > 0)
    .map((v) => ({
      id: v.id,
      name: v.name,
      city: v.city,
      seatCount: v._count.seats,
      categories: v.categories.map((c) => ({ id: c.id, name: c.name, colour: c.colour })),
    }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/organiser" className="mb-5 inline-block text-sm opacity-60 hover:opacity-100">
        &larr; Dashboard
      </Link>
      <PageTitle title="Create event" subtitle="Pick a venue, set prices per seat category." />
      <EventForm venues={usable} />
    </div>
  );
}
