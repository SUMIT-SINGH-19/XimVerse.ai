import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentDetail } from "@/components/importer/documents/document-detail";
import { buildDocuments, DOCUMENT_ID_PATTERN, MOCK_EVENTS_BY_DOCUMENT } from "@/lib/importer-documents";
import { MOCK_SHIPMENTS } from "@/lib/importer-shipments";

/*
 * Documents of the demo shipments are pre-rendered. Other well-formed IDs
 * render on request: documents of shipments created in the browser exist only
 * in this tab's session.
 */

export function generateStaticParams() {
  return buildDocuments(MOCK_SHIPMENTS, MOCK_EVENTS_BY_DOCUMENT).map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: PageProps<"/importer/documents/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Document ${id}` };
}

export default async function DocumentPage({ params }: PageProps<"/importer/documents/[id]">) {
  const { id } = await params;
  if (!DOCUMENT_ID_PATTERN.test(id)) notFound();
  return <DocumentDetail id={id} />;
}
