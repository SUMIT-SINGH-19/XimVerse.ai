import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequirementDetail } from "@/components/importer/rfq/requirement-detail";
import { MOCK_REQUIREMENTS, REQUIREMENT_ID_PATTERN } from "@/lib/import-requirements";

/*
 * Mock requirements are pre-rendered. Other well-formed IDs are rendered on
 * request, because requirements created in the browser exist only in the
 * client-side store; the detail view shows "not found" if the store lacks it.
 */

export function generateStaticParams() {
  return MOCK_REQUIREMENTS.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: PageProps<"/importer/rfqs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const known = MOCK_REQUIREMENTS.find((r) => r.id === id);
  return { title: known ? `${known.id} · ${known.product.name}` : id };
}

export default async function ImportRequirementPage({ params }: PageProps<"/importer/rfqs/[id]">) {
  const { id } = await params;
  if (!REQUIREMENT_ID_PATTERN.test(id)) notFound();
  return <RequirementDetail id={id} />;
}
