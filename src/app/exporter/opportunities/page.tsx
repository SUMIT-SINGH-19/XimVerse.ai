import type { Metadata } from "next";
import { OpportunityFeed } from "@/components/exporter/opportunities/opportunity-feed";
import { BUYER_OPPORTUNITIES, SUMIT_OPPORTUNITIES_INSIGHT } from "@/lib/exporter-opportunities";
import { EXPORTER_PRODUCTS, toProductSummary } from "@/lib/exporter-products";

export const metadata: Metadata = { title: "Buyer Opportunities" };

export default function ExporterOpportunitiesPage() {
  return (
    <OpportunityFeed
      opportunities={BUYER_OPPORTUNITIES}
      products={EXPORTER_PRODUCTS.map(toProductSummary)}
      insight={SUMIT_OPPORTUNITIES_INSIGHT}
    />
  );
}
