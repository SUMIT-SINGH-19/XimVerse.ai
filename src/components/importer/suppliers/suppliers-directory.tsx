"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Info, Search, SlidersHorizontal, X } from "lucide-react";
import { formatDayMonth } from "@/lib/format";
import { formatQuantity } from "@/lib/import-requirements";
import { importerHref } from "@/lib/importer-nav";
import { quotationsFromSupplier } from "@/lib/importer-quotations";
import {
  ALL_CERTIFICATIONS,
  ALL_REGIONS,
  ALL_SUPPLIER_CATEGORIES,
  ALL_SUPPLIER_COUNTRIES,
  leadTimeRange,
  PROFILE_STATUS_LABEL,
  relevanceScore,
  requirementMatches,
  SUPPLIER_TYPE_LABEL,
  SUPPLIER_TYPES,
  SUPPLIERS,
  yearsInBusiness,
  type ProfileStatus,
  type RequirementMatch,
  type Supplier,
} from "@/lib/importer-suppliers";
import { ImporterPageHeader } from "../importer-page-header";
import { useImportRequirements } from "../rfq/requirements-store";
import { focusRing, primaryButton } from "../styles";
import { supplierQuotationsHref } from "./supplier-links";

const SORTS = [
  { id: "relevance", label: "Relevance to requirements" },
  { id: "name", label: "Supplier name" },
  { id: "experience", label: "Export experience" },
  { id: "recent", label: "Recently quoted" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

interface Filters {
  query: string;
  category: string;
  country: string;
  type: string;
  certification: string;
  region: string;
  verification: ProfileStatus | "";
  quoted: "" | "yes" | "no";
  experience: string;
}

const NO_FILTERS: Filters = {
  query: "",
  category: "",
  country: "",
  type: "",
  certification: "",
  region: "",
  verification: "",
  quoted: "",
  experience: "",
};

interface Row {
  supplier: Supplier;
  matches: RequirementMatch[];
  quoteCount: number;
  latestQuote?: string;
  score: number;
}

function searchText(s: Supplier): string {
  return [
    s.name,
    s.legalName,
    s.country,
    s.city,
    SUPPLIER_TYPE_LABEL[s.type],
    ...s.categories,
    ...s.products.map((p) => p.name),
    ...s.markets.regions,
    ...s.markets.countries,
    ...s.certifications.map((c) => c.name),
  ]
    .join(" · ")
    .toLowerCase();
}

function matchesFilters({ supplier: s, quoteCount }: Row, f: Filters): boolean {
  const terms = f.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length && !terms.every((t) => searchText(s).includes(t))) return false;
  if (f.category && !s.categories.includes(f.category as Supplier["categories"][number])) return false;
  if (f.country && s.country !== f.country) return false;
  if (f.type && s.type !== f.type) return false;
  if (f.certification && !s.certifications.some((c) => c.name === f.certification)) return false;
  if (f.region && !s.markets.regions.includes(f.region as Supplier["markets"]["regions"][number])) return false;
  if (f.verification && s.profileStatus !== f.verification) return false;
  if (f.quoted === "yes" && quoteCount === 0) return false;
  if (f.quoted === "no" && quoteCount > 0) return false;
  if (f.experience && s.yearsExporting < Number(f.experience)) return false;
  return true;
}

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-teal/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

export function SuppliersDirectory() {
  const { requirements } = useImportRequirements();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortId>("relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const rows: Row[] = SUPPLIERS.map((supplier) => {
    const quotes = quotationsFromSupplier(supplier.id);
    const matches = requirementMatches(supplier, requirements);
    return {
      supplier,
      matches,
      quoteCount: quotes.length,
      latestQuote: quotes[0]?.receivedAt,
      score: relevanceScore(matches, quotes.length > 0),
    };
  });

  const visible = rows
    .filter((r) => matchesFilters(r, filters))
    .toSorted((a, b) => {
      const byName = a.supplier.name.localeCompare(b.supplier.name);
      if (sort === "relevance") return b.score - a.score || byName;
      if (sort === "experience") return b.supplier.yearsExporting - a.supplier.yearsExporting || byName;
      if (sort === "recent") return (b.latestQuote ?? "").localeCompare(a.latestQuote ?? "") || byName;
      return byName;
    });

  const activeCount = (Object.keys(NO_FILTERS) as (keyof Filters)[]).filter(
    (k) => k !== "query" && filters[k] !== NO_FILTERS[k],
  ).length;
  const anyFilter = activeCount > 0 || filters.query.trim() !== "";
  const clear = () => setFilters(NO_FILTERS);

  const summary = [
    { label: "Suppliers", value: SUPPLIERS.length },
    { label: "Countries", value: ALL_SUPPLIER_COUNTRIES.length },
    { label: "Product Categories", value: ALL_SUPPLIER_CATEGORIES.length },
    { label: "Previously Quoted", value: rows.filter((r) => r.quoteCount > 0).length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <ImporterPageHeader title="Suppliers" description="Discover and evaluate suppliers for your import requirements." />
        <button
          type="button"
          onClick={() => {
            searchRef.current?.focus();
            searchRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
          }}
          className={`${primaryButton} self-start sm:self-auto`}
        >
          <Search aria-hidden className="size-4" />
          Find suppliers
        </button>
      </div>

      <section aria-label="Supplier network summary">
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-4">
          {summary.map((s, i) => (
            <div
              key={s.label}
              className={`flex flex-col px-4 py-3 ${i % 2 ? "border-l border-line" : ""} ${
                i >= 2 ? "border-t border-line sm:border-t-0" : ""
              } ${i === 2 ? "sm:border-l" : ""}`}
            >
              <dt className="text-xs font-medium text-ink-muted">{s.label}</dt>
              <dd className="order-first text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row" role="search">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="supplier-search" className="sr-only">
            Search suppliers, products or countries
          </label>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-faint" />
          <input
            ref={searchRef}
            id="supplier-search"
            type="search"
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Search suppliers, products or countries..."
            className="h-12 w-full scroll-mt-28 rounded-xl border border-line bg-surface pl-12 pr-4 text-base text-ink shadow-sm placeholder:text-ink-faint focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
        </div>
        <div className="flex gap-3">
          <label className="block min-w-0 flex-1 sm:w-72 sm:flex-none">
            <span className="sr-only">Sort suppliers</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortId)} className={`${selectClass} h-12 rounded-xl`}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>Sort: {s.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            aria-controls="supplier-filters"
            className={`inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink hover:border-teal/40 lg:hidden ${focusRing}`}
          >
            <SlidersHorizontal aria-hidden className="size-4" />
            Filters{activeCount > 0 && <span className="rounded-full bg-teal px-1.5 text-xs text-on-brand">{activeCount}</span>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside
          id="supplier-filters"
          aria-label="Supplier filters"
          className={`${filtersOpen ? "block" : "hidden"} self-start rounded-2xl border border-line bg-surface p-4 lg:sticky lg:top-24 lg:block`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Filters</h2>
            {activeCount > 0 && (
              <button type="button" onClick={clear} className={`rounded text-xs font-medium text-teal hover:underline ${focusRing}`}>
                Reset
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Filter label="Product category" value={filters.category} onChange={(v) => set("category", v)} options={ALL_SUPPLIER_CATEGORIES} any="All categories" />
            <Filter label="Country" value={filters.country} onChange={(v) => set("country", v)} options={ALL_SUPPLIER_COUNTRIES} any="All countries" />
            <Filter
              label="Supplier type"
              value={filters.type}
              onChange={(v) => set("type", v)}
              options={SUPPLIER_TYPES.map((t) => ({ value: t.id, label: t.label }))}
              any="All types"
            />
            <Filter label="Certification" value={filters.certification} onChange={(v) => set("certification", v)} options={ALL_CERTIFICATIONS} any="Any certification" />
            <Filter label="Export market" value={filters.region} onChange={(v) => set("region", v)} options={ALL_REGIONS} any="Any region" />
            <Filter
              label="Profile status"
              value={filters.verification}
              onChange={(v) => set("verification", v as Filters["verification"])}
              options={(Object.keys(PROFILE_STATUS_LABEL) as ProfileStatus[]).map((k) => ({ value: k, label: PROFILE_STATUS_LABEL[k] }))}
              any="Any profile status"
            />
            <Filter
              label="Export experience"
              value={filters.experience}
              onChange={(v) => set("experience", v)}
              options={[5, 10, 20].map((y) => ({ value: String(y), label: `${y}+ years exporting` }))}
              any="Any experience"
            />
            <Filter
              label="Quotation history"
              value={filters.quoted}
              onChange={(v) => set("quoted", v as Filters["quoted"])}
              options={[
                { value: "yes", label: "Has quoted you" },
                { value: "no", label: "No quotations yet" },
              ]}
              any="Any history"
            />
          </div>
          <p className="mt-4 text-xs text-ink-faint">All profiles are fictional demo data, declared by suppliers.</p>
        </aside>

        <section aria-labelledby="supplier-results" className="min-w-0">
          <h2 id="supplier-results" className="sr-only">
            Suppliers
          </h2>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
            <p role="status">
              {visible.length} of {SUPPLIERS.length} suppliers
            </p>
            {anyFilter && (
              <button type="button" onClick={clear} className={`inline-flex items-center gap-1 rounded-md font-medium text-teal hover:underline ${focusRing}`}>
                <X aria-hidden className="size-3.5" />
                Clear filters
              </button>
            )}
          </div>
          {sort === "relevance" && (
            <p className="mb-4 flex gap-2 text-xs text-ink-muted">
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              Ordered by a simple, transparent rule: suppliers listing a product from your open requirements first, then
              shared product categories, export markets that include your destination, and existing quotations. Not an AI
              recommendation.
            </p>
          )}

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
              <p className="font-semibold text-ink">No suppliers match your current filters.</p>
              <button type="button" onClick={clear} className={`mt-3 inline-flex items-center gap-1 rounded-md text-sm font-semibold text-teal hover:underline ${focusRing}`}>
                <X aria-hidden className="size-3.5" />
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {visible.map((row) => (
                <li key={row.supplier.id} className="min-w-0">
                  <SupplierCard row={row} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
  any,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly (string | { value: string; label: string })[];
  any: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">{any}</option>
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function moqRange(s: Supplier): string {
  const moqs = s.products.map((p) => p.moq);
  const unit = moqs[0].unit;
  if (moqs.some((m) => m.unit !== unit)) return "Varies by product";
  return `from ${formatQuantity({ amount: Math.min(...moqs.map((m) => m.amount)), unit })}`;
}

function SupplierCard({ row }: { row: Row }) {
  const { supplier: s, matches, quoteCount, latestQuote } = row;
  const [leadMin, leadMax] = leadTimeRange(s);
  const productMatches = matches.filter((m) => m.kind === "product");
  const certs = s.certifications.map((c) => c.name);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition hover:border-teal/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold leading-snug text-ink">
            <Link href={importerHref(`suppliers/${s.id}`)} className={`rounded hover:text-teal ${focusRing}`}>
              {s.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            {s.city}, {s.country}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-ink-muted">
          {SUPPLIER_TYPE_LABEL[s.type]}
        </span>
      </div>

      {productMatches.length > 0 && (
        <p className="mt-3 rounded-lg bg-teal-soft/70 px-3 py-2 text-xs text-teal">
          <span className="font-semibold">Lists a product you need: </span>
          {productMatches.map((m) => `${m.requirement.product.name} (${m.requirement.id})`).join(", ")}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        <dt className="text-xs text-ink-faint">Products</dt>
        <dd className="text-ink">
          {s.products.slice(0, 3).map((p) => p.name).join(", ")}
          {s.products.length > 3 && <span className="text-ink-faint"> +{s.products.length - 3} more</span>}
        </dd>
        <dt className="text-xs text-ink-faint">Categories</dt>
        <dd className="text-ink-muted">{s.categories.join(", ")}</dd>
        <dt className="text-xs text-ink-faint">Experience</dt>
        <dd className="text-ink-muted">
          {yearsInBusiness(s)} years in business · {s.yearsExporting} exporting
        </dd>
        <dt className="text-xs text-ink-faint">Export markets</dt>
        <dd className="text-ink-muted">{s.markets.regions.join(", ")}</dd>
        <dt className="text-xs text-ink-faint">Certifications</dt>
        <dd className="text-ink-muted">
          {certs.length === 0 ? (
            <span className="text-ink-faint">None declared</span>
          ) : (
            <>
              {certs.slice(0, 3).join(", ")}
              {certs.length > 3 && <span className="text-ink-faint"> +{certs.length - 3}</span>}
            </>
          )}
        </dd>
        <dt className="text-xs text-ink-faint">Capability</dt>
        <dd className="text-ink-muted">
          MOQ {moqRange(s)} · Lead time {leadMin}–{leadMax} days
        </dd>
      </dl>

      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-3 text-xs">
          <span className={quoteCount ? "font-medium text-ink" : "text-ink-faint"}>
            {quoteCount
              ? `Quoted you ${quoteCount} ${quoteCount === 1 ? "time" : "times"} · latest ${formatDayMonth(latestQuote!)}`
              : "No quotations yet"}
          </span>
          <span className="text-ink-faint">{PROFILE_STATUS_LABEL[s.profileStatus]}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={importerHref(`suppliers/${s.id}`)}
            aria-label={`View supplier ${s.name}`}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal px-3.5 text-sm font-semibold text-on-brand transition hover:brightness-110 ${focusRing}`}
          >
            View Supplier
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          {quoteCount > 0 && (
            <Link
              href={supplierQuotationsHref(s.id)}
              aria-label={`View quotations from ${s.name}`}
              className={`inline-flex h-9 items-center rounded-lg border border-line px-3.5 text-sm font-semibold text-ink transition hover:border-teal/40 hover:bg-teal-soft ${focusRing}`}
            >
              View Quotations
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
