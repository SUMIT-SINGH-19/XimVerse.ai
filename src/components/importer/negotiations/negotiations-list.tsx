"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import {
  currentOffer,
  formatOfferIncoterm,
  formatOfferPrice,
  lastEvent,
  NEGOTIATION_STATUSES,
  negotiationStatus,
  originalOffer,
  PARTY_LABEL,
  updatedAt,
  WAITING_ON_LABEL,
  waitingOn,
  type Negotiation,
  type NegotiationStatus,
  type WaitingOn,
} from "@/lib/importer-negotiations";
import { requirementOf } from "@/lib/importer-quotations";
import { findSupplier } from "@/lib/importer-suppliers";
import { ImportId } from "../dashboard/dashboard-ui";
import { ImporterPageHeader } from "../importer-page-header";
import { focusRing } from "../styles";
import { NegotiationStatusBadge } from "./negotiation-ui";
import { useNegotiations } from "./negotiation-store";
import { quotationOf } from "@/lib/importer-negotiations";

const SORTS = [
  { id: "recent", label: "Recently updated" },
  { id: "oldest", label: "Oldest updated" },
  { id: "supplier", label: "Supplier" },
  { id: "requirement", label: "Requirement" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

interface Filters {
  query: string;
  status: NegotiationStatus | "";
  requirement: string;
  supplier: string;
  waiting: WaitingOn | "";
  sort: SortId;
}
const NO_FILTERS: Filters = { query: "", status: "", requirement: "", supplier: "", waiting: "", sort: "recent" };

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-teal/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

interface Row {
  n: Negotiation;
  status: NegotiationStatus;
  product: string;
  supplier: string;
  updated: string;
}

export function NegotiationsList({ initialRequirement = "" }: { initialRequirement?: string }) {
  const negotiations = useNegotiations();
  const rows: Row[] = negotiations.map((n) => ({
    n,
    status: negotiationStatus(n),
    product: requirementOf(quotationOf(n))?.product.name ?? "",
    supplier: findSupplier(n.supplierId)?.name ?? n.supplierId,
    updated: updatedAt(n),
  }));
  const requirementIds = [...new Set(rows.map((r) => r.n.requirementId))].sort();
  const suppliers = [...new Map(rows.map((r) => [r.n.supplierId, r.supplier])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const [filters, setFilters] = useState<Filters>({
    ...NO_FILTERS,
    requirement: requirementIds.includes(initialRequirement) ? initialRequirement : "",
  });
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const q = filters.query.trim().toLowerCase();
  const visible = rows
    .filter((r) => {
      if (q && ![r.n.id, r.n.requirementId, r.n.quotationId, r.product, r.supplier].some((v) => v.toLowerCase().includes(q))) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (filters.requirement && r.n.requirementId !== filters.requirement) return false;
      if (filters.supplier && r.n.supplierId !== filters.supplier) return false;
      if (filters.waiting && waitingOn(r.status) !== filters.waiting) return false;
      return true;
    })
    .toSorted((a, b) => {
      if (filters.sort === "oldest") return a.updated.localeCompare(b.updated);
      if (filters.sort === "supplier") return a.supplier.localeCompare(b.supplier) || b.updated.localeCompare(a.updated);
      if (filters.sort === "requirement") return a.n.requirementId.localeCompare(b.n.requirementId) || b.updated.localeCompare(a.updated);
      return b.updated.localeCompare(a.updated);
    });
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const count = (w: WaitingOn) => rows.filter((r) => waitingOn(r.status) === w).length;
  const summary = [
    { label: "Active", value: count("you") + count("supplier") },
    { label: "Awaiting Supplier", value: count("supplier") },
    { label: "Awaiting Your Response", value: count("you") },
    { label: "Agreed", value: count("agreed") },
    { label: "Closed", value: count("closed") },
  ];

  return (
    <div className="space-y-6">
      <ImporterPageHeader title="Negotiations" description="Manage commercial discussions with shortlisted suppliers." />

      <section aria-label="Negotiation summary">
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-5">
          {summary.map((s, i) => (
            <div key={s.label} className={`flex flex-col border-line px-4 py-3 ${i > 0 ? "sm:border-l" : ""} ${i % 2 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""}`}>
              <dt className="text-xs font-medium text-ink-muted">{s.label}</dt>
              <dd className="order-first text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="negotiations-heading" className="rounded-2xl border border-line bg-surface">
        <h2 id="negotiations-heading" className="sr-only">Negotiations</h2>
        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]"
        >
          <div className="relative sm:col-span-2 xl:col-span-1">
            <label htmlFor="ng-search" className="sr-only">Search negotiations</label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              id="ng-search"
              type="search"
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Search..."
              className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <Select label="Status" value={filters.status} onChange={(v) => set("status", v as Filters["status"])} any="All statuses" options={NEGOTIATION_STATUSES.map((s) => [s.id, s.label])} />
          <Select label="Requirement" value={filters.requirement} onChange={(v) => set("requirement", v)} any="All requirements" options={requirementIds.map((id) => [id, id])} />
          <Select label="Supplier" value={filters.supplier} onChange={(v) => set("supplier", v)} any="All suppliers" options={suppliers} />
          <Select label="Waiting on" value={filters.waiting} onChange={(v) => set("waiting", v as Filters["waiting"])} any="Waiting on anyone" options={(Object.keys(WAITING_ON_LABEL) as WaitingOn[]).map((w) => [w, WAITING_ON_LABEL[w]])} />
          <Select label="Sort by" value={filters.sort} onChange={(v) => set("sort", v as SortId)} options={SORTS.map((s) => [s.id, `Sort: ${s.label.toLowerCase()}`])} />
        </form>

        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-ink-muted sm:px-5">
          <p role="status">{visible.length} of {rows.length} negotiations</p>
          {filtered && (
            <button type="button" onClick={() => setFilters(NO_FILTERS)} className={`inline-flex items-center gap-1 rounded-md font-medium text-teal hover:underline ${focusRing}`}>
              <X aria-hidden className="size-3.5" />
              Clear filters
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <p className="border-t border-line px-6 py-14 text-center text-sm text-ink-muted">No negotiations match these filters.</p>
        ) : (
          <>
            <Table rows={visible} />
            <Cards rows={visible} />
          </>
        )}
      </section>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  any,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly (readonly [string, string])[];
  any?: string;
}) {
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

function Table({ rows }: { rows: Row[] }) {
  const heads = ["Negotiation", "Requirement", "Supplier", "Original", "Current offer", "Incoterm", "Last action", "Status", "Updated"];
  return (
    <div className="relative hidden overflow-x-auto xl:block">
      <table className="w-full min-w-[60rem] text-left text-sm">
        <thead>
          <tr className="border-y border-line bg-canvas/60 text-xs text-ink-muted">
            {heads.map((h, i) => (
              <th key={h} scope="col" className={`py-2.5 font-medium ${i === 0 ? "pl-5 pr-3" : i === heads.length - 1 ? "pl-3 pr-5" : "px-3"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(({ n, status, product, supplier, updated }) => {
            const current = currentOffer(n);
            const original = originalOffer(n);
            return (
              <tr key={n.id} className="group relative transition-colors hover:bg-teal-soft/50 focus-within:bg-teal-soft/50">
                <th scope="row" className="whitespace-nowrap py-3.5 pl-5 pr-3 font-normal">
                  <Link
                    href={importerHref(`negotiations/${n.id}`)}
                    className="font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                  >
                    <ImportId id={n.id} />
                  </Link>
                </th>
                <td className="px-3 py-3.5">
                  <ImportId id={n.requirementId} className="block whitespace-nowrap text-ink-muted" />
                  <span className="block text-xs text-ink-faint">{product}</span>
                </td>
                <td className="px-3 py-3.5 font-medium text-ink">{supplier}</td>
                <td className="px-3 py-3.5">
                  <span className="block whitespace-nowrap text-ink-muted">{formatOfferPrice(original)}</span>
                  <ImportId id={n.quotationId} className="block whitespace-nowrap text-xs text-ink-faint" />
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 font-semibold tabular-nums text-ink">{formatOfferPrice(current)}</td>
                <td className="px-3 py-3.5 text-ink-muted">{formatOfferIncoterm(current)}</td>
                <td className="px-3 py-3.5 text-ink-muted">{PARTY_LABEL[lastEvent(n).by]}</td>
                <td className="px-3 py-3.5"><NegotiationStatusBadge status={status} /></td>
                <td className="whitespace-nowrap py-3.5 pl-3 pr-5 text-ink-muted">{formatDate(updated)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cards({ rows }: { rows: Row[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-2 sm:p-5 xl:hidden">
      {rows.map(({ n, status, product, supplier, updated }) => {
        const current = currentOffer(n);
        return (
          <li key={n.id}>
            <Link
              href={importerHref(`negotiations/${n.id}`)}
              className={`block h-full rounded-xl border border-line p-4 transition hover:border-teal/40 hover:bg-teal-soft/40 ${focusRing}`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <ImportId id={n.id} className="block text-ink-muted" />
                  <span className="mt-0.5 block break-words font-semibold text-ink">{supplier}</span>
                </span>
                <NegotiationStatusBadge status={status} />
              </span>
              <span className="mt-1 block text-xs text-ink-faint">
                {n.requirementId} · {product} · from {n.quotationId}
              </span>
              <span className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span>
                  <span className="block text-xs text-ink-faint">Original</span>
                  <span className="block text-ink-muted">{formatOfferPrice(originalOffer(n))}</span>
                </span>
                <span>
                  <span className="block text-xs text-ink-faint">Current offer</span>
                  <span className="block font-semibold text-ink">{formatOfferPrice(current)}</span>
                </span>
                <span className="col-span-2">
                  <span className="block text-xs text-ink-faint">Incoterm</span>
                  <span className="block text-ink">{formatOfferIncoterm(current)}</span>
                </span>
              </span>
              <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-faint">
                Last action: {PARTY_LABEL[lastEvent(n).by]} · {formatDate(updated)}
                <ArrowRight aria-hidden className="size-4" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
