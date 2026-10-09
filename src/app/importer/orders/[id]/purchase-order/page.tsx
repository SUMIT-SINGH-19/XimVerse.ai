import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PurchaseOrderPreview } from "@/components/importer/orders/purchase-order-preview";
import { MOCK_ORDERS, ORDER_ID_PATTERN } from "@/lib/importer-orders";

export function generateStaticParams() {
  return MOCK_ORDERS.map((o) => ({ id: o.id }));
}

export async function generateMetadata({ params }: PageProps<"/importer/orders/[id]/purchase-order">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Purchase Order · ${id}` };
}

export default async function PurchaseOrderPage({ params }: PageProps<"/importer/orders/[id]/purchase-order">) {
  const { id } = await params;
  if (!ORDER_ID_PATTERN.test(id)) notFound();
  return <PurchaseOrderPreview id={id} />;
}
