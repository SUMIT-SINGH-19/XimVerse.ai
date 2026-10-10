"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, SearchX } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { focusRing } from "@/components/workspace/styles";
import { Select } from "@/components/exporter/products/catalogue-filters";
import { qtyText, valueText } from "@/components/exporter/deals/deal-ui";
import { exporterHref } from "@/lib/exporter-nav";
import { findOpportunity, shortCountry } from "@/lib/exporter-opportunities";
import { formatCompactMoney } from "@/lib/exporter-quotation-pipeline";
import {
  actionsRequired,
  isActiveOrder,
  ORDER_STATUS_LABEL,
  orderValueMinor,
  readinessScore,
  type ExporterOrder,
  type OrderState,
  type OrderStatus,
} from "@/lib/exporter-orders";
import { useExporterOrders } from "@/lib/exporter-order-store";
import { useExporterShipments } from "@/lib/exporter-shipment-store";
import { orderStateWithShipments } from "@/lib/exporter-shipments";
import type { Currency } from "@/lib/import-requirements";
import { OrderStatusPill, ProgressBar } from "./order-ui";

interface Row {
  o: ExporterOrder;
  s: OrderState;
  readiness: number;
  actions: string[];
  destination: string;
}

type Sort = "attention" | "newest" | "value" | "delivery" | "progress";

const th = "whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint first:pl-5 last:pr-4";
const td = "px-2.5 py-3.5 align-top first:pl-5 last:pr-4";

/** Seeded orders plus orders created in this browser. */
export function OrdersList() {
  const orders = useExporterOrders();
  const shipments = useExporterShipments();
  const rows = useMemo<Row[]>(
    () =>
      orders.map((o) => {
        const s = orderStateWithShipments(o, shipments);
        const opp = findOpportunity(o.requirementId);
        return { o, s, readiness: readinessScore(o, s), actions: actionsRequired(o, s), destination: opp ? shortCountry(opp.delivery.destinationCountry) : "—" };
      }),
    [orders, shipments],
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [stage, setStage] = useState("");
  const [destination, setDestination] = useState("");
  const [currency, setCurrency] = useState<Currency | "">("");
  const [attention, setAttention] = useState<"" | "yes">("");
  const [sort, setSort] = useState<Sort>("attention");

  const active = rows.filter((r) => isActiveOrder(r.s.status));
  const totals: Partial<Record<Currency, number>> = {};
  for (const r of active) totals[r.o.terms.currency] = (totals[r.o.terms.currency] ?? 0) + orderValueMinor(r.o);

  const q = query.trim().toLowerCase();
  const cmp: Record<Sort, (a: Row, b: Row) => number> = {
    attention: (a, b) => b.actions.length - a.actions.length || a.readiness - b.readiness,
    newest: (a, b) => b.o.createdAt.localeCompare(a.o.createdAt),
    value: (a, b) => a.o.terms.currency.localeCompare(b.o.terms.currency) || orderValueMinor(b.o) - orderValueMinor(a.o),
    delivery: (a, b) => (a.o.terms.estimatedDelivery ?? "9999").localeCompare(b.o.terms.estimatedDelivery ?? "9999"),
    progress: (a, b) => b.readiness - a.readiness,
  };
  const visible = rows
    .filter(
      (r) =>
        (!q || [r.o.id, r.o.dealId, r.o.requirementId, r.o.terms.productName, r.destination].some((x) => x.toLowerCase().includes(q))) &&
        (!status || r.s.status === status) &&
        (!stage || r.s.stage === stage) &&
        (!destination || r.destination === destination) &&
        (!currency || r.o.terms.currency === currency) &&
        (!attention || r.actions.length > 0),
    )
    .sort(cmp[sort]);
  const uniq = (xs: string[]) => [...new Set(xs)].sort();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="Orders" description="Execute confirmed deals across production, documentation, payment and shipment readiness." />

      <ul aria-label="Order summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Active Orders", value: active.length },
          { label: "In Production", value: rows.filter((r) => r.s.status === "production").length },
          { label: "Pre-Shipment Ready", value: rows.filter((r) => r.s.status === "ready-to-ship").length },
          { label: "Needs Attention", value: active.filter((r) => r.actions.length > 0).length, alert: true },
        ].map((m) => (
          <li key={m.label} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
            <span className="text-sm font-medium text-ink-muted">{m.label}</span>
            <span className={`mt-1.5 text-2xl font-bold tabular-nums ${m.alert && m.value > 0 ? "text-orange" : "text-ink"}`}>{m.value}</span>
          </li>
        ))}
        <li className="col-span-2 flex flex-col rounded-2xl border border-line bg-surface p-4 sm:col-span-1">
          <span className="text-sm font-medium text-ink-muted">Order Value</span>
          <ul className="mt-1.5 space-y-0.5">
            {(Object.entries(totals) as [Currency, number][]).map(([c, minor]) => (
              <li key={c} className="text-xl font-bold tabular-nums text-ink">
                {formatCompactMoney(minor, c)} <span className="text-xs font-medium text-ink-faint">{c}</span>
              </li>
            ))}
          </ul>
          <span className="mt-0.5 text-xs text-ink-muted">Active orders, per currency</span>
        </li>
      </ul>

      <section aria-labelledby="orders-heading" className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <h2 id="orders-heading" className="text-base font-semibold tracking-tight text-ink">
            Orders <span className="ml-2 text-sm font-normal text-ink-muted">{visible.length} of {rows.length}</span>
          </h2>
          <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 rounded-lg border border-line bg-canvas px-2 text-sm text-ink focus:border-teal focus:outline-none">
              <option value="attention">Needs Attention</option>
              <option value="newest">Newest</option>
              <option value="value">Highest Value (per currency)</option>
              <option value="delivery">Closest Delivery</option>
              <option value="progress">Execution Progress</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-3 sm:px-6 xl:grid-cols-6">
          <label className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-3 xl:col-span-1">
            <span className="text-xs font-medium text-ink-faint">Search</span>
            <span className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ORD, DL, RFQ, product…" className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-2.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20" />
            </span>
          </label>
          <Select label="Status" value={status} onChange={setStatus} options={(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((x) => ({ value: x, label: ORDER_STATUS_LABEL[x] }))} allLabel="All statuses" />
          <Select label="Stage" value={stage} onChange={setStage} options={uniq(rows.map((r) => r.s.stage)).map((x) => ({ value: x, label: x }))} allLabel="All stages" />
          <Select label="Destination" value={destination} onChange={setDestination} options={uniq(rows.map((r) => r.destination)).map((x) => ({ value: x, label: x }))} allLabel="All destinations" />
          <Select label="Currency" value={currency} onChange={(v) => setCurrency(v as Currency | "")} options={uniq(rows.map((r) => r.o.terms.currency)).map((x) => ({ value: x, label: x }))} allLabel="All currencies" />
          <Select label="Attention" value={attention} onChange={setAttention} options={[{ value: "yes", label: "Needs attention" }]} allLabel="All orders" />
        </div>

        {visible.length === 0 ? (
          <div className="border-t border-line px-6 py-14 text-center">
            <SearchX className="mx-auto size-8 text-ink-faint" aria-hidden />
            <p className="mt-3 font-semibold text-ink">No orders match these filters</p>
          </div>
        ) : (
          <>
            <div className="relative hidden overflow-x-auto xl:block">
              {/* Columns marked 2xl wait for room beside the sidebar; their data folds into a neighbouring cell until then. */}
              <table className="w-full text-sm">
                <thead className="border-y border-line bg-canvas/60">
                  <tr>
                    <th scope="col" className={th}>Order</th>
                    <th scope="col" className={th}>Product / Destination</th>
                    <th scope="col" className={`${th} text-right! hidden 2xl:table-cell`}>Quantity</th>
                    <th scope="col" className={`${th} text-right!`}>Contract Value</th>
                    <th scope="col" className={th}>Stage / Status</th>
                    <th scope="col" className={`${th} hidden 2xl:table-cell`}>Production</th>
                    <th scope="col" className={th}>Pre-Shipment</th>
                    <th scope="col" className={th}><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((r) => (
                    <tr key={r.o.id} className="transition-colors hover:bg-canvas/50">
                      <td className={td}>
                        <p className="whitespace-nowrap font-mono text-xs font-semibold text-ink">{r.o.id}</p>
                        <p className="mt-0.5 whitespace-nowrap font-mono text-xs text-ink-muted">{r.o.dealId}</p>
                      </td>
                      <td className={`${td} max-w-44`}>
                        <p className="font-semibold text-ink">{r.o.terms.productName}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">{r.destination}</p>
                      </td>
                      <td className={`${td} hidden 2xl:table-cell whitespace-nowrap text-right tabular-nums text-ink`}>
                        {qtyText(r.o.terms)}
                        {r.s.quantities.allocated > 0 && <p className="mt-0.5 text-xs text-ink-muted">{r.s.quantities.allocated.toLocaleString("en-US")} allocated</p>}
                      </td>
                      <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums text-ink`}>
                        {valueText(r.o.terms)}
                        <p className="mt-0.5 text-xs font-normal text-ink-muted 2xl:hidden">{qtyText(r.o.terms)}</p>
                      </td>
                      <td className={td}>
                        <p className="whitespace-nowrap text-ink">{r.s.stage}</p>
                        <span className="mt-1 block"><OrderStatusPill status={r.s.status} /></span>
                        {r.actions.length > 0 && <span className="mt-1 block text-xs text-orange">{r.actions.length} to do</span>}
                      </td>
                      <td className={`${td} hidden 2xl:table-cell w-24`}><span className="text-xs tabular-nums text-ink">{r.s.production.progress}%</span><ProgressBar value={r.s.production.progress} label="Production" /></td>
                      <td className={`${td} w-24`}><span className="text-xs tabular-nums text-ink">{r.readiness}%</span><ProgressBar value={r.readiness} label="Pre-shipment readiness" /></td>
                      <td className={`${td} text-right`}>
                        <Link href={exporterHref(`orders/${r.o.id}`)} aria-label={`View order ${r.o.id}`} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-teal hover:border-teal hover:bg-teal-soft ${focusRing}`}>
                          View
                          <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 md:grid-cols-2 xl:hidden">
              {visible.map((r) => (
                <li key={r.o.id} className="flex flex-col rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-ink">{r.o.id}</p>
                      <p className="mt-1 font-semibold text-ink">{r.o.terms.productName}</p>
                    </div>
                    <OrderStatusPill status={r.s.status} />
                  </div>
                  <dl className="mb-3 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div><dt className="text-xs text-ink-faint">Value</dt><dd className="font-semibold tabular-nums text-ink">{valueText(r.o.terms)}</dd></div>
                    <div><dt className="text-xs text-ink-faint">Quantity</dt><dd className="tabular-nums text-ink">{qtyText(r.o.terms)}</dd></div>
                    <div><dt className="text-xs text-ink-faint">Stage</dt><dd className="text-ink">{r.s.stage}</dd></div>
                    <div><dt className="text-xs text-ink-faint">Pre-shipment</dt><dd><span className="text-xs tabular-nums text-ink">{r.readiness}%</span><ProgressBar value={r.readiness} label="Pre-shipment readiness" /></dd></div>
                  </dl>
                  {r.actions[0] && <p className="mb-3 text-xs text-orange">Next: {r.actions[0]}</p>}
                  <Link href={exporterHref(`orders/${r.o.id}`)} className={`mt-auto inline-flex items-center justify-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-teal hover:border-teal hover:bg-teal-soft ${focusRing}`}>
                    View Order
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
