import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShipmentDetail } from "@/components/importer/shipments/shipment-detail";
import { MOCK_SHIPMENTS, SHIPMENT_ID_PATTERN } from "@/lib/importer-shipments";

/*
 * Demo shipments are pre-rendered. Other well-formed IDs render on request,
 * because shipments created in the browser exist only in session storage.
 */

export function generateStaticParams() {
  return MOCK_SHIPMENTS.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/importer/shipments/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Shipment ${id}` };
}

export default async function ShipmentPage({ params }: PageProps<"/importer/shipments/[id]">) {
  const { id } = await params;
  if (!SHIPMENT_ID_PATTERN.test(id)) notFound();
  return <ShipmentDetail id={id} />;
}
