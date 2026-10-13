import type { Metadata } from "next";
import { PaymentsList } from "@/components/importer/payments/payments-list";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return <PaymentsList />;
}
