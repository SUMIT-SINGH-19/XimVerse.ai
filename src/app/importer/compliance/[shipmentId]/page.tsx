import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComplianceDetail } from "@/components/importer/compliance/compliance-detail";
import { MOCK_SHIPMENTS, SHIPMENT_ID_PATTERN } from "@/lib/importer-shipments";

export function generateStaticParams() {
  return MOCK_SHIPMENTS.map((s) => ({ shipmentId: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/importer/compliance/[shipmentId]">): Promise<Metadata> {
  const { shipmentId } = await params;
  return { title: `Compliance · ${shipmentId}` };
}

export default async function ShipmentCompliancePage({ params }: PageProps<"/importer/compliance/[shipmentId]">) {
  const { shipmentId } = await params;
  if (!SHIPMENT_ID_PATTERN.test(shipmentId)) notFound();
  return <ComplianceDetail shipmentId={shipmentId} />;
}
