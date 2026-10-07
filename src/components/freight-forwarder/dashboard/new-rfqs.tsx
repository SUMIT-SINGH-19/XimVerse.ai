import { Panel } from "@/components/workspace/panel";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { formatDayMonth } from "@/lib/format";
import { freightForwarderHref } from "@/lib/freight-forwarder-nav";
import {
  RFQ_CTA,
  RFQ_STATUS_LABEL,
  type FreightRFQ,
  type RfqStatus,
} from "@/lib/freight-forwarder-dashboard-data";
import {
  CtaLink,
  DataTable,
  LaneLabel,
  ModeBadge,
  RefId,
  formatClock,
  formatDuration,
  minutesUntil,
  type Column,
} from "./dashboard-ui";

const STATUS_TONE: Record<RfqStatus, PillTone> = {
  new: "accent",
  reviewing: "neutral",
  quoted: "brand",
};

const weight = new Intl.NumberFormat("en-IN");

function QuoteDeadline({ rfq, asOf, timeZone }: { rfq: FreightRFQ; asOf: string; timeZone: string }) {
  const minutes = minutesUntil(rfq.quoteDeadline, asOf);
  // Within a day, a countdown reads faster than a clock time.
  const label =
    minutes > 0 && minutes < 24 * 60
      ? `${formatDuration(minutes)} left`
      : formatClock(rfq.quoteDeadline, timeZone);
  return (
    <time
      dateTime={rfq.quoteDeadline}
      className={`whitespace-nowrap tabular-nums ${minutes <= 180 ? "font-semibold text-orange" : "text-ink"}`}
    >
      {label}
    </time>
  );
}

function columns(asOf: string, timeZone: string): Column<FreightRFQ>[] {
  return [
    {
      header: "RFQ",
      hideInCard: true,
      cell: (r) => (
        <>
          <RefId className="block font-semibold text-ink">{r.id}</RefId>
          <span className="block max-w-48 truncate text-xs text-ink-muted">{r.customer.name}</span>
          <span className="mt-1 flex items-center gap-2">
            <StatusPill tone={STATUS_TONE[r.status]}>{RFQ_STATUS_LABEL[r.status]}</StatusPill>
            <span className="text-xs capitalize text-ink-faint">{r.customer.role}</span>
          </span>
        </>
      ),
    },
    {
      header: "Lane",
      cell: (r) => (
        <>
          <LaneLabel lane={r.lane} className="text-ink" />
          <ModeBadge mode={r.mode} className="mt-0.5" />
        </>
      ),
    },
    {
      header: "Cargo",
      cell: (r) => (
        <>
          <span className="block text-ink">{r.cargo}</span>
          <span className="block text-xs text-ink-muted">
            {weight.format(r.weightKg)} kg
            {r.volumeCbm !== undefined && ` · ${r.volumeCbm} cbm`}
          </span>
          <span className="block text-xs text-ink-muted">{r.equipment}</span>
        </>
      ),
    },
    { header: "Incoterm", cell: (r) => <span className="font-medium text-ink">{r.incoterm}</span> },
    {
      header: "Departure",
      className: "whitespace-nowrap",
      cell: (r) => <time dateTime={r.requiredDeparture}>{formatDayMonth(r.requiredDeparture)}</time>,
    },
    { header: "Quote Due", cell: (r) => <QuoteDeadline rfq={r} asOf={asOf} timeZone={timeZone} /> },
  ];
}

/** Freight requests from exporters and importers that still need a quote. */
export function NewRfqs({
  rfqs,
  total,
  asOf,
  timeZone,
  className = "",
}: {
  /** Sorted by quote deadline. */
  rfqs: readonly FreightRFQ[];
  total: number;
  asOf: string;
  timeZone: string;
  className?: string;
}) {
  return (
    <Panel
      title="New RFQs"
      description={`${total} freight requests awaiting your quote · soonest deadline first`}
      action={{ label: "View All RFQs", href: freightForwarderHref("rfqs") }}
      className={className}
      bodyClassName="pt-4"
    >
      <DataTable
        rows={rfqs}
        columns={columns(asOf, timeZone)}
        rowKey={(r) => r.id}
        caption="New freight RFQs"
        cardTitle={(r) => (
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <RefId className="block font-semibold text-ink">{r.id}</RefId>
              <span className="block truncate text-xs text-ink-muted">{r.customer.name}</span>
            </span>
            <StatusPill tone={STATUS_TONE[r.status]}>{RFQ_STATUS_LABEL[r.status]}</StatusPill>
          </span>
        )}
        action={(r) => (
          <CtaLink
            section="rfqs"
            label={RFQ_CTA[r.status]}
            context={r.id}
            variant={r.status === "new" ? "primary" : "secondary"}
          />
        )}
      />
    </Panel>
  );
}
