"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, CircleAlert, Info, ShieldCheck, Sparkles } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { Modal } from "@/components/exporter/products/modal";
import { textarea } from "@/components/exporter/quote/form-ui";
import { exporterHref } from "@/lib/exporter-nav";
import { findOpportunity, shortCountry, UNIT_SHORT } from "@/lib/exporter-opportunities";
import { findSeededDeal } from "@/lib/exporter-deals";
import { useExporterDeals } from "@/lib/exporter-deal-store";
import { useExporterOrders } from "@/lib/exporter-order-store";
import { useIsClient } from "@/lib/exporter-quotation-store";
import { cancelShipment, useExporterShipments } from "@/lib/exporter-shipment-store";
import {
  customsReadiness,
  formatShortDate,
  freightReadiness,
  isActiveShipment,
  nextAction,
  orderStateWithShipments,
  score,
  shipmentActions,
  shipmentInsights,
  shipmentStage,
  shipmentState,
  shippingBillIndex,
  TRANSPORT_MODE_LABEL,
  usesContainers,
  type ExporterShipment,
  type ShipmentAction,
} from "@/lib/exporter-shipments";
import { DemoTag, Meter, ReadinessList, ShipmentStatusPill } from "./shipment-ui";
import {
  Card,
  CargoSection,
  ClearanceSection,
  ContainerSection,
  DocumentsSection,
  FreightSection,
  HistorySection,
  InstructionsSection,
  TrackingSection,
  TransportDocumentSection,
  type ShipmentCtx,
} from "./shipment-sections";

const secondary = `inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition-colors hover:border-teal hover:bg-teal-soft disabled:opacity-50 ${focusRing}`;
const danger = `inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange px-4 text-sm font-semibold text-on-brand transition hover:brightness-95 disabled:opacity-50 ${focusRing}`;

function actionHref(a: ShipmentAction, orderId: string) {
  return a.section === "order" ? exporterHref(`orders/${orderId}`) : `#${a.section}`;
}

function ShipmentView({ c }: { c: ShipmentCtx }) {
  const { sh, st, order, os, access } = c;
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const unit = UNIT_SHORT[sh.allocation.unit];
  const opp = findOpportunity(sh.requirementId);
  const customs = customsReadiness(sh, st, os);
  const freight = freightReadiness(sh, st, os);
  const actions = shipmentActions(sh, st, os);
  const next = nextAction(sh, st, os);
  const stage = shipmentStage(sh, st);
  const partial = sh.allocation.quantity < os.quantities.ordered;
  const canCancel = isActiveShipment(st.status) && shippingBillIndex(st.shippingBill) < shippingBillIndex("filed") && Object.keys(st.milestones).length === 0;
  const departure = st.schedule.atd ? `ATD ${formatShortDate(st.schedule.atd)}` : st.schedule.etd ? `ETD ${formatShortDate(st.schedule.etd)}` : "ETD not set";
  const arrival = st.schedule.ata ? `ATA ${formatShortDate(st.schedule.ata)}` : st.schedule.eta ? `ETA ${formatShortDate(st.schedule.eta)}` : "ETA not set";

  const chain = [
    { label: "RFQ", id: sh.requirementId, href: exporterHref(`opportunities/${sh.requirementId}`) },
    { label: "Opportunity", id: sh.opportunityId, href: exporterHref(`opportunities/${sh.requirementId}`) },
    { label: "Quotation", id: sh.quotationId, href: exporterHref(`quotations/${sh.quotationId}`) },
    ...(sh.negotiationId ? [{ label: "Negotiation", id: sh.negotiationId, href: exporterHref(`negotiations/${sh.negotiationId}`) }] : []),
    { label: "Deal", id: sh.dealId, href: exporterHref(`deals/${sh.dealId}`) },
    { label: "Order", id: sh.orderId, href: exporterHref(`orders/${sh.orderId}`) },
    { label: "Shipment", id: sh.id },
  ];

  const confirmCancel = () => {
    const r = cancelShipment(sh.id, reason);
    if (!r.ok) return setCancelError(r.reason);
    setCancelError(null);
    setCancelling(false);
  };

  return (
    <div className="space-y-6">
      <Link href={exporterHref("shipments")} className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to Shipments
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm font-semibold text-ink">{sh.id}</p>
              <ShipmentStatusPill status={st.status} />
              <DemoTag />
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">{order.terms.productName}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              <span className="font-semibold tabular-nums text-ink">{sh.allocation.quantity.toLocaleString("en-US")} {unit}</span>
              {partial && <span> of {os.quantities.ordered.toLocaleString("en-US")} {unit} · Partial</span>}
              {" · "}{sh.route.finalDelivery}
              {" · "}{TRANSPORT_MODE_LABEL[sh.route.mode]}{sh.route.shipmentType ? ` ${sh.route.shipmentType}` : ""}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <dt className="text-xs text-ink-faint">Current stage</dt>
                <dd className="font-medium text-ink">{stage.phase}<span className="block text-xs font-normal text-ink-muted">{stage.detail}</span></dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Departure</dt>
                <dd className="tabular-nums text-ink">{departure}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Arrival</dt>
                <dd className="tabular-nums text-ink">{arrival}</dd>
              </div>
            </dl>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <Meter value={score(customs)} label="Customs readiness" />
            <Meter value={score(freight)} label="Freight readiness" />
            <a
              href={actionHref(next, order.id)}
              className={`mt-1 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${actions.length ? "bg-orange-soft hover:bg-orange-soft/70" : "bg-teal-soft hover:bg-teal-soft/70"} ${focusRing}`}
            >
              <span className="min-w-0">
                <span className={`block text-xs font-semibold uppercase tracking-[0.1em] ${actions.length ? "text-orange" : "text-teal"}`}>Next action</span>
                <span className="block font-medium text-ink">{next.text}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-ink-faint" aria-hidden />
            </a>
          </div>
        </div>
      </header>

      <p className="flex items-start gap-2 rounded-xl border border-orange/25 bg-orange-soft/60 px-4 py-3 text-sm text-ink">
        <Info className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden />
        <span>Demo execution record. Freight, customs and carrier states are recorded by hand — nothing is filed on ICEGATE, booked with a carrier or issued by customs.</span>
      </p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <CargoSection c={c} />
          {usesContainers(sh.route) && <ContainerSection c={c} />}
          <FreightSection c={c} />
          <InstructionsSection c={c} />
          <ClearanceSection c={c} />
          <TransportDocumentSection c={c} />
          <DocumentsSection c={c} />
          <TrackingSection c={c} />

          <Card title="Source Traceability">
            <ol className="flex flex-col items-start gap-1">
              {chain.map((x, i) => (
                <li key={x.id} className="flex flex-col items-start">
                  <span className="flex items-baseline gap-2">
                    <span className="w-24 text-xs text-ink-faint">{x.label}</span>
                    {x.href ? <Link href={x.href} className={`font-mono text-sm text-teal hover:text-ink ${focusRing}`}>{x.id}</Link> : <span className="font-mono text-sm font-semibold text-ink">{x.id}</span>}
                  </span>
                  {i < chain.length - 1 && <ArrowDown className="ml-26 size-3.5 text-ink-faint" aria-hidden />}
                </li>
              ))}
            </ol>
          </Card>

          <HistorySection c={c} />
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Customs Readiness" aside={<span className="text-lg font-bold tabular-nums text-teal">{score(customs)}%</span>}>
            <p className="-mt-2 mb-3 text-xs text-ink-faint">Readiness for export-clearance workflow. Separate from the order&apos;s pre-shipment readiness.</p>
            <ReadinessList items={customs} />
          </Card>

          <Card title="Freight Readiness" aside={<span className="text-lg font-bold tabular-nums text-teal">{score(freight)}%</span>}>
            <p className="-mt-2 mb-3 text-xs text-ink-faint">Readiness to move the cargo: parties, booking, schedule and instructions.</p>
            <ReadinessList items={freight} />
          </Card>

          <Card title="Action Required">
            {actions.length ? (
              <ul className="space-y-1.5">
                {actions.map((a) => (
                  <li key={a.text}>
                    <a href={actionHref(a, order.id)} className={`flex items-start gap-2 rounded-md text-sm text-ink hover:text-teal ${focusRing}`}>
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden />
                      {a.text}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-teal">Nothing outstanding.</p>
            )}
          </Card>

          <aside aria-label="SUMIT insight" className="rounded-2xl border border-teal/15 bg-teal-soft p-5">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal">
              <Sparkles className="size-3.5 text-orange" aria-hidden />
              SUMIT insight
            </p>
            <ul className="mt-2 space-y-2">
              {shipmentInsights(sh, st, order, os).map((x) => (
                <li key={x} className="text-sm leading-relaxed text-ink">{x}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">Rule-based, from this shipment&apos;s records.</p>
          </aside>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
              <ShieldCheck className="size-4 text-teal" aria-hidden />
              Buyer &amp; Consignee
            </h2>
            <p className="mt-2 text-sm font-medium text-ink">{access === "approved" || access === "shared" ? "Buyer access granted via Ximverse" : "Buyer identity protected by Ximverse"}</p>
            {opp && (
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Buyer market</dt><dd className="text-right text-ink">{opp.buyer.region} · {shortCountry(opp.buyer.country)}</dd></div>
                {opp.buyer.industry && <div className="flex justify-between gap-3"><dt className="text-ink-muted">Industry</dt><dd className="text-right text-ink">{opp.buyer.industry}</dd></div>}
              </dl>
            )}
            <p className="mt-3 text-xs text-ink-faint">Consignee, notify party, buyer contacts and addresses aren&apos;t stored on this shipment. Ximverse provides them to the forwarder.</p>
          </section>

          {canCancel && (
            <section className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="text-base font-semibold tracking-tight text-ink">Cancel Shipment</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Releases {sh.allocation.quantity.toLocaleString("en-US")} {unit} back to {order.id}. Possible until the Shipping Bill is filed and before any cargo movement.
              </p>
              <button type="button" onClick={() => setCancelling(true)} className={`${secondary} mt-3 w-full`}>Cancel Shipment</button>
            </section>
          )}
        </div>
      </div>

      <Modal open={cancelling} onClose={() => setCancelling(false)} labelledBy="cancel-shipment-title">
        <header className="border-b border-line px-5 py-4 sm:px-6">
          <h2 id="cancel-shipment-title" className="text-lg font-bold tracking-tight text-ink">Cancel {sh.id}?</h2>
          <p className="mt-0.5 text-sm text-ink-muted">The shipment stays in history as Cancelled and its {sh.allocation.quantity.toLocaleString("en-US")} {unit} return to {order.id}.</p>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <label className="text-sm font-medium text-ink">
            Reason
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${textarea} mt-1.5`} />
          </label>
          {cancelError && <p role="alert" className="mt-2 text-sm text-orange">{cancelError}</p>}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
          <button type="button" onClick={() => setCancelling(false)} className={`h-10 rounded-lg px-4 text-sm font-semibold text-ink-muted hover:bg-canvas hover:text-ink ${focusRing}`}>Keep Shipment</button>
          <button type="button" disabled={!reason.trim()} onClick={confirmCancel} className={danger}>Cancel Shipment</button>
        </footer>
      </Modal>
    </div>
  );
}

/** One shipment, with its order, deal access and sibling shipments resolved. */
export function ShipmentDetail({ shipment: sh }: { shipment: ExporterShipment }) {
  const isClient = useIsClient();
  const orders = useExporterOrders();
  const all = useExporterShipments();
  const deals = useExporterDeals();
  const order = orders.find((o) => o.id === sh.orderId);
  if (!order) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <p className="font-semibold text-ink">Order {sh.orderId} for {sh.id} isn&apos;t stored in this browser</p>
        <Link href={exporterHref("shipments")} className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to Shipments
        </Link>
      </div>
    );
  }
  const deal = deals.find((d) => d.id === sh.dealId) ?? findSeededDeal(sh.dealId);
  const c: ShipmentCtx = { sh, st: shipmentState(sh), order, os: orderStateWithShipments(order, all), all, access: deal?.counterpartyAccess };
  // Forms take their first values at mount; remount once this browser's stored events are in.
  return <ShipmentView key={isClient ? "client" : "server"} c={c} />;
}

/** Resolves a shipment (seeded or created in this browser). */
export function ShipmentById({ id }: { id: string }) {
  const isClient = useIsClient();
  const shipment = useExporterShipments().find((s) => s.id === id);
  if (shipment) return <ShipmentDetail shipment={shipment} />;
  if (!isClient) return <p className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-sm text-ink-muted">Loading shipment…</p>;
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
      <p className="font-semibold text-ink">Shipment {id} isn&apos;t stored in this browser</p>
      <p className="mt-1 text-sm text-ink-muted">Demo shipments live in the browser where they were created.</p>
      <Link href={exporterHref("shipments")} className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to Shipments
      </Link>
    </div>
  );
}
