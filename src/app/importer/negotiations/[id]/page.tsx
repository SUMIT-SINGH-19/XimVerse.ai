import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NegotiationWorkspace } from "@/components/importer/negotiations/negotiation-workspace";
import { MOCK_NEGOTIATIONS, NEGOTIATION_ID_PATTERN } from "@/lib/importer-negotiations";

/*
 * Demo negotiations are pre-rendered. Other well-formed IDs render on request,
 * because negotiations started in the browser exist only in session storage;
 * the workspace shows "not found" if this tab doesn't have it.
 */

export function generateStaticParams() {
  return MOCK_NEGOTIATIONS.map((n) => ({ id: n.id }));
}

export async function generateMetadata({ params }: PageProps<"/importer/negotiations/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Negotiation ${id}` };
}

export default async function NegotiationPage({ params }: PageProps<"/importer/negotiations/[id]">) {
  const { id } = await params;
  if (!NEGOTIATION_ID_PATTERN.test(id)) notFound();
  return <NegotiationWorkspace id={id} />;
}
