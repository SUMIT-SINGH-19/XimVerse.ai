import type { Metadata } from "next";
import { RequirementsList } from "@/components/importer/rfq/requirements-list";

export const metadata: Metadata = { title: "Import Requirements" };

export default function ImportRequirementsPage() {
  return <RequirementsList />;
}
