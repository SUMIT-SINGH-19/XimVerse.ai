import type { Metadata } from "next";
import { OrdersList } from "@/components/importer/orders/orders-list";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return <OrdersList />;
}
