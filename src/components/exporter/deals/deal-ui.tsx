import { GitMerge, Handshake } from "lucide-react";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { formatMoney } from "@/lib/exporter-quotations";
import { UNIT_SHORT } from "@/lib/exporter-opportunities";
import {
  COMMITMENT_LABEL,
  DEAL_SOURCE_LABEL,
  DEAL_STATUS_LABEL,
  dealValueMinor,
  type DealSource,
  type DealStatus,
  type DealTerms,
} from "@/lib/exporter-deals";

const TONE: Record<DealStatus, PillTone> = {
  "pending-setup": "accent",
  confirmed: "brand",
  "ready-for-execution": "solid",
  "on-hold": "neutral",
  cancelled: "muted",
  completed: "muted",
};

export function DealStatusPill({ status }: { status: DealStatus }) {
  return <StatusPill tone={TONE[status]}>{DEAL_STATUS_LABEL[status]}</StatusPill>;
}

export function SourceBadge({ source }: { source: DealSource }) {
  const Icon = source === "negotiated-agreement" ? GitMerge : Handshake;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-ink-muted ring-1 ring-inset ring-line">
      <Icon className="size-3" aria-hidden />
      {source === "negotiated-agreement" ? "Negotiated" : "Direct Acceptance"}
      <span className="sr-only"> ({DEAL_SOURCE_LABEL[source]})</span>
    </span>
  );
}

export const unitPriceText = (t: Pick<DealTerms, "unitPrice" | "currency" | "quantity">) =>
  `${formatMoney(Math.round(t.unitPrice * 100), t.currency)} / ${UNIT_SHORT[t.quantity.unit]}`;
export const valueText = (t: Pick<DealTerms, "unitPrice" | "currency" | "quantity">) => formatMoney(dealValueMinor(t), t.currency);
export const qtyText = (t: Pick<DealTerms, "quantity">) => `${t.quantity.amount.toLocaleString("en-US")} ${UNIT_SHORT[t.quantity.unit]}`;

export { COMMITMENT_LABEL };
