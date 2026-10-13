"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import {
  formatMoney,
  INSTRUMENT_LABEL,
  WORKSPACE_STATUS_LABEL,
  type FinanceInstrument,
  type PaymentWorkspace,
  type WorkspaceStatus,
} from "@/lib/importer-payments";
import { importerHref } from "@/lib/importer-nav";
import { ImportId } from "../dashboard/dashboard-ui";
import { useDocuments } from "../documents/document-store";
import { ImporterPageHeader } from "../importer-page-header";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { focusRing } from "../styles";
import { usePaymentWorkspaces } from "./payment-store";
import { PAYMENT_PROMPTS, PaymentsNotice, SUMIT_PAYMENT_MESSAGE, WorkspaceBadge } from "./payments-ui";

const SORTS = [
  { id: "next", label: "Next due" },
  { id: "overdue", label: "Overdue first" },
  { id: "updated", label: "Recently updated" },
  { id: "supplier", label: "Supplier" },
  { id: "value", label: "Order value (within currency)" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

interface Filters {
  query: string;
  status: string;
  supplier: string;
  currency: string;
  instrument: string;
  due: string;
  finance: string;
  sort: SortId;
}
const NO_FILTERS: Filters = { query: "", status: "", supplier: "", currency: "", instrument: "", due: "", finance: "", sort: "next" };

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-teal/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

/** "overdue" | "due" | "upcoming" | "awaiting" | "none" — from the next open obligation. */
function dueState(w: PaymentWorkspace): string {
  const o = w.obligations.filter((x) => x.status !== "recorded");
  if (o.some((x) => x.status === "overdue")) return "overdue";
  if (o.some((x) => x.status === "due")) return "due";
  if (o.some((x) => x.status === "upcoming" || x.status === "ready")) return "upcoming";
  if (o.some((x) => x.status === "awaiting-trigger" || x.status === "planned")) return "awaiting";
  return "none";
}

export function PaymentsList() {
  const workspaces = usePaymentWorkspaces();
  const documents = useDocuments();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const invoiceNumbers = (w: PaymentWorkspace) => (w.shipment ? documents.filter((d) => d.shipmentId === w.shipment!.id && d.type === "commercial-invoice").map((d) => d.metadata.number ?? "") : []);
  const suppliers = [...new Map(workspaces.map((w) => [w.order.supplierId, w.supplierName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const currencies = [...new Set(workspaces.map((w) => w.currency))].sort();
  const financeLabels = [...new Set(workspaces.map((w) => w.financeStatusLabel))].sort();
  const q = filters.query.trim().toLowerCase();

  const visible = workspaces
    .filter((w) => {
      const hay = [w.order.id, w.order.purchaseOrder.number, w.supplierName, w.order.terms.productName, ...w.records.map((r) => r.reference ?? ""), ...w.records.map((r) => r.evidence.utr ?? ""), w.lc?.plan.reference ?? "", ...invoiceNumbers(w)];
      if (q && !hay.some((x) => x.toLowerCase().includes(q))) return false;
      if (filters.status && w.status !== filters.status) return false;
      if (filters.supplier && w.order.supplierId !== filters.supplier) return false;
      if (filters.currency && w.currency !== filters.currency) return false;
      if (filters.instrument && w.finance.instrument !== filters.instrument) return false;
      if (filters.due && dueState(w) !== filters.due) return false;
      if (filters.finance && w.financeStatusLabel !== filters.finance) return false;
      return true;
    })
    .toSorted((a, b) => {
      const next = (w: PaymentWorkspace) => w.nextObligation?.dueDate ?? "9999";
      switch (filters.sort) {
        case "overdue":
          return Number(dueState(b) === "overdue") - Number(dueState(a) === "overdue") || next(a).localeCompare(next(b)) || a.order.id.localeCompare(b.order.id);
        case "updated":
          return b.updatedAt.localeCompare(a.updatedAt) || a.order.id.localeCompare(b.order.id);
        case "supplier":
          return a.supplierName.localeCompare(b.supplierName) || a.order.id.localeCompare(b.order.id);
        // Values are only compared within one currency.
        case "value":
          return a.currency.localeCompare(b.currency) || b.orderValue - a.orderValue;
        default:
          return next(a).localeCompare(next(b)) || a.order.id.localeCompare(b.order.id);
      }
    });
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const obligations = workspaces.flatMap((w) => w.obligations);
  const summary = [
    { label: "Upcoming", value: obligations.filter((o) => o.status === "upcoming" || o.status === "ready").length },
    { label: "Due", value: obligations.filter((o) => o.status === "due").length },
    { label: "Overdue", value: obligations.filter((o) => o.status === "overdue").length },
    { label: "Awaiting Documents", value: obligations.filter((o) => o.status === "awaiting-trigger" && (o.trigger === "documents" || o.trigger === "lc-presentation")).length },
    { label: "Recorded Paid", value: obligations.filter((o) => o.status === "recorded").length },
    { label: "Finance Action Required", value: workspaces.filter((w) => w.exceptions.some((e) => e.type.startsWith("lc-") || e.type === "manual-schedule-required")).length },
  ];

  return (
    <div className="space-y-6">
      <ImporterPageHeader title="Payments" description="Track supplier payment obligations and trade-finance readiness." />
      <PaymentsNotice />

      <section aria-label="Payments summary">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {summary.map((s) => (
            <div key={s.label} className="flex flex-col bg-surface px-4 py-3">
              <dt className="text-xs font-medium text-ink-muted">{s.label}</dt>
              <dd className="order-first text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-faint">Counts are payment obligations, except Finance Action Required (orders).</p>
      </section>

      <section aria-labelledby="pay-heading" className="rounded-2xl border border-line bg-surface">
        <h2 id="pay-heading" className="sr-only">Payment workspaces</h2>
        <form role="search" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-4">
            <label htmlFor="pay-search" className="sr-only">Search payments</label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              id="pay-search"
              type="search"
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Search order, PO, supplier, product, payment or LC reference, invoice number…"
              className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <Select label="Payment status" value={filters.status} onChange={(v) => set("status", v)} any="All payment statuses" options={(Object.keys(WORKSPACE_STATUS_LABEL) as WorkspaceStatus[]).map((s) => [s, WORKSPACE_STATUS_LABEL[s]])} />
          <Select label="Supplier" value={filters.supplier} onChange={(v) => set("supplier", v)} any="All suppliers" options={suppliers} />
          <Select label="Currency" value={filters.currency} onChange={(v) => set("currency", v)} any="All currencies" options={currencies.map((c) => [c, c])} />
          <Select label="Instrument" value={filters.instrument} onChange={(v) => set("instrument", v)} any="All instruments" options={(Object.keys(INSTRUMENT_LABEL) as FinanceInstrument[]).map((i) => [i, INSTRUMENT_LABEL[i]])} />
          <Select label="Due state" value={filters.due} onChange={(v) => set("due", v)} any="Any due state" options={[["overdue", "Overdue"], ["due", "Due today"], ["upcoming", "Upcoming / ready"], ["awaiting", "Awaiting trigger"], ["none", "Nothing open"]]} />
          <Select label="Finance status" value={filters.finance} onChange={(v) => set("finance", v)} any="Any finance status" options={financeLabels.map((l) => [l, l])} />
          <Select label="Sort by" value={filters.sort} onChange={(v) => set("sort", v as SortId)} options={SORTS.map((s) => [s.id, `Sort: ${s.label.toLowerCase()}`])} />
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-ink-muted sm:px-5">
          <p role="status">{visible.length} of {workspaces.length} orders</p>
          {filters.sort === "value" && <p className="text-xs text-ink-faint">Grouped by currency; values are only compared within the same currency.</p>}
          {filtered && (
            <button type="button" onClick={() => setFilters(NO_FILTERS)} className={`inline-flex items-center gap-1 rounded-md font-medium text-teal hover:underline ${focusRing}`}>
              <X aria-hidden className="size-3.5" />
              Clear filters
            </button>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="border-t border-line px-6 py-14 text-center text-sm text-ink-muted">{workspaces.length === 0 ? "No orders yet." : "No orders match your current filters."}</p>
        ) : (
          <>
            <Table list={visible} />
            <Cards list={visible} />
          </>
        )}
      </section>

      <SumitAnalysisCard id="sumit-payments" heading="Ask SUMIT about payments" prompts={PAYMENT_PROMPTS} message={SUMIT_PAYMENT_MESSAGE} />
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

const nextLabel = (w: PaymentWorkspace) => (w.nextObligation ? `${w.nextObligation.label} · ${formatMoney(w.nextObligation.remaining, w.currency)}` : w.obligations.length ? "Nothing open" : "Schedule not set");

function Table({ list }: { list: PaymentWorkspace[] }) {
  const heads = ["Order", "Supplier", "Order Value", "Payment Terms", "Next Payment", "Due Date", "Payment Status", "Finance Status"];
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
          {list.map((w) => (
            <tr key={w.order.id} className="group relative align-top transition-colors hover:bg-teal-soft/50 focus-within:bg-teal-soft/50">
              <th scope="row" className="py-3.5 pl-5 pr-3 font-normal">
                <Link
                  href={importerHref(`payments/${w.order.id}`)}
                  className="whitespace-nowrap font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                >
                  <ImportId id={w.order.id} />
                </Link>
                <span className="block text-xs text-ink-faint">{w.order.purchaseOrder.number} · {w.order.terms.productName}</span>
              </th>
              <td className="px-3 py-3.5 text-ink">{w.supplierName}</td>
              <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-ink">{formatMoney(w.orderValue, w.currency)}</td>
              <td className="px-3 py-3.5 text-ink-muted">{w.terms.summary}</td>
              <td className="px-3 py-3.5 text-ink">{nextLabel(w)}</td>
              <td className="whitespace-nowrap px-3 py-3.5 text-ink-muted">{w.nextObligation?.dueDate ? formatDate(w.nextObligation.dueDate) : "—"}</td>
              <td className="px-3 py-3.5"><WorkspaceBadge status={w.status} /></td>
              <td className="py-3.5 pl-3 pr-5 text-ink-muted">{w.financeStatusLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cards({ list }: { list: PaymentWorkspace[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-2 sm:p-5 xl:hidden">
      {list.map((w) => (
        <li key={w.order.id}>
          <Link href={importerHref(`payments/${w.order.id}`)} className={`block h-full rounded-xl border border-line p-4 transition hover:border-teal/40 hover:bg-teal-soft/40 ${focusRing}`}>
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <ImportId id={w.order.id} className="block text-ink-muted" />
                <span className="mt-0.5 block break-words font-semibold text-ink">{w.supplierName}</span>
                <span className="block break-words text-sm text-ink-muted">{formatMoney(w.orderValue, w.currency)} · {w.terms.summary}</span>
              </span>
              <WorkspaceBadge status={w.status} />
            </span>
            <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-sm text-ink">
              <span className="min-w-0 break-words">Next: {nextLabel(w)} · Finance: {w.financeStatusLabel}</span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-muted" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
