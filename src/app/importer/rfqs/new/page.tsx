import type { Metadata } from "next";
import { RequirementForm } from "@/components/importer/rfq/requirement-form";

export const metadata: Metadata = { title: "New Import Requirement" };

export default function NewImportRequirementPage() {
  return <RequirementForm />;
}
