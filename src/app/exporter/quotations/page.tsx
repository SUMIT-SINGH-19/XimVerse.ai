import type { Metadata } from "next";
import { MyQuotations } from "@/components/exporter/quotations/my-quotations";

export const metadata: Metadata = { title: "My Quotations" };

export default function ExporterQuotationsPage() {
  return <MyQuotations />;
}
