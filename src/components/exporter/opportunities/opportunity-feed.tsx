"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Gauge, Radar, ReceiptText, Scale, SearchX } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { focusRing } from "@/components/workspace/styles";
import { SumitInsight } from "@/components/exporter/company/profile-readiness";
import type { ProductSummary } from "@/lib/exporter-products";
import {
  hoursUntilDue,
  isClosingSoon,
  isOpen,
  opportunitySummary,
  tonnes,
  type BuyerOpportunity,
  type Incoterm,
} from "@/lib/exporter-opportunities";
import {
  DEFAULT_FILTERS,
  OpportunityFilters,
  SortSelect,
  type OpportunityFilterState,
} from "./opportunity-filters";
import { OpportunityList } from "./opportunity-list";

const DEADLINE_HOURS = { "24h": 24, "3d": 72, "7d": 168 } as const;

function applyFilters(list: readonly BuyerOpportunity[], f: OpportunityFilterState): BuyerOpportunity[] {
  const q = f.query.trim().toLowerCase();
  const score = (s: number) =>
    f.score === "90" ? s >= 90 : f.score === "80" ? s >= 80 && s < 90 : f.score === "below-80" ? s < 80 : true;
  const status = (o: BuyerOpportunity) =>
    f.status === "all"
      ? true
      : f.status === "open"
        ? isOpen(o)
        : f.status === "closing-soon"
          ? isOpen(o) && isClosingSoon(o)
          : o.status === f.status;

  const matches = list.filter(
    (o) =>
      (!q ||
        [o.rfqId, o.opportunityId, o.product.name, o.delivery.destinationCountry, o.delivery.destinationLocation].some((s) =>
          s.toLowerCase().includes(q),
        )) &&
      score(o.match.score) &&
      (!f.product || o.match.matchedProductId === f.product) &&
      (!f.region || o.buyer.region === f.region) &&
      status(o) &&
      (!f.deadline || (isOpen(o) && hoursUntilDue(o) > 0 && hoursUntilDue(o) <= DEADLINE_HOURS[f.deadline])) &&
      (!f.incoterm || o.delivery.incoterm?.term === f.incoterm),
  );

  // Closed opportunities sink to the bottom whatever the sort.
  const closedLast = (a: BuyerOpportunity, b: BuyerOpportunity) => Number(!isOpen(a)) - Number(!isOpen(b));
  const by: Record<OpportunityFilterState["sort"], (a: BuyerOpportunity, b: BuyerOpportunity) => number> = {
    match: (a, b) => b.match.score - a.match.score,
    closing: (a, b) => a.quotesDueAt.localeCompare(b.quotesDueAt),
    newest: (a, b) => b.sharedAt.localeCompare(a.sharedAt),
    quantity: (a, b) => (tonnes(b.quantity) ?? -1) - (tonnes(a.quantity) ?? -1),
  };
  return matches.sort((a, b) => closedLast(a, b) || by[f.sort](a, b));
}

const nf = new Intl.NumberFormat("en-US");

/** The exporter's demand feed. Filters are local UI state; rows link to the detail page. */
export function OpportunityFeed({
  opportunities,
  products,
  insight,
}: {
  opportunities: readonly BuyerOpportunity[];
  products: readonly ProductSummary[];
  insight: string;
}) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const visible = useMemo(() => applyFilters(opportunities, filters), [opportunities, filters]);
  const summary = useMemo(() => opportunitySummary(opportunities), [opportunities]);
  const matchedProducts = useMemo(
    () =>
      [...new Set(opportunities.map((o) => o.match.matchedProductId))]
        .map((id) => productsById.get(id))
        .filter((p): p is ProductSummary => Boolean(p)),
    [opportunities, productsById],
  );
  const incoterms = useMemo(
    () => [...new Set(opportunities.flatMap((o) => (o.delivery.incoterm ? [o.delivery.incoterm.term] : [])))].sort() as Incoterm[],
    [opportunities],
  );

  const metrics = [
    { key: "open", label: "Open Opportunities", value: String(summary.open), icon: Radar },
    { key: "high", label: "High Match", value: String(summary.highMatch), icon: Gauge, note: "90% match or better" },
    { key: "closing", label: "Closing Soon", value: String(summary.closingSoon), icon: CalendarClock, note: "Within 3 days" },
    { key: "volume", label: "Potential Volume", value: `${nf.format(summary.potentialVolume)} MT`, icon: Scale },
    { key: "quoted", label: "Quotation Submitted", value: String(summary.quoted), icon: ReceiptText },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trade"
        title="Buyer Opportunities"
        description="Buyer requirements matched with your products, capacity and export capabilities."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ul aria-label="Opportunity summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:col-span-2">
          {metrics.map(({ key, label, value, icon: Icon, note }) => (
            <li key={key} className="flex flex-col rounded-2xl border border-line bg-surface p-4 last:col-span-2 sm:last:col-span-1">
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-ink-muted">{label}</span>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-soft text-teal">
                  <Icon className="size-4" aria-hidden />
                </span>
              </span>
              <span className="mt-2 text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</span>
              {note && <span className="mt-0.5 text-xs text-ink-muted">{note}</span>}
            </li>
          ))}
        </ul>
        <SumitInsight title="SUMIT insight" insight={insight} />
      </div>

      <section aria-labelledby="feed-heading" className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="feed-heading" className="text-base font-semibold tracking-tight text-ink">
              Matched Requirements
            </h2>
            <p className="text-sm text-ink-muted" aria-live="polite">
              {visible.length} shown
            </p>
          </div>
          <SortSelect value={filters.sort} onChange={(sort) => setFilters({ ...filters, sort })} />
        </div>
        <OpportunityFilters filters={filters} onChange={setFilters} products={matchedProducts} incoterms={incoterms} />
        {visible.length ? (
          <OpportunityList opportunities={visible} productsById={productsById} />
        ) : (
          <div className="border-t border-line px-6 py-14 text-center">
            <SearchX className="mx-auto size-8 text-ink-faint" aria-hidden />
            <p className="mt-3 font-semibold text-ink">No opportunities match these filters</p>
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className={`mt-3 rounded-lg text-sm font-semibold text-teal hover:text-ink ${focusRing}`}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

    </div>
  );
}
