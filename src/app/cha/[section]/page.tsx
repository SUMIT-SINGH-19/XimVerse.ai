import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/workspace/page-header";
import { CHA_PAGES, findChaPage } from "@/lib/cha-nav";

/*
 * Placeholder for every CHA section that isn't built yet. When a section gets
 * its real page, add a static folder for it (e.g. app/cha/shipments/) — static
 * segments take precedence over this dynamic one.
 */

// Only the sections in the nav exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return CHA_PAGES.filter((p) => p.slug).map((p) => ({ section: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/cha/[section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: findChaPage(section)?.label };
}

export default async function ChaSectionPage({ params }: PageProps<"/cha/[section]">) {
  const { section } = await params;
  const page = findChaPage(section);
  if (!page) notFound();

  return <ComingSoon title={page.label} group={page.group} workspaceLabel="CHA" />;
}
