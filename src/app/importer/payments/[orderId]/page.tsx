import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaymentsDetail } from "@/components/importer/payments/payments-detail";
import { MOCK_ORDERS, ORDER_ID_PATTERN } from "@/lib/importer-orders";

/*
 * One payment workspace per order. Demo orders are pre-rendered; other
 * well-formed IDs render on request (orders created in this browser tab).
 */

export function generateStaticParams() {
  return MOCK_ORDERS.map((o) => ({ orderId: o.id }));
}

export async function generateMetadata({ params }: PageProps<"/importer/payments/[orderId]">): Promise<Metadata> {
  const { orderId } = await params;
  return { title: `Payments · ${orderId}` };
}

export default async function OrderPaymentsPage({ params }: PageProps<"/importer/payments/[orderId]">) {
  const { orderId } = await params;
  if (!ORDER_ID_PATTERN.test(orderId)) notFound();
  return <PaymentsDetail orderId={orderId} />;
}
