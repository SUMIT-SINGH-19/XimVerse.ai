import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { ORDER_STATUS_LABEL, type OrderDocumentStatus, type OrderStatus, DOCUMENT_STATUS_LABEL } from "@/lib/exporter-orders";

const TONE: Record<OrderStatus, PillTone> = {
  "awaiting-confirmation": "accent",
  confirmed: "brand",
  production: "brand",
  "pre-shipment": "brand",
  "ready-to-ship": "solid",
  "in-shipment": "solid",
  completed: "muted",
  "on-hold": "neutral",
  cancelled: "muted",
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <StatusPill tone={TONE[status]}>{ORDER_STATUS_LABEL[status]}</StatusPill>;
}

const DOC_TONE: Record<OrderDocumentStatus, PillTone> = {
  "not-started": "muted",
  preparing: "neutral",
  ready: "brand",
  verified: "solid",
  blocked: "accent",
  "not-required": "muted",
};

export function DocumentStatusPill({ status, label }: { status: OrderDocumentStatus; label?: string }) {
  return <StatusPill tone={DOC_TONE[status]}>{label ?? DOCUMENT_STATUS_LABEL[status]}</StatusPill>;
}

/** Thin progress bar for a 0–100 value. */
export function ProgressBar({ value, label, tone = "teal" }: { value: number; label: string; tone?: "teal" | "orange" }) {
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={`block h-1.5 w-full overflow-hidden rounded-full ${tone === "orange" ? "bg-orange-soft" : "bg-teal-soft"}`}
    >
      <span className={`block h-full rounded-full ${tone === "orange" ? "bg-orange" : "bg-teal"}`} style={{ width: `${value}%` }} />
    </span>
  );
}
