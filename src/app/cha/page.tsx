import type { Metadata } from "next";
import { ChaDashboard } from "@/components/cha/dashboard/cha-dashboard";
import { getChaDashboard } from "@/lib/cha-dashboard-data";

export const metadata: Metadata = { title: "Overview" };

export default function ChaOverviewPage() {
  return <ChaDashboard data={getChaDashboard()} />;
}
