import type { Metadata } from "next";
import { CreateShipment } from "@/components/importer/shipments/create-shipment";

export const metadata: Metadata = { title: "Create Shipment" };

export default async function CreateShipmentPage({ searchParams }: PageProps<"/importer/shipments/new">) {
  const { order } = await searchParams;
  const id = typeof order === "string" ? order : "";
  return <CreateShipment key={id} orderId={id} />;
}
