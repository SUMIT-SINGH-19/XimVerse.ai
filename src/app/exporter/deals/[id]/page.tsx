import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DealById } from "@/components/exporter/deals/deal-detail";
import { LOCAL_DEAL_ID, SEEDED_DEAL_IDS } from "@/lib/exporter-deals";

/*
 * Seeded deals are prerendered. Deals created in this browser (DL-YYYY-9xxx)
 * exist only in localStorage, so the server can't know them: IDs in that range
 * render a client lookup (with a not-found state if this browser doesn't have
 * the deal). Any other ID is a real 404.
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return SEEDED_DEAL_IDS.map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/exporter/deals/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Deal ${id}` };
}

export default async function DealPage({ params }: PageProps<"/exporter/deals/[id]">) {
  const { id } = await params;
  if (!SEEDED_DEAL_IDS.includes(id) && !LOCAL_DEAL_ID.test(id)) notFound();
  return <DealById id={id} />;
}
