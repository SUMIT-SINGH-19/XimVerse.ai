import type { Metadata } from "next";
import { OrdersList } from "@/components/exporter/orders/orders-list";

export const metadata: Metadata = { title: "Orders" };

export default function ExporterOrdersPage() {
  return <OrdersList />;
}
