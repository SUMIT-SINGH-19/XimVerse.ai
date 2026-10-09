"use client";

import { useMemo, useState } from "react";
import { focusRing } from "@/components/workspace/styles";
import { FormField, input, invalidProps, textarea } from "@/components/exporter/quote/form-ui";
import { PAYMENT_TERM_LABEL, UNIT_SHORT } from "@/lib/exporter-opportunities";
import { DEMO_TODAY, formatMoney, PAYMENT_TERMS, QUOTE_INCOTERMS, toMinor } from "@/lib/exporter-quotations";
import { offerChanges, priceImpact, type CommercialOffer, type CounterDraft } from "@/lib/exporter-negotiations";
import type { Incoterm, PaymentTerm } from "@/lib/import-requirements";

interface Values {
  quantity: string;
  unitPrice: string;
  incoterm: Incoterm;
  namedPlace: string;
  estimatedDelivery: string;
  paymentTerm: PaymentTerm;
  advancePercent: string;
  packaging: string;
  validUntil: string;
  note: string;
}

function toValues(o: CommercialOffer, note = ""): Values {
  return {
    quantity: String(o.quantity.amount),
    unitPrice: String(o.unitPrice),
    incoterm: o.incoterm,
    namedPlace: o.namedPlace,
    estimatedDelivery: o.estimatedDelivery ?? "",
    paymentTerm: o.paymentTerm,
    advancePercent: String(o.advancePercent),
    packaging: o.packaging ?? "",
    validUntil: o.validUntil < DEMO_TODAY ? DEMO_TODAY : o.validUntil,
    note,
  };
}

/** Builds the offer from the form, keeping every field it doesn't edit from `base`. */
function toOffer(v: Values, base: CommercialOffer): CommercialOffer | undefined {
  const qty = Number(v.quantity);
  const minor = toMinor(v.unitPrice);
  const advance = Number(v.advancePercent);
  if (!(qty > 0) || minor === undefined || !Number.isInteger(advance)) return undefined;
  const termChanged = v.paymentTerm !== base.paymentTerm || advance !== base.advancePercent;
  return {
    ...base,
    quantity: { amount: qty, unit: base.quantity.unit },
    unitPrice: minor / 100,
    incoterm: v.incoterm,
    namedPlace: v.namedPlace.trim(),
    estimatedDelivery: v.estimatedDelivery || undefined,
    paymentTerm: v.paymentTerm,
    advancePercent: advance,
    paymentSummary: termChanged
      ? `${advance > 0 ? `${advance}% advance, ` : ""}${PAYMENT_TERM_LABEL[v.paymentTerm]}`
      : base.paymentSummary,
    packaging: v.packaging.trim() || undefined,
    validUntil: v.validUntil,
  };
}

type Errors = Partial<Record<keyof Values | "form", string>>;

function validate(v: Values, availableTonnes?: number): Errors {
  const e: Errors = {};
  const qty = Number(v.quantity);
  if (!(qty > 0)) e.quantity = "Enter a quantity above 0.";
  else if (availableTonnes !== undefined && qty > availableTonnes) e.quantity = `Exceeds your available capacity (${availableTonnes} MT).`;
  if (toMinor(v.unitPrice) === undefined) e.unitPrice = "Enter a price above 0, up to 2 decimal places.";
  if (!v.namedPlace.trim()) e.namedPlace = "Enter the named place.";
  if (v.estimatedDelivery && v.estimatedDelivery < DEMO_TODAY) e.estimatedDelivery = "Delivery can't be in the past.";
  const adv = Number(v.advancePercent);
  if (!Number.isInteger(adv) || adv < 0 || adv > 100) e.advancePercent = "Whole percentage, 0–100.";
  if (!v.validUntil || v.validUntil < DEMO_TODAY) e.validUntil = "Validity can't end before today.";
  return e;
}

/**
 * The exporter's structured counter. Prefilled from `base` (the current
 * offer, or the buyer's requested terms for a revision); changes are shown
 * against `previous` (your current offer).
 */
export function CounterForm({
  base,
  previous,
  draft,
  availableTonnes,
  title,
  submitLabel,
  onReview,
  onSaveDraft,
  onCancel,
}: {
  base: CommercialOffer;
  previous: CommercialOffer;
  draft?: CounterDraft;
  /** Available capacity, when the unit is MT. */
  availableTonnes?: number;
  title: string;
  submitLabel: string;
  onReview: (draft: CounterDraft) => void;
  onSaveDraft: (draft: CounterDraft) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<Values>(() => (draft ? toValues(draft.offer, draft.note ?? "") : toValues(base)));
  const [showErrors, setShowErrors] = useState(false);
  const errors = useMemo(() => validate(v, availableTonnes), [v, availableTonnes]);
  const offer = useMemo(() => toOffer(v, previous), [v, previous]);
  const changes = offer ? offerChanges(previous, offer) : [];
  const impact = offer ? priceImpact(previous, offer) : undefined;
  const unit = UNIT_SHORT[previous.quantity.unit];
  const set = <K extends keyof Values>(k: K, value: Values[K]) => setV((p) => ({ ...p, [k]: value }));
  const err = (k: keyof Values) => (showErrors ? errors[k] : undefined);
  const noChange = offer !== undefined && changes.length === 0;

  const review = () => {
    setShowErrors(true);
    if (Object.keys(errors).length === 0 && offer && !noChange) onReview({ offer, note: v.note.trim() || undefined });
  };

  return (
    <section aria-labelledby="counter-heading" className="rounded-2xl border-2 border-teal/40 bg-surface">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 id="counter-heading" className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">Change only the terms you want to counter. Everything else stays as offered.</p>
      </div>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
        <FormField id="c-quantity" label={`Quantity (${unit})`} error={err("quantity")}>
          <input id="c-quantity" inputMode="decimal" value={v.quantity} onChange={(e) => set("quantity", e.target.value)} className={input} {...invalidProps("c-quantity", err("quantity"))} />
        </FormField>
        <FormField id="c-price" label={`Unit Price (${previous.currency} / ${unit})`} error={err("unitPrice")}>
          <input id="c-price" inputMode="decimal" value={v.unitPrice} onChange={(e) => set("unitPrice", e.target.value)} className={`${input} tabular-nums`} {...invalidProps("c-price", err("unitPrice"))} />
        </FormField>
        <FormField id="c-incoterm" label="Incoterm">
          <select id="c-incoterm" value={v.incoterm} onChange={(e) => set("incoterm", e.target.value as Incoterm)} className={input}>
            {QUOTE_INCOTERMS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </FormField>
        <FormField id="c-place" label="Named Place" error={err("namedPlace")}>
          <input id="c-place" value={v.namedPlace} onChange={(e) => set("namedPlace", e.target.value)} className={input} {...invalidProps("c-place", err("namedPlace"))} />
        </FormField>
        <FormField id="c-delivery" label="Delivery Date" error={err("estimatedDelivery")}>
          <input id="c-delivery" type="date" value={v.estimatedDelivery} onChange={(e) => set("estimatedDelivery", e.target.value)} className={input} {...invalidProps("c-delivery", err("estimatedDelivery"))} />
        </FormField>
        <FormField id="c-valid" label="Valid Until" error={err("validUntil")}>
          <input id="c-valid" type="date" value={v.validUntil} onChange={(e) => set("validUntil", e.target.value)} className={input} {...invalidProps("c-valid", err("validUntil"))} />
        </FormField>
        <FormField id="c-payment" label="Payment Term">
          <select id="c-payment" value={v.paymentTerm} onChange={(e) => set("paymentTerm", e.target.value as PaymentTerm)} className={input}>
            {PAYMENT_TERMS.map((t) => (
              <option key={t} value={t}>{PAYMENT_TERM_LABEL[t]}</option>
            ))}
          </select>
        </FormField>
        <FormField id="c-advance" label="Advance (%)" error={err("advancePercent")}>
          <input id="c-advance" inputMode="numeric" value={v.advancePercent} onChange={(e) => set("advancePercent", e.target.value)} className={input} {...invalidProps("c-advance", err("advancePercent"))} />
        </FormField>
        <FormField id="c-packaging" label="Packaging" className="sm:col-span-2">
          <input id="c-packaging" value={v.packaging} onChange={(e) => set("packaging", e.target.value)} className={input} />
        </FormField>
        <FormField id="c-note" label="Commercial Note to Buyer" className="sm:col-span-2">
          <textarea id="c-note" value={v.note} onChange={(e) => set("note", e.target.value)} placeholder="e.g. We can revise pricing while maintaining current delivery." className={textarea} />
        </FormField>
      </div>

      <div className="border-t border-line px-5 py-4 sm:px-6">
        <h3 className="text-sm font-semibold text-ink">Changes from your previous offer</h3>
        {changes.length ? (
          <ul className="mt-2 space-y-2">
            {changes.map((c) => (
              <li key={c.field} className="rounded-lg bg-orange-soft/60 px-3 py-2 text-sm">
                <span className="font-semibold text-ink">{c.label}</span>
                <span className="mt-0.5 flex flex-wrap gap-x-4 text-ink-muted">
                  <span>Previous: {c.from}</span>
                  <span className="font-semibold text-ink">Counter: {c.to}</span>
                </span>
                {c.field === "unitPrice" && impact && (
                  <span className="mt-0.5 block text-xs text-ink-muted tabular-nums">
                    Difference: {impact.unitDeltaMinor > 0 ? "+" : "−"}
                    {formatMoney(Math.abs(impact.unitDeltaMinor), previous.currency)} / {unit} ({impact.percent > 0 ? "+" : ""}
                    {impact.percent.toFixed(2)}%)
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink-faint">No changes yet.</p>
        )}
        {impact && impact.totalDeltaMinor !== 0 && (
          <p className="mt-2 text-sm font-semibold tabular-nums text-ink">
            Total impact: {impact.totalDeltaMinor > 0 ? "+" : "−"}
            {formatMoney(Math.abs(impact.totalDeltaMinor), previous.currency)}
          </p>
        )}
        {showErrors && noChange && (
          <p role="alert" className="mt-2 text-xs font-medium text-orange">
            Nothing has changed — use Keep Existing Offer instead.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
        <button type="button" onClick={onCancel} className={`h-10 rounded-lg px-4 text-sm font-semibold text-ink-muted hover:bg-canvas hover:text-ink ${focusRing}`}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => offer && onSaveDraft({ offer, note: v.note.trim() || undefined })}
          disabled={!offer}
          className={`h-10 rounded-lg border border-line px-4 text-sm font-semibold text-ink-muted hover:border-teal hover:bg-teal-soft hover:text-ink disabled:opacity-50 ${focusRing}`}
        >
          Save Draft
        </button>
        <button type="button" onClick={review} className={`h-10 rounded-lg bg-teal px-4 text-sm font-semibold text-on-brand transition hover:brightness-110 ${focusRing}`}>
          {submitLabel}
        </button>
      </div>
    </section>
  );
}
