import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getSeatMap } from "@/lib/seats";
import { SeatMap } from "@/components/SeatMap";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  // Rendered on the server first so the grid is visible immediately; the
  // client component then keeps it fresh by polling.
  const map = await getSeatMap(id, session?.userId);
  if (!map) notFound();

  return (
    <div>
      <Link href="/events" className="mb-5 inline-block text-sm opacity-60 hover:opacity-100">
        &larr; All events
      </Link>

      <SeatMap
        initial={JSON.parse(JSON.stringify(map))}
        signedIn={!!session}
        canBook={session?.role === "CUSTOMER"}
      />
    </div>
  );
}
