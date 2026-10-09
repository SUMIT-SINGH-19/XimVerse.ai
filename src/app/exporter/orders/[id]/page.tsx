import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderById } from "@/components/exporter/orders/order-detail";
import { LOCAL_ORDER_ID, SEEDED_ORDER_IDS } from "@/lib/exporter-orders";

/*
 * Seeded orders are prerendered. Orders created in this browser
 * (ORD-YYYY-9xxx) exist only in localStorage, so the server can't know them:
 * IDs in that range render a client lookup (with a not-found state if this
 * browser doesn't have the order). Any other ID is a real 404.
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return SEEDED_ORDER_IDS.map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/exporter/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${id}` };
}

export default async function OrderPage({ params }: PageProps<"/exporter/orders/[id]">) {
  const { id } = await params;
  if (!SEEDED_ORDER_IDS.includes(id) && !LOCAL_ORDER_ID.test(id)) notFound();
  return <OrderById id={id} />;
}
