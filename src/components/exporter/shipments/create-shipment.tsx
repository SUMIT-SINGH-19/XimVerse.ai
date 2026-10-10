"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleAlert, Lock, Ship } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { Modal } from "@/components/exporter/products/modal";
import { FormField, input, invalidProps } from "@/components/exporter/quote/form-ui";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDate } from "@/lib/exporter-dashboard";
import { findOpportunity, UNIT_SHORT } from "@/lib/exporter-opportunities";
import { useExporterOrders } from "@/lib/exporter-order-store";
import { createShipment, useExporterShipments } from "@/lib/exporter-shipment-store";
import { useIsClient } from "@/lib/exporter-quotation-store";
import {
  orderStateWithShipments,
  setupDefaults,
  shipmentEligibility,
  shipmentsForOrder,
  TRANSPORT_MODE_LABEL,
  type ExporterShipment,
  type ShipmentRoute,
  type ShipmentType,
  type TransportMode,
} from "@/lib/exporter-shipments";
import type { ExporterOrder } from "@/lib/exporter-orders";

const primary = `inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange px-4 text-sm font-semibold text-on-brand shadow-sm shadow-orange/20 transition hover:brightness-95 disabled:opacity-50 ${focusRing}`;
const MODES = Object.keys(TRANSPORT_MODE_LABEL) as TransportMode[];

function SetupForm({ order, shipments }: { order: ExporterOrder; shipments: readonly ExporterShipment[] }) {
  const router = useRouter();
  const os = orderStateWithShipments(order, shipments);
  const eligibility = shipmentEligibility(order, os);
  const unit = UNIT_SHORT[order.terms.quantity.unit];
  const opp = findOpportunity(order.requirementId);
  // One setup form → one shipment: the key is the order plus how many shipments it had when the form opened.
  const [setupKey] = useState(() => `${order.id}#${shipmentsForOrder(order.id, shipments).length}`);
  const defaults = setupDefaults(order, eligibility.available);
  const [quantity, setQuantity] = useState(String(eligibility.available || ""));
  const [mode, setMode] = useState<TransportMode>(defaults.route.mode);
  const [shipmentType, setShipmentType] = useState<ShipmentType>("FCL");
  const [pol, setPol] = useState(defaults.route.portOfLoading);
  const [pod, setPod] = useState(defaults.route.portOfDischarge);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const q = Number(quantity);
  const qtyError = !(q > 0)
    ? "Enter a quantity greater than 0."
    : q > eligibility.available
      ? `Only ${eligibility.available.toLocaleString("en-US")} ${unit} is available.`
      : !/^\d+(\.\d{1,3})?$/.test(quantity.trim())
        ? "Up to 3 decimal places."
        : undefined;
  const partial = q > 0 && q < os.quantities.ordered;
  const after = Math.max(0, eligibility.available - (q > 0 ? q : 0));
  const route: ShipmentRoute = { ...defaults.route, mode, shipmentType: mode === "sea" || mode === "multimodal" ? shipmentType : undefined, portOfLoading: pol, portOfDischarge: pod };
  const cargo = setupDefaults(order, q > 0 ? q : 0).cargo;

  const create = () => {
    if (busy) return;
    setBusy(true);
    const r = createShipment(order, { quantity: q, route, cargo, setupKey });
    if (!r.ok) {
      setBusy(false);
      setReviewing(false);
      return setError(r.reason);
    }
    router.push(exporterHref(`shipments/${r.id}`));
  };

  const facts: [string, string][] = [
    ["Order", order.id],
    ["Product", order.terms.productName],
    ["Incoterm", `${order.terms.incoterm} ${order.terms.namedPlace}`],
    ["Origin", defaults.route.origin],
    ["Destination", opp?.delivery.destinationLocation ?? order.terms.namedPlace],
    ["Port of loading (order)", order.terms.portOfLoading ?? "—"],
    ["Delivery commitment", order.terms.estimatedDelivery ? formatDate(order.terms.estimatedDelivery) : "—"],
  ];

  return (
    <div className="space-y-6">
      <Link href={exporterHref(`orders/${order.id}`)} className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to Order
      </Link>
      <header className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange">Create Shipment</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">{order.terms.productName}</h1>
        <p className="mt-1 font-mono text-sm text-ink-muted">{order.id}</p>
      </header>

      {!eligibility.ok ? (
        <section className="rounded-2xl border border-orange/25 bg-orange-soft p-5">
          <p className="font-semibold text-ink">This order can&apos;t ship yet</p>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {eligibility.blockers.map((b) => (
              <li key={b} className="flex gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden />{b}</li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="min-w-0 space-y-6 xl:col-span-2">
            <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <h2 className="text-base font-semibold tracking-tight text-ink">Quantity</h2>
              <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
                {[
                  ["Order quantity", os.quantities.ordered],
                  ["Produced", os.quantities.produced],
                  ["Allocated", os.quantities.allocated],
                  ["Available", eligibility.available],
                ].map(([label, value]) => (
                  <div key={label as string} className="bg-surface px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-faint">{label}</dt>
                    <dd className={`mt-0.5 text-lg font-bold tabular-nums ${label === "Available" ? "text-teal" : "text-ink"}`}>{(value as number).toLocaleString("en-US")} {unit}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 grid items-end gap-4 sm:grid-cols-2">
                <FormField id="ship-qty" label={`This shipment (${unit})`} error={qtyError && quantity ? qtyError : undefined}>
                  <input id="ship-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${input} text-lg font-semibold tabular-nums`} {...invalidProps("ship-qty", qtyError && quantity ? qtyError : undefined)} />
                </FormField>
                <p className="pb-2 text-sm text-ink-muted">
                  Remaining after this shipment: <span className="font-semibold tabular-nums text-ink">{after.toLocaleString("en-US")} {unit}</span>
                  {partial && <span className="ml-2 rounded-full bg-orange-soft px-2 py-0.5 text-xs font-semibold text-orange">Partial Shipment</span>}
                </p>
              </div>
              <p className="mt-2 text-xs text-ink-faint">You don&apos;t need to plan every shipment now — allocate what&apos;s moving in this one.</p>
            </section>

            <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <h2 className="text-base font-semibold tracking-tight text-ink">Route</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FormField id="ship-mode" label="Mode">
                  <select id="ship-mode" value={mode} onChange={(e) => setMode(e.target.value as TransportMode)} className={input}>
                    {MODES.map((m) => <option key={m} value={m}>{TRANSPORT_MODE_LABEL[m]}</option>)}
                  </select>
                </FormField>
                {(mode === "sea" || mode === "multimodal") && (
                  <FormField id="ship-type" label="Shipment type">
                    <select id="ship-type" value={shipmentType} onChange={(e) => setShipmentType(e.target.value as ShipmentType)} className={input}>
                      <option value="FCL">FCL — full container</option>
                      <option value="LCL">LCL — consolidated</option>
                    </select>
                  </FormField>
                )}
                <FormField id="ship-pol" label="Port of loading">
                  <input id="ship-pol" value={pol} onChange={(e) => setPol(e.target.value)} className={input} />
                </FormField>
                <FormField id="ship-pod" label="Port of discharge">
                  <input id="ship-pod" value={pod} onChange={(e) => setPod(e.target.value)} className={input} />
                </FormField>
              </div>
              <p className="mt-2 text-xs text-ink-faint">Forwarder, carrier, booking and schedule are set up on the shipment after it&apos;s created.</p>
            </section>
          </div>

          <div className="min-w-0 space-y-6">
            <section className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-ink"><Lock className="size-4 text-ink-faint" aria-hidden />From the order</h2>
              <dl className="mt-3 space-y-1.5 text-sm">
                {facts.map(([l, v]) => (
                  <div key={l} className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{l}</dt>
                    <dd className="text-right font-medium text-ink [overflow-wrap:anywhere]">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-ink-faint">Read-only. A shipment never changes the order&apos;s terms or quantity.</p>
            </section>
            {eligibility.warnings.length > 0 && (
              <section className="rounded-2xl border border-orange/25 bg-orange-soft p-5">
                <p className="text-sm font-semibold text-ink">Outstanding (not blocking)</p>
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  {eligibility.warnings.map((w) => <li key={w}>• {w}</li>)}
                </ul>
              </section>
            )}
            {error && <p role="alert" className="rounded-xl bg-orange-soft px-4 py-3 text-sm text-ink">{error}</p>}
            <button type="button" disabled={Boolean(qtyError)} onClick={() => setReviewing(true)} className={`${primary} w-full`}>
              <Ship className="size-4" aria-hidden />
              Review Shipment
            </button>
          </div>
        </div>
      )}

      <Modal open={reviewing} onClose={() => setReviewing(false)} labelledBy="ship-review-title">
        <header className="border-b border-line px-5 py-4 sm:px-6">
          <h2 id="ship-review-title" className="text-lg font-bold tracking-tight text-ink">Review Shipment</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Allocates cargo from {order.id}. Demo: stored in this browser only.</p>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <dl className="divide-y divide-line rounded-xl border border-line">
            {([
              ["Order", order.id],
              ["Product", order.terms.productName],
              ["This shipment", `${q.toLocaleString("en-US")} ${unit}${partial ? " (partial)" : ""}`],
              ["Already allocated", `${os.quantities.allocated.toLocaleString("en-US")} ${unit}`],
              ["Remaining after", `${after.toLocaleString("en-US")} ${unit}`],
              ["Mode", `${TRANSPORT_MODE_LABEL[mode]}${route.shipmentType ? ` · ${route.shipmentType}` : ""}`],
              ["Route", `${pol} → ${pod}`],
            ] as [string, string][]).map(([l, v]) => (
              <div key={l} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <dt className="text-ink-muted">{l}</dt>
                <dd className="text-right font-medium text-ink [overflow-wrap:anywhere]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
          <button type="button" onClick={() => setReviewing(false)} className={`h-10 rounded-lg px-4 text-sm font-semibold text-ink-muted hover:bg-canvas hover:text-ink ${focusRing}`}>Cancel</button>
          <button type="button" disabled={busy} onClick={create} className={primary}>Create Shipment</button>
        </footer>
      </Modal>
    </div>
  );
}

/** Shipment setup for one order (seeded or created in this browser). */
export function CreateShipment({ orderId }: { orderId?: string }) {
  const isClient = useIsClient();
  const orders = useExporterOrders();
  const shipments = useExporterShipments();
  const order = orderId ? orders.find((o) => o.id === orderId) : undefined;

  if (order) return <SetupForm key={`${order.id}#${shipmentsForOrder(order.id, shipments).length}`} order={order} shipments={shipments} />;
  if (orderId && !isClient) return <p className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-sm text-ink-muted">Loading order…</p>;

  const eligible = orders.filter((o) => shipmentEligibility(o, orderStateWithShipments(o, shipments)).ok);
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange">Create Shipment</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-ink">{orderId ? `Order ${orderId} not found` : "Choose an order"}</h1>
        <p className="mt-1 text-sm text-ink-muted">A shipment always allocates cargo from an order.</p>
      </header>
      <ul className="space-y-2">
        {eligible.map((o) => (
          <li key={o.id}>
            <Link href={exporterHref(`shipments/new?order=${o.id}`)} className={`flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-teal ${focusRing}`}>
              <span><span className="font-mono font-semibold text-ink">{o.id}</span> · {o.terms.productName}</span>
              <span className="text-teal">Allocate →</span>
            </Link>
          </li>
        ))}
        {eligible.length === 0 && <li className="text-sm text-ink-muted">No orders currently have produced, unallocated cargo.</li>}
      </ul>
    </div>
  );
}
