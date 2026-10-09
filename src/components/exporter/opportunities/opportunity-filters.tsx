"use client";

import { Search } from "lucide-react";
import { Select } from "@/components/exporter/products/catalogue-filters";
import {
  BUYER_REGIONS,
  OPPORTUNITY_STATUS_LABEL,
  type BuyerRegion,
  type Incoterm,
  type OpportunityStatus,
} from "@/lib/exporter-opportunities";

export type ScoreBand = "90" | "80" | "below-80";
/** "open" (default) hides closed opportunities; "closing-soon" is derived from the deadline. */
export type StatusFilter = OpportunityStatus | "open" | "closing-soon" | "all";
export type DeadlineWindow = "24h" | "3d" | "7d";
export type OpportunitySort = "match" | "closing" | "newest" | "quantity";

export interface OpportunityFilterState {
  query: string;
  score: ScoreBand | "";
  product: string;
  region: BuyerRegion | "";
  status: StatusFilter;
  deadline: DeadlineWindow | "";
  incoterm: Incoterm | "";
  sort: OpportunitySort;
}

export const DEFAULT_FILTERS: OpportunityFilterState = {
  query: "",
  score: "",
  product: "",
  region: "",
  status: "open",
  deadline: "",
  incoterm: "",
  sort: "match",
};

const STATUS_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closing-soon", label: "Closing Soon" },
  ...(Object.keys(OPPORTUNITY_STATUS_LABEL) as OpportunityStatus[]).map((s) => ({
    value: s,
    label: OPPORTUNITY_STATUS_LABEL[s],
  })),
  { value: "all", label: "All, including closed" },
];

const control =
  "h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-2.5 text-sm text-ink transition-colors focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20";

export function OpportunityFilters({
  filters,
  onChange,
  products,
  incoterms,
}: {
  filters: OpportunityFilterState;
  onChange: (next: OpportunityFilterState) => void;
  /** Catalogue products that appear as matches. */
  products: readonly { id: string; name: string }[];
  incoterms: readonly Incoterm[];
}) {
  const set = <K extends keyof OpportunityFilterState>(key: K, value: OpportunityFilterState[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-4 sm:px-6 xl:grid-cols-8">
      <label className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-4 xl:col-span-2">
        <span className="text-xs font-medium text-ink-faint">Search</span>
        <span className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="RFQ ID, product or destination"
            className={control}
          />
        </span>
      </label>
      <Select
        label="Match Score"
        value={filters.score}
        onChange={(v) => set("score", v)}
        options={[
          { value: "90", label: "90%+" },
          { value: "80", label: "80–89%" },
          { value: "below-80", label: "Below 80%" },
        ]}
        allLabel="Any score"
      />
      <Select
        label="Product"
        value={filters.product}
        onChange={(v) => set("product", v)}
        options={products.map((p) => ({ value: p.id, label: p.name }))}
        allLabel="All products"
      />
      <Select
        label="Region"
        value={filters.region}
        onChange={(v) => set("region", v)}
        options={BUYER_REGIONS.map((r) => ({ value: r, label: r }))}
        allLabel="All regions"
      />
      <Select
        label="Status"
        value={filters.status}
        onChange={(v) => set("status", v || "open")}
        options={STATUS_OPTIONS}
      />
      <Select
        label="Deadline"
        value={filters.deadline}
        onChange={(v) => set("deadline", v)}
        options={[
          { value: "24h", label: "Within 24 hours" },
          { value: "3d", label: "Within 3 days" },
          { value: "7d", label: "Within 7 days" },
        ]}
        allLabel="Any deadline"
      />
      <Select
        label="Incoterm"
        value={filters.incoterm}
        onChange={(v) => set("incoterm", v)}
        options={incoterms.map((i) => ({ value: i, label: i }))}
        allLabel="Any Incoterm"
      />
    </div>
  );
}

export function SortSelect({ value, onChange }: { value: OpportunitySort; onChange: (v: OpportunitySort) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
      Sort
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as OpportunitySort)}
        className="h-8 rounded-lg border border-line bg-canvas px-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
      >
        <option value="match">Highest Match</option>
        <option value="closing">Closing Soon</option>
        <option value="newest">Newest</option>
        <option value="quantity">Largest Quantity</option>
      </select>
    </label>
  );
}
