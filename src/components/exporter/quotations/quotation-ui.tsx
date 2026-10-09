import { Clock } from "lucide-react";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { formatDate } from "@/lib/exporter-dashboard";
import { ACTIVE_STATUSES, daysBetween, DEMO_TODAY, QUOTATION_STATUS_LABEL, type ExporterQuotationStatus } from "@/lib/exporter-quotations";

const TONE: Record<ExporterQuotationStatus, PillTone> = {
  draft: "muted",
  submitted: "neutral",
  "under-review": "neutral",
  shortlisted: "brand",
  "revision-requested": "accent",
  negotiation: "accent",
  accepted: "solid",
  rejected: "muted",
  expired: "muted",
};

/** Rejected reads as "Not Selected" to the exporter. */
const DISPLAY_LABEL: Partial<Record<ExporterQuotationStatus, string>> = { rejected: "Not Selected" };

export function quotationStatusText(status: ExporterQuotationStatus): string {
  return DISPLAY_LABEL[status] ?? QUOTATION_STATUS_LABEL[status];
}

export function QuotationStatusPill({ status }: { status: ExporterQuotationStatus }) {
  return <StatusPill tone={TONE[status]}>{quotationStatusText(status)}</StatusPill>;
}

/** "Valid until 14 Oct" plus days left; urgent in the last three days. */
export function ValidityText({ validUntil, status }: { validUntil?: string; status: ExporterQuotationStatus }) {
  if (!validUntil) return <span className="text-ink-faint">—</span>;
  if (status === "expired") return <span className="text-xs font-medium text-ink-faint">Expired {formatDate(validUntil)}</span>;
  const live = ACTIVE_STATUSES.includes(status) || status === "draft";
  const left = daysBetween(DEMO_TODAY, validUntil);
  return (
    <span className="inline-flex flex-col">
      <span className="whitespace-nowrap text-sm text-ink">Valid until {formatDate(validUntil).replace(/ \d{4}$/, "")}</span>
      {live && (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap text-xs ${left <= 3 ? "font-semibold text-orange" : "text-ink-muted"}`}>
          {left <= 3 && <Clock className="size-3" aria-hidden />}
          {left <= 0 ? "Expires today" : `${left} ${left === 1 ? "day" : "days"} left`}
        </span>
      )}
    </span>
  );
}
