"use client";

import { CircleAlert, CircleCheck, Info, OctagonAlert } from "lucide-react";
import {
  CUSTOMS_CASE_STATUS_LABEL,
  CUSTOMS_NOTICE,
  CUSTOMS_READINESS_LABEL,
  type CustomsCaseStatus,
  type CustomsCaseView,
  type CustomsReadiness,
} from "@/lib/importer-customs";

export const CUSTOMS_PROMPTS = [
  "What is blocking this customs case?",
  "Which documents are missing?",
  "Summarize the declaration draft.",
  "What has the CHA asked me?",
  "Which fields still need information?",
  "What changed since handoff?",
];

export const SUMIT_CUSTOMS_MESSAGE = "SUMIT customs intelligence will be connected later. Nothing was analysed.";

const STATUS_STYLE: Record<CustomsCaseStatus, string> = {
  preparing: "border border-line text-ink-muted",
  "ready-for-handoff": "border border-teal/40 text-teal",
  "with-cha": "bg-teal-soft text-teal",
  "clarification-required": "bg-orange-soft text-orange",
  "ready-for-filing": "bg-teal text-on-brand",
  filed: "bg-teal-soft text-teal",
  "under-assessment": "bg-teal-soft text-teal",
  cleared: "bg-teal text-on-brand",
};

export function CustomsStatusBadge({ status }: { status: CustomsCaseStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {CUSTOMS_CASE_STATUS_LABEL[status]}
    </span>
  );
}

const READINESS_STYLE: Record<CustomsReadiness, { cls: string; Icon: typeof Info }> = {
  blocked: { cls: "bg-orange-soft text-orange", Icon: OctagonAlert },
  preparing: { cls: "border border-orange/40 text-orange", Icon: CircleAlert },
  "ready-for-handoff": { cls: "border border-teal/40 text-teal", Icon: CircleCheck },
  "ready-for-filing": { cls: "bg-teal-soft text-teal", Icon: CircleCheck },
};

export function CustomsReadinessBadge({ readiness }: { readiness: CustomsReadiness }) {
  const { cls, Icon } = READINESS_STYLE[readiness];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <Icon aria-hidden className="size-3.5" />
      {CUSTOMS_READINESS_LABEL[readiness]}
    </span>
  );
}

export const demoTag = <span className="whitespace-nowrap rounded-full border border-orange/40 px-1.5 text-xs font-medium text-orange">Demo</span>;
export const historicalTag = <span className="whitespace-nowrap rounded-full border border-line px-1.5 text-xs font-medium text-ink-muted">Historical Record</span>;

/** "Demo" or "Historical Record" for Filed / Under Assessment / Cleared. */
export function StatusRecordTag({ view }: { view: CustomsCaseView }) {
  if (view.statusRecord === "demo") return demoTag;
  if (view.statusRecord === "historical") return historicalTag;
  return null;
}

export function CustomsNotice() {
  return (
    <p className="flex gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      {CUSTOMS_NOTICE}
    </p>
  );
}

/** Customs case summary shown on shipment and compliance pages. */
export function CaseSummaryRows({ view }: { view: CustomsCaseView }) {
  return (
    <dl className="divide-y divide-line">
      <div className="flex justify-between gap-4 py-2">
        <dt className="text-ink-muted">Customs case</dt>
        <dd className="font-mono text-ink">{view.id}</dd>
      </div>
      <div className="flex justify-between gap-4 py-2">
        <dt className="text-ink-muted">Assigned CHA</dt>
        <dd className="min-w-0 break-words text-right text-ink">{view.cha?.company ?? "Not assigned"}</dd>
      </div>
      <div className="flex items-center justify-between gap-4 py-2">
        <dt className="text-ink-muted">Readiness</dt>
        <dd><CustomsReadinessBadge readiness={view.readiness} /></dd>
      </div>
      <div className="flex items-center justify-between gap-4 py-2">
        <dt className="text-ink-muted">Case status</dt>
        <dd className="flex flex-wrap items-center justify-end gap-2">
          <CustomsStatusBadge status={view.status} />
          <StatusRecordTag view={view} />
        </dd>
      </div>
    </dl>
  );
}
