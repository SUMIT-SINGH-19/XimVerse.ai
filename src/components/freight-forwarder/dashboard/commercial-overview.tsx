import { Panel } from "@/components/workspace/panel";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { freightForwarderHref } from "@/lib/freight-forwarder-nav";
import {
  QUOTE_STATUS_LABEL,
  conversionRate,
  type CommercialOverview as Commercial,
  type QuoteStatus,
} from "@/lib/freight-forwarder-dashboard-data";
import { LaneLabel, RefId, formatInr, formatInrCompact } from "./dashboard-ui";

const STATUS_TONE: Record<QuoteStatus, PillTone> = {
  accepted: "brand",
  awaiting: "accent",
  declined: "muted",
};

/** Quote volume, win rate and money in; not an accounting ledger. */
export function CommercialOverview({
  commercial,
  className = "",
}: {
  commercial: Commercial;
  className?: string;
}) {
  const metrics = [
    { label: "Quotes Sent", value: String(commercial.quotesSent) },
    { label: "Quotes Accepted", value: String(commercial.quotesAccepted) },
    { label: "Conversion Rate", value: `${conversionRate(commercial)}%` },
    { label: "Revenue Confirmed", value: formatInrCompact(commercial.revenueConfirmed) },
    { label: "Outstanding Receivables", value: formatInrCompact(commercial.receivables) },
    { label: "Avg. Quote Response", value: `${commercial.avgResponseMinutes} min` },
  ];

  return (
    <Panel
      title="Quotes & Commercial"
      description="This month."
      action={{ label: "Quotes", href: freightForwarderHref("quotes") }}
      className={className}
    >
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col bg-surface px-4 py-3">
            <dt className="text-xs text-ink-muted">{m.label}</dt>
            <dd className="order-first text-xl font-semibold tabular-nums tracking-tight text-ink">{m.value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Recent quotes</h3>
      <ul className="mt-1 divide-y divide-line">
        {commercial.recentQuotes.map((q) => (
          <li key={q.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
            <div className="min-w-0">
              <RefId className="text-ink">{q.rfqId}</RefId>
              <LaneLabel lane={q.lane} className="ml-2 text-ink-muted" />
              <p className="truncate text-xs text-ink-faint">{q.customer}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold tabular-nums text-ink">{formatInr(q.amount)}</span>
              <StatusPill tone={STATUS_TONE[q.status]}>{QUOTE_STATUS_LABEL[q.status]}</StatusPill>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
