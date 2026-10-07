import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/workspace/page-header";
import { FREIGHT_FORWARDER_PAGES, findFreightForwarderPage } from "@/lib/freight-forwarder-nav";

/*
 * Placeholder for every freight forwarder section that isn't built yet. When a
 * section gets its real page, add a static folder for it (e.g.
 * app/freight-forwarder/rfqs/) — static segments take precedence over this one.
 */

// Only the sections in the nav exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return FREIGHT_FORWARDER_PAGES.filter((p) => p.slug).map((p) => ({ section: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/freight-forwarder/[section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: findFreightForwarderPage(section)?.label };
}

export default async function FreightForwarderSectionPage({
  params,
}: PageProps<"/freight-forwarder/[section]">) {
  const { section } = await params;
  const page = findFreightForwarderPage(section);
  if (!page) notFound();

  return <ComingSoon title={page.label} group={page.group} workspaceLabel="freight forwarder" />;
}
