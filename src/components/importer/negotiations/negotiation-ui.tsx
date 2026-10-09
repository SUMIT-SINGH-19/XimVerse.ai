"use client";

import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { formatQuantity } from "@/lib/import-requirements";
import {
  formatOfferIncoterm,
  formatOfferPrice,
  negotiationStatusLabel,
  offerValue,
  type CommercialOffer,
  type NegotiationStatus,
} from "@/lib/importer-negotiations";
import { focusRing } from "../styles";

const STATUS_STYLE: Record<NegotiationStatus, string> = {
  "awaiting-importer": "bg-orange-soft text-orange",
  "draft-counter": "border border-dashed border-orange/50 text-orange",
  "awaiting-supplier": "border border-teal/40 text-teal",
  "supplier-responded": "bg-orange-soft text-orange",
  agreed: "bg-teal text-on-brand",
  closed: "bg-line/70 text-ink-muted",
  withdrawn: "bg-line/70 text-ink-muted",
};

export function NegotiationStatusBadge({ status }: { status: NegotiationStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {status === "agreed" ? (
        <Check aria-hidden className="size-3" strokeWidth={3} />
      ) : (
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
      )}
      {negotiationStatusLabel(status)}
    </span>
  );
}

/**
 * Modal dialog on the native <dialog> element: focus is trapped, Escape
 * closes it, and focus returns to the opener.
 */
export function Dialog({
  open,
  onClose,
  title,
  id,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight text-ink">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`-mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-teal-soft hover:text-ink ${focusRing}`}
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </dialog>
  );
}

/** Label/value list of an offer's commercial terms. */
export function OfferFacts({
  offer,
  extra = [],
  withValue = true,
}: {
  offer: CommercialOffer;
  extra?: { label: string; value: React.ReactNode }[];
  withValue?: boolean;
}) {
  const rows: { label: string; value: React.ReactNode }[] = [
    ...extra,
    { label: "Quantity", value: formatQuantity(offer.quantity) },
    { label: "Unit price", value: formatOfferPrice(offer) },
    { label: "Currency", value: offer.currency },
    { label: "Incoterm", value: formatOfferIncoterm(offer) },
    { label: "Payment terms", value: offer.paymentSummary },
    { label: "Lead time", value: `${offer.leadTimeDays} days` },
    { label: "Validity", value: `Until ${formatDate(offer.validUntil)}` },
    ...(withValue ? [{ label: "Total commercial value", value: offerValue(offer) }] : []),
  ];
  return (
    <dl className="divide-y divide-line rounded-xl border border-line">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm">
          <dt className="text-ink-muted">{r.label}</dt>
          <dd className="min-w-0 text-right font-medium text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
