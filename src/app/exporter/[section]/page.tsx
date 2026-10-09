import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/workspace/page-header";
import { EXPORTER_PAGES, findExporterPage } from "@/lib/exporter-nav";

/*
 * Placeholder for every exporter section that isn't built yet. When a section
 * gets its real page, add a static folder for it (e.g. app/exporter/products/)
 * and list its slug in BUILT_SECTIONS so this route stops generating it.
 */

const BUILT_SECTIONS = new Set(["company", "products", "opportunities", "quotations", "negotiations"]);

// Only the sections in the nav exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return EXPORTER_PAGES.filter((p) => p.slug && !BUILT_SECTIONS.has(p.slug)).map((p) => ({ section: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/exporter/[section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: findExporterPage(section)?.label };
}

export default async function ExporterSectionPage({ params }: PageProps<"/exporter/[section]">) {
  const { section } = await params;
  const page = findExporterPage(section);
  if (!page) notFound();

  return <ComingSoon title={page.label} group={page.group} workspaceLabel="exporter" />;
}
