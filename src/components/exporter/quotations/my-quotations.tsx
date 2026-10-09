"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, SearchX } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { focusRing } from "@/components/workspace/styles";
import { SumitInsight } from "@/components/exporter/company/profile-readiness";
import { Select } from "@/components/exporter/products/catalogue-filters";
import { exporterHref } from "@/lib/exporter-nav";
import { daysBetween, DEMO_TODAY, QUOTATION_STATUS_ORDER, ACTIVE_STATUSES, type ExporterQuotationStatus } from "@/lib/exporter-quotations";
import { useStoredDrafts, useStoredQuotations } from "@/lib/exporter-quotation-store";
import {
  buildPipeline,
  formatCompactMoney,
  pipelineSummary,
  quotationsInsight,
  rowTonnes,
  type PipelineRow,
} from "@/lib/exporter-quotation-pipeline";
import type { Currency } from "@/lib/import-requirements";
import { QuotationList } from "./quotation-list";
import { quotationStatusText } from "./quotation-ui";

type SubmittedWindow = "7d" | "30d" | "older";
type Sort = "recent" | "value" | "expiring" | "status" | "quantity";

interface Filters {
  query: string;
  status: ExporterQuotationStatus | "";
  destination: string;
  product: string;
  currency: Currency | "";
  submitted: SubmittedWindow | "";
  sort: Sort;
}

const DEFAULT_FILTERS: Filters = { query: "", status: "", destination: "", product: "", currency: "", submitted: "", sort: "recent" };

const statusRank = (s: ExporterQuotationStatus) => QUOTATION_STATUS_ORDER.indexOf(s);
const isLive = (r: PipelineRow) => r.status === "draft" || ACTIVE_STATUSES.includes(r.status);

function applyFilters(rows: readonly PipelineRow[], f: Filters): PipelineRow[] {
  const q = f.query.trim().toLowerCase();
  const submittedAge = (r: PipelineRow) => {
    const at = r.quotation?.submittedAt;
    return at ? daysBetween(at.slice(0, 10), DEMO_TODAY) : undefined;
  };
  const inWindow = (r: PipelineRow) => {
    if (!f.submitted) return true;
    const age = submittedAge(r);
    if (age === undefined) return false;
    return f.submitted === "7d" ? age <= 7 : f.submitted === "30d" ? age <= 30 : age > 30;
  };
  const out = rows.filter(
    (r) =>
      (!q || [r.key, r.rfqId, r.productName, r.destinationCountry ?? "", r.destinationLocation ?? ""].some((s) => s.toLowerCase().includes(q))) &&
      (!f.status || r.status === f.status) &&
      (!f.destination || r.destinationCountry === f.destination) &&
      (!f.product || r.productName === f.product) &&
      (!f.currency || r.currency === f.currency) &&
      inWindow(r),
  );
  const by: Record<Sort, (a: PipelineRow, b: PipelineRow) => number> = {
    recent: (a, b) => b.activityAt.localeCompare(a.activityAt),
    // Values are only comparable within a currency: group by currency, then largest first.
    value: (a, b) => (a.currency ?? "").localeCompare(b.currency ?? "") || (b.totalMinor ?? -1) - (a.totalMinor ?? -1),
    expiring: (a, b) =>
      Number(!isLive(a)) - Number(!isLive(b)) || (a.validUntil ?? "9999").localeCompare(b.validUntil ?? "9999"),
    status: (a, b) => statusRank(a.status) - statusRank(b.status) || b.activityAt.localeCompare(a.activityAt),
    quantity: (a, b) => rowTonnes(b) - rowTonnes(a),
  };
  return out.sort(by[f.sort]);
}

const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => Boolean(x)))].sort();

/** The exporter's quotation pipeline: seeded history + this browser's submissions + drafts. */
export function MyQuotations() {
  const local = useStoredQuotations();
  const drafts = useStoredDrafts();
  const rows = useMemo(() => buildPipeline(local, drafts), [local, drafts]);
  const summary = useMemo(() => pipelineSummary(rows), [rows]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const visible = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const values = Object.entries(summary.activeValueByCurrency) as [Currency, number][];
  const metrics = [
    { key: "total", label: "Total Quotations", value: String(summary.total), note: summary.drafts ? `+ ${summary.drafts} draft${summary.drafts === 1 ? "" : "s"}` : undefined },
    { key: "active", label: "Active", value: String(summary.active), note: "Submitted to negotiation" },
    { key: "shortlisted", label: "Shortlisted", value: String(summary.shortlisted) },
    { key: "revision", label: "Revision Requested", value: String(summary.revisionRequested), alert: summary.revisionRequested > 0 },
    {
      key: "winrate",
      label: "Win Rate",
      value: summary.winRate !== undefined ? `${Math.round(summary.winRate * 100)}%` : "—",
      note: summary.decided ? `${summary.accepted} won of ${summary.decided} decided` : "No decisions yet",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trade"
        title="My Quotations"
        description="Track, manage and follow up on quotations submitted for buyer opportunities."
        aside={
          <Link
            href={exporterHref("opportunities")}
            className={`inline-flex h-10 items-center gap-2 rounded-lg bg-teal px-4 text-sm font-semibold text-on-brand shadow-sm shadow-teal/20 transition hover:brightness-110 ${focusRing}`}
          >
            View Buyer Opportunities
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      />

      <ul aria-label="Quotation summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m) => (
          <li key={m.key} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
            <span className="text-sm font-medium text-ink-muted">{m.label}</span>
            <span className={`mt-1.5 text-2xl font-bold tracking-tight tabular-nums ${m.alert ? "text-orange" : "text-ink"}`}>{m.value}</span>
            {m.note && <span className="mt-0.5 text-xs text-ink-muted">{m.note}</span>}
          </li>
        ))}
        <li className="col-span-2 flex flex-col rounded-2xl border border-line bg-surface p-4 sm:col-span-3 xl:col-span-1">
          <span className="text-sm font-medium text-ink-muted">Quoted Value</span>
          {values.length ? (
            <ul className="mt-1.5 space-y-0.5">
              {values.map(([currency, minor]) => (
                <li key={currency} className="text-xl font-bold tracking-tight tabular-nums text-ink">
                  {formatCompactMoney(minor, currency)}
                  <span className="ml-1.5 text-xs font-medium text-ink-faint">{currency}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="mt-1.5 text-2xl font-bold text-ink">—</span>
          )}
          <span className="mt-0.5 text-xs text-ink-muted">Active quotations{values.length > 1 ? " · per currency, not converted" : ""}</span>
        </li>
      </ul>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <nav aria-label="Quotation pipeline" className="rounded-2xl border border-line bg-surface p-4 xl:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Pipeline</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {QUOTATION_STATUS_ORDER.map((s) => {
              const active = filters.status === s;
              return (
                <li key={s}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => set("status", active ? "" : s)}
                    className={`flex items-baseline gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${focusRing} ${
                      active ? "border-teal bg-teal text-on-brand" : "border-line text-ink-muted hover:border-teal/50 hover:text-ink"
                    } ${summary.byStatus[s] === 0 && !active ? "opacity-50" : ""}`}
                  >
                    {quotationStatusText(s)}
                    <span className={`font-bold tabular-nums ${active ? "" : "text-ink"}`}>{summary.byStatus[s]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <SumitInsight title="SUMIT insight" insight={quotationsInsight(rows)} />
      </div>

      <section aria-labelledby="quotations-heading" className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 id="quotations-heading" className="text-base font-semibold tracking-tight text-ink">
              Quotations
            </h2>
            <p className="text-sm text-ink-muted" aria-live="polite">
              {visible.length} of {rows.length}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
            Sort
            <select
              value={filters.sort}
              onChange={(e) => set("sort", e.target.value as Sort)}
              className="h-8 rounded-lg border border-line bg-canvas px-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
            >
              <option value="recent">Most Recent</option>
              <option value="value">Highest Value (per currency)</option>
              <option value="expiring">Expiring Soon</option>
              <option value="status">Status</option>
              <option value="quantity">Largest Quantity</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-3 sm:px-6 xl:grid-cols-6">
          <label className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-3 xl:col-span-1">
            <span className="text-xs font-medium text-ink-faint">Search</span>
            <span className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="search"
                value={filters.query}
                onChange={(e) => set("query", e.target.value)}
                placeholder="Quotation, RFQ, product…"
                className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-2.5 text-sm text-ink transition-colors focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20"
              />
            </span>
          </label>
          <Select
            label="Status"
            value={filters.status}
            onChange={(v) => set("status", v)}
            options={QUOTATION_STATUS_ORDER.map((s) => ({ value: s, label: quotationStatusText(s) }))}
            allLabel="All statuses"
          />
          <Select
            label="Destination"
            value={filters.destination}
            onChange={(v) => set("destination", v)}
            options={uniq(rows.map((r) => r.destinationCountry)).map((d) => ({ value: d, label: d }))}
            allLabel="All destinations"
          />
          <Select
            label="Product"
            value={filters.product}
            onChange={(v) => set("product", v)}
            options={uniq(rows.map((r) => r.productName)).map((p) => ({ value: p, label: p }))}
            allLabel="All products"
          />
          <Select
            label="Currency"
            value={filters.currency}
            onChange={(v) => set("currency", v as Currency | "")}
            options={uniq(rows.map((r) => r.currency)).map((c) => ({ value: c, label: c }))}
            allLabel="All currencies"
          />
          <Select
            label="Submitted"
            value={filters.submitted}
            onChange={(v) => set("submitted", v)}
            options={[
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "older", label: "Older than 30 days" },
            ]}
            allLabel="Any time"
          />
        </div>

        {visible.length ? (
          <QuotationList rows={visible} />
        ) : (
          <div className="border-t border-line px-6 py-14 text-center">
            <SearchX className="mx-auto size-8 text-ink-faint" aria-hidden />
            <p className="mt-3 font-semibold text-ink">No quotations match these filters</p>
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
