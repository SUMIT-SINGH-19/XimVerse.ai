import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/importer/importer-page-header";
import { findImporterPage, IMPORTER_PAGES } from "@/lib/importer-nav";

/*
 * Placeholder for every importer section that isn't built yet. When a section
 * gets its real page, add a static folder for it (e.g. app/importer/rfqs/) —
 * static segments take precedence over this dynamic one — and list it in
 * BUILT_SECTIONS so it isn't also generated here.
 */

const BUILT_SECTIONS = new Set(["rfqs", "quotations", "suppliers", "negotiations", "orders", "shipments", "documents", "compliance"]);

export const dynamicParams = false;

export function generateStaticParams() {
  return IMPORTER_PAGES.filter((p) => p.slug && !BUILT_SECTIONS.has(p.slug)).map((p) => ({ section: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/importer/[section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: findImporterPage(section)?.label };
}

export default async function ImporterSectionPage({ params }: PageProps<"/importer/[section]">) {
  const { section } = await params;
  const page = findImporterPage(section);
  if (!page || BUILT_SECTIONS.has(section)) notFound();

  return <ComingSoon title={page.label} group={page.group} />;
}
