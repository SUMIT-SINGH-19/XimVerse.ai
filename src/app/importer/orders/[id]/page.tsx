import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/importer/orders/order-detail";
import { MOCK_ORDERS, ORDER_ID_PATTERN } from "@/lib/importer-orders";

/*
 * Demo orders are pre-rendered. Other well-formed IDs render on request,
 * because orders created in the browser exist only in session storage.
 */

export function generateStaticParams() {
  return MOCK_ORDERS.map((o) => ({ id: o.id }));
}

export async function generateMetadata({ params }: PageProps<"/importer/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${id}` };
}

export default async function OrderPage({ params }: PageProps<"/importer/orders/[id]">) {
  const { id } = await params;
  if (!ORDER_ID_PATTERN.test(id)) notFound();
  return <OrderDetail id={id} />;
}
