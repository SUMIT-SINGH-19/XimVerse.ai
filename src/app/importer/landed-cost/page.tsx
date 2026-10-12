import type { Metadata } from "next";
import { LandedCostList } from "@/components/importer/landed-cost/landed-cost-list";

export const metadata: Metadata = { title: "Landed Cost" };

export default function LandedCostPage() {
  return <LandedCostList />;
}
