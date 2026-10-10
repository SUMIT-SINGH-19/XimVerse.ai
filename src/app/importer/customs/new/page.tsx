import type { Metadata } from "next";
import { CreateCustomsCase } from "@/components/importer/customs/create-customs-case";

export const metadata: Metadata = { title: "Prepare Customs" };

export default async function CreateCustomsCasePage({ searchParams }: PageProps<"/importer/customs/new">) {
  const { shipment } = await searchParams;
  const id = typeof shipment === "string" ? shipment : "";
  return <CreateCustomsCase key={id} shipmentId={id} />;
}
