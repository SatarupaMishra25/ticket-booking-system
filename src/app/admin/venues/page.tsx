import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { VenueForm } from "@/components/VenueForm";
import { Badge, Card, Empty, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminVenuesPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/venues");
  if (session.role !== "ADMIN") redirect("/events");

  const venues = await prisma.venue.findMany({
    orderBy: { name: "asc" },
    include: {
      categories: {
        orderBy: { name: "asc" },
        include: { _count: { select: { seats: true } } },
      },
      _count: { select: { seats: true, events: true } },
    },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title="Venues"
          subtitle="Seat layouts and categories. Organisers price these per event."
        />
      </div>

      <div className="mb-6">
        <VenueForm />
      </div>

      {venues.length === 0 ? (
        <Empty>No venues yet. Add one to get started.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {venues.map((v) => (
              <Card key={v.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold leading-snug">{v.name}</h2>
                    <p className="mt-1 text-sm opacity-60">
                      {v.city} · {v.address}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p className="font-semibold">{v._count.seats}</p>
                    <p className="text-xs opacity-50">seats</p>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-sm">
                  {v.categories.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <Badge colour={c.colour}>{c.name}</Badge>
                      <span className="text-xs opacity-55">{c._count.seats} seats</span>
                    </div>
                  ))}
                  {v.categories.length === 0 && (
                    <p className="text-xs opacity-50">No seat categories — unusable for events.</p>
                  )}
                </div>

                <p className="mt-4 border-t border-black/10 pt-3 text-xs opacity-50 dark:border-white/10">
                  {v._count.events} event{v._count.events === 1 ? "" : "s"} scheduled here
                </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
