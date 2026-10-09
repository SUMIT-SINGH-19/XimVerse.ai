"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { CURRENCIES, INCOTERMS, PAYMENT_TERMS, unitShort, type Currency, type Incoterm, type PaymentTerm } from "@/lib/import-requirements";
import type { CommercialOffer, CounterDraft } from "@/lib/importer-negotiations";
import { SelectField, TextArea, TextField } from "../rfq/form-fields";
import { todayISO } from "../rfq/requirement-form-model";
import { ghostButton, primaryButton, secondaryButton } from "../styles";

/* Structured commercial terms form — not a free-text chat composer. */

interface Values {
  unitPrice: string;
  currency: Currency;
  quantity: string;
  incoterm: Incoterm;
  namedPlace: string;
  paymentTerm: PaymentTerm;
  advancePercent: string;
  paymentSummary: string;
  leadTimeDays: string;
  validUntil: string;
  packaging: string;
  inspection: string;
  note: string;
}

type Errors = Partial<Record<keyof Values, string>>;

const PAYMENT_WORDING: Record<PaymentTerm, string> = {
  lc: "LC at sight",
  dp: "D/P at sight",
  da: "D/A",
  "open-account": "Open account",
  advance: "before shipment",
  negotiable: "to be agreed",
};

/** Default wording for a payment term and advance share, e.g. "20% advance / 80% LC at sight". */
export function paymentWording(term: PaymentTerm, advance: number): string {
  if (term === "advance") return advance >= 100 || advance <= 0 ? "100% advance" : `${advance}% advance / ${100 - advance}% before shipment`;
  return advance > 0 ? `${advance}% advance / ${100 - advance}% ${PAYMENT_WORDING[term]}` : PAYMENT_WORDING[term].replace(/^to/, "To");
}

const LIMITS = { paymentSummary: 80, namedPlace: 60, packaging: 200, inspection: 300, note: 500 };

function toValues(o: CommercialOffer, note = ""): Values {
  return {
    unitPrice: String(o.unitPrice),
    currency: o.currency,
    quantity: String(o.quantity.amount),
    incoterm: o.incoterm,
    namedPlace: o.namedPlace,
    paymentTerm: o.paymentTerm,
    advancePercent: String(o.advancePercent),
    paymentSummary: o.paymentSummary,
    leadTimeDays: String(o.leadTimeDays),
    validUntil: o.validUntil,
    packaging: o.packaging ?? "",
    inspection: o.inspection ?? "",
    note,
  };
}

function validate(v: Values): Errors {
  const e: Errors = {};
  const price = Number(v.unitPrice);
  if (!v.unitPrice.trim()) e.unitPrice = "Enter a unit price.";
  else if (!Number.isFinite(price) || price <= 0) e.unitPrice = "Unit price must be greater than 0.";
  const qty = Number(v.quantity);
  if (!v.quantity.trim()) e.quantity = "Enter a quantity.";
  else if (!Number.isFinite(qty) || qty <= 0) e.quantity = "Quantity must be greater than 0.";
  if (!(INCOTERMS as readonly string[]).includes(v.incoterm)) e.incoterm = "Choose an Incoterm.";
  if (!v.namedPlace.trim()) e.namedPlace = "Enter the named port or place.";
  else if (v.namedPlace.length > LIMITS.namedPlace) e.namedPlace = `Keep it under ${LIMITS.namedPlace} characters.`;
  if (!v.paymentTerm) e.paymentTerm = "Choose payment terms.";
  if (!/^\d{1,3}$/.test(v.advancePercent.trim()) || Number(v.advancePercent) > 100) e.advancePercent = "Enter a whole percentage from 0 to 100.";
  if (!v.paymentSummary.trim()) e.paymentSummary = "Describe the payment terms.";
  else if (v.paymentSummary.length > LIMITS.paymentSummary) e.paymentSummary = `Keep it under ${LIMITS.paymentSummary} characters.`;
  if (!/^\d{1,3}$/.test(v.leadTimeDays.trim()) || Number(v.leadTimeDays) <= 0) e.leadTimeDays = "Lead time must be a whole number of days, greater than 0.";
  if (!v.validUntil) e.validUntil = "Choose how long the terms should stay valid.";
  else if (v.validUntil < todayISO()) e.validUntil = "Validity must be today or later.";
  if (v.packaging.length > LIMITS.packaging) e.packaging = `Keep it under ${LIMITS.packaging} characters.`;
  if (v.inspection.length > LIMITS.inspection) e.inspection = `Keep it under ${LIMITS.inspection} characters.`;
  if (v.note.length > LIMITS.note) e.note = `Keep notes under ${LIMITS.note} characters (${v.note.length} now).`;
  return e;
}

function toDraft(v: Values, unit: CommercialOffer["quantity"]["unit"]): CounterDraft {
  return {
    offer: {
      unitPrice: Number(v.unitPrice),
      currency: v.currency,
      quantity: { amount: Number(v.quantity), unit },
      incoterm: v.incoterm,
      namedPlace: v.namedPlace.trim(),
      paymentTerm: v.paymentTerm,
      advancePercent: Number(v.advancePercent),
      paymentSummary: v.paymentSummary.trim(),
      leadTimeDays: Number(v.leadTimeDays),
      validUntil: v.validUntil,
      packaging: v.packaging.trim() || undefined,
      inspection: v.inspection.trim() || undefined,
    },
    note: v.note.trim() || undefined,
  };
}

export function OfferForm({
  mode,
  initial,
  initialNote,
  onSubmit,
  onSaveDraft,
  onCancel,
}: {
  mode: "counter" | "supplier-demo";
  initial: CommercialOffer;
  initialNote?: string;
  onSubmit: (draft: CounterDraft) => void;
  onSaveDraft?: (draft: CounterDraft) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Values>(() => toValues(initial, initialNote));
  const [wordingEdited, setWordingEdited] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const errors = validate(values);
  const visible = showErrors ? errors : {};
  const unit = initial.quantity.unit;
  const prefix = mode === "counter" ? "co" : "sr";

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((v) => {
      const next = { ...v, [key]: value };
      if ((key === "paymentTerm" || key === "advancePercent") && !wordingEdited && /^\d{1,3}$/.test(next.advancePercent)) {
        next.paymentSummary = paymentWording(next.paymentTerm, Number(next.advancePercent));
      }
      return next;
    });

  const submit = (save: (d: CounterDraft) => void) => {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      const first = Object.keys(errors)[0];
      requestAnimationFrame(() => document.getElementById(`${prefix}-${first}`)?.focus());
      return;
    }
    save(toDraft(values, unit));
  };

  const id = (k: keyof Values) => `${prefix}-${k}`;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit(onSubmit);
      }}
      className="space-y-5"
      aria-labelledby={`${prefix}-heading`}
    >
      <div>
        <h3 id={`${prefix}-heading`} className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
          {mode === "counter" ? (
            "Your counter offer"
          ) : (
            <>
              <FlaskConical aria-hidden className="size-4 text-orange" />
              Simulate supplier revision
              <span className="rounded-full border border-orange/40 px-2 py-0.5 text-xs font-semibold text-orange">Demo</span>
            </>
          )}
        </h3>
        <p className="mt-1 text-sm text-ink-muted">
          {mode === "counter"
            ? "Prefilled with the current offer. Change the terms you want to propose."
            : "For demonstration only: enter terms as if the supplier had revised them. No real supplier is involved."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
          <TextField id={id("unitPrice")} label={`Unit price (per ${unitShort(unit).replace(/s$/, "")})`} required type="number" inputMode="decimal" min="0" value={values.unitPrice} onChange={(v) => set("unitPrice", v)} error={visible.unitPrice} />
          <SelectField id={id("currency")} label="Currency" showOptional={false} value={values.currency} onChange={(v) => set("currency", v as Currency)} options={CURRENCIES.map((c) => ({ value: c, label: c }))} emptyLabel={null} />
        </div>
        <TextField id={id("quantity")} label={`Quantity (${unitShort(unit)})`} required type="number" inputMode="decimal" min="0" value={values.quantity} onChange={(v) => set("quantity", v)} error={visible.quantity} />
        <SelectField id={id("incoterm")} label="Incoterm" required value={values.incoterm} onChange={(v) => set("incoterm", v as Incoterm)} options={INCOTERMS.map((t) => ({ value: t, label: t }))} emptyLabel={null} error={visible.incoterm} />
        <TextField id={id("namedPlace")} label="Named port / place" required value={values.namedPlace} onChange={(v) => set("namedPlace", v)} error={visible.namedPlace} />
        <SelectField id={id("paymentTerm")} label="Payment terms" required value={values.paymentTerm} onChange={(v) => set("paymentTerm", v as PaymentTerm)} options={PAYMENT_TERMS.map((t) => ({ value: t.id, label: t.label }))} emptyLabel={null} error={visible.paymentTerm} />
        <TextField id={id("advancePercent")} label="Advance payment (%)" required inputMode="numeric" value={values.advancePercent} onChange={(v) => set("advancePercent", v)} error={visible.advancePercent} />
        <TextField
          id={id("paymentSummary")}
          label="Payment wording"
          required
          className="sm:col-span-2"
          value={values.paymentSummary}
          onChange={(v) => {
            setWordingEdited(true);
            set("paymentSummary", v);
          }}
          hint="Updates automatically from the payment terms and advance unless you edit it."
          error={visible.paymentSummary}
        />
        <TextField id={id("leadTimeDays")} label="Lead time (days)" required inputMode="numeric" value={values.leadTimeDays} onChange={(v) => set("leadTimeDays", v)} error={visible.leadTimeDays} />
        <TextField id={id("validUntil")} label="Valid until" required type="date" value={values.validUntil} onChange={(v) => set("validUntil", v)} error={visible.validUntil} />
        <TextArea id={id("packaging")} label="Packaging notes" rows={2} className="sm:col-span-2" value={values.packaging} onChange={(v) => set("packaging", v)} error={visible.packaging} />
        <TextArea id={id("inspection")} label="Inspection requirements" rows={2} className="sm:col-span-2" value={values.inspection} onChange={(v) => set("inspection", v)} error={visible.inspection} />
        <TextArea
          id={id("note")}
          label="Commercial note"
          rows={3}
          className="sm:col-span-2"
          value={values.note}
          onChange={(v) => set("note", v)}
          hint={`A short note on the terms, up to ${LIMITS.note} characters.`}
          error={visible.note}
        />
      </div>

      {showErrors && Object.keys(errors).length > 0 && (
        <p role="alert" className="text-sm font-medium text-orange">
          Fix the highlighted fields to continue.
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:items-center">
        <button type="button" onClick={onCancel} className={ghostButton}>
          Cancel
        </button>
        <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
          {onSaveDraft && (
            <button type="button" onClick={() => submit(onSaveDraft)} className={secondaryButton}>
              Save as draft
            </button>
          )}
          <button type="submit" className={primaryButton}>
            {mode === "counter" ? "Make Counter Offer" : "Record demo revision"}
          </button>
        </div>
      </div>
    </form>
  );
}
