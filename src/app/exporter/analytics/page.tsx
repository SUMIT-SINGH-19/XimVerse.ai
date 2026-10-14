import type { Metadata } from "next";
import { AnalyticsWorkspace } from "@/components/exporter/analytics/analytics-workspace";

export const metadata: Metadata = { title: "Analytics" };

export default function ExporterAnalyticsPage() {
  return <AnalyticsWorkspace />;
}
