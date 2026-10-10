import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShipmentById } from "@/components/exporter/shipments/shipment-detail";
import { LOCAL_SHIPMENT_ID, SEEDED_SHIPMENT_IDS } from "@/lib/exporter-shipments";

/*
 * Seeded shipments are prerendered. Shipments created in this browser
 * (SHP-YYYY-9xxx) exist only in localStorage, so the server can't know them:
 * IDs in that range render a client lookup (with a not-found state if this
 * browser doesn't have the shipment). Any other ID is a real 404.
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return SEEDED_SHIPMENT_IDS.map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/exporter/shipments/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Shipment ${id}` };
}

export default async function ShipmentPage({ params }: PageProps<"/exporter/shipments/[id]">) {
  const { id } = await params;
  if (!SEEDED_SHIPMENT_IDS.includes(id) && !LOCAL_SHIPMENT_ID.test(id)) notFound();
  return <ShipmentById id={id} />;
}
