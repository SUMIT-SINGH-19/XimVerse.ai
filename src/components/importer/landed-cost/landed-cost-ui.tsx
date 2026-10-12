"use client";

import { CircleAlert, CircleCheck, CircleDashed, Info } from "lucide-react";
import { COST_STATUS_LABEL, LANDED_COST_NOTICE, type CostStatus } from "@/lib/importer-landed-cost";

export const LANDED_COST_PROMPTS = [
  "What is driving my landed cost?",
  "How much of the cost is duties and taxes?",
  "What happens if freight rises by 10%?",
  "Which values are still assumptions?",
  "Compare my scenarios.",
];

export const SUMIT_COST_MESSAGE = "SUMIT cost intelligence will be connected later. Nothing was analysed.";

const STATUS_STYLE: Record<CostStatus, { cls: string; Icon: typeof Info }> = {
  "needs-input": { cls: "border border-line text-ink-muted", Icon: CircleDashed },
  partial: { cls: "border border-orange/40 text-orange", Icon: CircleAlert },
  complete: { cls: "bg-teal-soft text-teal", Icon: CircleCheck },
};

export function CostStatusBadge({ status }: { status: CostStatus }) {
  const { cls, Icon } = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <Icon aria-hidden className="size-3.5" />
      {COST_STATUS_LABEL[status]}
    </span>
  );
}

export function LandedCostNotice() {
  return (
    <p className="flex gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      {LANDED_COST_NOTICE}
    </p>
  );
}
