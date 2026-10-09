"use client";

import { CircleAlert, CircleCheck, Save, Send } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { formatDate } from "@/lib/exporter-dashboard";
import { PAYMENT_TERM_LABEL, UNIT_SHORT, type BuyerOpportunity } from "@/lib/exporter-opportunities";
import {
  formatMoney,
  type QuotationDeviation,
  type QuoteFormValues,
  type QuoteTotals,
  quoteReadiness,
} from "@/lib/exporter-quotations";
import { SeverityBadge } from "./form-ui";

type Readiness = ReturnType<typeof quoteReadiness>;

const submitClass = `inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-orange px-4 text-sm font-semibold text-on-brand shadow-sm shadow-orange/20 transition hover:brightness-95 ${focusRing}`;

function timeOf(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(iso));
}

/** Live summary, readiness and actions. Sticky beside the form on wide screens. */
export function QuoteSummary({
  o,
  v,
  totals,
  expiry,
  deviations,
  readiness,
  errorCount,
  savedAt,
  dirty,
  saveFailed,
  onSave,
  onSubmit,
}: {
  o: BuyerOpportunity;
  v: QuoteFormValues;
  totals: QuoteTotals;
  expiry?: string;
  deviations: readonly QuotationDeviation[];
  readiness: Readiness;
  errorCount: number;
  savedAt?: string;
  dirty: boolean;
  saveFailed: boolean;
  onSave: () => void;
  onSubmit: () => void;
}) {
  const unit = UNIT_SHORT[o.quantity.unit];
  const late = deviations.some((d) => d.field === "delivery");
  const rows = [
    { label: "Quantity", value: totals.quantity !== undefined ? `${totals.quantity.toLocaleString("en-US")} ${unit}` : "—" },
    { label: "Unit price", value: totals.unitMinor !== undefined ? `${formatMoney(totals.unitMinor, v.currency)} / ${unit}` : "—" },
    { label: "Incoterm", value: `${v.incoterm} ${v.namedPlace || "—"}` },
    { label: "Lead time", value: v.leadTimeDays ? `${v.leadTimeDays} days` : "—" },
    { label: "Delivery", value: v.deliveryDate ? (late ? `${formatDate(v.deliveryDate)} · late` : "Meets requirement") : "—" },
    { label: "Payment", value: v.paymentTerm ? PAYMENT_TERM_LABEL[v.paymentTerm] : "—" },
    { label: "Validity", value: expiry ? `${v.validityDays} days · ${formatDate(expiry)}` : "—" },
  ];
  const counts = { blocking: 0, warning: 0, info: 0 };
  for (const d of deviations) counts[d.severity] += 1;

  return (
    <>
      <section aria-labelledby="quote-summary-heading" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="quote-summary-heading" className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Quotation Summary
        </h2>
        <p className="mt-3 text-xs text-ink-faint">Total</p>
        <p className="text-3xl font-bold tracking-tight text-ink tabular-nums" aria-live="polite">
          {totals.totalMinor !== undefined ? formatMoney(totals.totalMinor, v.currency) : "—"}
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-3">
              <dt className="text-ink-muted">{r.label}</dt>
              <dd className={`text-right font-medium ${r.label === "Delivery" && late ? "text-orange" : "text-ink"}`}>{r.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 border-t border-line pt-4">
          <p className="flex items-center justify-between text-sm">
            <span className="font-semibold text-ink">Deviations</span>
            <span className="tabular-nums text-ink-muted">{deviations.length}</span>
          </p>
          {deviations.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {deviations.map((d) => (
                <li key={d.id} className="flex items-start gap-2 text-xs text-ink">
                  <SeverityBadge severity={d.severity} />
                  <span className="pt-0.5">{d.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-teal">Offer matches every stated requirement.</p>
          )}
          {counts.blocking > 0 && (
            <p className="mt-2 text-xs font-medium text-orange">Blocking deviations must be resolved before submitting.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="readiness-heading" className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="readiness-heading" className="text-base font-semibold tracking-tight text-ink">
            Quotation Readiness
          </h2>
          <span className="text-lg font-bold tabular-nums text-teal">{readiness.score}%</span>
        </div>
        <p className="text-xs text-ink-faint">How complete this quotation is — not the RFQ match score.</p>
        <ul className="mt-3 space-y-1">
          {readiness.checks.map((c) => (
            <li key={c.key} className="flex items-center gap-2 text-sm">
              {c.ok ? (
                <CircleCheck className="size-4 shrink-0 text-teal" aria-label="Done" />
              ) : (
                <CircleAlert className="size-4 shrink-0 text-orange" aria-label="To do" />
              )}
              <span className={c.ok ? "text-ink-muted" : "font-medium text-ink"}>{c.label}</span>
            </li>
          ))}
          {readiness.pending.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm">
              <CircleAlert className="size-4 shrink-0 text-orange" aria-label="Note" />
              <span className="text-ink">{p}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2">
          {errorCount > 0 && (
            <p role="alert" className="text-xs font-medium text-orange">
              Fix {errorCount} {errorCount === 1 ? "field" : "fields"} before submitting.
            </p>
          )}
          <button type="button" onClick={onSubmit} className={`${submitClass} w-full`}>
            <Send className="size-4" aria-hidden />
            Submit Quotation
          </button>
          <button
            type="button"
            onClick={onSave}
            className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line text-sm font-semibold text-ink-muted transition-colors hover:border-teal hover:bg-teal-soft hover:text-ink ${focusRing}`}
          >
            <Save className="size-4" aria-hidden />
            Save Draft
          </button>
          <p className="text-xs text-ink-faint" aria-live="polite">
            {saveFailed
              ? "Couldn't save — browser storage is unavailable."
              : savedAt
                ? `Saved locally for demo · ${timeOf(savedAt)}${dirty ? " · unsaved changes" : ""}. Not sent to Ximverse.`
                : "Drafts are saved in this browser only, for demo."}
          </p>
        </div>
      </section>
    </>
  );
}

/** Key figures and Submit, pinned to the bottom of small screens. */
export function MobileSubmitBar({ v, totals, onSubmit }: { v: QuoteFormValues; totals: QuoteTotals; onSubmit: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur xl:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-ink-muted">
            {v.quantity || "—"} · {v.incoterm} {v.namedPlace}
          </p>
          <p className="text-lg font-bold tabular-nums text-ink">
            {totals.totalMinor !== undefined ? formatMoney(totals.totalMinor, v.currency) : "—"}
          </p>
        </div>
        <button type="button" onClick={onSubmit} className={`${submitClass} shrink-0`}>
          <Send className="size-4" aria-hidden />
          Submit
        </button>
      </div>
    </div>
  );
}
