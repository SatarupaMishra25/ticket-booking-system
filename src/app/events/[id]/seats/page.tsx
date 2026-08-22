import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSeatMap } from "@/lib/seats";
import { SeatMap } from "@/components/SeatMap";

export const dynamic = "force-dynamic";

export default async function SeatSelectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const map = await getSeatMap(id, session?.userId);
  if (!map) notFound();

  return <SeatMap initial={JSON.parse(JSON.stringify(map))} signedIn={!!session} canBook={session?.role === "CUSTOMER"} />;
}
