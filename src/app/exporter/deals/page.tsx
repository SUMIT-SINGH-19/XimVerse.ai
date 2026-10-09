import type { Metadata } from "next";
import { DealsList } from "@/components/exporter/deals/deals-list";

export const metadata: Metadata = { title: "Deals" };

export default function ExporterDealsPage() {
  return <DealsList />;
}
