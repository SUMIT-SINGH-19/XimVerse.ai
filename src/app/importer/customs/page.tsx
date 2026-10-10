import type { Metadata } from "next";
import { CustomsList } from "@/components/importer/customs/customs-list";

export const metadata: Metadata = { title: "Customs" };

export default function CustomsPage() {
  return <CustomsList />;
}
