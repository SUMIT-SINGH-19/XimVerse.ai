import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityDetail } from "@/components/exporter/opportunities/detail/opportunity-detail";
import { BUYER_OPPORTUNITIES, findOpportunity, opportunitySlug } from "@/lib/exporter-opportunities";
import { EXPORTER_PRODUCTS } from "@/lib/exporter-products";

// The mock dataset is fixed, so every opportunity is prerendered; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return BUYER_OPPORTUNITIES.map((o) => ({ id: opportunitySlug(o) }));
}

export async function generateMetadata({ params }: PageProps<"/exporter/opportunities/[id]">): Promise<Metadata> {
  const { id } = await params;
  const o = findOpportunity(id);
  return { title: o ? `${o.rfqId} · ${o.product.name}` : "Opportunity" };
}

export default async function OpportunityDetailPage({ params }: PageProps<"/exporter/opportunities/[id]">) {
  const { id } = await params;
  const o = findOpportunity(id);
  if (!o) notFound();

  const product = EXPORTER_PRODUCTS.find((p) => p.id === o.match.matchedProductId);
  return <OpportunityDetail o={o} product={product} />;
}
