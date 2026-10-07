"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Search, X } from "lucide-react";
import { formatDate, formatTimeAgo } from "@/lib/format";
import {
  formatQuantity,
  isActive,
  isAwaitingQuotations,
  MOCK_NOW,
  PRODUCT_CATEGORIES,
  REQUIREMENT_STATUSES,
  type ImportRequirement,
  type RequirementStatus,
} from "@/lib/import-requirements";
import { importerHref } from "@/lib/importer-nav";
import { ImportId } from "../dashboard/dashboard-ui";
import { ImporterPageHeader } from "../importer-page-header";
import { focusRing, primaryButton } from "../styles";
import { RequirementStatusBadge } from "./requirement-status-badge";
import { useImportRequirements } from "./requirements-store";

const CREATED_WITHIN = [
  { id: "any", label: "Any time", days: Infinity },
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
] as const;

interface Filters {
  query: string;
  status: RequirementStatus | "";
  category: string;
  destination: string;
  created: (typeof CREATED_WITHIN)[number]["id"];
}

const NO_FILTERS: Filters = { query: "", status: "", category: "", destination: "", created: "any" };

function matches(r: ImportRequirement, f: Filters): boolean {
  const q = f.query.trim().toLowerCase();
  if (
    q &&
    ![r.id, r.product.name, r.product.category, r.delivery.destinationLocation].some((s) =>
      s.toLowerCase().includes(q),
    )
  ) {
    return false;
  }
  if (f.status && r.status !== f.status) return false;
  if (f.category && r.product.category !== f.category) return false;
  if (f.destination && r.delivery.destinationCountry !== f.destination) return false;
  const window = CREATED_WITHIN.find((c) => c.id === f.created)!.days;
  if (window !== Infinity && Date.parse(MOCK_NOW) - Date.parse(r.createdAt) > window * 86_400_000) {
    return false;
  }
  return true;
}

function quotationsLabel(r: ImportRequirement): string {
  if (r.status === "draft" || r.status === "ready") return "—";
  return `${r.quotationCount} ${r.quotationCount === 1 ? "quotation" : "quotations"}`;
}

const selectClass = `h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-teal/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20`;

export function RequirementsList() {
  const { requirements } = useImportRequirements();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const destinations = useMemo(
    () => [...new Set(requirements.map((r) => r.delivery.destinationCountry))].sort(),
    [requirements],
  );
  const visible = requirements.filter((r) => matches(r, filters));
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const summary = [
    { label: "Active Requirements", value: requirements.filter(isActive).length },
    { label: "Awaiting Quotations", value: requirements.filter(isAwaitingQuotations).length },
    { label: "Drafts", value: requirements.filter((r) => r.status === "draft").length },
    { label: "Closed", value: requirements.filter((r) => r.status === "closed").length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <ImporterPageHeader
          title="Import Requirements"
          description="Create, manage and track your sourcing requirements."
        />
        <Link href={importerHref("rfqs/new")} className={`${primaryButton} self-start sm:self-auto`}>
          <Plus className="size-4" aria-hidden strokeWidth={2.5} />
          New Import Requirement
        </Link>
      </div>

      <section aria-label="Requirement summary">
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

      <section aria-labelledby="requirements-heading" className="rounded-2xl border border-line bg-surface">
        <h2 id="requirements-heading" className="sr-only">
          Requirements
        </h2>

        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]"
        >
          <div className="relative sm:col-span-2 lg:col-span-1">
            <label htmlFor="rfq-search" className="sr-only">
              Search requirements
            </label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              id="rfq-search"
              type="search"
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Search requirements..."
              className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <label className="block">
            <span className="sr-only">Status</span>
            <select value={filters.status} onChange={(e) => set("status", e.target.value as Filters["status"])} className={selectClass}>
              <option value="">All statuses</option>
              {REQUIREMENT_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Product category</span>
            <select value={filters.category} onChange={(e) => set("category", e.target.value)} className={selectClass}>
              <option value="">All categories</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Destination</span>
            <select value={filters.destination} onChange={(e) => set("destination", e.target.value)} className={selectClass}>
              <option value="">All destinations</option>
              {destinations.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Created date</span>
            <select value={filters.created} onChange={(e) => set("created", e.target.value as Filters["created"])} className={selectClass}>
              {CREATED_WITHIN.map((c) => (
                <option key={c.id} value={c.id}>{c.id === "any" ? "Created: any time" : `Created: ${c.label.toLowerCase()}`}</option>
              ))}
            </select>
          </label>
        </form>

        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-ink-muted sm:px-5">
          <p role="status">
            {visible.length} of {requirements.length} requirements
          </p>
          {filtered && (
            <button
              type="button"
              onClick={() => setFilters(NO_FILTERS)}
              className={`inline-flex items-center gap-1 rounded-md font-medium text-teal hover:underline ${focusRing}`}
            >
              <X aria-hidden className="size-3.5" />
              Clear filters
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <p className="border-t border-line px-6 py-14 text-center text-sm text-ink-muted">
            No requirements match these filters.
          </p>
        ) : (
          <>
            <RequirementsTable requirements={visible} />
            <RequirementCards requirements={visible} />
          </>
        )}
      </section>
    </div>
  );
}

function RequirementsTable({ requirements }: { requirements: readonly ImportRequirement[] }) {
  return (
    <div className="hidden xl:block">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-y border-line bg-canvas/60 text-xs text-ink-muted">
            {["Requirement", "Product", "Quantity", "Destination", "Incoterm", "Required By", "Quotations", "Status", "Updated"].map(
              (h, i) => (
                <th key={h} scope="col" className={`py-2.5 font-medium ${i === 0 ? "pl-5 pr-3" : i === 8 ? "pl-3 pr-5" : "px-3"}`}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {requirements.map((r) => (
            <tr key={r.id} className="group relative transition-colors focus-within:bg-teal-soft/50 hover:bg-teal-soft/50">
              <th scope="row" className="whitespace-nowrap py-3.5 pl-5 pr-3 font-normal">
                <Link
                  href={importerHref(`rfqs/${r.id}`)}
                  className="font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                >
                  <ImportId id={r.id} />
                </Link>
              </th>
              <td className="px-3 py-3.5">
                <span className="block font-medium text-ink">{r.product.name}</span>
                <span className="block text-xs text-ink-faint">{r.product.category}</span>
              </td>
              <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-ink">{formatQuantity(r.quantity)}</td>
              <td className="px-3 py-3.5 text-ink-muted">{r.delivery.destinationLocation}</td>
              <td className="px-3 py-3.5 text-ink-muted">{r.delivery.incoterm ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-ink">{formatDate(r.delivery.requiredBy)}</td>
              <td className="whitespace-nowrap px-3 py-3.5 text-ink-muted">{quotationsLabel(r)}</td>
              <td className="px-3 py-3.5">
                <RequirementStatusBadge status={r.status} />
              </td>
              <td className="whitespace-nowrap py-3.5 pl-3 pr-5 text-ink-muted">{formatTimeAgo(r.updatedAt, MOCK_NOW)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequirementCards({ requirements }: { requirements: readonly ImportRequirement[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-2 sm:p-5 xl:hidden">
      {requirements.map((r) => (
        <li key={r.id}>
          <Link
            href={importerHref(`rfqs/${r.id}`)}
            className={`block h-full rounded-xl border border-line p-4 transition hover:border-teal/40 hover:bg-teal-soft/40 ${focusRing}`}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <ImportId id={r.id} className="block text-ink-muted" />
                <span className="mt-0.5 block truncate font-semibold text-ink">{r.product.name}</span>
              </span>
              <RequirementStatusBadge status={r.status} />
            </span>
            <span className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Quantity">{formatQuantity(r.quantity)}</Field>
              <Field label="Incoterm">{r.delivery.incoterm ?? "—"}</Field>
              <Field label="Destination" wide>{r.delivery.destinationLocation}</Field>
              <Field label="Required by">{formatDate(r.delivery.requiredBy)}</Field>
              <Field label="Quotations">{quotationsLabel(r)}</Field>
            </span>
            <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-faint">
              Updated {formatTimeAgo(r.updatedAt, MOCK_NOW).replace(/^(Yesterday|Just now)$/, (m) => m.toLowerCase())}
              <ArrowRight aria-hidden className="size-4" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <span className={wide ? "col-span-2" : undefined}>
      <span className="block text-xs text-ink-faint">{label}</span>
      <span className="block text-ink">{children}</span>
    </span>
  );
}
