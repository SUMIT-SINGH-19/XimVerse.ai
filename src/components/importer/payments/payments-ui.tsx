"use client";

import { CircleAlert, CircleCheck, CircleDashed, Clock, Eye, Info, OctagonAlert } from "lucide-react";
import {
  OBLIGATION_STATUS_LABEL,
  PAYMENTS_NOTICE,
  SEVERITY_LABEL,
  WORKSPACE_STATUS_LABEL,
  type ExceptionSeverity,
  type ObligationStatus,
  type WorkspaceStatus,
} from "@/lib/importer-payments";

export const PAYMENT_PROMPTS = [
  "What payment is due next?",
  "Which documents are blocking payment?",
  "How much remains unpaid?",
  "Is the LC checklist complete?",
  "What financing information is still missing?",
];

export const SUMIT_PAYMENT_MESSAGE = "SUMIT payment intelligence will be connected later. Nothing was analysed.";

type Tone = "ok" | "warn" | "bad" | "neutral";
const TONE: Record<Tone, string> = {
  ok: "bg-teal-soft text-teal",
  warn: "border border-orange/40 text-orange",
  bad: "bg-orange-soft text-orange",
  neutral: "border border-line text-ink-muted",
};
const ICON: Record<Tone, typeof Info> = { ok: CircleCheck, warn: Clock, bad: OctagonAlert, neutral: CircleDashed };

function Badge({ tone, label }: { tone: Tone; label: string }) {
  const Icon = ICON[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[tone]}`}>
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}

const OB_TONE: Record<ObligationStatus, Tone> = { planned: "neutral", "awaiting-trigger": "neutral", upcoming: "warn", ready: "warn", due: "bad", overdue: "bad", recorded: "ok" };
export function ObligationBadge({ status, label }: { status: ObligationStatus; label?: string }) {
  return <Badge tone={OB_TONE[status]} label={label ?? OBLIGATION_STATUS_LABEL[status]} />;
}

const WS_TONE: Record<WorkspaceStatus, Tone> = { "manual-setup": "warn", overdue: "bad", due: "bad", ready: "warn", partial: "warn", awaiting: "neutral", upcoming: "warn", recorded: "ok" };
export function WorkspaceBadge({ status }: { status: WorkspaceStatus }) {
  return <Badge tone={WS_TONE[status]} label={WORKSPACE_STATUS_LABEL[status]} />;
}

const SEV: Record<ExceptionSeverity, { cls: string; Icon: typeof Info }> = {
  critical: { cls: "bg-orange text-on-brand", Icon: OctagonAlert },
  "action-required": { cls: "bg-orange-soft text-orange", Icon: CircleAlert },
  watch: { cls: "border border-orange/40 text-orange", Icon: Eye },
  information: { cls: "border border-line text-ink-muted", Icon: Info },
};
export function SeverityBadge({ severity }: { severity: ExceptionSeverity }) {
  const { cls, Icon } = SEV[severity];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon aria-hidden className="size-3.5" />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export function PaymentsNotice() {
  return (
    <p className="flex gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      {PAYMENTS_NOTICE}
    </p>
  );
}
