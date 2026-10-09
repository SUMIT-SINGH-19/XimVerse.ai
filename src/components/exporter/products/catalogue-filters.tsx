"use client";

import { Search } from "lucide-react";
import {
  PRODUCT_SORT_LABEL,
  PRODUCT_STATUS_LABEL,
  READINESS_BAND_LABEL,
  type ProductSort,
  type ProductStatus,
  type ReadinessBand,
} from "@/lib/exporter-products";

export interface CatalogueFilterState {
  query: string;
  status: ProductStatus | "";
  category: string;
  readiness: ReadinessBand | "";
  certification: string;
  sort: ProductSort;
}

export const EMPTY_FILTERS: CatalogueFilterState = {
  query: "",
  status: "",
  category: "",
  readiness: "",
  certification: "",
  sort: "readiness",
};

const control =
  "h-9 rounded-lg border border-line bg-canvas px-2.5 text-sm text-ink transition-colors focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20";

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: T | "";
  onChange: (value: T | "") => void;
  options: readonly { value: T; label: string }[];
  /** Label of the "no filter" option; omit for a required choice. */
  allLabel?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-ink-faint">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T | "")} className={`${control} min-w-0`}>
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const entries = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export function CatalogueFilters({
  filters,
  onChange,
  categories,
  certifications,
}: {
  filters: CatalogueFilterState;
  onChange: (next: CatalogueFilterState) => void;
  categories: readonly string[];
  certifications: readonly { key: string; name: string }[];
}) {
  const set = <K extends keyof CatalogueFilterState>(key: K, value: CatalogueFilterState[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
      <label className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-3 lg:col-span-1">
        <span className="text-xs font-medium text-ink-faint">Search</span>
        <span className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Search products"
            className={`${control} w-full pl-8`}
          />
        </span>
      </label>
      <Select
        label="Status"
        value={filters.status}
        onChange={(v) => set("status", v)}
        options={entries(PRODUCT_STATUS_LABEL)}
        allLabel="All statuses"
      />
      <Select
        label="Category"
        value={filters.category}
        onChange={(v) => set("category", v)}
        options={categories.map((c) => ({ value: c, label: c }))}
        allLabel="All categories"
      />
      <Select
        label="Match Readiness"
        value={filters.readiness}
        onChange={(v) => set("readiness", v)}
        options={entries(READINESS_BAND_LABEL)}
        allLabel="Any readiness"
      />
      <Select
        label="Certification"
        value={filters.certification}
        onChange={(v) => set("certification", v)}
        options={certifications.map((c) => ({ value: c.key, label: c.name }))}
        allLabel="Any certification"
      />
      <Select
        label="Sort by"
        value={filters.sort}
        onChange={(v) => set("sort", v || "readiness")}
        options={entries(PRODUCT_SORT_LABEL)}
      />
    </div>
  );
}
