import { Check, CircleAlert, CircleCheck, Info, Minus, Star } from "lucide-react";
import {
  quotationStatusLabel,
  type DocumentAvailability,
  type IncotermCoverage,
  type QuotationDeviation,
  type QuotationStatus,
} from "@/lib/importer-quotations";
import { focusRing } from "../styles";

const STATUS_STYLE: Record<QuotationStatus, string> = {
  new: "bg-orange-soft text-orange",
  "under-review": "border border-teal/40 text-teal",
  shortlisted: "bg-teal-soft text-teal",
  "clarification-required": "border border-orange/35 text-orange",
  "not-selected": "bg-line/70 text-ink-muted",
  selected: "bg-teal text-on-brand",
};

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {status === "shortlisted" ? (
        <Star aria-hidden className="size-3 fill-current" />
      ) : status === "selected" ? (
        <Check aria-hidden className="size-3" strokeWidth={3} />
      ) : (
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
      )}
      {quotationStatusLabel(status)}
    </span>
  );
}

/** Star toggle for adding a quotation to, or removing it from, the shortlist. */
export function ShortlistToggle({
  label,
  shortlisted,
  disabled,
  onToggle,
  withText = false,
  className = "",
}: {
  /** What is being shortlisted, for the accessible name. */
  label: string;
  shortlisted: boolean;
  disabled?: boolean;
  onToggle: () => void;
  withText?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={shortlisted}
      aria-label={withText ? undefined : `Shortlist ${label}`}
      title={disabled ? "No changes possible for this requirement" : shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${focusRing} ${
        withText ? "h-10 border px-4" : "size-8"
      } ${
        shortlisted
          ? withText
            ? "border-teal bg-teal-soft text-teal"
            : "text-orange hover:bg-orange-soft"
          : withText
            ? "border-line text-ink hover:border-teal/40 hover:bg-teal-soft"
            : "text-ink-faint enabled:hover:bg-teal-soft enabled:hover:text-teal"
      } ${className}`}
    >
      <Star aria-hidden className={`size-4 ${shortlisted ? "fill-current" : ""}`} />
      {withText && (shortlisted ? "Shortlisted" : "Shortlist")}
    </button>
  );
}

const DEVIATION_ICON = {
  deviation: { Icon: CircleAlert, className: "text-orange", sr: "Deviation:" },
  match: { Icon: CircleCheck, className: "text-teal", sr: "Matches:" },
  note: { Icon: Info, className: "text-ink-faint", sr: "Note:" },
} as const;

export function DeviationList({
  deviations,
  compact = false,
}: {
  deviations: readonly QuotationDeviation[];
  compact?: boolean;
}) {
  return (
    <ul className={compact ? "space-y-1.5" : "space-y-2.5"}>
      {deviations.map((d) => {
        const { Icon, className, sr } = DEVIATION_ICON[d.kind];
        return (
          <li key={d.id} className={`flex gap-2.5 ${compact ? "text-xs" : "text-sm"}`}>
            <Icon aria-hidden className={`mt-0.5 shrink-0 ${compact ? "size-3.5" : "size-4"} ${className}`} />
            <span className={d.kind === "deviation" ? "text-ink" : "text-ink-muted"}>
              <span className="sr-only">{sr} </span>
              {d.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const AVAILABILITY: Record<DocumentAvailability, { label: string; Icon: typeof Check; className: string }> = {
  available: { label: "Available", Icon: CircleCheck, className: "text-teal" },
  "on-request": { label: "On request", Icon: CircleAlert, className: "text-orange" },
  "not-offered": { label: "Not offered", Icon: Minus, className: "text-ink-faint" },
};

export function Availability({ value }: { value: DocumentAvailability }) {
  const { label, Icon, className } = AVAILABILITY[value];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${value === "available" ? "text-ink" : "text-ink-muted"}`}>
      <Icon aria-hidden className={`size-4 shrink-0 ${className}`} />
      {label}
    </span>
  );
}

export function IncotermCoverageList({ coverage }: { coverage: IncotermCoverage }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Quoted price includes</h4>
        <ul className="mt-2 space-y-1.5">
          {coverage.included.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-ink">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-teal" strokeWidth={2.5} />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Not included — typically your responsibility
        </h4>
        <ul className="mt-2 space-y-1.5">
          {coverage.buyer.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-ink-muted">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-faint" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
