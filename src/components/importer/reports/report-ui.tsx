"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { PRODUCT_CATEGORIES, CURRENCIES } from "@/lib/import-requirements";
import { ORDER_STATUSES } from "@/lib/importer-orders";
import { csvFilename, DATE_PRESET_LABEL, toCsv, type DatePreset, type ReportData, type ReportFilters } from "@/lib/importer-reports";
import { SHIPMENT_STAGES } from "@/lib/importer-shipments";
import { findSupplier } from "@/lib/importer-suppliers";
import { focusRing } from "../styles";

export const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-teal/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

export type FilterField = "date" | "supplierId" | "product" | "category" | "country" | "requirementId" | "orderStatus" | "shipmentStage" | "currency";

/** Only the filters shown for the current view apply. */
export function effectiveFilters(f: ReportFilters, fields: readonly FilterField[]): ReportFilters {
  const out: ReportFilters = { date: fields.includes("date") ? f.date : "all" };
  if (fields.includes("date")) {
    out.from = f.from;
    out.to = f.to;
  }
  for (const k of fields) if (k !== "date") (out as unknown as Record<string, unknown>)[k] = (f as unknown as Record<string, unknown>)[k];
  return out;
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

/** The one shared filter bar; `fields` picks what is relevant to the view. */
export function ReportFilterBar({ data, filters, onChange, fields }: { data: ReportData; filters: ReportFilters; onChange: (f: ReportFilters) => void; fields: readonly FilterField[] }) {
  const set = <K extends keyof ReportFilters>(k: K, v: ReportFilters[K]) => onChange({ ...filters, [k]: v });
  const supplierIds = [...new Set([...data.quotations.map((q) => q.supplierId), ...data.orders.map((o) => o.supplierId)])];
  const suppliers = supplierIds.map((id) => [id, findSupplier(id)?.name ?? id] as const).sort((a, b) => a[1].localeCompare(b[1]));
  const products = [...new Set([...data.requirements.map((r) => r.product.name), ...data.orders.map((o) => o.terms.productName)])].sort();
  const countries = [...new Set(supplierIds.map((id) => findSupplier(id)?.country ?? ""))].filter(Boolean).sort();
  const show = (f: FilterField) => fields.includes(f);
  return (
    <form role="search" aria-label="Report filters" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
      {show("date") && <Select label="Date range" value={filters.date} onChange={(v) => set("date", v as DatePreset)} options={(Object.keys(DATE_PRESET_LABEL) as DatePreset[]).map((k) => [k, `Dates: ${DATE_PRESET_LABEL[k]}`])} />}
      {show("date") && filters.date === "custom" && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">From</span>
            <input id="report-from" type="date" value={filters.from ?? ""} onChange={(e) => set("from", e.target.value)} className={selectClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">To</span>
            <input id="report-to" type="date" value={filters.to ?? ""} onChange={(e) => set("to", e.target.value)} className={selectClass} />
          </label>
        </>
      )}
      {show("supplierId") && <Select label="Supplier" value={filters.supplierId ?? ""} onChange={(v) => set("supplierId", v)} any="All suppliers" options={suppliers} />}
      {show("product") && <Select label="Product" value={filters.product ?? ""} onChange={(v) => set("product", v)} any="All products" options={products.map((p) => [p, p])} />}
      {show("category") && <Select label="Product category" value={filters.category ?? ""} onChange={(v) => set("category", v as ReportFilters["category"])} any="All categories" options={PRODUCT_CATEGORIES.map((c) => [c, c])} />}
      {show("country") && <Select label="Supplier country" value={filters.country ?? ""} onChange={(v) => set("country", v)} any="All countries" options={countries.map((c) => [c, c])} />}
      {show("requirementId") && <Select label="Requirement" value={filters.requirementId ?? ""} onChange={(v) => set("requirementId", v)} any="All requirements" options={data.requirements.map((r) => [r.id, `${r.id} · ${r.product.name}`])} />}
      {show("orderStatus") && <Select label="Order status" value={filters.orderStatus ?? ""} onChange={(v) => set("orderStatus", v as ReportFilters["orderStatus"])} any="All order statuses" options={ORDER_STATUSES.map((s) => [s.id, s.label])} />}
      {show("shipmentStage") && <Select label="Shipment stage" value={filters.shipmentStage ?? ""} onChange={(v) => set("shipmentStage", v as ReportFilters["shipmentStage"])} any="All shipment stages" options={SHIPMENT_STAGES.map((s) => [s.id, s.label])} />}
      {show("currency") && <Select label="Currency" value={filters.currency ?? ""} onChange={(v) => set("currency", v as ReportFilters["currency"])} any="All currencies" options={CURRENCIES.map((c) => [c, c])} />}
    </form>
  );
}

/** A compact metric; links to the workspace that owns the number when useful. */
export function Metric({ label, value, href, hint, id }: { label: string; value: React.ReactNode; href?: string; hint?: string; id?: string }) {
  const body = (
    <>
      <span className="block text-lg font-semibold tabular-nums text-ink">{value}</span>
      <span className="block text-xs font-medium text-ink-muted">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-ink-faint">{hint}</span>}
    </>
  );
  return (
    <div className="bg-surface" data-metric={id ?? label}>
      {href ? (
        <Link href={href} className={`block h-full px-4 py-3 transition hover:bg-teal-soft/50 ${focusRing}`}>{body}</Link>
      ) : (
        <div className="h-full px-4 py-3">{body}</div>
      )}
    </div>
  );
}

export function MetricGrid({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
      {children}
    </div>
  );
}

/** Horizontal bars with the value always written out (never colour-only). */
export function Bars({ items, label }: { items: { key: string; label: string; value: number; display?: string; href?: string }[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul aria-label={label} className="space-y-2" data-bars={label}>
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
          <span className="min-w-0 truncate text-ink-muted" title={i.label}>
            {i.href ? <Link href={i.href} className={`rounded hover:text-teal hover:underline ${focusRing}`}>{i.label}</Link> : i.label}
          </span>
          <span aria-hidden className="h-2.5 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full bg-teal" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-ink">{i.display ?? i.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Client-side CSV of exactly the rows on screen. */
export function ExportCsv({ report, headers, rows }: { report: string; headers: string[]; rows: (string | number | undefined)[][] }) {
  return (
    <button
      type="button"
      data-export={report}
      onClick={() => {
        const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = csvFilename(report);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink transition hover:border-teal/40 hover:bg-teal-soft ${focusRing}`}
    >
      <Download aria-hidden className="size-4" />
      Export CSV
    </button>
  );
}

export function Table({ headers, rows, caption, minWidth = "40rem" }: { headers: string[]; rows: React.ReactNode[][]; caption: string; minWidth?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-canvas/60 text-xs text-ink-muted">
            {headers.map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-3 py-6 text-center text-ink-muted">No records in the selected data.</td></tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="align-top">
                {r.map((c, j) => (j === 0 ? <th key={j} scope="row" className="px-3 py-2 font-normal text-ink">{c}</th> : <td key={j} className="px-3 py-2 text-ink">{c}</td>))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
