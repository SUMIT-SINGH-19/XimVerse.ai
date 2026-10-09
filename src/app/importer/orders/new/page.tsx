import type { Metadata } from "next";
import { CreateOrder } from "@/components/importer/orders/create-order";

export const metadata: Metadata = { title: "Create Order" };

export default async function CreateOrderPage({ searchParams }: PageProps<"/importer/orders/new">) {
  const { negotiation } = await searchParams;
  const id = typeof negotiation === "string" ? negotiation : "";
  return <CreateOrder key={id} negotiationId={id} />;
}
