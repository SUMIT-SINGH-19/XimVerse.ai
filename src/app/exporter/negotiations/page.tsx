import type { Metadata } from "next";
import { NegotiationsList } from "@/components/exporter/negotiations/negotiations-list";

export const metadata: Metadata = { title: "Negotiations" };

export default function ExporterNegotiationsPage() {
  return <NegotiationsList />;
}
