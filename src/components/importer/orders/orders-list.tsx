"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import {
  formatOrderQuantity,
  formatOrderValue,
  ORDER_STATUSES,
  ORDERS_NOW,
  orderStatus,
  orderUpdatedAt,
  orderValue,
  type Order,
  type OrderStatus,
} from "@/lib/importer-orders";
import { findSupplier } from "@/lib/importer-suppliers";
import { ImportId } from "../dashboard/dashboard-ui";
import { ImporterPageHeader } from "../importer-page-header";
import { focusRing } from "../styles";
import { useOrders } from "./order-store";
import { OrderStatusBadge } from "./order-ui";

const SORTS = [
  { id: "updated", label: "Recently updated" },
  { id: "ordered", label: "Order date" },
  { id: "required", label: "Required date" },
  { id: "supplier", label: "Supplier" },
  { id: "value", label: "Order value" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const DATE_WINDOWS = [
  { id: "30", label: "Ordered in the last 30 days", days: 30 },
  { id: "90", label: "Ordered in the last 90 days", days: 90 },
  { id: "older", label: "Ordered more than 90 days ago", days: -90 },
] as const;

interface Filters {
  query: string;
  status: OrderStatus | "";
  supplier: string;
  product: string;
  date: string;
  sort: SortId;
}
const NO_FILTERS: Filters = { query: "", status: "", supplier: "", product: "", date: "", sort: "updated" };

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-teal/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

interface Row {
  o: Order;
  status: OrderStatus;
  supplier: string;
  updated: string;
}

function daysBefore(date: string): number {
  return (Date.parse(ORDERS_NOW) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000;
}

export function OrdersList() {
  const orders = useOrders();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const rows: Row[] = orders.map((o) => ({ o, status: orderStatus(o), supplier: findSupplier(o.supplierId)?.name ?? o.supplierId, updated: orderUpdatedAt(o) }));
  const suppliers = [...new Map(rows.map((r) => [r.o.supplierId, r.supplier])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const products = [...new Set(rows.map((r) => r.o.terms.productName))].sort();

  const q = filters.query.trim().toLowerCase();
  const visible = rows
    .filter((r) => {
      const { o } = r;
      if (q && ![o.id, o.purchaseOrder.number, r.supplier, o.terms.productName, o.requirementId].some((v) => v.toLowerCase().includes(q))) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (filters.supplier && o.supplierId !== filters.supplier) return false;
      if (filters.product && o.terms.productName !== filters.product) return false;
      if (filters.date) {
        const w = DATE_WINDOWS.find((d) => d.id === filters.date)!;
        const age = daysBefore(o.purchaseOrder.issueDate);
        if (w.days > 0 ? age > w.days : age <= -w.days) return false;
      }
      return true;
    })
    .toSorted((a, b) => {
      switch (filters.sort) {
        case "ordered":
          return b.o.purchaseOrder.issueDate.localeCompare(a.o.purchaseOrder.issueDate);
        case "required":
          return a.o.purchaseOrder.requiredBy.localeCompare(b.o.purchaseOrder.requiredBy);
        case "supplier":
          return a.supplier.localeCompare(b.supplier);
        case "value":
          // Within one currency only; different currencies are not converted.
          return a.o.terms.currency.localeCompare(b.o.terms.currency) || orderValue(b.o.terms) - orderValue(a.o.terms);
        default:
          return b.updated.localeCompare(a.updated);
      }
    });
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const count = (...s: OrderStatus[]) => rows.filter((r) => s.includes(r.status)).length;
  const summary = [
    { label: "Active Orders", value: count("po-ready", "awaiting-confirmation", "confirmed", "pre-shipment") },
    { label: "Awaiting Confirmation", value: count("po-ready", "awaiting-confirmation") },
    { label: "Confirmed", value: count("confirmed") },
    { label: "Pre-Shipment", value: count("pre-shipment") },
    { label: "Completed", value: count("completed") },
  ];

  return (
    <div className="space-y-6">
      <ImporterPageHeader title="Orders" description="Manage confirmed supplier orders and purchase orders." />

      <section aria-label="Order summary">
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-5">
          {summary.map((s, i) => (
            <div key={s.label} className={`flex flex-col border-line px-4 py-3 ${i > 0 ? "sm:border-l" : ""} ${i % 2 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""}`}>
              <dt className="text-xs font-medium text-ink-muted">{s.label}</dt>
              <dd className="order-first text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
          <p className="font-semibold text-ink">No orders yet.</p>
          <p className="mt-1 text-sm text-ink-muted">Orders are created after you accept a supplier&apos;s commercial terms.</p>
        </div>
      ) : (
        <section aria-labelledby="orders-heading" className="rounded-2xl border border-line bg-surface">
          <h2 id="orders-heading" className="sr-only">Orders</h2>
          <form role="search" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]">
            <div className="relative sm:col-span-2 xl:col-span-1">
              <label htmlFor="order-search" className="sr-only">Search orders</label>
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <input
                id="order-search"
                type="search"
                value={filters.query}
                onChange={(e) => set("query", e.target.value)}
                placeholder="Search orders, POs, suppliers…"
                className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20"
              />
            </div>
            <Select label="Status" value={filters.status} onChange={(v) => set("status", v as Filters["status"])} any="All statuses" options={ORDER_STATUSES.map((s) => [s.id, s.label])} />
            <Select label="Supplier" value={filters.supplier} onChange={(v) => set("supplier", v)} any="All suppliers" options={suppliers} />
            <Select label="Product" value={filters.product} onChange={(v) => set("product", v)} any="All products" options={products.map((p) => [p, p])} />
            <Select label="Order date" value={filters.date} onChange={(v) => set("date", v)} any="Any order date" options={DATE_WINDOWS.map((d) => [d.id, d.label])} />
            <Select label="Sort by" value={filters.sort} onChange={(v) => set("sort", v as SortId)} options={SORTS.map((s) => [s.id, `Sort: ${s.label.toLowerCase()}`])} />
          </form>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-ink-muted sm:px-5">
            <p role="status">{visible.length} of {rows.length} orders</p>
            {filters.sort === "value" && <p className="text-xs text-ink-faint">Highest value first, within each currency. No currency conversion.</p>}
            {filtered && (
              <button type="button" onClick={() => setFilters(NO_FILTERS)} className={`inline-flex items-center gap-1 rounded-md font-medium text-teal hover:underline ${focusRing}`}>
                <X aria-hidden className="size-3.5" />
                Clear filters
              </button>
            )}
          </div>
          {visible.length === 0 ? (
            <p className="border-t border-line px-6 py-14 text-center text-sm text-ink-muted">No orders match your current filters.</p>
          ) : (
            <>
              <Table rows={visible} />
              <Cards rows={visible} />
            </>
          )}
        </section>
      )}
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

function Table({ rows }: { rows: Row[] }) {
  const heads = ["Order / PO", "Supplier", "Product", "Quantity", "Order value", "Incoterm", "Required by", "Status", "Updated"];
  return (
    <div className="relative hidden overflow-x-auto xl:block">
      <table className="w-full min-w-[58rem] text-left text-sm">
        <thead>
          <tr className="border-y border-line bg-canvas/60 text-xs text-ink-muted">
            {heads.map((h, i) => (
              <th key={h} scope="col" className={`py-2.5 font-medium ${i === 0 ? "pl-5 pr-3" : i === heads.length - 1 ? "pl-3 pr-5" : "px-3"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(({ o, status, supplier, updated }) => (
            <tr key={o.id} className="group relative transition-colors hover:bg-teal-soft/50 focus-within:bg-teal-soft/50">
              <th scope="row" className="whitespace-nowrap py-3.5 pl-5 pr-3 font-normal">
                <Link
                  href={importerHref(`orders/${o.id}`)}
                  className="font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                >
                  <ImportId id={o.id} />
                </Link>
                <ImportId id={o.purchaseOrder.number} className="block text-xs text-ink-faint" />
              </th>
              <td className="px-3 py-3.5 font-medium text-ink">{supplier}</td>
              <td className="px-3 py-3.5">
                <span className="block text-ink">{o.terms.productName}</span>
                <ImportId id={o.requirementId} className="block whitespace-nowrap text-xs text-ink-faint" />
              </td>
              <td className="whitespace-nowrap px-3 py-3.5 text-ink">{formatOrderQuantity(o.terms)}</td>
              <td className="whitespace-nowrap px-3 py-3.5 font-semibold tabular-nums text-ink">{formatOrderValue(o.terms)}</td>
              <td className="px-3 py-3.5 text-ink-muted">{o.terms.incoterm} {o.terms.namedPlace}</td>
              <td className="whitespace-nowrap px-3 py-3.5 text-ink">{formatDate(o.purchaseOrder.requiredBy)}</td>
              <td className="px-3 py-3.5"><OrderStatusBadge status={status} /></td>
              <td className="whitespace-nowrap py-3.5 pl-3 pr-5 text-ink-muted">{formatDate(updated)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cards({ rows }: { rows: Row[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-2 sm:p-5 xl:hidden">
      {rows.map(({ o, status, supplier, updated }) => (
        <li key={o.id}>
          <Link href={importerHref(`orders/${o.id}`)} className={`block h-full rounded-xl border border-line p-4 transition hover:border-teal/40 hover:bg-teal-soft/40 ${focusRing}`}>
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <ImportId id={o.id} className="block text-ink-muted" />
                <span className="mt-0.5 block break-words font-semibold text-ink">{o.terms.productName}</span>
                <span className="block break-words text-sm text-ink-muted">{supplier}</span>
              </span>
              <OrderStatusBadge status={status} />
            </span>
            <span className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Quantity">{formatOrderQuantity(o.terms)}</Field>
              <Field label="Order value">{formatOrderValue(o.terms)}</Field>
              <Field label="Incoterm">{o.terms.incoterm} {o.terms.namedPlace}</Field>
              <Field label="Required by">{formatDate(o.purchaseOrder.requiredBy)}</Field>
            </span>
            <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-faint">
              {o.purchaseOrder.number} · updated {formatDate(updated)}
              <ArrowRight aria-hidden className="size-4" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span>
      <span className="block text-xs text-ink-faint">{label}</span>
      <span className="block break-words text-ink">{children}</span>
    </span>
  );
}
