"use client";

import Link from "next/link";
import { ArrowRight, Check, CircleCheck, Clock, Minus, Ship } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import { orderStatus, type Order } from "@/lib/importer-orders";
import {
  CUSTOMS_STATUS_LABEL,
  DOCUMENT_STATUS_LABEL,
  FREIGHT_STATUS_LABEL,
  READINESS_STATUS_LABEL,
  shipmentEligibility,
  shipmentForOrder,
  shipmentState,
  shipmentStatusLabel,
  type ReadinessStatus,
  type Shipment,
  type ShipmentEvent,
  type ShipmentStatus,
} from "@/lib/importer-shipments";
import { ImportId } from "../dashboard/dashboard-ui";
import { primaryButton, secondaryButton } from "../styles";
import { useShipments } from "./shipment-store";

const STATUS_STYLE: Record<ShipmentStatus, string> = {
  preparing: "border border-orange/40 text-orange",
  "ready-to-ship": "bg-teal-soft text-teal",
  "at-origin": "border border-teal/40 text-teal",
  "in-transit": "bg-teal text-on-brand",
  arrived: "bg-orange-soft text-orange",
  customs: "bg-orange-soft text-orange",
  delivered: "border border-line text-ink-muted",
};

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {status === "delivered" ? <Check aria-hidden className="size-3" strokeWidth={3} /> : <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {shipmentStatusLabel(status)}
    </span>
  );
}

const READY_ICON: Record<ReadinessStatus, { Icon: typeof Check; className: string }> = {
  complete: { Icon: CircleCheck, className: "text-teal" },
  pending: { Icon: Clock, className: "text-orange" },
  "not-started": { Icon: Minus, className: "text-ink-faint" },
  "not-required": { Icon: Minus, className: "text-ink-faint" },
};

export function ReadinessStatusBadge({ status }: { status: ReadinessStatus }) {
  const { Icon, className } = READY_ICON[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-sm ${status === "complete" ? "text-ink" : "text-ink-muted"}`}>
      <Icon aria-hidden className={`size-4 ${className}`} />
      {READINESS_STATUS_LABEL[status]}
    </span>
  );
}

const PARTY: Record<ShipmentEvent["by"], string> = {
  importer: "You",
  supplier: "Supplier",
  carrier: "Carrier",
  "customs-broker": "Customs broker",
  system: "XimVerse",
};

export function eventParty(e: ShipmentEvent): string {
  return PARTY[e.by];
}

/** A structured, human-readable line for an activity event. */
export function describeEvent(e: ShipmentEvent, s: Shipment): string {
  switch (e.type) {
    case "created":
      return "Shipment created";
    case "document-updated": {
      const label = s.documents.find((d) => d.id === e.document?.id)?.label ?? "Document";
      return `${label} marked ${DOCUMENT_STATUS_LABEL[e.document!.status].toLowerCase()}`;
    }
    case "booking-updated":
      return e.booking?.status === "booked"
        ? `Freight booked${e.booking.reference ? ` · ref. ${e.booking.reference}` : ""}`
        : `Freight booking: ${FREIGHT_STATUS_LABEL[e.booking!.status]}`;
    case "schedule-updated":
      return `Planned dates updated: ${Object.entries(e.schedule ?? {})
        .map(([k, v]) => `${k === "readyDate" ? "ready date" : k.toUpperCase()} ${formatDate(v as string)}`)
        .join(", ")}`;
    case "cargo-ready":
      return "Cargo marked ready";
    case "status-changed":
      return {
        preparing: "Shipment preparing",
        "ready-to-ship": "Shipment marked Ready to Ship",
        "at-origin": "Cargo handed to carrier",
        "in-transit": "Shipment departed origin",
        arrived: "Shipment arrived at destination",
        customs: "Customs clearance started",
        delivered: "Shipment delivered",
      }[e.status!];
    case "customs-updated":
      return `Customs status: ${CUSTOMS_STATUS_LABEL[e.customs!]}`;
  }
}

/** On the Order page: create or view the order's shipment, or explain why not yet. */
export function OrderShipmentPanel({ order }: { order: Order }) {
  const shipments = useShipments();
  const shipment = shipmentForOrder(order.id, shipments);
  const eligibility = shipmentEligibility(order, shipments);
  const status = orderStatus(order);

  let body: React.ReactNode;
  if (shipment) {
    const st = shipmentState(shipment);
    body = (
      <>
        <p className="text-sm text-ink">
          Shipment Created · <ImportId id={shipment.id} className="text-ink" /> · <ShipmentStatusBadge status={st.status} />
        </p>
        <Link href={importerHref(`shipments/${shipment.id}`)} className={`${secondaryButton} h-10`}>
          View Shipment
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </>
    );
  } else if (eligibility.ok) {
    body = (
      <>
        <p className="text-sm text-ink-muted">Supplier confirmed. Plan the shipment for this order.</p>
        <Link href={`${importerHref("shipments/new")}?order=${order.id}`} className={`${primaryButton} h-10`}>
          <Ship aria-hidden className="size-4" />
          Create Shipment
        </Link>
      </>
    );
  } else if (status === "cancelled" || status === "completed") {
    return null;
  } else {
    body = <p className="text-sm text-ink-muted">A shipment can be created once the supplier has confirmed this order.</p>;
  }

  return (
    <section aria-label="Shipment" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      {body}
    </section>
  );
}
