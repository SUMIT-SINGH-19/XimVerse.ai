import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import {
  deadlineInfo,
  OPPORTUNITY_STATUS_LABEL,
  type BuyerOpportunity,
  type OpportunityMatchReason,
  type OpportunityStatus,
} from "@/lib/exporter-opportunities";

const STATUS_TONE: Record<OpportunityStatus, PillTone> = {
  new: "accent",
  viewed: "neutral",
  considering: "brand",
  quoted: "solid",
  closed: "muted",
};

export function OpportunityStatusPill({ status }: { status: OpportunityStatus }) {
  return <StatusPill tone={STATUS_TONE[status]}>{OPPORTUNITY_STATUS_LABEL[status]}</StatusPill>;
}

/** "96% Match" with a short bar. */
export function MatchScore({ score, size = "md" }: { score: number; size?: "md" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        role="meter"
        aria-label="Match score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        className={`overflow-hidden rounded-full bg-teal-soft ${size === "lg" ? "h-2 w-24" : "h-1.5 w-10"}`}
      >
        <span className="block h-full rounded-full bg-teal" style={{ width: `${score}%` }} />
      </span>
      <span className={`whitespace-nowrap font-semibold text-teal ${size === "lg" ? "text-base" : "text-sm"}`}>
        {score}% Match
      </span>
    </span>
  );
}

/** Time left to quote. Only the last 24 hours get the accent colour. */
export function DeadlineLabel({ opportunity }: { opportunity: BuyerOpportunity }) {
  const { urgency, label } = deadlineInfo(opportunity);
  const tone = {
    "within-24h": "font-semibold text-orange",
    "within-3d": "font-medium text-ink",
    later: "text-ink-muted",
    closed: "text-ink-faint",
  }[urgency];

  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-xs ${tone}`}>
      {(urgency === "within-24h" || urgency === "within-3d") && <Clock className="size-3.5" aria-hidden />}
      {label}
    </span>
  );
}

export function MatchReasons({ reasons }: { reasons: readonly OpportunityMatchReason[] }) {
  return (
    <ul className="space-y-1.5">
      {reasons.map((r) => (
        <li key={r.label} className="flex items-start gap-2 text-sm">
          {r.kind === "strength" ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-label="Strength" />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-label="Gap" />
          )}
          <span className={r.kind === "strength" ? "text-ink" : "text-ink-muted"}>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}
