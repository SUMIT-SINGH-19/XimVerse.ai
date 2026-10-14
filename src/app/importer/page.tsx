import type { Metadata } from "next";
import { ImporterDashboard } from "@/components/importer/dashboard/importer-dashboard";

export const metadata: Metadata = { title: "Overview" };

export default function ImporterOverviewPage() {
  return <ImporterDashboard />;
}
