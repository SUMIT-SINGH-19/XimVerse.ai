import type { Metadata } from "next";
import { DocumentsList } from "@/components/importer/documents/documents-list";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: PageProps<"/importer/documents">) {
  const { shipment } = await searchParams;
  const initial = typeof shipment === "string" ? shipment : "";
  // Keyed so following a link with a different ?shipment= resets the filters.
  return <DocumentsList key={initial} initialShipment={initial} />;
}
