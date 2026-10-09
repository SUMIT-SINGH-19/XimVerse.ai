import type { Metadata } from "next";
import { ShipmentsList } from "@/components/importer/shipments/shipments-list";

export const metadata: Metadata = { title: "Shipments" };

export default function ShipmentsPage() {
  return <ShipmentsList />;
}
