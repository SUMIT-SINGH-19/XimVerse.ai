import type { Metadata } from "next";
import { SuppliersDirectory } from "@/components/importer/suppliers/suppliers-directory";

export const metadata: Metadata = { title: "Suppliers" };

export default function SuppliersPage() {
  return <SuppliersDirectory />;
}
