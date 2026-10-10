import type { Metadata } from "next";
import { ShipmentsList } from "@/components/exporter/shipments/shipments-list";

export const metadata: Metadata = { title: "Shipments" };

export default function ExporterShipmentsPage() {
  return <ShipmentsList />;
}
