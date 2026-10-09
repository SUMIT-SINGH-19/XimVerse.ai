"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileCheck2, Lock } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { Modal } from "@/components/exporter/products/modal";
import { exporterHref } from "@/lib/exporter-nav";
import { PAYMENT_TERM_LABEL } from "@/lib/exporter-opportunities";
import { formatDate } from "@/lib/exporter-dashboard";
import { dealEligibility, DEAL_SOURCE_LABEL } from "@/lib/exporter-deals";
import type { ExporterNegotiation } from "@/lib/exporter-negotiations";
import type { ExporterQuotation } from "@/lib/exporter-quotations";
import { createDeal, useExporterDeals } from "@/lib/exporter-deal-store";
import { qtyText, unitPriceText, valueText } from "./deal-ui";

const primary = `inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange px-4 text-sm font-semibold text-on-brand shadow-sm shadow-orange/20 transition hover:brightness-95 ${focusRing}`;
const view = `inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-teal bg-teal-soft px-4 text-sm font-semibold text-teal transition hover:bg-teal hover:text-on-brand ${focusRing}`;

/**
 * "Set Up Deal" for an agreed negotiation or a directly accepted quotation,
 * or "View Deal" once one exists. Reviews the terms before creating.
 */
export function SetUpDealAction({ quotation, negotiation }: { quotation: ExporterQuotation; negotiation?: ExporterNegotiation }) {
  const deals = useExporterDeals();
  const router = useRouter();
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligibility = dealEligibility(quotation, negotiation, deals);

  if (!eligibility.ok) {
    if (eligibility.reason === "deal-exists" && eligibility.deal) {
      return (
        <Link href={exporterHref(`deals/${eligibility.deal.id}`)} className={view}>
          <FileCheck2 className="size-4" aria-hidden />
          View Deal {eligibility.deal.id}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      );
    }
    return null;
  }

  const t = eligibility.terms;
  const rows: [string, string][] = [
    ["RFQ", quotation.requirementId],
    ["Quotation", quotation.id],
    ...(negotiation ? ([["Negotiation", negotiation.id]] as [string, string][]) : []),
    ["Source", DEAL_SOURCE_LABEL[eligibility.source]],
    ["Product", t.productName],
    ["Quantity", qtyText(t)],
    ["Final Price", unitPriceText(t)],
    ["Total", valueText(t)],
    ["Incoterm", `${t.incoterm} ${t.namedPlace}`],
    ["Payment", t.paymentSummary || PAYMENT_TERM_LABEL[t.paymentTerm]],
    ["Delivery", t.estimatedDelivery ? formatDate(t.estimatedDelivery) : `${t.leadTimeDays}-day lead time`],
  ];

  const create = () => {
    const result = createDeal(quotation, negotiation);
    if (!result.ok) return setError("The deal couldn't be created. Please reload and try again.");
    setReviewing(false);
    router.push(exporterHref(`deals/${result.id}`));
  };

  return (
    <>
      <button type="button" onClick={() => setReviewing(true)} className={primary}>
        <FileCheck2 className="size-4" aria-hidden />
        Set Up Deal
      </button>
      <Modal open={reviewing} onClose={() => setReviewing(false)} labelledBy="deal-setup-title">
        <header className="border-b border-line px-5 py-4 sm:px-6">
          <h2 id="deal-setup-title" className="text-lg font-bold tracking-tight text-ink">Set Up Deal</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {eligibility.source === "negotiated-agreement"
              ? "Terms are taken from the agreement in the negotiation — not the original quotation."
              : "Terms are taken from the quotation as the buyer accepted it."}
          </p>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <dl className="divide-y divide-line rounded-xl border border-line">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <dt className="text-ink-muted">{label}</dt>
                <dd className={`text-right [overflow-wrap:anywhere] ${label === "Total" ? "font-bold" : "font-medium"} text-ink`}>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-canvas px-4 py-3 text-xs text-ink-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            These terms are frozen into the deal. Buyer identity stays protected. Demo: stored in this browser only.
          </p>
          {error && <p role="alert" className="mt-3 text-sm font-medium text-orange">{error}</p>}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
          <button type="button" onClick={() => setReviewing(false)} className={`h-10 rounded-lg px-4 text-sm font-semibold text-ink-muted hover:bg-canvas hover:text-ink ${focusRing}`}>
            Cancel
          </button>
          <button type="button" onClick={create} className={primary}>
            Create Deal
          </button>
        </footer>
      </Modal>
    </>
  );
}
