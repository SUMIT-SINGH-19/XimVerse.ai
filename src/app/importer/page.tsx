import type { Metadata } from "next";
import { ImporterDashboard } from "@/components/importer/dashboard/importer-dashboard";
import { getImporterDashboard } from "@/lib/importer-dashboard-data";

export const metadata: Metadata = { title: "Overview" };

export default function ImporterOverviewPage() {
  return <ImporterDashboard data={getImporterDashboard()} />;
}
