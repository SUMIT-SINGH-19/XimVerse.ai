"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import {
  DOCUMENT_SOURCE_LABEL,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPE_LABEL,
  isMissing,
  VALIDITY_LABEL,
  type DocumentType,
  type TradeDocument,
  type ValidityState,
} from "@/lib/importer-documents";
import { findSupplier } from "@/lib/importer-suppliers";
import { ImportId } from "../dashboard/dashboard-ui";
import { ImporterPageHeader } from "../importer-page-header";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { useShipments } from "../shipments/shipment-store";
import { focusRing } from "../styles";
import { useDocuments } from "./document-store";
import { DocumentStatusBadge, RequirementTag, ValidityText } from "./document-ui";

const SORTS = [
  { id: "updated", label: "Recently updated" },
  { id: "type", label: "Document type" },
  { id: "shipment", label: "Shipment" },
  { id: "issue", label: "Issue date" },
  { id: "expiry", label: "Expiry date" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

interface Filters {
  query: string;
  type: string;
  status: string;
  shipment: string;
  supplier: string;
  source: string;
  expiry: string;
  sort: SortId;
}
const NO_FILTERS: Filters = { query: "", type: "", status: "", shipment: "", supplier: "", source: "", expiry: "", sort: "updated" };

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-teal/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

export function DocumentsList({ initialShipment = "" }: { initialShipment?: string }) {
  const documents = useDocuments();
  const shipments = useShipments();
  const shipmentIds = [...new Set(documents.map((d) => d.shipmentId))].sort();
  const [filters, setFilters] = useState<Filters>({ ...NO_FILTERS, shipment: shipmentIds.includes(initialShipment) ? initialShipment : "" });
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const supplierName = (id: string) => findSupplier(id)?.name ?? id;
  const productOf = (d: TradeDocument) => shipments.find((s) => s.id === d.shipmentId)?.cargo.product ?? "";
  const suppliers = [...new Set(documents.map((d) => d.supplierId))].map((id) => [id, supplierName(id)] as const).sort((a, b) => a[1].localeCompare(b[1]));
  const sources = [...new Set(documents.map((d) => d.source))].sort();

  const q = filters.query.trim().toLowerCase();
  const visible = documents
    .filter((d) => {
      const hay = [d.id, d.label, DOCUMENT_TYPE_LABEL[d.type], d.shipmentId, d.orderId, supplierName(d.supplierId), productOf(d), d.metadata.number ?? "", d.metadata.issuer ?? "", d.metadata.filename ?? ""];
      if (q && !hay.some((v) => v.toLowerCase().includes(q))) return false;
      if (filters.type && d.type !== filters.type) return false;
      if (filters.status && d.status !== filters.status) return false;
      if (filters.shipment && d.shipmentId !== filters.shipment) return false;
      if (filters.supplier && d.supplierId !== filters.supplier) return false;
      if (filters.source && d.source !== filters.source) return false;
      if (filters.expiry && d.validity !== filters.expiry) return false;
      return true;
    })
    .toSorted((a, b) => {
      switch (filters.sort) {
        case "type":
          return a.label.localeCompare(b.label) || a.shipmentId.localeCompare(b.shipmentId);
        case "shipment":
          return a.shipmentId.localeCompare(b.shipmentId) || a.id.localeCompare(b.id);
        case "issue":
          return (b.metadata.issueDate ?? "").localeCompare(a.metadata.issueDate ?? "");
        case "expiry":
          // Soonest expiry first; documents without expiry last.
          return (a.metadata.expiryDate || "9999").localeCompare(b.metadata.expiryDate || "9999");
        default:
          return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
      }
    });
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const count = (pred: (d: TradeDocument) => boolean) => documents.filter(pred).length;
  const summary = [
    { label: "Available", value: count((d) => d.status === "available") },
    { label: "Approved", value: count((d) => d.status === "approved") },
    { label: "Requested", value: count((d) => d.status === "requested") },
    { label: "Needs Review", value: count((d) => d.status === "needs-review") },
    { label: "Missing Required", value: count(isMissing) },
    { label: "Expiring Soon", value: count((d) => d.validity === "expiring-soon") },
  ];

  return (
    <div className="space-y-6">
      <ImporterPageHeader title="Documents" description="Manage trade documents across your import shipments." />

      <section aria-label="Document summary">
        <dl className="grid grid-cols-3 overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-6">
          {summary.map((s, i) => (
            <div key={s.label} className={`flex flex-col border-line px-4 py-3 ${i % 3 ? "border-l" : ""} ${i >= 3 ? "border-t lg:border-t-0" : ""} ${i === 3 ? "lg:border-l" : ""}`}>
              <dt className="text-xs font-medium text-ink-muted">{s.label}</dt>
              <dd className="order-first text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-faint">Document metadata only — no file is stored. Expiring Soon = expiry within 30 days.</p>
      </section>

      <section aria-labelledby="documents-heading" className="rounded-2xl border border-line bg-surface">
        <h2 id="documents-heading" className="sr-only">Documents</h2>
        <form role="search" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-4">
            <label htmlFor="document-search" className="sr-only">Search documents</label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              id="document-search"
              type="search"
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Search documents, shipments, suppliers, numbers, issuers…"
              className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <Select label="Document type" value={filters.type} onChange={(v) => set("type", v)} any="All document types" options={(Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[]).map((t) => [t, DOCUMENT_TYPE_LABEL[t]])} />
          <Select label="Status" value={filters.status} onChange={(v) => set("status", v)} any="All statuses" options={DOCUMENT_STATUSES.map((s) => [s.id, s.label])} />
          <Select label="Shipment" value={filters.shipment} onChange={(v) => set("shipment", v)} any="All shipments" options={shipmentIds.map((id) => [id, id])} />
          <Select label="Supplier" value={filters.supplier} onChange={(v) => set("supplier", v)} any="All suppliers" options={suppliers} />
          <Select label="Source party" value={filters.source} onChange={(v) => set("source", v)} any="All source parties" options={sources.map((s) => [s, DOCUMENT_SOURCE_LABEL[s]])} />
          <Select label="Expiry state" value={filters.expiry} onChange={(v) => set("expiry", v)} any="Any expiry state" options={(Object.keys(VALIDITY_LABEL) as ValidityState[]).map((v) => [v, VALIDITY_LABEL[v]])} />
          <Select label="Sort by" value={filters.sort} onChange={(v) => set("sort", v as SortId)} options={SORTS.map((s) => [s.id, `Sort: ${s.label.toLowerCase()}`])} />
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-ink-muted sm:px-5">
          <p role="status">{visible.length} of {documents.length} documents</p>
          {filtered && (
            <button type="button" onClick={() => setFilters(NO_FILTERS)} className={`inline-flex items-center gap-1 rounded-md font-medium text-teal hover:underline ${focusRing}`}>
              <X aria-hidden className="size-3.5" />
              Clear filters
            </button>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="border-t border-line px-6 py-14 text-center text-sm text-ink-muted">No documents match your current filters.</p>
        ) : (
          <>
            <Table docs={visible} supplierName={supplierName} />
            <Cards docs={visible} supplierName={supplierName} />
          </>
        )}
      </section>

      <SumitAnalysisCard
        id="sumit-documents"
        heading="Ask SUMIT about these documents"
        prompts={["Which required documents are missing?", "Which documents need review?", "Which documents expire soon?", "What is blocking this shipment?", "Which documents have not been provided?"]}
        message="SUMIT document intelligence will be connected later. Nothing was analysed."
      />
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

function Table({ docs, supplierName }: { docs: TradeDocument[]; supplierName: (id: string) => string }) {
  const heads = ["Document", "Shipment", "Supplier", "Type", "Source", "Status", "Issue date", "Expiry", "Updated"];
  return (
    <div className="relative hidden overflow-x-auto xl:block">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <thead>
          <tr className="border-y border-line bg-canvas/60 text-xs text-ink-muted">
            {heads.map((h, i) => (
              <th key={h} scope="col" className={`py-2.5 font-medium ${i === 0 ? "pl-5 pr-3" : i === heads.length - 1 ? "pl-3 pr-5" : "px-3"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {docs.map((d) => (
            <tr key={d.id} className="group relative transition-colors hover:bg-teal-soft/50 focus-within:bg-teal-soft/50">
              <th scope="row" className="py-3.5 pl-5 pr-3 font-normal">
                <Link
                  href={importerHref(`documents/${d.id}`)}
                  className="block font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                >
                  {d.label}
                </Link>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <ImportId id={d.id} className="whitespace-nowrap text-xs text-ink-faint" />
                  <RequirementTag level={d.requirement.level} />
                </span>
              </th>
              <td className="whitespace-nowrap px-3 py-3.5"><ImportId id={d.shipmentId} className="text-ink-muted" /></td>
              <td className="px-3 py-3.5 text-ink">{supplierName(d.supplierId)}</td>
              <td className="px-3 py-3.5 text-ink-muted">{d.category}</td>
              <td className="px-3 py-3.5 text-ink-muted">{DOCUMENT_SOURCE_LABEL[d.source]}</td>
              <td className="px-3 py-3.5"><DocumentStatusBadge status={d.status} /></td>
              <td className="whitespace-nowrap px-3 py-3.5 text-ink-muted">{d.metadata.issueDate ? formatDate(d.metadata.issueDate) : "—"}</td>
              <td className="px-3 py-3.5"><ValidityText validity={d.validity} expiryDate={d.metadata.expiryDate} /></td>
              <td className="whitespace-nowrap py-3.5 pl-3 pr-5 text-ink-muted">{formatDate(d.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cards({ docs, supplierName }: { docs: TradeDocument[]; supplierName: (id: string) => string }) {
  return (
    <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-2 sm:p-5 xl:hidden">
      {docs.map((d) => (
        <li key={d.id}>
          <Link href={importerHref(`documents/${d.id}`)} className={`block h-full rounded-xl border border-line p-4 transition hover:border-teal/40 hover:bg-teal-soft/40 ${focusRing}`}>
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block break-words font-semibold text-ink">{d.label}</span>
                <ImportId id={d.id} className="block text-xs text-ink-faint" />
              </span>
              <DocumentStatusBadge status={d.status} />
            </span>
            <span className="mt-2 block break-words text-sm text-ink-muted">
              {d.shipmentId} · {supplierName(d.supplierId)}
            </span>
            <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <RequirementTag level={d.requirement.level} />
              {d.category} · {DOCUMENT_SOURCE_LABEL[d.source]}
            </span>
            <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-muted">
              <ValidityText validity={d.validity} expiryDate={d.metadata.expiryDate} />
              <ArrowRight aria-hidden className="size-4 shrink-0" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
