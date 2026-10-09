import type { Metadata } from "next";
import { QuotationsList } from "@/components/importer/quotations/quotations-list";
import { findSupplier } from "@/lib/importer-suppliers";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage({ searchParams }: PageProps<"/importer/quotations">) {
  const { requirement, supplier } = await searchParams;
  const initial = typeof requirement === "string" ? requirement : "";
  // ?supplier= pre-fills the search with that supplier's name.
  const query = typeof supplier === "string" ? (findSupplier(supplier)?.name ?? "") : "";
  // Keyed so following a link with different parameters resets the filters.
  return <QuotationsList key={`${initial}|${query}`} initialRequirement={initial} initialQuery={query} />;
}
