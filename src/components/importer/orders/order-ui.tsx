"use client";

import Link from "next/link";
import { ArrowRight, Check, CircleCheck, Clock, Minus, PackagePlus } from "lucide-react";
import { importerHref } from "@/lib/importer-nav";
import {
  orderForNegotiation,
  orderStatus,
  orderStatusLabel,
  READINESS_LABEL,
  type OrderStatus,
  type ReadinessState,
} from "@/lib/importer-orders";
import { ImportId } from "../dashboard/dashboard-ui";
import { focusRing, primaryButton, secondaryButton } from "../styles";
import { useOrders } from "./order-store";

const STATUS_STYLE: Record<OrderStatus, string> = {
  "po-ready": "border border-teal/40 text-teal",
  "awaiting-confirmation": "bg-orange-soft text-orange",
  confirmed: "bg-teal-soft text-teal",
  "pre-shipment": "bg-teal text-on-brand",
  completed: "border border-line text-ink-muted",
  cancelled: "bg-line/70 text-ink-muted line-through decoration-ink-faint/50",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {status === "completed" ? <Check aria-hidden className="size-3" strokeWidth={3} /> : <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {orderStatusLabel(status)}
    </span>
  );
}

const READINESS_ICON: Record<ReadinessState, { Icon: typeof Check; className: string }> = {
  complete: { Icon: CircleCheck, className: "text-teal" },
  pending: { Icon: Clock, className: "text-orange" },
  "not-started": { Icon: Minus, className: "text-ink-faint" },
};

export function ReadinessBadge({ state }: { state: ReadinessState }) {
  const { Icon, className } = READINESS_ICON[state];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-sm ${state === "complete" ? "text-ink" : "text-ink-muted"}`}>
      <Icon aria-hidden className={`size-4 ${className}`} />
      {READINESS_LABEL[state]}
    </span>
  );
}

/**
 * Create Order (no order yet) or View Order (order exists) for an agreed
 * negotiation. The single place that decides, so duplicates can't be offered.
 */
export function OrderAction({ negotiationId, block = false }: { negotiationId: string; block?: boolean }) {
  const order = orderForNegotiation(negotiationId, useOrders());
  if (order) {
    return (
      <div className={`flex flex-col gap-1 ${block ? "" : "items-start sm:items-end"}`}>
        <span className="text-xs text-ink-muted">
          Order Created · <ImportId id={order.id} className="text-xs text-ink" /> · {orderStatusLabel(orderStatus(order))}
        </span>
        <Link href={importerHref(`orders/${order.id}`)} className={`${secondaryButton} h-10 ${block ? "w-full" : ""}`}>
          View Order
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    );
  }
  return (
    <Link href={`${importerHref("orders/new")}?negotiation=${negotiationId}`} className={`${primaryButton} h-10 ${block ? "w-full" : ""}`}>
      <PackagePlus aria-hidden className="size-4" />
      Create Order
    </Link>
  );
}

/** On the selected quotation only: shows its order once one exists. */
export function QuotationOrderLink({ quotationId }: { quotationId: string }) {
  const order = useOrders().find((o) => o.quotationId === quotationId);
  if (!order) return null;
  return (
    <Link
      href={importerHref(`orders/${order.id}`)}
      className={`inline-flex h-10 items-center gap-1.5 rounded-xl border border-teal/40 bg-teal-soft px-4 text-sm font-semibold text-teal hover:brightness-95 ${focusRing}`}
    >
      Order Created · <ImportId id={order.id} className="text-xs" /> · View Order
    </Link>
  );
}
