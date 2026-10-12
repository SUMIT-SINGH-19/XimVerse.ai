"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { formatQuantity, INCOTERMS } from "@/lib/import-requirements";
import { importerHref } from "@/lib/importer-nav";
import { COST_STATUS_LABEL, formatMoney, type CostStatus } from "@/lib/importer-landed-cost";
import { findSupplier } from "@/lib/importer-suppliers";
import { ImportId } from "../dashboard/dashboard-ui";
import { ImporterPageHeader } from "../importer-page-header";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { focusRing } from "../styles";
import { useLandedCostSheets, type LandedCostSheet } from "./landed-cost-store";
import { CostStatusBadge, LANDED_COST_PROMPTS, LandedCostNotice, SUMIT_COST_MESSAGE } from "./landed-cost-ui";

const SORTS = [
  { id: "updated", label: "Recently updated" },
  { id: "date", label: "Order date" },
  { id: "supplier", label: "Supplier" },
  { id: "value", label: "Commercial value (within currency)" },
  { id: "landed", label: "Landed cost (within currency)" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

interface Filters {
  query: string;
  status: string;
  supplier: string;
  currency: string;
  incoterm: string;
  shipment: string;
  duties: string;
  sort: SortId;
}
const NO_FILTERS: Filters = { query: "", status: "", supplier: "", currency: "", incoterm: "", shipment: "", duties: "", sort: "updated" };

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-teal/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

const supplierName = (s: LandedCostSheet) => findSupplier(s.order.supplierId)?.name ?? s.order.supplierId;
const commercialValue = (s: LandedCostSheet) => s.result.commercial.amount ?? 0;
const dutiesEntered = (s: LandedCostSheet) => Object.keys(s.stored.duties).length > 0 || s.stored.otherDuties.length > 0;
/** No estimate until some planning input exists (the total would be the order value alone). */
const estimate = (s: LandedCostSheet) => (s.result.status === "needs-input" ? undefined : s.result.total);
const hsCode = (s: LandedCostSheet) => s.customsCase?.override.hsCode ?? s.shipment?.hsCode ?? s.order.terms.hsCode ?? "";

export function LandedCostList() {
  const sheets = useLandedCostSheets();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const suppliers = [...new Map(sheets.map((s) => [s.order.supplierId, supplierName(s)])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const currencies = [...new Set(sheets.map((s) => s.order.terms.currency))].sort();
  const q = filters.query.trim().toLowerCase();

  const visible = sheets
    .filter((s) => {
      const hay = [s.order.id, s.order.purchaseOrder.number, supplierName(s), s.order.terms.productName, s.shipment?.id ?? "", hsCode(s)];
      if (q && !hay.some((x) => x.toLowerCase().includes(q))) return false;
      if (filters.status && s.result.status !== filters.status) return false;
      if (filters.supplier && s.order.supplierId !== filters.supplier) return false;
      if (filters.currency && s.order.terms.currency !== filters.currency) return false;
      if (filters.incoterm && s.order.terms.incoterm !== filters.incoterm) return false;
      if (filters.shipment && (filters.shipment === "yes") !== !!s.shipment) return false;
      if (filters.duties && (filters.duties === "yes") !== dutiesEntered(s)) return false;
      return true;
    })
    .toSorted((a, b) => {
      switch (filters.sort) {
        case "date":
          return b.order.createdAt.localeCompare(a.order.createdAt);
        case "supplier":
          return supplierName(a).localeCompare(supplierName(b)) || a.order.id.localeCompare(b.order.id);
        // Money is only compared within one currency: group by currency first.
        case "value":
          return a.order.terms.currency.localeCompare(b.order.terms.currency) || commercialValue(b) - commercialValue(a);
        case "landed":
          return a.result.currency.localeCompare(b.result.currency) || (estimate(b) ?? -1) - (estimate(a) ?? -1) || a.order.id.localeCompare(b.order.id);
        default:
          return b.updatedAt.localeCompare(a.updatedAt) || a.order.id.localeCompare(b.order.id);
      }
    });
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  // Import value per currency — never summed across currencies.
  const byCurrency = new Map<string, number>();
  for (const s of sheets) byCurrency.set(s.order.terms.currency, (byCurrency.get(s.order.terms.currency) ?? 0) + commercialValue(s));
  const summary = [
    { label: "Cost Sheets", value: String(sheets.length) },
    { label: "Complete Estimates", value: String(sheets.filter((s) => s.result.status === "complete").length) },
    { label: "Needs Input", value: String(sheets.filter((s) => s.result.status === "needs-input").length) },
    { label: "With Duties Entered", value: String(sheets.filter(dutiesEntered).length) },
  ];

  return (
    <div className="space-y-6">
      <ImporterPageHeader title="Landed Cost" description="Estimate and compare the total cost of your import orders." />
      <LandedCostNotice />

      <section aria-label="Landed cost summary">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
          {summary.map((s) => (
            <div key={s.label} className="flex flex-col bg-surface px-4 py-3">
              <dt className="text-xs font-medium text-ink-muted">{s.label}</dt>
              <dd className="order-first text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-faint" id="import-value-by-currency">
          Total import value (agreed order value, by currency):{" "}
          {[...byCurrency.entries()].map(([c, v]) => formatMoney(v, c as LandedCostSheet["order"]["terms"]["currency"])).join(" · ")}
        </p>
      </section>

      <section aria-labelledby="lc-heading" className="rounded-2xl border border-line bg-surface">
        <h2 id="lc-heading" className="sr-only">Cost sheets</h2>
        <form role="search" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-4">
            <label htmlFor="lc-search" className="sr-only">Search cost sheets</label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              id="lc-search"
              type="search"
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Search order, PO, supplier, product, shipment, HS code…"
              className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <Select label="Cost status" value={filters.status} onChange={(v) => set("status", v)} any="All cost statuses" options={(Object.keys(COST_STATUS_LABEL) as CostStatus[]).map((s) => [s, COST_STATUS_LABEL[s]])} />
          <Select label="Supplier" value={filters.supplier} onChange={(v) => set("supplier", v)} any="All suppliers" options={suppliers} />
          <Select label="Currency" value={filters.currency} onChange={(v) => set("currency", v)} any="All currencies" options={currencies.map((c) => [c, c])} />
          <Select label="Incoterm" value={filters.incoterm} onChange={(v) => set("incoterm", v)} any="All Incoterms" options={INCOTERMS.map((i) => [i, i])} />
          <Select label="Shipment available" value={filters.shipment} onChange={(v) => set("shipment", v)} any="With or without shipment" options={[["yes", "Shipment created"], ["no", "No shipment yet"]]} />
          <Select label="Duties entered" value={filters.duties} onChange={(v) => set("duties", v)} any="Duties entered or not" options={[["yes", "Duties entered"], ["no", "Duties not entered"]]} />
          <Select label="Sort by" value={filters.sort} onChange={(v) => set("sort", v as SortId)} options={SORTS.map((s) => [s.id, `Sort: ${s.label.toLowerCase()}`])} />
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-ink-muted sm:px-5">
          <p role="status">{visible.length} of {sheets.length} cost sheets</p>
          {(filters.sort === "value" || filters.sort === "landed") && <p className="text-xs text-ink-faint">Grouped by currency; values are only compared within the same currency.</p>}
          {filtered && (
            <button type="button" onClick={() => setFilters(NO_FILTERS)} className={`inline-flex items-center gap-1 rounded-md font-medium text-teal hover:underline ${focusRing}`}>
              <X aria-hidden className="size-3.5" />
              Clear filters
            </button>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="border-t border-line px-6 py-14 text-center text-sm text-ink-muted">{sheets.length === 0 ? "No orders yet." : "No cost sheets match your current filters."}</p>
        ) : (
          <>
            <Table sheets={visible} />
            <Cards sheets={visible} />
          </>
        )}
      </section>

      <SumitAnalysisCard id="sumit-landed-cost" heading="Ask SUMIT about landed cost" prompts={LANDED_COST_PROMPTS} message={SUMIT_COST_MESSAGE} />
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

const landed = (s: LandedCostSheet) => (estimate(s) !== undefined ? formatMoney(estimate(s)!, s.result.currency) : "Not calculated");
const perUnit = (s: LandedCostSheet) => (s.result.perUnit && s.result.status !== "needs-input" ? `${formatMoney(s.result.perUnit.value, s.result.currency)} / ${s.order.terms.quantity.unit}` : "—");

function Table({ sheets }: { sheets: LandedCostSheet[] }) {
  const heads = ["Order", "Supplier", "Product", "Commercial Value", "Incoterm", "Shipment", "Cost Status", "Estimated Landed Cost", "Per Unit", "Updated"];
  return (
    <div className="relative hidden overflow-x-auto xl:block">
      <table className="w-full min-w-[66rem] text-left text-sm">
        <thead>
          <tr className="border-y border-line bg-canvas/60 text-xs text-ink-muted">
            {heads.map((h, i) => (
              <th key={h} scope="col" className={`py-2.5 font-medium ${i === 0 ? "pl-5 pr-3" : i === heads.length - 1 ? "pl-3 pr-5" : "px-3"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sheets.map((s) => (
            <tr key={s.order.id} className="group relative align-top transition-colors hover:bg-teal-soft/50 focus-within:bg-teal-soft/50">
              <th scope="row" className="py-3.5 pl-5 pr-3 font-normal">
                <Link
                  href={importerHref(`landed-cost/${s.order.id}`)}
                  className="whitespace-nowrap font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                >
                  <ImportId id={s.order.id} />
                </Link>
                <span className="block text-xs text-ink-faint">{s.order.purchaseOrder.number}</span>
              </th>
              <td className="px-3 py-3.5 text-ink">{supplierName(s)}</td>
              <td className="px-3 py-3.5 text-ink">{s.order.terms.productName}<span className="block text-xs text-ink-faint">{formatQuantity(s.order.terms.quantity)}</span></td>
              <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-ink">{formatMoney(commercialValue(s), s.order.terms.currency)}</td>
              <td className="px-3 py-3.5 text-ink-muted">{s.order.terms.incoterm}</td>
              <td className="whitespace-nowrap px-3 py-3.5 text-ink-muted">{s.shipment ? <ImportId id={s.shipment.id} /> : "Not created"}</td>
              <td className="px-3 py-3.5"><CostStatusBadge status={s.result.status} /></td>
              <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-ink">{landed(s)}</td>
              <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-ink-muted">{perUnit(s)}</td>
              <td className="whitespace-nowrap py-3.5 pl-3 pr-5 text-ink-muted">{formatDate(s.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cards({ sheets }: { sheets: LandedCostSheet[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-2 sm:p-5 xl:hidden">
      {sheets.map((s) => (
        <li key={s.order.id}>
          <Link href={importerHref(`landed-cost/${s.order.id}`)} className={`block h-full rounded-xl border border-line p-4 transition hover:border-teal/40 hover:bg-teal-soft/40 ${focusRing}`}>
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <ImportId id={s.order.id} className="block text-ink-muted" />
                <span className="mt-0.5 block break-words font-semibold text-ink">{s.order.terms.productName}</span>
                <span className="block break-words text-sm text-ink-muted">{supplierName(s)}</span>
              </span>
              <CostStatusBadge status={s.result.status} />
            </span>
            <span className="mt-2 block text-sm text-ink-muted">
              {formatMoney(commercialValue(s), s.order.terms.currency)} · {s.order.terms.incoterm} · {s.shipment ? s.shipment.id : "No shipment yet"}
            </span>
            <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-sm text-ink">
              <span className="min-w-0 break-words">Landed: {landed(s)} · {perUnit(s)}</span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-muted" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
