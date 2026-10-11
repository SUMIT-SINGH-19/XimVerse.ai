"use client";

import { CircleAlert, CircleCheck, Eye, Info, OctagonAlert } from "lucide-react";
import {
  EXCEPTION_SEVERITY_LABEL,
  SCHEDULE_STATUS_LABEL,
  TRACKING_NOTICE,
  type ExceptionSeverity,
  type ScheduleStatus,
  type TrackingView,
} from "@/lib/importer-tracking";

export const TRACKING_PROMPTS = [
  "What needs my attention?",
  "Why is this shipment delayed?",
  "Which exceptions are still open?",
  "What changed in the ETA?",
  "What is blocking customs?",
  "Summarize this shipment's journey.",
];

export const SUMIT_TRACKING_MESSAGE = "SUMIT tracking intelligence will be connected later. Nothing was analysed.";

const SEVERITY_STYLE: Record<ExceptionSeverity, { cls: string; Icon: typeof Info }> = {
  critical: { cls: "bg-orange text-on-brand", Icon: OctagonAlert },
  "action-required": { cls: "bg-orange-soft text-orange", Icon: CircleAlert },
  watch: { cls: "border border-orange/40 text-orange", Icon: Eye },
  information: { cls: "border border-line text-ink-muted", Icon: Info },
};

/** Severity shown with an icon and text, never colour alone. */
export function SeverityBadge({ severity }: { severity: ExceptionSeverity }) {
  const { cls, Icon } = SEVERITY_STYLE[severity];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon aria-hidden className="size-3.5" />
      {EXCEPTION_SEVERITY_LABEL[severity]}
    </span>
  );
}

const SCHEDULE_STYLE: Record<ScheduleStatus, string> = {
  "on-schedule": "bg-teal-soft text-teal",
  changed: "border border-orange/40 text-orange",
  delayed: "bg-orange-soft text-orange",
  arrived: "border border-teal/40 text-teal",
  delivered: "bg-teal text-on-brand",
};

export function ScheduleBadge({ status }: { status: ScheduleStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${SCHEDULE_STYLE[status]}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {SCHEDULE_STATUS_LABEL[status]}
    </span>
  );
}

/** "3 exceptions · Action Required" or "No open exceptions". */
export function ExceptionSummary({ view }: { view: TrackingView }) {
  if (!view.highest) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-ink-muted">
        <CircleCheck aria-hidden className="size-4 text-teal" />
        No open exceptions
      </span>
    );
  }
  const n = view.open.length;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="whitespace-nowrap text-sm text-ink">{n} {n === 1 ? "exception" : "exceptions"}</span>
      <SeverityBadge severity={view.highest} />
    </span>
  );
}

export function TrackingNotice() {
  return (
    <p className="flex gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      {TRACKING_NOTICE}
    </p>
  );
}
