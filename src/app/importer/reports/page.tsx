import type { Metadata } from "next";
import { ReportsWorkspace } from "@/components/importer/reports/reports-workspace";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return <ReportsWorkspace />;
}
