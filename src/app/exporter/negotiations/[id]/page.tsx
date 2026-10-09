import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NegotiationWorkspace } from "@/components/exporter/negotiations/negotiation-workspace";
import { findOpportunity } from "@/lib/exporter-opportunities";
import { EXPORTER_PRODUCTS } from "@/lib/exporter-products";
import { findSeededNegotiation, SEEDED_NEGOTIATION_IDS } from "@/lib/exporter-negotiations";
import { SEEDED_QUOTATIONS } from "@/lib/exporter-quotation-history";

/*
 * Negotiations are started by the buyer / Ximverse, never by the exporter, so
 * every negotiation is a known seed; this browser only appends events to them.
 * Anything else is a 404.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return SEEDED_NEGOTIATION_IDS.map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/exporter/negotiations/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Negotiation ${id}` };
}

export default async function NegotiationPage({ params }: PageProps<"/exporter/negotiations/[id]">) {
  const { id } = await params;
  const n = findSeededNegotiation(id);
  if (!n) notFound();

  const opportunity = findOpportunity(n.requirementId);
  const quotation = SEEDED_QUOTATIONS.find((q) => q.id === n.quotationId);
  // Resolved here so the catalogue (with its private price band) never reaches the browser.
  const product = EXPORTER_PRODUCTS.find((p) => p.id === quotation?.exporterProductId);

  return (
    <NegotiationWorkspace
      id={n.id}
      opportunity={opportunity}
      productName={opportunity?.product.name ?? product?.name ?? n.quotationId}
      availableTonnes={product?.supply.availableCapacity.value}
    />
  );
}
