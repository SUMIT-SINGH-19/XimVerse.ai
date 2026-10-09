import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import {
  NEGOTIATION_STATUS_LABEL,
  OFFER_ROWS,
  type CommercialOffer,
  type ExporterNegotiationStatus,
  type NegotiationEvent,
} from "@/lib/exporter-negotiations";

const TONE: Record<ExporterNegotiationStatus, PillTone> = {
  "revision-requested": "accent",
  "awaiting-exporter": "accent",
  "draft-counter": "accent",
  "awaiting-buyer": "neutral",
  agreed: "solid",
  closed: "muted",
  withdrawn: "muted",
};

export function NegotiationStatusPill({ status }: { status: ExporterNegotiationStatus }) {
  return <StatusPill tone={TONE[status]}>{NEGOTIATION_STATUS_LABEL[status]}</StatusPill>;
}

/** How each event reads from the exporter's side. */
export function eventLabel(e: NegotiationEvent): string {
  switch (e.type) {
    case "original-quotation":
      return "Quotation submitted";
    case "revision-request":
      return "Buyer requested revision";
    case "importer-counter":
      return "Buyer counter offer";
    case "supplier-revision":
      return "You countered";
    case "supplier-kept-offer":
      return "You kept your offer";
    case "agreement":
      return e.by === "supplier" ? "You accepted the buyer's terms" : "Buyer accepted your terms";
    case "withdrawn":
      return "Negotiation withdrawn";
    case "closed":
      return "Negotiation closed";
    case "note":
      return "Ximverse note";
  }
}

export const PARTY_TEXT = { importer: "Buyer", supplier: "You", system: "Ximverse" } as const;

/**
 * Two offers side by side, one row per commercial term; rows that differ are
 * highlighted. Stacks into per-term cards on narrow screens.
 */
export function OfferComparison({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: CommercialOffer;
  right?: CommercialOffer;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] bg-canvas text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
        <span className="px-3 py-2.5 sm:px-4">Term</span>
        <span className="px-3 py-2.5 sm:px-4">{leftLabel}</span>
        <span className="px-3 py-2.5 sm:px-4">{rightLabel}</span>
      </div>
      <dl className="divide-y divide-line">
        {OFFER_ROWS.map((row) => {
          const a = row.text(left);
          const b = right ? row.text(right) : "—";
          const changed = Boolean(right) && a !== b;
          return (
            <div
              key={row.field}
              className={`grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] text-sm ${changed ? "bg-orange-soft/60" : ""}`}
            >
              <dt className="px-3 py-2.5 text-ink-muted sm:px-4">
                {row.label}
                {changed && <span className="sr-only"> (changed)</span>}
              </dt>
              <dd className="px-3 py-2.5 font-medium text-ink [overflow-wrap:anywhere] sm:px-4">{a}</dd>
              <dd className={`px-3 py-2.5 [overflow-wrap:anywhere] sm:px-4 ${changed ? "font-semibold text-orange" : "text-ink"}`}>{b}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
