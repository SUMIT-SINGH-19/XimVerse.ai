import type { Metadata } from "next";
import { NegotiationsList } from "@/components/importer/negotiations/negotiations-list";

export const metadata: Metadata = { title: "Negotiations" };

export default async function NegotiationsPage({ searchParams }: PageProps<"/importer/negotiations">) {
  const { requirement } = await searchParams;
  const initial = typeof requirement === "string" ? requirement : "";
  return <NegotiationsList key={initial} initialRequirement={initial} />;
}
