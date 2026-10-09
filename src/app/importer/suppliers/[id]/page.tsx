import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SupplierProfile } from "@/components/importer/suppliers/supplier-profile";
import { findSupplier, SUPPLIERS } from "@/lib/importer-suppliers";

export const dynamicParams = false;

export function generateStaticParams() {
  return SUPPLIERS.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/importer/suppliers/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: findSupplier(id)?.name ?? "Supplier" };
}

export default async function SupplierPage({ params }: PageProps<"/importer/suppliers/[id]">) {
  const { id } = await params;
  const supplier = findSupplier(id);
  if (!supplier) notFound();
  return <SupplierProfile supplier={supplier} />;
}
