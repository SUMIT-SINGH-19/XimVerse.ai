import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuotationDetail } from "@/components/importer/quotations/quotation-detail";
import { findQuotation, MOCK_QUOTATIONS, requirementOf, supplierOf } from "@/lib/importer-quotations";

export const dynamicParams = false;

export function generateStaticParams() {
  return MOCK_QUOTATIONS.map((q) => ({ id: q.id }));
}

export async function generateMetadata({ params }: PageProps<"/importer/quotations/[id]">): Promise<Metadata> {
  const { id } = await params;
  const quote = findQuotation(id);
  return { title: quote ? `${quote.id} · ${supplierOf(quote).name}` : "Quotation" };
}

export default async function QuotationPage({ params }: PageProps<"/importer/quotations/[id]">) {
  const { id } = await params;
  const quote = findQuotation(id);
  const requirement = quote && requirementOf(quote);
  if (!quote || !requirement) notFound();
  return <QuotationDetail quote={quote} requirement={requirement} />;
}
