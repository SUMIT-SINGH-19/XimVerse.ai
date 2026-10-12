import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandedCostDetail } from "@/components/importer/landed-cost/landed-cost-detail";
import { MOCK_ORDERS, ORDER_ID_PATTERN } from "@/lib/importer-orders";

/*
 * One cost sheet per order. Demo orders are pre-rendered; other well-formed
 * IDs render on request (orders created in this browser tab).
 */

export function generateStaticParams() {
  return MOCK_ORDERS.map((o) => ({ orderId: o.id }));
}

export async function generateMetadata({ params }: PageProps<"/importer/landed-cost/[orderId]">): Promise<Metadata> {
  const { orderId } = await params;
  return { title: `Landed Cost · ${orderId}` };
}

export default async function OrderLandedCostPage({ params }: PageProps<"/importer/landed-cost/[orderId]">) {
  const { orderId } = await params;
  if (!ORDER_ID_PATTERN.test(orderId)) notFound();
  return <LandedCostDetail orderId={orderId} />;
}
