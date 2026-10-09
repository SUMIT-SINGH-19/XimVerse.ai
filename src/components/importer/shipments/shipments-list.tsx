"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import {
  isArrivingSoon,
  modeLabel,
  nextAction,
  preShipmentChecklist,
  SHIPMENT_STAGES,
  SHIPMENT_STATUSES,
  shipmentState,
  stageLabel,
  TRANSPORT_MODES,
  type Shipment,
  type ShipmentState,
} from "@/lib/importer-shipments";
import { findSupplier } from "@/lib/importer-suppliers";
import { ImportId } from "../dashboard/dashboard-ui";
import { ImporterPageHeader } from "../importer-page-header";
import { useOrders } from "../orders/order-store";
import { focusRing } from "../styles";
import { useShipments } from "./shipment-store";
import { ShipmentStatusBadge } from "./shipment-ui";

const SORTS = [
  { id: "updated", label: "Recently updated" },
  { id: "eta", label: "ETA" },
  { id: "etd", label: "ETD" },
  { id: "supplier", label: "Supplier" },
  { id: "id", label: "Shipment ID" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

interface Filters {
  query: string;
  stage: string;
  status: string;
  supplier: string;
  mode: string;
  destination: string;
  sort: SortId;
}
const NO_FILTERS: Filters = { query: "", stage: "", status: "", supplier: "", mode: "", destination: "", sort: "updated" };

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-teal/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

interface Row {
  sh: Shipment;
  st: ShipmentState;
  supplier: string;
  next: string;
}

export function ShipmentsList() {
  const shipments = useShipments();
  const orders = useOrders();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const rows: Row[] = shipments.map((sh) => {
    const st = shipmentState(sh);
    const confirmed = !!orders.find((o) => o.id === sh.orderId)?.events.some((e) => e.type === "supplier-confirmed");
    return { sh, st, supplier: findSupplier(sh.supplierId)?.name ?? sh.supplierId, next: nextAction(sh, st, preShipmentChecklist(sh, st, confirmed)) };
  });
  const suppliers = [...new Map(rows.map((r) => [r.sh.supplierId, r.supplier])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const destinations = [...new Set(rows.map((r) => r.sh.route.portOfDischarge))].sort();

  const q = filters.query.trim().toLowerCase();
  const visible = rows
    .filter(({ sh, st, supplier }) => {
      const hay = [sh.id, sh.orderId, supplier, sh.cargo.product, sh.route.origin, sh.route.portOfLoading, sh.route.portOfDischarge, sh.route.finalDelivery, st.booking.reference ?? ""];
      if (q && !hay.some((v) => v.toLowerCase().includes(q))) return false;
      if (filters.stage && st.stage !== filters.stage) return false;
      if (filters.status && st.status !== filters.status) return false;
      if (filters.supplier && sh.supplierId !== filters.supplier) return false;
      if (filters.mode && sh.route.mode !== filters.mode) return false;
      if (filters.destination && sh.route.portOfDischarge !== filters.destination) return false;
      return true;
    })
    .toSorted((a, b) => {
      switch (filters.sort) {
        case "eta":
          return a.st.schedule.eta.localeCompare(b.st.schedule.eta);
        case "etd":
          return a.st.schedule.etd.localeCompare(b.st.schedule.etd);
        case "supplier":
          return a.supplier.localeCompare(b.supplier);
        case "id":
          return a.sh.id.localeCompare(b.sh.id);
        default:
          return b.st.updatedAt.localeCompare(a.st.updatedAt);
      }
    });
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const count = (pred: (r: Row) => boolean) => rows.filter(pred).length;
  const summary = [
    { label: "Preparing", value: count((r) => r.st.status === "preparing") },
    { label: "Ready to Ship", value: count((r) => r.st.status === "ready-to-ship" || r.st.status === "at-origin") },
    { label: "In Transit", value: count((r) => r.st.status === "in-transit") },
    { label: "Arriving Soon", value: count((r) => isArrivingSoon(r.st)) },
    { label: "Customs", value: count((r) => r.st.status === "arrived" || r.st.status === "customs") },
    { label: "Delivered", value: count((r) => r.st.status === "delivered") },
  ];

  return (
    <div className="space-y-6">
      <ImporterPageHeader title="Shipments" description="Plan, prepare and track your inbound shipments." />

      <section aria-label="Shipment summary">
        <dl className="grid grid-cols-3 overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-6">
          {summary.map((s, i) => (
            <div key={s.label} className={`flex flex-col border-line px-4 py-3 ${i % 3 ? "border-l" : ""} ${i >= 3 ? "border-t lg:border-t-0" : ""} ${i === 3 ? "lg:border-l" : ""}`}>
              <dt className="text-xs font-medium text-ink-muted">{s.label}</dt>
              <dd className="order-first text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-faint">Arriving Soon: in transit with a planned ETA within 7 days. Dates are planned — no live tracking is connected.</p>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
          <p className="font-semibold text-ink">No shipments yet.</p>
          <p className="mt-1 text-sm text-ink-muted">Shipments are created from confirmed supplier orders.</p>
        </div>
      ) : (
        <section aria-labelledby="shipments-heading" className="rounded-2xl border border-line bg-surface">
          <h2 id="shipments-heading" className="sr-only">Shipments</h2>
          <form role="search" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3 2xl:grid-cols-[minmax(0,1.4fr)_repeat(6,minmax(0,1fr))]">
            <div className="relative sm:col-span-2 lg:col-span-3 2xl:col-span-1">
              <label htmlFor="shipment-search" className="sr-only">Search shipments</label>
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <input
                id="shipment-search"
                type="search"
                value={filters.query}
                onChange={(e) => set("query", e.target.value)}
                placeholder="Search shipments, orders, ports, bookings…"
                className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20"
              />
            </div>
            <Select label="Stage" value={filters.stage} onChange={(v) => set("stage", v)} any="All stages" options={SHIPMENT_STAGES.filter((s) => s.id !== "planning").map((s) => [s.id, s.label])} />
            <Select label="Status" value={filters.status} onChange={(v) => set("status", v)} any="All statuses" options={SHIPMENT_STATUSES.map((s) => [s.id, s.label])} />
            <Select label="Supplier" value={filters.supplier} onChange={(v) => set("supplier", v)} any="All suppliers" options={suppliers} />
            <Select label="Transport mode" value={filters.mode} onChange={(v) => set("mode", v)} any="All modes" options={TRANSPORT_MODES.map((m) => [m.id, m.label])} />
            <Select label="Destination" value={filters.destination} onChange={(v) => set("destination", v)} any="All destinations" options={destinations.map((d) => [d, d])} />
            <Select label="Sort by" value={filters.sort} onChange={(v) => set("sort", v as SortId)} options={SORTS.map((s) => [s.id, `Sort: ${s.label.toLowerCase()}`])} />
          </form>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-ink-muted sm:px-5">
            <p role="status">{visible.length} of {rows.length} shipments</p>
            {filtered && (
              <button type="button" onClick={() => setFilters(NO_FILTERS)} className={`inline-flex items-center gap-1 rounded-md font-medium text-teal hover:underline ${focusRing}`}>
                <X aria-hidden className="size-3.5" />
                Clear filters
              </button>
            )}
          </div>
          {visible.length === 0 ? (
            <p className="border-t border-line px-6 py-14 text-center text-sm text-ink-muted">No shipments match your current filters.</p>
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

function Route({ sh }: { sh: Shipment }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      {sh.route.portOfLoading}
      <ArrowRight aria-hidden className="size-3.5 text-ink-faint" />
      <span className="sr-only">to</span>
      {sh.route.portOfDischarge}
    </span>
  );
}

function Table({ rows }: { rows: Row[] }) {
  const heads = ["Shipment / Order", "Supplier", "Product", "Route", "Mode", "ETD", "ETA", "Stage", "Status", "Next action"];
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
          {rows.map(({ sh, st, supplier, next }) => (
            <tr key={sh.id} className="group relative transition-colors hover:bg-teal-soft/50 focus-within:bg-teal-soft/50">
              <th scope="row" className="whitespace-nowrap py-3.5 pl-5 pr-3 font-normal">
                <Link
                  href={importerHref(`shipments/${sh.id}`)}
                  className="font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                >
                  <ImportId id={sh.id} />
                </Link>
                <ImportId id={sh.orderId} className="block text-xs text-ink-faint" />
              </th>
              <td className="px-3 py-3.5 font-medium text-ink">{supplier}</td>
              <td className="px-3 py-3.5 text-ink">{sh.cargo.product}</td>
              <td className="px-3 py-3.5 text-ink-muted"><Route sh={sh} /></td>
              <td className="px-3 py-3.5 text-ink-muted">{modeLabel(sh.route.mode)}</td>
              <td className="whitespace-nowrap px-3 py-3.5 text-ink">{formatDate(st.schedule.etd)}</td>
              <td className="whitespace-nowrap px-3 py-3.5 text-ink">{formatDate(st.schedule.eta)}</td>
              <td className="px-3 py-3.5 text-ink-muted">{stageLabel(st.stage)}</td>
              <td className="px-3 py-3.5"><ShipmentStatusBadge status={st.status} /></td>
              <td className="py-3.5 pl-3 pr-5 text-ink-muted">{next}</td>
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
      {rows.map(({ sh, st, supplier, next }) => (
        <li key={sh.id}>
          <Link href={importerHref(`shipments/${sh.id}`)} className={`block h-full rounded-xl border border-line p-4 transition hover:border-teal/40 hover:bg-teal-soft/40 ${focusRing}`}>
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <ImportId id={sh.id} className="block text-ink-muted" />
                <span className="mt-0.5 block break-words font-semibold text-ink">{sh.cargo.product}</span>
                <span className="block break-words text-sm text-ink-muted">{supplier}</span>
              </span>
              <ShipmentStatusBadge status={st.status} />
            </span>
            <span className="mt-3 block text-sm text-ink"><Route sh={sh} /> <span className="text-ink-faint">· {modeLabel(sh.route.mode)}</span></span>
            <span className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span><span className="block text-xs text-ink-faint">ETD</span><span className="text-ink">{formatDate(st.schedule.etd)}</span></span>
              <span><span className="block text-xs text-ink-faint">ETA</span><span className="text-ink">{formatDate(st.schedule.eta)}</span></span>
            </span>
            <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-muted">
              <span>Next: {next}</span>
              <ArrowRight aria-hidden className="size-4 shrink-0" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
