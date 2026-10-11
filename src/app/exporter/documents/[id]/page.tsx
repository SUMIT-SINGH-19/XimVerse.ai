import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentById } from "@/components/exporter/documents/document-detail";
import { LOCAL_DOCUMENT_ID, SEEDED_DOCUMENT_IDS } from "@/lib/exporter-documents";

/*
 * A logical document record, derived from its owner. Seeded owners'
 * documents are known to the server; documents of orders / shipments created
 * in this browser (…-9xxx) resolve on the client. Anything else is a 404.
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return SEEDED_DOCUMENT_IDS.map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/exporter/documents/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Document ${id}` };
}

export default async function DocumentPage({ params }: PageProps<"/exporter/documents/[id]">) {
  const { id } = await params;
  if (!SEEDED_DOCUMENT_IDS.includes(id) && !LOCAL_DOCUMENT_ID.test(id)) notFound();
  return <DocumentById id={id} />;
}
