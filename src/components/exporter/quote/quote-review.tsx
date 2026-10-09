"use client";

import { Send, X } from "lucide-react";
import { focusRing, iconButton } from "@/components/workspace/styles";
import { formatDate } from "@/lib/exporter-dashboard";
import { PAYMENT_TERM_LABEL, UNIT_SHORT, type BuyerOpportunity } from "@/lib/exporter-opportunities";
import { formatMoney, type QuotationDeviation, type QuoteFormValues, type QuoteTotals } from "@/lib/exporter-quotations";
import { SeverityBadge } from "./form-ui";

/** Final check before submission. */
export function QuoteReview({
  o,
  v,
  totals,
  expiry,
  deviations,
  onCancel,
  onConfirm,
}: {
  o: BuyerOpportunity;
  v: QuoteFormValues;
  totals: QuoteTotals;
  expiry?: string;
  deviations: readonly QuotationDeviation[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const unit = UNIT_SHORT[o.quantity.unit];
  const rows = [
    ["RFQ", o.rfqId],
    ["Product", o.product.name],
    ["Quantity", `${totals.quantity?.toLocaleString("en-US")} ${unit}`],
    ["Unit price", totals.unitMinor !== undefined ? `${formatMoney(totals.unitMinor, v.currency)} / ${unit}` : "—"],
    ["Total", totals.totalMinor !== undefined ? formatMoney(totals.totalMinor, v.currency) : "—"],
    ["Incoterm", `${v.incoterm} ${v.namedPlace}`],
    ["Delivery", `Dispatch ${formatDate(v.dispatchDate)} · arrive ${formatDate(v.deliveryDate)}`],
    ["Payment", `${v.paymentTerm ? PAYMENT_TERM_LABEL[v.paymentTerm] : "—"}${Number(v.advancePercent) > 0 ? ` · ${v.advancePercent}% advance` : ""}`],
    ["Validity", expiry ? `${v.validityDays} days · until ${formatDate(expiry)}` : "—"],
  ];

  return (
    <>
      <header className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id="quote-review-title" className="text-lg font-bold tracking-tight text-ink">
            Review &amp; Submit Quotation
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">Check the offer once more. Your internal note isn&apos;t included.</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Close" className={`${iconButton} -mr-2`}>
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <dl className="divide-y divide-line rounded-xl border border-line">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
              <dt className="text-ink-muted">{label}</dt>
              <dd className={`text-right ${label === "Total" ? "font-bold" : "font-medium"} text-ink`}>{value}</dd>
            </div>
          ))}
        </dl>

        <h3 className="mt-5 text-sm font-semibold text-ink">Deviations ({deviations.length})</h3>
        {deviations.length ? (
          <ul className="mt-2 space-y-2">
            {deviations.map((d) => (
              <li key={d.id} className="rounded-lg bg-canvas px-3 py-2 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={d.severity} />
                  <span className="font-medium text-ink">{d.message}</span>
                </span>
                <span className="mt-1 block text-xs text-ink-muted">
                  Buyer: {d.buyerRequirement} · You: {d.exporterOffer}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-teal">None — the offer matches every stated requirement.</p>
        )}

        <p className="mt-5 rounded-xl bg-orange-soft px-4 py-3 text-sm text-ink">
          Demo: submitting stores this quotation in this browser only. It isn&apos;t sent to Ximverse or the buyer yet.
        </p>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
        <button type="button" onClick={onCancel} className={`h-10 rounded-lg px-4 text-sm font-semibold text-ink-muted hover:bg-canvas hover:text-ink ${focusRing}`}>
          Back to Edit
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`inline-flex h-10 items-center gap-2 rounded-lg bg-orange px-4 text-sm font-semibold text-on-brand transition hover:brightness-95 ${focusRing}`}
        >
          <Send className="size-4" aria-hidden />
          Confirm Submission
        </button>
      </footer>
    </>
  );
}
