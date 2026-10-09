"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, PackagePlus } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { Modal } from "@/components/exporter/products/modal";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDate } from "@/lib/exporter-dashboard";
import { PAYMENT_TERM_LABEL } from "@/lib/exporter-opportunities";
import { COMMITMENT_LABEL, dealStatus, type ExporterDeal } from "@/lib/exporter-deals";
import { orderForDeal } from "@/lib/exporter-orders";
import { createOrder, useExporterOrders } from "@/lib/exporter-order-store";
import { qtyText, unitPriceText, valueText } from "@/components/exporter/deals/deal-ui";

const primary = `inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange px-4 text-sm font-semibold text-on-brand shadow-sm shadow-orange/20 transition hover:brightness-95 ${focusRing}`;

/** "Create Order" for a confirmed deal; "View Order" once it exists. */
export function CreateOrderAction({ deal }: { deal: ExporterDeal }) {
  const orders = useExporterOrders();
  const router = useRouter();
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existing = orderForDeal(deal.id, orders);
  const status = dealStatus(deal);

  if (existing) {
    return (
      <Link href={exporterHref(`orders/${existing.id}`)} className={`inline-flex h-10 items-center gap-2 rounded-lg border border-teal bg-teal-soft px-4 text-sm font-semibold text-teal hover:bg-teal hover:text-on-brand ${focusRing}`}>
        View Order {existing.id}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    );
  }
  if (status !== "confirmed" && status !== "ready-for-execution") {
    return (
      <button type="button" disabled title="Confirm the deal terms first" className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg bg-orange/40 px-4 text-sm font-semibold text-on-brand">
        <PackagePlus className="size-4" aria-hidden />
        Create Order · confirm deal first
      </button>
    );
  }

  const t = deal.terms;
  const rows: [string, string][] = [
    ["Deal", deal.id],
    ["Product", t.productName],
    ["Quantity", qtyText(t)],
    ["Unit Price", unitPriceText(t)],
    ["Contract Value", valueText(t)],
    ["Incoterm", `${t.incoterm} ${t.namedPlace}`],
    ["Payment", t.paymentSummary || PAYMENT_TERM_LABEL[t.paymentTerm]],
    ["Delivery", t.estimatedDelivery ? formatDate(t.estimatedDelivery) : `${t.leadTimeDays}-day lead time`],
    ["Compliance", t.complianceCommitments.map((c) => `${c.name} (${COMMITMENT_LABEL[c.commitment]})`).join("; ") || "—"],
  ];

  const create = () => {
    const r = createOrder(deal);
    if (!r.ok) return setError(r.reason === "not-confirmed" ? "Confirm the deal terms first." : "The order couldn't be saved. Please try again.");
    setReviewing(false);
    router.push(exporterHref(`orders/${r.id}`));
  };

  return (
    <>
      <button type="button" onClick={() => setReviewing(true)} className={primary}>
        <PackagePlus className="size-4" aria-hidden />
        Create Order
      </button>
      <Modal open={reviewing} onClose={() => setReviewing(false)} labelledBy="order-create-title">
        <header className="border-b border-line px-5 py-4 sm:px-6">
          <h2 id="order-create-title" className="text-lg font-bold tracking-tight text-ink">Review Order Baseline</h2>
          <p className="mt-0.5 text-sm text-ink-muted">This Order will execute the locked commercial terms from this Deal.</p>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <dl className="divide-y divide-line rounded-xl border border-line">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <dt className="shrink-0 text-ink-muted">{label}</dt>
                <dd className={`text-right [overflow-wrap:anywhere] ${label === "Contract Value" ? "font-bold" : "font-medium"} text-ink`}>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-canvas px-4 py-3 text-xs text-ink-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Terms are copied from the deal and can&apos;t be edited on the order. Demo: stored in this browser only.
          </p>
          {error && <p role="alert" className="mt-3 text-sm font-medium text-orange">{error}</p>}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
          <button type="button" onClick={() => setReviewing(false)} className={`h-10 rounded-lg px-4 text-sm font-semibold text-ink-muted hover:bg-canvas hover:text-ink ${focusRing}`}>Cancel</button>
          <button type="button" onClick={create} className={primary}>Create Order</button>
        </footer>
      </Modal>
    </>
  );
}
