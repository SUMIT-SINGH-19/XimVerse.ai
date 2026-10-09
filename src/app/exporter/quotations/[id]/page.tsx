import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocalQuotationDetail, QuotationDetail } from "@/components/exporter/quotations/quotation-detail";
import { findSeededQuotation, SEEDED_QUOTATION_IDS } from "@/lib/exporter-quotation-pipeline";
import { LOCAL_QUOTATION_ID } from "@/lib/exporter-quotations";

/*
 * Seeded quotations are prerendered. Quotations created in this browser
 * (QT-YYYY-9xxx) exist only in localStorage, so the server can't know them:
 * any ID in that range renders a client lookup, which shows a not-found state
 * if this browser doesn't have it. Every other ID is a real 404.
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return SEEDED_QUOTATION_IDS.map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/exporter/quotations/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Quotation ${id}` };
}

export default async function QuotationDetailPage({ params }: PageProps<"/exporter/quotations/[id]">) {
  const { id } = await params;
  const seeded = findSeededQuotation(id);
  if (seeded) return <QuotationDetail q={seeded} />;
  if (LOCAL_QUOTATION_ID.test(id)) return <LocalQuotationDetail id={id} />;
  notFound();
}
