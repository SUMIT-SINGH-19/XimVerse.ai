"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, SearchX } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { focusRing } from "@/components/workspace/styles";
import { Select } from "@/components/exporter/products/catalogue-filters";
import { ProgressBar } from "@/components/exporter/orders/order-ui";
import { exporterHref } from "@/lib/exporter-nav";
import { findOpportunity, shortCountry, UNIT_SHORT } from "@/lib/exporter-opportunities";
import { useExporterOrders } from "@/lib/exporter-order-store";
import { useExporterShipments } from "@/lib/exporter-shipment-store";
import type { ExporterOrder, OrderState } from "@/lib/exporter-orders";
import {
  customsReadiness,
  formatShortDate,
  freightReadiness,
  isActiveShipment,
  isArrivingSoon,
  isPreDeparture,
  nextAction,
  orderStateWithShipments,
  score,
  SHIPMENT_STATUS_LABEL,
  shipmentActions,
  shipmentStage,
  shipmentState,
  TRANSPORT_MODE_LABEL,
  type ExporterShipment,
  type ShipmentAction,
  type ShipmentPhase,
  type ShipmentState,
  type ShipmentStatus,
  type TransportMode,
} from "@/lib/exporter-shipments";
import { ShipmentStatusPill } from "./shipment-ui";

interface Row {
  sh: ExporterShipment;
  st: ShipmentState;
  order: ExporterOrder;
  os: OrderState;
  stage: { phase: ShipmentPhase; detail: string };
  customs: number;
  freight: number;
  actions: ShipmentAction[];
  next: ShipmentAction;
  destination: string;
}

type Sort = "attention" | "newest" | "departure" | "arrival" | "readiness";
type Bucket = "complete" | "partial" | "low";

const BUCKETS: readonly { value: Bucket; label: string }[] = [
  { value: "complete", label: "Complete (100%)" },
  { value: "partial", label: "In progress (50–99%)" },
  { value: "low", label: "Low (below 50%)" },
];
const bucket = (n: number): Bucket => (n === 100 ? "complete" : n >= 50 ? "partial" : "low");

const th = "whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint first:pl-5 last:pr-4";
const td = "px-2.5 py-3.5 align-top first:pl-5 last:pr-4";

/** Rows for shipments whose order is known in this browser. */
function buildRows(shipments: readonly ExporterShipment[], orders: readonly ExporterOrder[]): Row[] {
  return shipments.flatMap((sh) => {
    const order = orders.find((o) => o.id === sh.orderId);
    if (!order) return [];
    const st = shipmentState(sh);
    const os = orderStateWithShipments(order, shipments);
    const opp = findOpportunity(sh.requirementId);
    return [
      {
        sh,
        st,
        order,
        os,
        stage: shipmentStage(sh, st),
        customs: score(customsReadiness(sh, st, os)),
        freight: score(freightReadiness(sh, st, os)),
        actions: shipmentActions(sh, st, os),
        next: nextAction(sh, st, os),
        destination: opp ? shortCountry(opp.delivery.destinationCountry) : sh.route.finalDelivery,
      },
    ];
  });
}

function qty(r: Row) {
  return `${r.sh.allocation.quantity.toLocaleString("en-US")} ${UNIT_SHORT[r.sh.allocation.unit]}`;
}

function mode(r: Row) {
  return `${TRANSPORT_MODE_LABEL[r.sh.route.mode]}${r.sh.route.shipmentType ? ` · ${r.sh.route.shipmentType}` : ""}`;
}

function Schedule({ st }: { st: ShipmentState }) {
  const dep = st.schedule.atd ? `ATD ${formatShortDate(st.schedule.atd)}` : st.schedule.etd ? `ETD ${formatShortDate(st.schedule.etd)}` : "ETD —";
  const arr = st.schedule.ata ? `ATA ${formatShortDate(st.schedule.ata)}` : st.schedule.eta ? `ETA ${formatShortDate(st.schedule.eta)}` : "ETA —";
  return (
    <>
      <span className="block whitespace-nowrap">{dep}</span>
      <span className="block whitespace-nowrap text-ink-muted">{arr}</span>
    </>
  );
}

/** Seeded shipments plus shipments created in this browser. */
export function ShipmentsList() {
  const orders = useExporterOrders();
  const shipments = useExporterShipments();
  const rows = useMemo(() => buildRows(shipments, orders), [shipments, orders]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ShipmentStatus | "">("");
  const [modeFilter, setModeFilter] = useState<TransportMode | "">("");
  const [destination, setDestination] = useState("");
  const [customs, setCustoms] = useState<Bucket | "">("");
  const [freight, setFreight] = useState<Bucket | "">("");
  const [sort, setSort] = useState<Sort>("attention");

  const active = rows.filter((r) => isActiveShipment(r.st.status));
  const volume: Record<string, number> = {};
  for (const r of active) volume[UNIT_SHORT[r.sh.allocation.unit]] = (volume[UNIT_SHORT[r.sh.allocation.unit]] ?? 0) + r.sh.allocation.quantity;

  const kpis = [
    { label: "Active Shipments", value: active.length },
    { label: "Preparing", value: rows.filter((r) => r.st.status === "preparing" || r.st.status === "freight-setup").length },
    { label: "Customs / Origin", value: rows.filter((r) => isPreDeparture(r.st.status) && r.stage.phase !== "Setup").length },
    { label: "In Transit", value: rows.filter((r) => r.st.status === "in-transit").length },
    { label: "Arriving Soon", value: rows.filter((r) => isArrivingSoon(r.st)).length, hint: "ETA within 7 days" },
    { label: "Delivered", value: rows.filter((r) => r.st.status === "delivered").length },
  ];

  const q = query.trim().toLowerCase();
  const rank = (r: Row) => (isActiveShipment(r.st.status) ? 0 : 1);
  const cmp: Record<Sort, (a: Row, b: Row) => number> = {
    attention: (a, b) => rank(a) - rank(b) || b.actions.length - a.actions.length || a.customs - b.customs,
    newest: (a, b) => b.sh.createdAt.localeCompare(a.sh.createdAt),
    departure: (a, b) => {
      const key = (r: Row) => (isPreDeparture(r.st.status) && r.st.schedule.etd ? r.st.schedule.etd : "9999");
      return key(a).localeCompare(key(b));
    },
    arrival: (a, b) => {
      const key = (r: Row) => (!r.st.milestones.arrived && r.st.status !== "cancelled" && r.st.schedule.eta ? r.st.schedule.eta : "9999");
      return key(a).localeCompare(key(b));
    },
    readiness: (a, b) => rank(a) - rank(b) || Math.min(a.customs, a.freight) - Math.min(b.customs, b.freight),
  };
  const visible = rows
    .filter(
      (r) =>
        (!q ||
          [r.sh.id, r.sh.orderId, r.order.terms.productName, r.destination, r.sh.route.portOfDischarge, r.sh.route.finalDelivery, r.st.bookingReference ?? "", r.st.container.numbers ?? ""].some((x) =>
            x.toLowerCase().includes(q),
          )) &&
        (!status || r.st.status === status) &&
        (!modeFilter || r.sh.route.mode === modeFilter) &&
        (!destination || r.destination === destination) &&
        (!customs || bucket(r.customs) === customs) &&
        (!freight || bucket(r.freight) === freight),
    )
    .sort(cmp[sort]);
  const uniq = (xs: string[]) => [...new Set(xs)].sort();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="Shipments" description="Track cargo allocation, export clearance, freight and delivery across your orders." />

      <ul aria-label="Shipment summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {kpis.map((m) => (
          <li key={m.label} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
            <span className="text-sm font-medium text-ink-muted">{m.label}</span>
            <span className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{m.value}</span>
            {m.hint && <span className="mt-0.5 text-xs text-ink-faint">{m.hint}</span>}
          </li>
        ))}
        <li className="flex flex-col rounded-2xl border border-line bg-surface p-4">
          <span className="text-sm font-medium text-ink-muted">Volume</span>
          <ul className="mt-1.5 space-y-0.5">
            {Object.entries(volume).map(([unit, value]) => (
              <li key={unit} className="text-xl font-bold tabular-nums text-ink">
                {value.toLocaleString("en-US")} <span className="text-xs font-medium text-ink-faint">{unit}</span>
              </li>
            ))}
            {Object.keys(volume).length === 0 && <li className="text-xl font-bold text-ink">—</li>}
          </ul>
          <span className="mt-0.5 text-xs text-ink-faint">Active, per unit</span>
        </li>
      </ul>

      <section aria-labelledby="shipments-heading" className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <h2 id="shipments-heading" className="text-base font-semibold tracking-tight text-ink">
            Shipments <span className="ml-2 text-sm font-normal text-ink-muted">{visible.length} of {rows.length}</span>
          </h2>
          <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 rounded-lg border border-line bg-canvas px-2 text-sm text-ink focus:border-teal focus:outline-none">
              <option value="attention">Needs Attention</option>
              <option value="newest">Newest</option>
              <option value="departure">Upcoming Departure</option>
              <option value="arrival">Upcoming Arrival</option>
              <option value="readiness">Lowest Readiness</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-3 sm:px-6 xl:grid-cols-6">
          <label className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-3 xl:col-span-1">
            <span className="text-xs font-medium text-ink-faint">Search</span>
            <span className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="SHP, ORD, product, booking, container…"
                className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-2.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
              />
            </span>
          </label>
          <Select label="Status" value={status} onChange={setStatus} options={(Object.keys(SHIPMENT_STATUS_LABEL) as ShipmentStatus[]).map((x) => ({ value: x, label: SHIPMENT_STATUS_LABEL[x] }))} allLabel="All statuses" />
          <Select label="Mode" value={modeFilter} onChange={setModeFilter} options={(Object.keys(TRANSPORT_MODE_LABEL) as TransportMode[]).map((x) => ({ value: x, label: TRANSPORT_MODE_LABEL[x] }))} allLabel="All modes" />
          <Select label="Destination" value={destination} onChange={setDestination} options={uniq(rows.map((r) => r.destination)).map((x) => ({ value: x, label: x }))} allLabel="All destinations" />
          <Select label="Customs readiness" value={customs} onChange={setCustoms} options={BUCKETS} allLabel="Any" />
          <Select label="Freight readiness" value={freight} onChange={setFreight} options={BUCKETS} allLabel="Any" />
        </div>

        {visible.length === 0 ? (
          <div className="border-t border-line px-6 py-14 text-center">
            <SearchX className="mx-auto size-8 text-ink-faint" aria-hidden />
            <p className="mt-3 font-semibold text-ink">{rows.length ? "No shipments match these filters" : "No shipments yet"}</p>
            {!rows.length && (
              <p className="mt-1 text-sm text-ink-muted">
                Create one from an order with produced cargo —{" "}
                <Link href={exporterHref("orders")} className="font-semibold text-teal hover:text-ink">open Orders</Link>.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="relative hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[60rem] text-sm">
                <thead className="border-y border-line bg-canvas/60">
                  <tr>
                    <th scope="col" className={th}>Shipment · Order</th>
                    <th scope="col" className={th}>Product · Destination</th>
                    <th scope="col" className={th}>Quantity · Mode</th>
                    <th scope="col" className={th}>Stage</th>
                    <th scope="col" className={th}>ETD / ETA</th>
                    <th scope="col" className={th}>Customs Readiness</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={th}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((r) => (
                    <tr key={r.sh.id} className="transition-colors hover:bg-canvas/50">
                      <td className={td}>
                        <Link href={exporterHref(`shipments/${r.sh.id}`)} className={`whitespace-nowrap font-mono text-xs font-semibold text-ink hover:text-teal ${focusRing}`}>{r.sh.id}</Link>
                        <Link href={exporterHref(`orders/${r.sh.orderId}`)} className={`mt-0.5 block whitespace-nowrap font-mono text-xs text-ink-muted hover:text-teal ${focusRing}`}>{r.sh.orderId}</Link>
                      </td>
                      <td className={`${td} max-w-48`}>
                        <p className="font-semibold text-ink">{r.order.terms.productName}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">{r.destination} · {r.sh.route.portOfDischarge}</p>
                      </td>
                      <td className={td}>
                        <p className="whitespace-nowrap tabular-nums text-ink">{qty(r)}</p>
                        <p className="mt-0.5 whitespace-nowrap text-xs text-ink-muted">{mode(r)}</p>
                      </td>
                      <td className={`${td} max-w-44`}>
                        <p className="text-ink">{r.stage.phase}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">{r.stage.detail}</p>
                      </td>
                      <td className={`${td} text-xs tabular-nums text-ink`}><Schedule st={r.st} /></td>
                      <td className={`${td} w-28`}>
                        <span className="text-xs tabular-nums text-ink">{r.customs}%</span>
                        <ProgressBar value={r.customs} label={`${r.sh.id} customs readiness`} />
                        <span className="mt-1 block text-xs text-ink-faint">Freight {r.freight}%</span>
                      </td>
                      <td className={td}>
                        <ShipmentStatusPill status={r.st.status} />
                        {r.actions.length > 0 && <span className="mt-1 block text-xs text-orange">{r.actions.length} to do</span>}
                      </td>
                      <td className={`${td} max-w-44`}>
                        <p className="text-xs text-ink-muted">{r.next.text}</p>
                        <Link href={exporterHref(`shipments/${r.sh.id}`)} aria-label={`View shipment ${r.sh.id}`} className={`mt-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-teal hover:border-teal hover:bg-teal-soft ${focusRing}`}>
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
                <li key={r.sh.id} className="flex flex-col rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-ink">{r.sh.id}</p>
                      <p className="mt-1 font-semibold text-ink">{r.order.terms.productName}</p>
                    </div>
                    <ShipmentStatusPill status={r.st.status} />
                  </div>
                  <dl className="mb-3 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div><dt className="text-xs text-ink-faint">Quantity</dt><dd className="tabular-nums text-ink">{qty(r)}</dd></div>
                    <div><dt className="text-xs text-ink-faint">Destination</dt><dd className="text-ink">{r.destination}</dd></div>
                    <div><dt className="text-xs text-ink-faint">Stage</dt><dd className="text-ink">{r.stage.phase}</dd></div>
                    <div><dt className="text-xs text-ink-faint">ETD / ETA</dt><dd className="text-xs tabular-nums text-ink"><Schedule st={r.st} /></dd></div>
                    <div className="col-span-2">
                      <dt className="flex justify-between text-xs text-ink-faint"><span>Customs readiness</span><span className="tabular-nums text-ink">{r.customs}% · Freight {r.freight}%</span></dt>
                      <dd className="mt-1"><ProgressBar value={r.customs} label={`${r.sh.id} customs readiness`} /></dd>
                    </div>
                  </dl>
                  <p className={`mb-3 text-xs ${r.actions.length ? "text-orange" : "text-ink-muted"}`}>Next: {r.next.text}</p>
                  <Link href={exporterHref(`shipments/${r.sh.id}`)} className={`mt-auto inline-flex items-center justify-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-teal hover:border-teal hover:bg-teal-soft ${focusRing}`}>
                    View Shipment
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <p className="text-xs text-ink-faint">Demo: freight, customs and carrier states are recorded by hand. Nothing is filed on ICEGATE or booked with a carrier.</p>
    </div>
  );
}
