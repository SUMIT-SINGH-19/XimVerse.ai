"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import {
  ATTENTION_SORT_EXPLANATION,
  compareAttention,
  EXCEPTION_SEVERITY_LABEL,
  SCHEDULE_STATUS_LABEL,
  type ScheduleStatus,
  type TrackingView,
} from "@/lib/importer-tracking";
import { modeLabel, SHIPMENT_STAGES, SHIPMENT_STATUSES, shipmentStatusLabel, stageLabel, TRANSPORT_MODES } from "@/lib/importer-shipments";
import { ImportId } from "../dashboard/dashboard-ui";
import { ImporterPageHeader } from "../importer-page-header";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { focusRing } from "../styles";
import { useTrackingViews } from "./tracking-store";
import { ExceptionSummary, ScheduleBadge, SUMIT_TRACKING_MESSAGE, TRACKING_PROMPTS, TrackingNotice } from "./tracking-ui";

const SORTS = [
  { id: "attention", label: "Attention first" },
  { id: "eta", label: "ETA" },
  { id: "updated", label: "Recently updated" },
  { id: "shipment", label: "Shipment ID" },
  { id: "supplier", label: "Supplier" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

interface Filters {
  query: string;
  stage: string;
  status: string;
  schedule: string;
  severity: string;
  supplier: string;
  destination: string;
  mode: string;
  sort: SortId;
  attentionOnly: boolean;
}
const NO_FILTERS: Filters = { query: "", stage: "", status: "", schedule: "", severity: "", supplier: "", destination: "", mode: "", sort: "attention", attentionOnly: false };

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-teal/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

export function TrackingList() {
  const views = useTrackingViews();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const suppliers = [...new Map(views.map((v) => [v.shipment.supplierId, v.supplierName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const destinations = [...new Set(views.map((v) => v.shipment.route.portOfDischarge))].sort();
  const q = filters.query.trim().toLowerCase();

  const visible = views
    .filter((v) => {
      const s = v.shipment;
      const hay = [s.id, s.orderId, v.supplierName, s.cargo.product, s.route.origin, s.route.finalDelivery, s.route.portOfLoading, s.route.portOfDischarge, v.state.booking.carrier ?? "", v.state.booking.reference ?? "", v.customsCase?.id ?? ""];
      if (q && !hay.some((x) => x.toLowerCase().includes(q))) return false;
      if (filters.attentionOnly && v.open.length === 0) return false;
      if (filters.stage && v.state.stage !== filters.stage) return false;
      if (filters.status && v.state.status !== filters.status) return false;
      if (filters.schedule && v.schedule.status !== filters.schedule) return false;
      if (filters.severity === "none" ? v.open.length > 0 : filters.severity && v.highest !== filters.severity) return false;
      if (filters.supplier && s.supplierId !== filters.supplier) return false;
      if (filters.destination && s.route.portOfDischarge !== filters.destination) return false;
      if (filters.mode && s.route.mode !== filters.mode) return false;
      return true;
    })
    .toSorted((a, b) => {
      switch (filters.sort) {
        case "eta":
          return a.schedule.current.eta.localeCompare(b.schedule.current.eta) || a.shipment.id.localeCompare(b.shipment.id);
        case "updated":
          return b.updatedAt.localeCompare(a.updatedAt) || a.shipment.id.localeCompare(b.shipment.id);
        case "shipment":
          return a.shipment.id.localeCompare(b.shipment.id);
        case "supplier":
          return a.supplierName.localeCompare(b.supplierName) || a.shipment.id.localeCompare(b.shipment.id);
        default:
          return compareAttention(a, b);
      }
    });
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const active = views.filter((v) => v.state.status !== "delivered");
  const summary = [
    { label: "Active Shipments", value: active.length },
    { label: "On Schedule", value: active.filter((v) => v.schedule.status === "on-schedule").length },
    { label: "Attention Required", value: views.filter((v) => v.attention).length },
    { label: "Delayed", value: views.filter((v) => v.schedule.status === "delayed").length },
    { label: "At Customs", value: views.filter((v) => v.state.status === "customs").length },
    { label: "Delivered", value: views.filter((v) => v.state.status === "delivered").length },
  ];

  return (
    <div className="space-y-6">
      <ImporterPageHeader title="Tracking" description="Monitor shipment progress, schedule changes and operational exceptions." />
      <TrackingNotice />

      <section aria-label="Tracking summary">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {summary.map((s) => (
            <div key={s.label} className="flex flex-col bg-surface px-4 py-3">
              <dt className="text-xs font-medium text-ink-muted">{s.label}</dt>
              <dd className="order-first text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="tracking-heading" className="rounded-2xl border border-line bg-surface">
        <h2 id="tracking-heading" className="sr-only">Shipments</h2>
        <form role="search" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-3">
            <label htmlFor="tracking-search" className="sr-only">Search shipments</label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              id="tracking-search"
              type="search"
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Search shipment, order, supplier, product, ports, carrier, booking, customs case…"
              className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <button
            type="button"
            aria-pressed={filters.attentionOnly}
            onClick={() => set("attentionOnly", !filters.attentionOnly)}
            className={`h-10 rounded-lg border px-3 text-sm font-semibold transition ${filters.attentionOnly ? "border-orange bg-orange-soft text-orange" : "border-line text-ink hover:border-teal/40 hover:bg-teal-soft"} ${focusRing}`}
          >
            Needs Attention
          </button>
          <Select label="Shipment stage" value={filters.stage} onChange={(v) => set("stage", v)} any="All stages" options={SHIPMENT_STAGES.map((s) => [s.id, s.label])} />
          <Select label="Shipment status" value={filters.status} onChange={(v) => set("status", v)} any="All statuses" options={SHIPMENT_STATUSES.map((s) => [s.id, s.label])} />
          <Select label="Schedule status" value={filters.schedule} onChange={(v) => set("schedule", v)} any="Any schedule" options={(Object.keys(SCHEDULE_STATUS_LABEL) as ScheduleStatus[]).map((s) => [s, SCHEDULE_STATUS_LABEL[s]])} />
          <Select
            label="Exception severity"
            value={filters.severity}
            onChange={(v) => set("severity", v)}
            any="All exceptions"
            options={[...(["critical", "action-required", "watch"] as const).map((s) => [s, EXCEPTION_SEVERITY_LABEL[s]] as const), ["none", "No exceptions"] as const]}
          />
          <Select label="Supplier" value={filters.supplier} onChange={(v) => set("supplier", v)} any="All suppliers" options={suppliers} />
          <Select label="Destination" value={filters.destination} onChange={(v) => set("destination", v)} any="All destinations" options={destinations.map((d) => [d, d])} />
          <Select label="Transport mode" value={filters.mode} onChange={(v) => set("mode", v)} any="All modes" options={TRANSPORT_MODES.map((m) => [m.id, m.label])} />
          <Select label="Sort by" value={filters.sort} onChange={(v) => set("sort", v as SortId)} options={SORTS.map((s) => [s.id, `Sort: ${s.label.toLowerCase()}`])} />
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-ink-muted sm:px-5">
          <p role="status">{visible.length} of {views.length} shipments</p>
          {filters.sort === "attention" && <p className="text-xs text-ink-faint">Attention first: {ATTENTION_SORT_EXPLANATION}</p>}
          {filtered && (
            <button type="button" onClick={() => setFilters(NO_FILTERS)} className={`inline-flex items-center gap-1 rounded-md font-medium text-teal hover:underline ${focusRing}`}>
              <X aria-hidden className="size-3.5" />
              Clear filters
            </button>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="border-t border-line px-6 py-14 text-center text-sm text-ink-muted">
            {views.length === 0 ? "No shipments yet." : "No shipments match your current filters."}
          </p>
        ) : (
          <>
            <Table views={visible} />
            <Cards views={visible} />
          </>
        )}
      </section>

      <SumitAnalysisCard id="sumit-tracking" heading="Ask SUMIT about your shipments" prompts={TRACKING_PROMPTS} message={SUMIT_TRACKING_MESSAGE} />
    </div>
  );
}

function Select({ label, value, onChange, options, any }: { label: string; value: string; onChange: (v: string) => void; options: readonly (readonly [string, string])[]; any?: string }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {any && <option value="">{any}</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

function Table({ views }: { views: TrackingView[] }) {
  const heads = ["Shipment", "Supplier", "Route", "Mode", "Current Stage", "ETD", "ETA", "Schedule", "Exceptions", "Next Action"];
  return (
    <div className="relative hidden overflow-x-auto xl:block">
      <table className="w-full min-w-[70rem] text-left text-sm">
        <thead>
          <tr className="border-y border-line bg-canvas/60 text-xs text-ink-muted">
            {heads.map((h, i) => (
              <th key={h} scope="col" className={`py-2.5 font-medium ${i === 0 ? "pl-5 pr-3" : i === heads.length - 1 ? "pl-3 pr-5" : "px-3"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {views.map((v) => (
            <tr key={v.shipment.id} className="group relative align-top transition-colors hover:bg-teal-soft/50 focus-within:bg-teal-soft/50">
              <th scope="row" className="py-3.5 pl-5 pr-3 font-normal">
                <Link
                  href={importerHref(`tracking/${v.shipment.id}`)}
                  className="whitespace-nowrap font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                >
                  <ImportId id={v.shipment.id} />
                </Link>
                <span className="block text-xs text-ink-faint">{v.shipment.cargo.product}</span>
              </th>
              <td className="px-3 py-3.5 text-ink">{v.supplierName}</td>
              <td className="px-3 py-3.5 text-ink-muted">{v.shipment.route.portOfLoading} → {v.shipment.route.portOfDischarge}</td>
              <td className="px-3 py-3.5 text-ink-muted">{modeLabel(v.shipment.route.mode)}</td>
              <td className="px-3 py-3.5 text-ink">{shipmentStatusLabel(v.state.status)}</td>
              <td className="whitespace-nowrap px-3 py-3.5 text-ink-muted">{formatDate(v.schedule.current.etd)}</td>
              <td className="whitespace-nowrap px-3 py-3.5 text-ink-muted">{formatDate(v.schedule.current.eta)}</td>
              <td className="px-3 py-3.5"><ScheduleBadge status={v.schedule.status} /></td>
              <td className="px-3 py-3.5"><ExceptionSummary view={v} /></td>
              <td className="py-3.5 pl-3 pr-5 text-ink">{v.nextAction.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cards({ views }: { views: TrackingView[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-2 sm:p-5 xl:hidden">
      {views.map((v) => (
        <li key={v.shipment.id}>
          <Link href={importerHref(`tracking/${v.shipment.id}`)} className={`block h-full rounded-xl border border-line p-4 transition hover:border-teal/40 hover:bg-teal-soft/40 ${focusRing}`}>
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <ImportId id={v.shipment.id} className="block text-ink-muted" />
                <span className="mt-0.5 block break-words font-semibold text-ink">{v.shipment.cargo.product}</span>
                <span className="block break-words text-sm text-ink-muted">{v.supplierName}</span>
              </span>
              <ScheduleBadge status={v.schedule.status} />
            </span>
            <span className="mt-2 block break-words text-sm text-ink-muted">
              {v.shipment.route.portOfLoading} → {v.shipment.route.portOfDischarge} · {modeLabel(v.shipment.route.mode)} · {stageLabel(v.state.stage)}
            </span>
            <span className="mt-1 block text-sm text-ink-muted">ETD {formatDate(v.schedule.current.etd)} · ETA {formatDate(v.schedule.current.eta)}</span>
            <span className="mt-2 block"><ExceptionSummary view={v} /></span>
            <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-sm text-ink">
              <span className="min-w-0 break-words">Next: {v.nextAction.label}</span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-muted" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
