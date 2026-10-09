"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Check, FileSearch, FileText, FlaskConical, Info, Lock, Send, Truck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref, PLACEHOLDER_IMPORTER } from "@/lib/importer-nav";
import {
  formatOrderQuantity,
  formatOrderUnitPrice,
  formatOrderValue,
  ORDER_EVENT_LABEL,
  orderStatus,
  preShipmentReadiness,
  type Order,
  type OrderStatus,
} from "@/lib/importer-orders";
import { SUPPLIER_TYPE_LABEL, findSupplier } from "@/lib/importer-suppliers";
import { ImportId, Panel } from "../dashboard/dashboard-ui";
import { Dialog } from "../negotiations/negotiation-ui";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { supplierHref } from "../suppliers/supplier-links";
import { focusRing, ghostButton, primaryButton, secondaryButton } from "../styles";
import { cancelOrder, markPoIssued, moveToPreShipment, simulateSupplierConfirmation, useOrders, useOrdersLoaded } from "./order-store";
import { OrderStatusBadge, ReadinessBadge } from "./order-ui";
import { shipmentForOrder, shipmentState, shipmentStatusLabel } from "@/lib/importer-shipments";
import { useShipments } from "../shipments/shipment-store";
import { OrderShipmentPanel } from "../shipments/shipment-ui";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;
const textLink = `inline-flex items-center gap-1 rounded text-sm font-semibold text-teal hover:underline ${focusRing}`;

export function OrderDetail({ id }: { id: string }) {
  const orders = useOrders();
  const loaded = useOrdersLoaded();
  const order = orders.find((o) => o.id === id);
  if (!order) {
    if (!loaded) return <p className="py-16 text-center text-sm text-ink-muted">Loading order…</p>;
    return <OrderNotFound id={id} />;
  }
  return <Workspace o={order} />;
}

export function OrderNotFound({ id }: { id: string }) {
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-canvas text-ink-faint">
        <FileSearch className="size-6" />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Order not found</h1>
      <p className="mt-2 text-sm text-ink-muted">
        There&apos;s no order <ImportId id={id} className="text-ink" /> in this browser tab. Orders you create are kept in this tab&apos;s session only.
      </p>
      <Link href={importerHref("orders")} className={`${secondaryButton} mt-6`}>
        <ArrowLeft aria-hidden className="size-4" />
        Back to Orders
      </Link>
    </div>
  );
}

function Workspace({ o }: { o: Order }) {
  const status = orderStatus(o);
  const supplier = findSupplier(o.supplierId)!;
  const t = o.terms;
  const po = o.purchaseOrder;
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const confirmation = o.events.find((e) => e.type === "supplier-confirmed");
  const shipment = shipmentForOrder(o.id, useShipments());

  return (
    <div className="space-y-6">
      <div>
        <Link href={importerHref("orders")} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Orders
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ImportId id={o.id} className="text-ink-muted" />
          <span className="text-xs text-ink-faint">PO <ImportId id={po.number} className="text-xs text-ink-muted" /></span>
          <OrderStatusBadge status={status} />
        </div>
        <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
              {t.productName}
              <span className="font-semibold text-ink-muted"> from {supplier.name}</span>
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Ordered {formatDate(po.issueDate)} · Required by {formatDate(po.requiredBy)} ·{" "}
              <span className="font-semibold text-ink">{formatOrderValue(t)}</span>
            </p>
          </div>
          <Link href={importerHref(`orders/${o.id}/purchase-order`)} className={`${secondaryButton} self-start lg:self-auto`}>
            <FileText aria-hidden className="size-4" />
            Preview Purchase Order
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Link href={importerHref(`rfqs/${o.requirementId}`)} className={textLink}>View Requirement</Link>
          <Link href={importerHref(`quotations/${o.quotationId}`)} className={textLink}>View Quotation</Link>
          <Link href={importerHref(`negotiations/${o.negotiationId}`)} className={textLink}>View Negotiation</Link>
          <Link href={supplierHref(o.supplierId)} className={textLink}>View Supplier</Link>
        </div>
      </div>

      <Lifecycle status={status} shipmentLabel={shipment ? `${shipment.id} · ${shipmentStatusLabel(shipmentState(shipment).status)}` : undefined} />

      <OrderShipmentPanel order={o} />

      <NextActions
        status={status}
        onIssue={() => markPoIssued(o.id)}
        onConfirm={() => simulateSupplierConfirmation(o.id)}
        onPreShipment={() => moveToPreShipment(o.id)}
        onCancel={() => setCancelling(true)}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Panel id="agreed-terms" title="Agreed Commercial Terms" description={`Fixed copy taken from the agreement on ${formatDate(t.agreedAt)}. Not affected by later changes.`}>
            <div className="px-5 pb-5 pt-3 sm:px-6">
              <Facts
                rows={[
                  ["Product", t.productName],
                  ["Specification", t.specification, true],
                  ["Quantity", formatOrderQuantity(t)],
                  ["Unit", t.quantity.unit],
                  ["Unit price", formatOrderUnitPrice(t)],
                  ["Currency", t.currency],
                  ["Total value", formatOrderValue(t)],
                  ["Incoterm", t.incoterm],
                  ["Named place", t.namedPlace],
                  ["Payment terms", t.paymentSummary],
                  ["Lead time", `${t.leadTimeDays} days`],
                  ["HS code", t.hsCode ?? "—"],
                  ["Packaging", t.packaging ?? "—", true],
                  ["Inspection", t.inspection ?? "—", true],
                  ...(t.commercialNote ? ([["Agreed commercial note", t.commercialNote, true]] as [string, string, boolean][]) : []),
                ]}
              />
            </div>
          </Panel>

          <Panel
            id="purchase-order"
            title="Purchase Order"
            action={
              <Link href={importerHref(`orders/${o.id}/purchase-order`)} className={`${textLink} shrink-0`}>
                Preview Purchase Order
              </Link>
            }
          >
            <div className="px-5 pb-5 pt-3 sm:px-6">
              <Facts
                rows={[
                  ["PO number", po.number],
                  ["Issue date", formatDate(po.issueDate)],
                  ["Buyer", PLACEHOLDER_IMPORTER.company],
                  ["Supplier", supplier.legalName],
                  ["Product", t.productName],
                  ["Quantity", formatOrderQuantity(t)],
                  ["Unit price", formatOrderUnitPrice(t)],
                  ["Total", formatOrderValue(t)],
                  ["Incoterm", `${t.incoterm} ${t.namedPlace}`],
                  ["Payment terms", t.paymentSummary],
                  ["Required by", formatDate(po.requiredBy)],
                  ["Buyer reference", po.buyerReference ?? "—"],
                  ["Delivery address", po.deliveryAddress, true],
                  ["Buyer instructions", po.buyerInstructions ?? "—", true],
                  ["Supplier instructions", po.supplierInstructions ?? "—", true],
                  ["Additional terms", po.additionalTerms ?? "—", true],
                  ...(po.internalReference ? ([["Internal reference (not on PO)", po.internalReference]] as [string, string][]) : []),
                ]}
              />
            </div>
          </Panel>

          <Panel id="readiness" title="Pre-Shipment Readiness" description="Summary only — these workflows are not built yet.">
            <ul className="divide-y divide-line px-5 pb-3 pt-1 sm:px-6">
              {preShipmentReadiness(o).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-ink">{item.label}</span>
                  <ReadinessBadge state={item.state} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel id="order-activity" title="Order Activity">
            <ol className="px-5 pb-5 pt-4 sm:px-6">
              {[...o.events].reverse().map((e, i, list) => (
                <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < list.length - 1 && <span aria-hidden className="absolute left-[3.5px] top-3 h-full w-px bg-line" />}
                  <span aria-hidden className={`relative mt-1.5 size-2 shrink-0 rounded-full ${e.type === "cancelled" ? "bg-ink-faint" : e.by === "supplier" ? "bg-teal" : "bg-orange"}`} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-medium text-ink">{ORDER_EVENT_LABEL[e.type]}</span>
                      {e.demo && <span className="rounded-full border border-orange/40 px-1.5 text-xs font-medium text-orange">Demo</span>}
                    </p>
                    <p className="text-xs text-ink-faint">
                      <time dateTime={e.at}>{formatDate(e.at)}</time> · {e.by === "importer" ? "You" : e.by === "supplier" ? "Supplier" : "XimVerse"}
                    </p>
                    {e.note && <p className="mt-0.5 text-sm text-ink-muted">{e.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel id="parties" title="Parties">
            <div className="space-y-5 px-5 pb-5 pt-3 sm:px-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Buyer</h3>
                <p className="mt-1 font-medium text-ink">{PLACEHOLDER_IMPORTER.company}</p>
                <p className="whitespace-pre-line text-sm text-ink-muted">{po.billingAddress}</p>
                <p className="mt-1 text-sm text-ink">{po.contact.name}</p>
                <p className="break-words text-sm text-ink-muted">{po.contact.email}</p>
                {po.contact.phone && <p className="text-sm text-ink-muted">{po.contact.phone}</p>}
              </div>
              <div className="border-t border-line pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Supplier</h3>
                <p className="mt-1 font-medium text-ink">
                  <Link href={supplierHref(supplier.id)} className={`rounded hover:text-teal hover:underline ${focusRing}`}>{supplier.name}</Link>
                </p>
                <p className="text-sm text-ink-muted">{supplier.city}, {supplier.country}</p>
                <p className="text-sm text-ink-muted">{SUPPLIER_TYPE_LABEL[supplier.type]}</p>
                <p className="mt-2 text-xs text-ink-faint">Demo supplier profile — not verified by XimVerse.</p>
              </div>
            </div>
          </Panel>

          <Panel id="confirmation" title="Supplier Confirmation">
            <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
              {confirmation ? (
                <p className="text-ink">
                  Recorded on {formatDate(confirmation.at)}
                  {confirmation.demo && <span className="ml-2 rounded-full border border-orange/40 px-1.5 text-xs font-medium text-orange">Demo</span>}
                </p>
              ) : (
                <p className="text-ink-muted">Supplier confirmation has not been recorded yet.</p>
              )}
            </div>
          </Panel>

          <SumitAnalysisCard
            id="sumit-order"
            heading="Ask SUMIT about this order"
            prompts={[
              "Summarize the agreed commercial terms.",
              "What needs to happen before shipment?",
              "Which documents will be needed?",
              "What is the current order value?",
              "What changed between the original quotation and this order?",
            ]}
            message="SUMIT order intelligence will be connected later. Nothing was analysed."
          />
        </div>
      </div>

      <Dialog id="cancel-order" open={cancelling} onClose={() => setCancelling(false)} title="Cancel this order?">
        <p className="text-sm text-ink-muted">
          The order and its purchase order will be marked as cancelled. The agreement stays in the negotiation history, and no
          new order can be created from it.
        </p>
        <label htmlFor="cancel-reason" className="mt-4 block text-sm font-medium text-ink">
          Reason <span className="text-xs font-normal text-ink-faint">Optional</span>
        </label>
        <input
          id="cancel-reason"
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
        />
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setCancelling(false)} className={secondaryButton}>Keep Order</button>
          <button
            type="button"
            onClick={() => {
              cancelOrder(o.id, reason.trim());
              setCancelling(false);
            }}
            className={`${secondaryButton} hover:border-orange/40 hover:bg-orange-soft hover:text-orange`}
          >
            <Ban aria-hidden className="size-4" />
            Cancel Order
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function Facts({ rows }: { rows: ([string, React.ReactNode] | [string, React.ReactNode, boolean])[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
      {rows.map(([label, value, wide]) => (
        <div key={label} className={wide ? "sm:col-span-2" : undefined}>
          <dt className="text-xs font-medium text-ink-faint">{label}</dt>
          <dd className="mt-1 whitespace-pre-line break-words text-sm text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const STAGES = [
  { id: "created", label: "Order Created" },
  { id: "po", label: "PO Ready" },
  { id: "confirmation", label: "Supplier Confirmation" },
  { id: "pre-shipment", label: "Pre-Shipment" },
  { id: "shipment", label: "Shipment" },
] as const;

function stageState(status: OrderStatus, stage: (typeof STAGES)[number]["id"]): "done" | "current" | "upcoming" | "future" {
  const order = ["created", "po", "confirmation", "pre-shipment", "shipment"];
  const currentIndex: Record<OrderStatus, number> = {
    "po-ready": 1,
    "awaiting-confirmation": 2,
    confirmed: 3,
    "pre-shipment": 3,
    completed: 5,
    cancelled: -1,
  };
  const i = order.indexOf(stage);
  const c = currentIndex[status];
  if (stage === "shipment" && status !== "completed") return "future";
  if (c === -1) return i === 0 ? "done" : "upcoming";
  // Confirmed: supplier confirmation is done and pre-shipment hasn't started.
  if (status === "confirmed" && stage === "pre-shipment") return "upcoming";
  if (i < c) return "done";
  if (i === c) return "current";
  return "upcoming";
}

function Lifecycle({ status, shipmentLabel }: { status: OrderStatus; shipmentLabel?: string }) {
  return (
    <section aria-labelledby="lifecycle" className="rounded-2xl border border-line bg-surface px-5 py-4 sm:px-6">
      <h2 id="lifecycle" className="sr-only">Order lifecycle</h2>
      {status === "cancelled" && (
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-muted">
          <Ban aria-hidden className="size-4" />
          This order was cancelled.
        </p>
      )}
      <ol className="grid grid-cols-1 gap-2 md:grid-cols-5 md:gap-0">
        {STAGES.map((stage, i) => {
          const state = stageState(status, stage.id);
          return (
            <li key={stage.id} className="relative flex items-center gap-3 md:flex-col md:items-start md:gap-2 md:pr-3">
              {i < STAGES.length - 1 && (
                <span aria-hidden className={`absolute hidden h-px md:left-6 md:top-3 md:block md:w-[calc(100%-1.5rem)] ${state === "done" ? "bg-teal" : "bg-line"}`} />
              )}
              <span
                aria-hidden
                className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  state === "done"
                    ? "bg-teal text-on-brand"
                    : state === "current"
                      ? "border-2 border-orange bg-surface text-orange"
                      : "border border-line bg-surface text-ink-faint"
                }`}
              >
                {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : stage.id === "shipment" ? <Truck className="size-3" /> : i + 1}
              </span>
              <span className="text-sm">
                <span className={state === "current" ? "font-semibold text-ink" : state === "done" ? "text-ink" : "text-ink-faint"}>{stage.label}</span>
                <span className="block text-xs text-ink-faint">
                  {stage.id === "shipment" && shipmentLabel
                    ? shipmentLabel
                    : state === "done"
                      ? "Done"
                      : state === "current"
                        ? "Current stage"
                        : state === "future"
                          ? "Not started"
                          : "Upcoming"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function NextActions({
  status,
  onIssue,
  onConfirm,
  onPreShipment,
  onCancel,
}: {
  status: OrderStatus;
  onIssue: () => void;
  onConfirm: () => void;
  onPreShipment: () => void;
  onCancel: () => void;
}) {
  if (status === "completed" || status === "cancelled") return null;
  const canConfirm = status === "po-ready" || status === "awaiting-confirmation";
  return (
    <section aria-label="Next actions" className="rounded-2xl border border-line bg-surface px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        {status === "po-ready" && (
          <button type="button" onClick={onIssue} className={`${primaryButton} h-auto min-h-11 w-full whitespace-normal py-2 text-center sm:w-auto`}>
            <Send aria-hidden className="size-4" />
            Mark PO as Issued
          </button>
        )}
        {canConfirm && (
          <button type="button" onClick={onConfirm} className={`${secondaryButton} h-auto min-h-11 w-full whitespace-normal py-2 text-center sm:w-auto`}>
            <FlaskConical aria-hidden className="size-4 text-orange" />
            Simulate Supplier Confirmation
            <span className="rounded-full border border-orange/40 px-1.5 text-xs text-orange">Demo</span>
          </button>
        )}
        {status === "confirmed" && (
          <button type="button" onClick={onPreShipment} className={`${primaryButton} h-auto min-h-11 w-full whitespace-normal py-2 text-center sm:w-auto`}>
            Move to Pre-Shipment
          </button>
        )}
        {status === "pre-shipment" && (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Lock aria-hidden className="size-4" />
            Shipment planning and tracking continue in the Shipment workspace.
          </p>
        )}
        <button type="button" onClick={onCancel} className={`${ghostButton} sm:ml-auto`}>
          Cancel Order
        </button>
      </div>
      <p className="mt-2 flex gap-2 text-xs text-ink-muted">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {status === "po-ready"
          ? "Marking the PO as issued records that you sent it outside XimVerse. "
          : ""}
        {canConfirm ? "Demo only — no supplier communication is sent." : "Changes are kept in this browser tab only."}
      </p>
    </section>
  );
}
