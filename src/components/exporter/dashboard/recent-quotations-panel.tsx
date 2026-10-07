import { Panel } from "@/components/workspace/panel";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { exporterHref } from "@/lib/exporter-nav";
import {
  formatDate,
  formatQuantity,
  formatUnitPrice,
  QUOTATION_STATUS_LABEL,
  type QuotationStatus,
  type QuotationSummary,
} from "@/lib/exporter-dashboard";

const STATUS_TONE: Record<QuotationStatus, PillTone> = {
  draft: "muted",
  submitted: "neutral",
  "under-review": "neutral",
  shortlisted: "brand",
  negotiation: "accent",
  won: "solid",
  lost: "muted",
};

const th = "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint first:pl-6 last:pr-6";
const td = "whitespace-nowrap px-4 py-3 first:pl-6 last:pr-6";

export function RecentQuotationsPanel({ quotations }: { quotations: readonly QuotationSummary[] }) {
  return (
    <Panel
      title="Recent Quotations"
      action={{ label: "View All Quotations", href: exporterHref("quotations") }}
      bodyClassName="pt-4 pb-2"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="border-y border-line bg-canvas/60">
            <tr>
              <th scope="col" className={th}>Quotation</th>
              <th scope="col" className={th}>Product / Destination</th>
              <th scope="col" className={`${th} text-right!`}>Quoted Price / Qty</th>
              <th scope="col" className={th}>Submitted</th>
              <th scope="col" className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {quotations.map((q) => (
              <tr key={q.quotationId} className="transition-colors hover:bg-canvas/50">
                <td className={`${td} font-mono text-xs text-ink-muted`}>{q.quotationId}</td>
                <td className={td}>
                  <p className="font-semibold text-ink">{q.product}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{q.destinationCountry}</p>
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  <p className="font-semibold text-ink">{formatUnitPrice(q.price, q.quantity.unit)}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{formatQuantity(q.quantity)}</p>
                </td>
                <td className={`${td} text-ink-muted`}>{formatDate(q.submittedOn)}</td>
                <td className={td}>
                  <StatusPill tone={STATUS_TONE[q.status]}>{QUOTATION_STATUS_LABEL[q.status]}</StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
