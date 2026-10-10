"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Search, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import {
  CUSTOMS_CASE_STATUSES,
  CUSTOMS_READINESS_LABEL,
  type CustomsCaseView,
  type CustomsReadiness,
} from "@/lib/importer-customs";
import { SHIPMENT_STAGES, stageLabel } from "@/lib/importer-shipments";
import { ImportId } from "../dashboard/dashboard-ui";
import { ImporterPageHeader } from "../importer-page-header";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { focusRing, secondaryButton } from "../styles";
import { useCustomsCases } from "./customs-store";
import { CUSTOMS_PROMPTS, CustomsNotice, CustomsReadinessBadge, CustomsStatusBadge, StatusRecordTag, SUMIT_CUSTOMS_MESSAGE } from "./customs-ui";

const SORTS = [
  { id: "updated", label: "Recently updated" },
  { id: "eta", label: "ETA" },
  { id: "shipment", label: "Shipment" },
  { id: "supplier", label: "Supplier" },
  { id: "status", label: "Customs status" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

interface Filters {
  query: string;
  status: string;
  readiness: string;
  cha: string;
  port: string;
  stage: string;
  sort: SortId;
}
const NO_FILTERS: Filters = { query: "", status: "", readiness: "", cha: "", port: "", stage: "", sort: "updated" };
const NOT_ASSIGNED = "__none";

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-teal/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

const STATUS_ORDER = CUSTOMS_CASE_STATUSES.map((s) => s.id);

export function CustomsList() {
  const cases = useCustomsCases();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const chas = [...new Set(cases.map((c) => c.cha?.company).filter((x): x is string => !!x))].sort();
  const ports = [...new Set(cases.map((c) => c.shipment.route.portOfDischarge))].sort();
  const stages = SHIPMENT_STAGES.filter((s) => cases.some((c) => c.state.stage === s.id));

  const q = filters.query.trim().toLowerCase();
  const visible = cases
    .filter((c) => {
      const hsCode = c.fields.find((f) => f.id === "hsCode")?.value ?? "";
      const hay = [c.id, c.shipment.id, c.record.orderId, c.supplierName, c.shipment.cargo.product, hsCode, c.shipment.route.portOfDischarge, c.cha?.company ?? "", c.manual.declarationReference ?? ""];
      if (q && !hay.some((v) => v.toLowerCase().includes(q))) return false;
      if (filters.status && c.status !== filters.status) return false;
      if (filters.readiness && c.readiness !== filters.readiness) return false;
      if (filters.cha && (filters.cha === NOT_ASSIGNED ? !!c.cha : c.cha?.company !== filters.cha)) return false;
      if (filters.port && c.shipment.route.portOfDischarge !== filters.port) return false;
      if (filters.stage && c.state.stage !== filters.stage) return false;
      return true;
    })
    .toSorted((a, b) => {
      switch (filters.sort) {
        case "eta":
          return a.eta.localeCompare(b.eta) || a.id.localeCompare(b.id);
        case "shipment":
          return a.shipment.id.localeCompare(b.shipment.id);
        case "supplier":
          return a.supplierName.localeCompare(b.supplierName) || a.id.localeCompare(b.id);
        case "status":
          return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.id.localeCompare(b.id);
        default:
          return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
      }
    });
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const count = (status: CustomsCaseView["status"]) => cases.filter((c) => c.status === status).length;
  const summary = [
    { label: "Preparing", value: count("preparing") },
    { label: "Ready for Handoff", value: count("ready-for-handoff") },
    { label: "With CHA", value: count("with-cha") },
    { label: "Clarification Required", value: count("clarification-required") },
    { label: "Ready for Filing", value: count("ready-for-filing") },
    { label: "Cleared", value: count("cleared") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ImporterPageHeader title="Customs" description="Prepare and coordinate customs clearance for your import shipments." />
        <Link href={importerHref("customs/new")} className={secondaryButton}>
          <Plus aria-hidden className="size-4" />
          Prepare Customs
        </Link>
      </div>

      <section aria-label="Customs summary">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {summary.map((s) => (
            <div key={s.label} className="flex flex-col bg-surface px-4 py-3">
              <dt className="text-xs font-medium text-ink-muted">{s.label}</dt>
              <dd className="order-first text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <CustomsNotice />

      <section aria-labelledby="customs-heading" className="rounded-2xl border border-line bg-surface">
        <h2 id="customs-heading" className="sr-only">Customs cases</h2>
        <form role="search" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          <div className="relative sm:col-span-2 lg:col-span-3">
            <label htmlFor="customs-search" className="sr-only">Search customs cases</label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              id="customs-search"
              type="search"
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Search case, shipment, order, supplier, product, HS code, port, CHA, reference…"
              className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <Select label="Status" value={filters.status} onChange={(v) => set("status", v)} any="All statuses" options={CUSTOMS_CASE_STATUSES.map((s) => [s.id, s.label])} />
          <Select label="Readiness" value={filters.readiness} onChange={(v) => set("readiness", v)} any="All readiness" options={(Object.keys(CUSTOMS_READINESS_LABEL) as CustomsReadiness[]).map((r) => [r, CUSTOMS_READINESS_LABEL[r]])} />
          <Select label="CHA" value={filters.cha} onChange={(v) => set("cha", v)} any="All brokers" options={[...chas.map((c) => [c, c] as const), [NOT_ASSIGNED, "Not assigned"] as const]} />
          <Select label="Port of import" value={filters.port} onChange={(v) => set("port", v)} any="All ports" options={ports.map((p) => [p, p])} />
          <Select label="Shipment stage" value={filters.stage} onChange={(v) => set("stage", v)} any="All shipment stages" options={stages.map((s) => [s.id, s.label])} />
          <Select label="Sort by" value={filters.sort} onChange={(v) => set("sort", v as SortId)} options={SORTS.map((s) => [s.id, `Sort: ${s.label.toLowerCase()}`])} />
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-ink-muted sm:px-5">
          <p role="status">{visible.length} of {cases.length} customs cases</p>
          {filtered && (
            <button type="button" onClick={() => setFilters(NO_FILTERS)} className={`inline-flex items-center gap-1 rounded-md font-medium text-teal hover:underline ${focusRing}`}>
              <X aria-hidden className="size-3.5" />
              Clear filters
            </button>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="border-t border-line px-6 py-14 text-center text-sm text-ink-muted">
            {cases.length === 0 ? "No customs cases yet." : "No customs cases match your current filters."}
          </p>
        ) : (
          <>
            <Table cases={visible} />
            <Cards cases={visible} />
          </>
        )}
      </section>

      <SumitAnalysisCard id="sumit-customs" heading="Ask SUMIT about customs" prompts={CUSTOMS_PROMPTS} message={SUMIT_CUSTOMS_MESSAGE} />
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

function Table({ cases }: { cases: CustomsCaseView[] }) {
  const heads = ["Case", "Shipment", "Supplier", "Product", "Port", "CHA", "Readiness", "Status", "ETA", "Updated"];
  return (
    <div className="relative hidden overflow-x-auto xl:block">
      <table className="w-full min-w-[72rem] text-left text-sm">
        <thead>
          <tr className="border-y border-line bg-canvas/60 text-xs text-ink-muted">
            {heads.map((h, i) => (
              <th key={h} scope="col" className={`py-2.5 font-medium ${i === 0 ? "pl-5 pr-3" : i === heads.length - 1 ? "pl-3 pr-5" : "px-3"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {cases.map((c) => (
            <tr key={c.id} className="group relative transition-colors hover:bg-teal-soft/50 focus-within:bg-teal-soft/50">
              <th scope="row" className="whitespace-nowrap py-3.5 pl-5 pr-3 font-normal">
                <Link
                  href={importerHref(`customs/${c.id}`)}
                  className="font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                >
                  <ImportId id={c.id} />
                </Link>
              </th>
              <td className="whitespace-nowrap px-3 py-3.5"><ImportId id={c.shipment.id} className="text-ink-muted" /></td>
              <td className="px-3 py-3.5 text-ink">{c.supplierName}</td>
              <td className="px-3 py-3.5 text-ink">{c.shipment.cargo.product}</td>
              <td className="px-3 py-3.5 text-ink-muted">{c.shipment.route.portOfDischarge}</td>
              <td className="px-3 py-3.5 text-ink-muted">{c.cha?.company ?? "Not assigned"}</td>
              <td className="px-3 py-3.5"><CustomsReadinessBadge readiness={c.readiness} /></td>
              <td className="px-3 py-3.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  <CustomsStatusBadge status={c.status} />
                  <StatusRecordTag view={c} />
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-3.5 text-ink-muted">{formatDate(c.eta)}</td>
              <td className="whitespace-nowrap py-3.5 pl-3 pr-5 text-ink-muted">{formatDate(c.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cards({ cases }: { cases: CustomsCaseView[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-2 sm:p-5 xl:hidden">
      {cases.map((c) => (
        <li key={c.id}>
          <Link href={importerHref(`customs/${c.id}`)} className={`block h-full rounded-xl border border-line p-4 transition hover:border-teal/40 hover:bg-teal-soft/40 ${focusRing}`}>
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <ImportId id={c.id} className="block text-ink-muted" />
                <span className="mt-0.5 block break-words font-semibold text-ink">{c.shipment.cargo.product}</span>
                <span className="block break-words text-sm text-ink-muted">{c.supplierName}</span>
              </span>
              <CustomsStatusBadge status={c.status} />
            </span>
            <span className="mt-2 block break-words text-sm text-ink-muted">
              {c.shipment.id} · {c.shipment.route.portOfDischarge} · ETA {formatDate(c.eta)}
            </span>
            <span className="mt-1 block break-words text-sm text-ink-muted">CHA: {c.cha?.company ?? "Not assigned"}</span>
            <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-muted">
              <span className="flex flex-wrap items-center gap-1.5">
                <CustomsReadinessBadge readiness={c.readiness} />
                <StatusRecordTag view={c} />
                <span>{stageLabel(c.state.stage)}</span>
              </span>
              <ArrowRight aria-hidden className="size-4 shrink-0" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
