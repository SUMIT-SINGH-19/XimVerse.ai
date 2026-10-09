"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, SearchX } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { focusRing } from "@/components/workspace/styles";
import { Select } from "@/components/exporter/products/catalogue-filters";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDate } from "@/lib/exporter-dashboard";
import { findOpportunity, shortCountry } from "@/lib/exporter-opportunities";
import { formatCompactMoney } from "@/lib/exporter-quotation-pipeline";
import {
  DEAL_SOURCE_LABEL,
  DEAL_STATUS_LABEL,
  dealReadiness,
  dealStatus,
  dealValueMinor,
  isActiveDeal,
  type DealSource,
  type DealStatus,
  type ExporterDeal,
} from "@/lib/exporter-deals";
import { useExporterDeals } from "@/lib/exporter-deal-store";
import type { Currency } from "@/lib/import-requirements";
import { DealStatusPill, qtyText, SourceBadge, valueText } from "./deal-ui";

type Sort = "newest" | "value" | "ready" | "oldest-pending";

interface Row {
  d: ExporterDeal;
  status: DealStatus;
  destination: string;
  readiness: number;
}

const th = "whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint first:pl-5 last:pr-4";
const td = "px-2.5 py-3.5 align-top first:pl-5 last:pr-4";
const EXECUTION_ORDER: Record<DealStatus, number> = {
  "ready-for-execution": 0,
  confirmed: 1,
  "pending-setup": 2,
  "on-hold": 3,
  completed: 4,
  cancelled: 5,
};

/** Seeded deals plus deals created in this browser. */
export function DealsList() {
  const deals = useExporterDeals();
  const rows = useMemo<Row[]>(
    () =>
      deals.map((d) => {
        const o = findOpportunity(d.requirementId);
        return { d, status: dealStatus(d), destination: o ? shortCountry(o.delivery.destinationCountry) : "—", readiness: dealReadiness(d) };
      }),
    [deals],
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DealStatus | "">("");
  const [source, setSource] = useState<DealSource | "">("");
  const [destination, setDestination] = useState("");
  const [currency, setCurrency] = useState<Currency | "">("");
  const [sort, setSort] = useState<Sort>("newest");

  const active = rows.filter((r) => isActiveDeal(r.status));
  const totals: Partial<Record<Currency, number>> = {};
  for (const r of active) totals[r.d.terms.currency] = (totals[r.d.terms.currency] ?? 0) + dealValueMinor(r.d.terms);

  const q = query.trim().toLowerCase();
  const cmp: Record<Sort, (a: Row, b: Row) => number> = {
    newest: (a, b) => b.d.createdAt.localeCompare(a.d.createdAt),
    value: (a, b) => a.d.terms.currency.localeCompare(b.d.terms.currency) || dealValueMinor(b.d.terms) - dealValueMinor(a.d.terms),
    ready: (a, b) => EXECUTION_ORDER[a.status] - EXECUTION_ORDER[b.status] || b.readiness - a.readiness,
    "oldest-pending": (a, b) => Number(a.status !== "pending-setup") - Number(b.status !== "pending-setup") || a.d.createdAt.localeCompare(b.d.createdAt),
  };
  const visible = rows
    .filter(
      (r) =>
        (!q ||
          [r.d.id, r.d.quotationId, r.d.negotiationId ?? "", r.d.requirementId, r.d.terms.productName, r.destination].some((s) => s.toLowerCase().includes(q))) &&
        (!status || r.status === status) &&
        (!source || r.d.source === source) &&
        (!destination || r.destination === destination) &&
        (!currency || r.d.terms.currency === currency),
    )
    .sort(cmp[sort]);
  const uniq = (xs: string[]) => [...new Set(xs)].sort();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Trade" title="Deals" description="Track commercially agreed transactions before execution and shipment." />

      <ul aria-label="Deal summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Active Deals", value: active.length },
          { label: "Pending Setup", value: rows.filter((r) => r.status === "pending-setup").length, alert: true },
          { label: "Ready for Execution", value: rows.filter((r) => r.status === "ready-for-execution").length },
        ].map((m) => (
          <li key={m.label} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
            <span className="text-sm font-medium text-ink-muted">{m.label}</span>
            <span className={`mt-1.5 text-2xl font-bold tabular-nums ${m.alert && m.value > 0 ? "text-orange" : "text-ink"}`}>{m.value}</span>
          </li>
        ))}
        <li className="col-span-2 flex flex-col rounded-2xl border border-line bg-surface p-4 sm:col-span-1">
          <span className="text-sm font-medium text-ink-muted">Total Contract Value</span>
          <ul className="mt-1.5 space-y-0.5">
            {(Object.entries(totals) as [Currency, number][]).map(([c, minor]) => (
              <li key={c} className="text-xl font-bold tabular-nums text-ink">
                {formatCompactMoney(minor, c)} <span className="text-xs font-medium text-ink-faint">{c}</span>
              </li>
            ))}
          </ul>
          <span className="mt-0.5 text-xs text-ink-muted">Active deals, per currency — not converted</span>
        </li>
      </ul>

      <section aria-labelledby="deals-heading" className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <h2 id="deals-heading" className="text-base font-semibold tracking-tight text-ink">
            Deals <span className="ml-2 text-sm font-normal text-ink-muted">{visible.length} of {rows.length}</span>
          </h2>
          <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 rounded-lg border border-line bg-canvas px-2 text-sm text-ink focus:border-teal focus:outline-none">
              <option value="newest">Newest</option>
              <option value="value">Highest Value (per currency)</option>
              <option value="ready">Execution Ready</option>
              <option value="oldest-pending">Oldest Pending</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-3 sm:px-6 xl:grid-cols-5">
          <label className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-3 xl:col-span-1">
            <span className="text-xs font-medium text-ink-faint">Search</span>
            <span className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="DL, QT, NG, RFQ, product…" className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-2.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20" />
            </span>
          </label>
          <Select label="Status" value={status} onChange={setStatus} options={(Object.keys(DEAL_STATUS_LABEL) as DealStatus[]).map((s) => ({ value: s, label: DEAL_STATUS_LABEL[s] }))} allLabel="All statuses" />
          <Select label="Source" value={source} onChange={setSource} options={(Object.keys(DEAL_SOURCE_LABEL) as DealSource[]).map((s) => ({ value: s, label: DEAL_SOURCE_LABEL[s] }))} allLabel="All sources" />
          <Select label="Destination" value={destination} onChange={setDestination} options={uniq(rows.map((r) => r.destination)).map((d) => ({ value: d, label: d }))} allLabel="All destinations" />
          <Select label="Currency" value={currency} onChange={(v) => setCurrency(v as Currency | "")} options={uniq(rows.map((r) => r.d.terms.currency)).map((c) => ({ value: c, label: c }))} allLabel="All currencies" />
        </div>

        {visible.length === 0 ? (
          <div className="border-t border-line px-6 py-14 text-center">
            <SearchX className="mx-auto size-8 text-ink-faint" aria-hidden />
            <p className="mt-3 font-semibold text-ink">No deals match these filters</p>
          </div>
        ) : (
          <>
            <div className="relative hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[58rem] text-sm">
                <thead className="border-y border-line bg-canvas/60">
                  <tr>
                    <th scope="col" className={th}>Deal</th>
                    <th scope="col" className={th}>Product</th>
                    <th scope="col" className={th}>Destination</th>
                    <th scope="col" className={`${th} text-right!`}>Quantity</th>
                    <th scope="col" className={`${th} text-right!`}>Contract Value</th>
                    <th scope="col" className={th}>Incoterm</th>
                    <th scope="col" className={th}>Status / Source</th>
                    <th scope="col" className={th}>Created</th>
                    <th scope="col" className={th}><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((r) => (
                    <tr key={r.d.id} className="transition-colors hover:bg-canvas/50">
                      <td className={`${td} whitespace-nowrap font-mono text-xs font-semibold text-ink`}>{r.d.id}</td>
                      <td className={`${td} max-w-52`}>
                        <p className="font-semibold text-ink">{r.d.terms.productName}</p>
                        <p className="mt-0.5 font-mono text-xs text-ink-muted">{r.d.quotationId}</p>
                      </td>
                      <td className={`${td} whitespace-nowrap text-ink`}>{r.destination}</td>
                      <td className={`${td} whitespace-nowrap text-right tabular-nums text-ink`}>{qtyText(r.d.terms)}</td>
                      <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums text-ink`}>{valueText(r.d.terms)}</td>
                      <td className={`${td} whitespace-nowrap text-ink`}>{r.d.terms.incoterm} {r.d.terms.namedPlace.split(",")[0]}</td>
                      <td className={td}>
                        <DealStatusPill status={r.status} />
                        <span className="mt-1.5 block"><SourceBadge source={r.d.source} /></span>
                      </td>
                      <td className={`${td} whitespace-nowrap text-xs text-ink-muted`}>{formatDate(r.d.createdAt.slice(0, 10))}</td>
                      <td className={`${td} text-right`}>
                        <Link href={exporterHref(`deals/${r.d.id}`)} aria-label={`View deal ${r.d.id}`} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-teal hover:border-teal hover:bg-teal-soft ${focusRing}`}>
                          View
                          <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="grid gap-3 border-t border-line p-4 md:grid-cols-2 xl:hidden">
              {visible.map((r) => (
                <li key={r.d.id} className="flex flex-col rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-ink">{r.d.id}</p>
                      <p className="mt-1 font-semibold text-ink">{r.d.terms.productName}</p>
                    </div>
                    <DealStatusPill status={r.status} />
                  </div>
                  <dl className="mb-3 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div><dt className="text-xs text-ink-faint">Contract value</dt><dd className="font-semibold tabular-nums text-ink">{valueText(r.d.terms)}</dd></div>
                    <div><dt className="text-xs text-ink-faint">Quantity</dt><dd className="tabular-nums text-ink">{qtyText(r.d.terms)}</dd></div>
                    <div><dt className="text-xs text-ink-faint">Destination</dt><dd className="text-ink">{r.destination}</dd></div>
                    <div><dt className="text-xs text-ink-faint">Source</dt><dd><SourceBadge source={r.d.source} /></dd></div>
                  </dl>
                  <Link href={exporterHref(`deals/${r.d.id}`)} className={`mt-auto inline-flex items-center justify-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-teal hover:border-teal hover:bg-teal-soft ${focusRing}`}>
                    View Deal
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
