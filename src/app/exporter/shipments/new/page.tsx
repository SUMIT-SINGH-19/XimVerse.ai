import type { Metadata } from "next";
import { CreateShipment } from "@/components/exporter/shipments/create-shipment";

export const metadata: Metadata = { title: "Create Shipment" };

/*
 * /exporter/shipments/new?order=ORD-… — the setup form resolves the order on
 * the client, so orders created in this browser (ORD-YYYY-9xxx) work too.
 */
export default async function NewShipmentPage({ searchParams }: PageProps<"/exporter/shipments/new">) {
  const { order } = await searchParams;
  return <CreateShipment orderId={typeof order === "string" ? order : undefined} />;
}
