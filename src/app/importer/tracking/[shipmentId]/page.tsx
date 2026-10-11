import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackingDetail } from "@/components/importer/tracking/tracking-detail";
import { MOCK_SHIPMENTS, SHIPMENT_ID_PATTERN } from "@/lib/importer-shipments";

/*
 * Tracking is keyed by shipment. Demo shipments are pre-rendered; other
 * well-formed IDs render on request (session-created shipments).
 */

export function generateStaticParams() {
  return MOCK_SHIPMENTS.map((s) => ({ shipmentId: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/importer/tracking/[shipmentId]">): Promise<Metadata> {
  const { shipmentId } = await params;
  return { title: `Tracking · ${shipmentId}` };
}

export default async function ShipmentTrackingPage({ params }: PageProps<"/importer/tracking/[shipmentId]">) {
  const { shipmentId } = await params;
  if (!SHIPMENT_ID_PATTERN.test(shipmentId)) notFound();
  return <TrackingDetail shipmentId={shipmentId} />;
}
