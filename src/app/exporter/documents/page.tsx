import type { Metadata } from "next";
import { DocumentsList } from "@/components/exporter/documents/documents-list";

export const metadata: Metadata = { title: "Documents" };

export default function ExporterDocumentsPage() {
  return <DocumentsList />;
}
