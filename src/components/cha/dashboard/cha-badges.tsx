import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  ACTION_STATUS_LABEL,
  PRIORITY_LABEL,
  type ActionStatus,
  type Priority,
  type ShipmentType,
} from "@/lib/cha-dashboard-data";

/*
 * Small labels shared by the CHA dashboard sections. Severity runs from a
 * filled orange chip (act now) through soft orange and teal to neutral.
 */

const chip =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";

const PRIORITY_STYLE: Record<Priority, string> = {
  critical: "bg-orange text-on-brand",
  high: "bg-orange-soft text-orange",
  medium: "bg-teal-soft text-teal",
  low: "bg-canvas text-ink-muted ring-1 ring-inset ring-line",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`${chip} ${PRIORITY_STYLE[priority]}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

const ACTION_STATUS_STYLE: Record<ActionStatus, string> = {
  critical: "bg-orange text-on-brand",
  urgent: "bg-orange-soft text-orange",
  review: "bg-teal-soft text-teal",
  ready: "bg-teal text-on-brand",
  "waiting-client": "bg-canvas text-ink-muted ring-1 ring-inset ring-line",
};

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  return <span className={`${chip} ${ACTION_STATUS_STYLE[status]}`}>{ACTION_STATUS_LABEL[status]}</span>;
}

/** "XIM-EXP-1042" in the monospace used for references across the app. */
export function ShipmentId({ id, className = "" }: { id: string; className?: string }) {
  return <span className={`font-mono text-[0.8125rem] tracking-tight ${className}`}>{id}</span>;
}

/** Export (outbound, orange) or import (inbound, teal). */
export function ShipmentTypeTag({ type }: { type: ShipmentType }) {
  const Icon = type === "export" ? ArrowUpRight : ArrowDownLeft;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
      <Icon aria-hidden className={`size-3.5 shrink-0 ${type === "export" ? "text-orange" : "text-teal"}`} />
      {type === "export" ? "Export" : "Import"}
    </span>
  );
}
