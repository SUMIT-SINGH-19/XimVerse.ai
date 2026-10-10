"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, GitCompareArrows, Search, X } from "lucide-react";
import { formatTimeAgo } from "@/lib/format";
import { INCOTERMS, MOCK_NOW, MOCK_REQUIREMENTS } from "@/lib/import-requirements";
import {
  deviationCount,
  formatUnitPrice,
  isDecisionOpen,
  MOCK_QUOTATIONS,
  QUOTATION_STATUSES,
  requirementOf,
  supplierOf,
  type Quotation,
  type QuotationStatus,
} from "@/lib/importer-quotations";
import { importerHref } from "@/lib/importer-nav";
import { ImportId } from "../dashboard/dashboard-ui";
import { ImporterPageHeader } from "../importer-page-header";
import { focusRing, primaryButton } from "../styles";
import { QuotationStatusBadge, ShortlistToggle } from "./quotation-ui";
import { toggleShortlist, useQuotationStatus } from "./quotation-status-store";
import { supplierHref } from "../suppliers/supplier-links";
import { useImportRequirements } from "../rfq/requirements-store";

export const MAX_COMPARE = 4;

const SORTS = [
  { id: "newest", label: "Newest first" },
  { id: "price", label: "Lowest quoted unit price" },
  { id: "lead", label: "Shortest stated lead time" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

interface Filters {
  query: string;
  requirement: string;
  status: QuotationStatus | "";
  country: string;
  incoterm: string;
  sort: SortId;
}

const REQUIREMENTS_WITH_QUOTES = MOCK_REQUIREMENTS.filter((r) => MOCK_QUOTATIONS.some((q) => q.requirementId === r.id));
const COUNTRIES = [...new Set(MOCK_QUOTATIONS.map((q) => supplierOf(q).country))].sort();
const QUOTED_INCOTERMS = INCOTERMS.filter((t) => MOCK_QUOTATIONS.some((q) => q.price.incoterm === t));

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-teal/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

export function compareHref(ids: readonly string[]): string {
  return `${importerHref("quotations/compare")}?ids=${ids.join(",")}`;
}

export function QuotationsList({
  initialRequirement = "",
  initialQuery = "",
}: {
  initialRequirement?: string;
  initialQuery?: string;
}) {
  const statusOf = useQuotationStatus();
  const { find: findRequirement } = useImportRequirements();
  const defaults: Filters = {
    query: initialQuery,
    requirement: REQUIREMENTS_WITH_QUOTES.some((r) => r.id === initialRequirement) ? initialRequirement : "",
    status: "",
    country: "",
    incoterm: "",
    sort: "newest",
  };
  const [filters, setFilters] = useState<Filters>(defaults);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionNotice, setSelectionNotice] = useState("");
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const q = filters.query.trim().toLowerCase();
  const visible = MOCK_QUOTATIONS.filter((quote) => {
    const s = supplierOf(quote);
    const r = requirementOf(quote);
    if (q && ![quote.id, quote.requirementId, s.name, r?.product.name ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
    if (filters.requirement && quote.requirementId !== filters.requirement) return false;
    if (filters.status && statusOf(quote) !== filters.status) return false;
    if (filters.country && s.country !== filters.country) return false;
    if (filters.incoterm && quote.price.incoterm !== filters.incoterm) return false;
    return true;
  }).toSorted((a, b) => {
    if (filters.sort === "price") {
      // Raw unit price, grouped by currency and unit: across those, prices aren't comparable.
      const basis = (x: Quotation) => `${x.price.currency}/${x.product.quantity.unit}`;
      return basis(a).localeCompare(basis(b)) || a.price.unitPrice - b.price.unitPrice;
    }
    if (filters.sort === "lead") return a.delivery.leadTimeDays - b.delivery.leadTimeDays;
    return b.receivedAt.localeCompare(a.receivedAt);
  });
  const filtered = JSON.stringify(filters) !== JSON.stringify({ ...defaults, requirement: "", query: "" });

  const selectedRequirement = selected.length ? MOCK_QUOTATIONS.find((x) => x.id === selected[0])?.requirementId : undefined;

  const toggleSelect = (quote: Quotation) => {
    if (selected.includes(quote.id)) {
      setSelected(selected.filter((id) => id !== quote.id));
      setSelectionNotice("");
      return;
    }
    if (selectedRequirement && quote.requirementId !== selectedRequirement) {
      setSelectionNotice(
        `Compare quotations from one requirement at a time. ${quote.id} is for ${quote.requirementId}; clear the selection to switch.`,
      );
      return;
    }
    if (selected.length >= MAX_COMPARE) {
      setSelectionNotice(`You can compare up to ${MAX_COMPARE} quotations at once.`);
      return;
    }
    setSelected([...selected, quote.id]);
    setSelectionNotice("");
  };

  const summary = [
    { label: "Total Quotations", value: MOCK_QUOTATIONS.length },
    {
      label: "Awaiting Review",
      value: MOCK_QUOTATIONS.filter((x) => ["new", "under-review"].includes(statusOf(x))).length,
    },
    { label: "Shortlisted", value: MOCK_QUOTATIONS.filter((x) => statusOf(x) === "shortlisted").length },
    { label: "Requirements with Quotes", value: REQUIREMENTS_WITH_QUOTES.length },
  ];

  const rowProps = (quote: Quotation) => {
    const status = statusOf(quote);
    const open = isDecisionOpen(findRequirement(quote.requirementId));
    return {
      quote,
      status,
      open,
      checked: selected.includes(quote.id),
      incompatible: !!selectedRequirement && quote.requirementId !== selectedRequirement,
      onSelect: () => toggleSelect(quote),
      onShortlist: () => toggleShortlist(quote, status),
    };
  };

  return (
    <div className={`space-y-6 ${selected.length ? "pb-28" : ""}`}>
      <ImporterPageHeader
        title="Quotations"
        description="Review and compare supplier offers across your import requirements."
      />

      <section aria-label="Quotation summary">
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

      <section aria-labelledby="quotations-heading" className="rounded-2xl border border-line bg-surface">
        <h2 id="quotations-heading" className="sr-only">
          Quotations
        </h2>
        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]"
        >
          <div className="relative sm:col-span-2 xl:col-span-1">
            <label htmlFor="qt-search" className="sr-only">
              Search quotations
            </label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              id="qt-search"
              type="search"
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Search..."
              className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <FilterSelect label="Requirement" value={filters.requirement} onChange={(v) => set("requirement", v)}>
            <option value="">All requirements</option>
            {REQUIREMENTS_WITH_QUOTES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} · {r.product.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Status" value={filters.status} onChange={(v) => set("status", v as Filters["status"])}>
            <option value="">All statuses</option>
            {QUOTATION_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Supplier country" value={filters.country} onChange={(v) => set("country", v)}>
            <option value="">All supplier countries</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Incoterm" value={filters.incoterm} onChange={(v) => set("incoterm", v)}>
            <option value="">All Incoterms</option>
            {QUOTED_INCOTERMS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Sort by" value={filters.sort} onChange={(v) => set("sort", v as SortId)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>Sort: {s.label.toLowerCase()}</option>
            ))}
          </FilterSelect>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm text-ink-muted sm:px-5">
          <p role="status">
            {visible.length} of {MOCK_QUOTATIONS.length} quotations
          </p>
          {filters.sort === "price" && (
            <p className="text-xs text-ink-faint">
              Sorted by raw quoted unit price within each currency and unit — not landed cost. Incoterms may differ.
            </p>
          )}
          {filtered && (
            <button
              type="button"
              onClick={() => setFilters({ ...defaults, requirement: "", query: "" })}
              className={`inline-flex items-center gap-1 rounded-md font-medium text-teal hover:underline ${focusRing}`}
            >
              <X aria-hidden className="size-3.5" />
              Clear filters
            </button>
          )}
        </div>
        <p className="border-t border-line px-4 py-2.5 text-xs text-ink-muted sm:px-5">
          Select 2–{MAX_COMPARE} quotations from the same requirement to compare them side by side.
        </p>

        {visible.length === 0 ? (
          <p className="border-t border-line px-6 py-14 text-center text-sm text-ink-muted">
            No quotations match these filters.
          </p>
        ) : (
          <>
            <QuotationTable rows={visible.map(rowProps)} />
            <QuotationCards rows={visible.map(rowProps)} />
          </>
        )}
      </section>

      {(selected.length > 0 || selectionNotice) && (
        <CompareBar
          selected={selected}
          requirementId={selectedRequirement}
          notice={selectionNotice}
          onClear={() => {
            setSelected([]);
            setSelectionNotice("");
          }}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {children}
      </select>
    </label>
  );
}

interface RowProps {
  quote: Quotation;
  status: QuotationStatus;
  open: boolean;
  checked: boolean;
  incompatible: boolean;
  onSelect: () => void;
  onShortlist: () => void;
}

function SelectBox({ quote, checked, incompatible, onSelect }: RowProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onSelect}
      aria-label={`Select ${quote.id} from ${supplierOf(quote).name} to compare`}
      className={`relative z-10 size-4 cursor-pointer accent-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
        incompatible ? "opacity-40" : ""
      }`}
    />
  );
}

function QuotationTable({ rows }: { rows: RowProps[] }) {
  const heads = ["Quotation", "Requirement", "Supplier", "Quoted Price", "Incoterm", "Lead Time", "Payment Terms", "Status", "Received"];
  // Hidden until 2xl so the table fits beside the sidebar on laptop screens.
  const wideOnly = new Set(["Payment Terms", "Received"]);
  return (
    <div className="relative hidden overflow-x-auto xl:block">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-y border-line bg-canvas/60 text-xs text-ink-muted">
            <th scope="col" className="w-10 py-2.5 pl-5 pr-1 font-medium">
              <span className="sr-only">Compare</span>
            </th>
            {heads.map((h) => (
              <th key={h} scope="col" className={`px-3 py-2.5 font-medium ${h === "Received" ? "pr-2" : ""} ${wideOnly.has(h) ? "hidden 2xl:table-cell" : ""}`}>
                {h}
              </th>
            ))}
            <th scope="col" className="w-12 py-2.5 pr-5 font-medium">
              <span className="sr-only">Shortlist</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const { quote, status } = row;
            const s = supplierOf(quote);
            return (
              <tr
                key={quote.id}
                className={`group relative transition-colors hover:bg-teal-soft/50 focus-within:bg-teal-soft/50 ${row.checked ? "bg-teal-soft/40" : ""}`}
              >
                <td className="py-3.5 pl-5 pr-1">
                  <SelectBox {...row} />
                </td>
                <th scope="row" className="whitespace-nowrap px-3 py-3.5 font-normal">
                  <Link
                    href={importerHref(`quotations/${quote.id}`)}
                    className="font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                  >
                    <ImportId id={quote.id} />
                  </Link>
                </th>
                <td className="px-3 py-3.5">
                  <ImportId id={quote.requirementId} className="block whitespace-nowrap text-ink-muted" />
                  <span className="block text-xs text-ink-faint">{requirementOf(quote)?.product.name}</span>
                </td>
                <td className="px-3 py-3.5">
                  <Link
                    href={supplierHref(s.id)}
                    className={`relative z-10 block w-fit rounded font-medium text-ink hover:text-teal hover:underline ${focusRing}`}
                  >
                    {s.name}
                  </Link>
                  <span className="block text-xs text-ink-faint">{s.country}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-ink">{formatUnitPrice(quote)}</td>
                <td className="px-3 py-3.5 text-ink-muted">
                  <span className="font-medium text-ink">{quote.price.incoterm}</span>
                  <span className="block text-xs text-ink-faint">{quote.price.namedPlace}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-ink">{quote.delivery.leadTimeDays} days</td>
                <td className="hidden 2xl:table-cell px-3 py-3.5 text-ink-muted">{quote.commercial.paymentSummary}</td>
                <td className="px-3 py-3.5">
                  <QuotationStatusBadge status={status} />
                </td>
                <td className="hidden 2xl:table-cell whitespace-nowrap py-3.5 pl-3 pr-2 text-ink-muted">{formatTimeAgo(quote.receivedAt, MOCK_NOW)}</td>
                <td className="py-3.5 pr-5">
                  <ShortlistToggle
                    label={`${quote.id} from ${s.name}`}
                    shortlisted={status === "shortlisted"}
                    disabled={!row.open || status === "selected"}
                    onToggle={row.onShortlist}
                    className="relative z-10"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QuotationCards({ rows }: { rows: RowProps[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-2 sm:p-5 xl:hidden">
      {rows.map((row) => {
        const { quote, status } = row;
        const s = supplierOf(quote);
        const devs = deviationCount(quote);
        return (
          <li
            key={quote.id}
            className={`relative rounded-xl border p-4 transition hover:border-teal/40 focus-within:border-teal/40 ${
              row.checked ? "border-teal/50 bg-teal-soft/40" : "border-line"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="pt-0.5">
                <SelectBox {...row} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={importerHref(`quotations/${quote.id}`)}
                    className="min-w-0 after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-orange"
                  >
                    <ImportId id={quote.id} className="block text-ink-muted" />
                    <span className="mt-0.5 block truncate font-semibold text-ink">{s.name}</span>
                  </Link>
                  <ShortlistToggle
                    label={`${quote.id} from ${s.name}`}
                    shortlisted={status === "shortlisted"}
                    disabled={!row.open || status === "selected"}
                    onToggle={row.onShortlist}
                    className="relative z-10 -mr-1 -mt-1"
                  />
                </div>
                <p className="text-xs text-ink-faint">
                  {s.country} · for {quote.requirementId} {requirementOf(quote)?.product.name}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Field label="Quoted price">{formatUnitPrice(quote)}</Field>
                  <Field label="Incoterm">{quote.price.incoterm} {quote.price.namedPlace}</Field>
                  <Field label="Lead time">{quote.delivery.leadTimeDays} days</Field>
                  <Field label="Payment">{quote.commercial.paymentSummary}</Field>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <QuotationStatusBadge status={status} />
                  <span className="text-xs text-ink-faint">
                    {devs} {devs === 1 ? "deviation" : "deviations"} · {formatTimeAgo(quote.receivedAt, MOCK_NOW)}
                  </span>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span>
      <span className="block text-xs text-ink-faint">{label}</span>
      <span className="block text-ink">{children}</span>
    </span>
  );
}

function CompareBar({
  selected,
  requirementId,
  notice,
  onClear,
}: {
  selected: string[];
  requirementId?: string;
  notice: string;
  onClear: () => void;
}) {
  const n = selected.length;
  const canCompare = n >= 2;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 shadow-[0_-8px_24px_rgba(11,46,48,0.08)] backdrop-blur sm:px-6 lg:left-64 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-ink">
            {n} of {MAX_COMPARE} selected
            {requirementId && <span className="font-normal text-ink-muted"> · {requirementId}</span>}
          </p>
          <p role="status" className={`text-xs ${notice ? "text-orange" : "text-ink-muted"}`}>
            {notice || (canCompare ? "Ready to compare." : "Select at least 2 quotations to compare.")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onClear}
            className={`h-10 rounded-xl px-4 text-sm font-semibold text-ink-muted hover:bg-teal-soft hover:text-ink ${focusRing}`}
          >
            Clear
          </button>
          {canCompare ? (
            <Link href={compareHref(selected)} className={`${primaryButton} h-10 flex-1 sm:flex-none`}>
              <GitCompareArrows aria-hidden className="size-4" />
              Compare {n} quotations
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          ) : (
            <button type="button" disabled className={`${primaryButton} h-10 flex-1 sm:flex-none`}>
              <GitCompareArrows aria-hidden className="size-4" />
              Compare
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
