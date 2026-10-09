import type { Metadata } from "next";
import { ComplianceList } from "@/components/importer/compliance/compliance-list";

export const metadata: Metadata = { title: "Compliance" };

export default function CompliancePage() {
  return <ComplianceList />;
}
