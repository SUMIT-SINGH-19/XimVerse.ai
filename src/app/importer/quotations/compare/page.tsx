import type { Metadata } from "next";
import { QuotationCompare } from "@/components/importer/quotations/quotation-compare";

export const metadata: Metadata = { title: "Compare Quotations" };

export default async function CompareQuotationsPage({ searchParams }: PageProps<"/importer/quotations/compare">) {
  const { ids } = await searchParams;
  const list = (Array.isArray(ids) ? ids.join(",") : (ids ?? ""))
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return <QuotationCompare key={list.join(",")} ids={list} />;
}
