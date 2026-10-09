import Link from "next/link";
import { ArrowLeft, CircleCheck, Lock } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { SeverityBadge } from "./form-ui";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDate } from "@/lib/exporter-dashboard";
import { PAYMENT_TERM_LABEL, UNIT_SHORT } from "@/lib/exporter-opportunities";
import { COMPLIANCE_RESPONSE_LABEL, formatMoney, QUOTATION_STATUS_LABEL, type ExporterQuotation } from "@/lib/exporter-quotations";

const money = (amount: number, currency: ExporterQuotation["price"]["currency"]) => formatMoney(Math.round(amount * 100), currency);

/** Read-only view of a locally submitted quotation. */
export function SubmittedView({ q }: { q: ExporterQuotation }) {
  const unit = UNIT_SHORT[q.product.quantity.unit];
  const rows = [
    ["Quotation", q.id],
    ["Status", QUOTATION_STATUS_LABEL[q.status]],
    ["Quantity", `${q.product.quantity.amount.toLocaleString("en-US")} ${unit}`],
    ["Unit price", `${money(q.price.unitPrice, q.price.currency)} / ${unit}`],
    ["Total", money(q.price.total, q.price.currency)],
    ["Incoterm", `${q.price.incoterm} ${q.price.namedPlace}`],
    ["Delivery", `Dispatch ${formatDate(q.delivery.earliestDispatch)} · arrive ${formatDate(q.delivery.estimatedDelivery)}`],
    ["Payment", q.commercial.paymentSummary || PAYMENT_TERM_LABEL[q.commercial.paymentTerm]],
    ["Valid until", formatDate(q.commercial.validUntil)],
    ["Documents", q.compliance.documents.map((d) => `${d.name}: ${COMPLIANCE_RESPONSE_LABEL[d.response]}`).join(" · ") || "—"],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-6 text-center">
        <CircleCheck className="mx-auto size-10 text-teal" aria-hidden />
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">Quotation Submitted</h2>
        <p className="mt-1 font-mono text-sm text-ink-muted">
          {q.id} · {q.requirementId}
        </p>
        <p className="mx-auto mt-4 max-w-md rounded-xl bg-orange-soft px-4 py-3 text-sm text-ink">
          Demo submission stored locally. Backend buyer delivery will be connected later.
        </p>
      </section>

      <section aria-label="Submitted quotation" className="rounded-2xl border border-line bg-surface">
        <dl className="divide-y divide-line">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm sm:px-6">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="text-right font-medium text-ink [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
        {q.deviations.length > 0 && (
          <div className="border-t border-line px-5 py-4 sm:px-6">
            <p className="text-sm font-semibold text-ink">Deviations the buyer will see ({q.deviations.length})</p>
            <ul className="mt-2 space-y-1.5">
              {q.deviations.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm text-ink">
                  <SeverityBadge severity={d.severity} />
                  {d.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {q.internalNote && (
          <p className="flex items-start gap-2 border-t border-line px-5 py-4 text-sm text-ink-muted sm:px-6">
            <Lock className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
            <span>
              <span className="font-semibold text-ink">Internal note (private):</span> {q.internalNote}
            </span>
          </p>
        )}
      </section>

      <Link
        href={exporterHref(`opportunities/${q.requirementId}`)}
        className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-teal hover:text-ink ${focusRing}`}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to Opportunity
      </Link>
    </div>
  );
}
