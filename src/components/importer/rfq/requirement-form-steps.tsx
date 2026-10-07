"use client";

import { useId, useRef, useState } from "react";
import { HelpCircle, Paperclip, Plus, Upload, X } from "lucide-react";
import {
  ATTACHMENT_KINDS,
  CURRENCIES,
  EXAMPLE_CERTIFICATIONS,
  INCOTERMS,
  PAYMENT_TERMS,
  PRODUCT_CATEGORIES,
  QUANTITY_UNITS,
  unitShort,
  type AttachmentKind,
  type RequirementAttachment,
} from "@/lib/import-requirements";
import { focusRing } from "../styles";
import { Checkbox, FieldShell, FormSection, SelectField, TextArea, TextField } from "./form-fields";
import type { FieldName, FormErrors, RequirementFormValues } from "./requirement-form-model";
import { formatBytes } from "./requirement-sections";

export interface StepProps {
  values: RequirementFormValues;
  set: <K extends FieldName>(field: K, value: RequirementFormValues[K]) => void;
  errors: FormErrors;
}

const COUNTRIES = [
  "India",
  "United Arab Emirates",
  "Saudi Arabia",
  "Bangladesh",
  "Sri Lanka",
  "Nepal",
  "Singapore",
  "Malaysia",
  "Vietnam",
  "China",
  "Japan",
  "South Korea",
  "United Kingdom",
  "Germany",
  "Netherlands",
  "United States",
  "Kenya",
  "Nigeria",
  "Egypt",
  "Australia",
];

const wide = "sm:col-span-2";

/* ------------------------------------------------------------------------ */

export function ProductStep({ values, set, errors }: StepProps) {
  return (
    <>
      <FormSection title="Product details">
        <TextField
          id="productName"
          label="Product name"
          required
          value={values.productName}
          onChange={(v) => set("productName", v)}
          placeholder="e.g. Basmati Rice"
          error={errors.productName}
        />
        <SelectField
          id="category"
          label="Product category"
          required
          value={values.category}
          onChange={(v) => set("category", v as RequirementFormValues["category"])}
          options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))}
          emptyLabel="Choose a category"
          error={errors.category}
        />
        <TextArea
          id="specification"
          label="Product description / specification"
          required
          rows={6}
          className={wide}
          value={values.specification}
          onChange={(v) => set("specification", v)}
          placeholder="e.g. 1121 Steam Basmati, 8.35 mm average grain length, moisture 12.5% max, broken 2% max, current crop."
          hint="Grade, variety, dimensions, purity, standards — whatever a supplier needs to quote accurately."
          error={errors.specification}
        />
        <TextField
          id="hsCode"
          label="HS Code"
          value={values.hsCode}
          onChange={(v) => set("hsCode", v)}
          placeholder="e.g. 1006.30"
          inputMode="decimal"
          hint="Don't know the HS Code? SUMIT can help identify it later."
          error={errors.hsCode}
        />
      </FormSection>

      <FormSection
        title="Attachments"
        description="Specifications, reference images, technical sheets or previous purchase specs."
      >
        <AttachmentPicker
          attachments={values.attachments}
          onChange={(a) => set("attachments", a)}
        />
      </FormSection>
    </>
  );
}

function AttachmentPicker({
  attachments,
  onChange,
}: {
  attachments: RequirementAttachment[];
  onChange: (attachments: RequirementAttachment[]) => void;
}) {
  const inputId = useId();
  const counter = useRef(0);

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    const added = Array.from(files).map((file) => ({
      id: `file-${++counter.current}-${file.name}`,
      name: file.name,
      kind: (file.type.startsWith("image/") ? "image" : "specification") as AttachmentKind,
      sizeBytes: file.size,
    }));
    onChange([...attachments, ...added]);
  };

  return (
    <div className={wide}>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-6 text-center transition-colors hover:border-teal/50 hover:bg-teal-soft/40 has-focus-visible:border-orange has-focus-visible:ring-2 has-focus-visible:ring-orange/30"
      >
        <Upload aria-hidden className="size-5 text-teal" />
        <span className="text-sm font-medium text-ink">Add files</span>
        <span className="text-xs text-ink-muted">
          Files stay on this device for now — nothing is uploaded or saved yet.
        </span>
        <input
          id={inputId}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {attachments.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
          {attachments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <Paperclip aria-hidden className="size-4 shrink-0 text-ink-faint" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{a.name}</span>
                <span className="block text-xs text-ink-muted">{formatBytes(a.sizeBytes)}</span>
              </span>
              <label className="sr-only" htmlFor={`${a.id}-kind`}>
                Type of document for {a.name}
              </label>
              <select
                id={`${a.id}-kind`}
                value={a.kind}
                onChange={(e) =>
                  onChange(
                    attachments.map((x) => (x.id === a.id ? { ...x, kind: e.target.value as AttachmentKind } : x)),
                  )
                }
                className="h-9 rounded-lg border border-line bg-surface px-2 text-xs text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
              >
                {ATTACHMENT_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(attachments.filter((x) => x.id !== a.id))}
                aria-label={`Remove ${a.name}`}
                className={`grid size-8 place-items-center rounded-lg text-ink-faint hover:bg-orange-soft hover:text-orange ${focusRing}`}
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

export function DeliveryStep({ values, set, errors }: StepProps) {
  const [incotermHelp, setIncotermHelp] = useState(false);
  // Earliest selectable date, in the viewer's time zone (matches validation).
  const [tomorrow] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  return (
    <>
      <FormSection title="Quantity">
        <TextField
          id="quantity"
          label="Quantity"
          required
          type="number"
          inputMode="decimal"
          min="0"
          value={values.quantity}
          onChange={(v) => set("quantity", v)}
          placeholder="e.g. 500"
          error={errors.quantity}
        />
        <SelectField
          id="unit"
          label="Unit"
          required
          value={values.unit}
          onChange={(v) => set("unit", v as RequirementFormValues["unit"])}
          options={QUANTITY_UNITS.map((u) => ({ value: u.id, label: u.label }))}
          emptyLabel="Choose a unit"
          error={errors.unit}
        />
        <TextField
          id="minQuantity"
          label="Minimum acceptable quantity"
          type="number"
          inputMode="decimal"
          min="0"
          value={values.minQuantity}
          onChange={(v) => set("minQuantity", v)}
          hint="The smallest quantity you'd accept from a single supplier."
          error={errors.minQuantity}
        />
      </FormSection>

      <FormSection title="Delivery">
        <TextField
          id="destinationCountry"
          label="Destination country"
          required
          list="rfq-countries"
          value={values.destinationCountry}
          onChange={(v) => set("destinationCountry", v)}
          placeholder="e.g. United Arab Emirates"
          error={errors.destinationCountry}
        />
        <datalist id="rfq-countries">
          {COUNTRIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <TextField
          id="destinationLocation"
          label="Destination port / location"
          required
          value={values.destinationLocation}
          onChange={(v) => set("destinationLocation", v)}
          placeholder="e.g. Jebel Ali port"
          error={errors.destinationLocation}
        />
        <TextField
          id="requiredBy"
          label="Required by"
          required
          type="date"
          min={tomorrow}
          value={values.requiredBy}
          onChange={(v) => set("requiredBy", v)}
          error={errors.requiredBy}
        />
        <div>
          <SelectField
            id="incoterm"
            label="Preferred Incoterm"
            value={values.incoterm}
            onChange={(v) => set("incoterm", v as RequirementFormValues["incoterm"])}
            options={INCOTERMS.map((t) => ({ value: t, label: t }))}
            emptyLabel="No preference"
            aside={
              <button
                type="button"
                onClick={() => setIncotermHelp((o) => !o)}
                aria-expanded={incotermHelp}
                aria-controls="incoterm-help"
                className={`inline-flex items-center gap-1 rounded-md text-xs font-medium text-teal hover:underline ${focusRing}`}
              >
                <HelpCircle aria-hidden className="size-3.5" />
                Not sure?
              </button>
            }
          />
        </div>
        {incotermHelp && (
          <div id="incoterm-help" className={`${wide} rounded-xl bg-teal-soft/60 px-4 py-3 text-sm text-ink-muted`}>
            <p className="text-ink">
              An Incoterm sets who arranges and pays for transport, and where risk passes to you.
            </p>
            <ul className="mt-2 space-y-1">
              <li><strong className="font-semibold text-ink">EXW / FCA</strong> — you collect from the supplier and arrange most of the transport.</li>
              <li><strong className="font-semibold text-ink">FOB</strong> — the supplier loads at their port; you arrange sea freight.</li>
              <li><strong className="font-semibold text-ink">CFR / CIF</strong> — the supplier pays freight to your port (CIF adds insurance).</li>
              <li><strong className="font-semibold text-ink">DAP / DDP</strong> — delivered to your location (DDP includes import duties).</li>
            </ul>
            <p className="mt-2">Unsure? Leave it as “No preference” and suppliers can propose terms.</p>
          </div>
        )}
      </FormSection>
    </>
  );
}

/* ------------------------------------------------------------------------ */

export function CommercialStep({ values, set, errors }: StepProps) {
  const per = values.unit ? unitShort(values.unit).replace(/s$/, "") : "unit";
  return (
    <FormSection
      title="Commercial preferences"
      description="All optional. These help evaluate quotations against what you expect."
    >
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <TextField
          id="targetPrice"
          label="Target price"
          type="number"
          inputMode="decimal"
          min="0"
          value={values.targetPrice}
          onChange={(v) => set("targetPrice", v)}
          placeholder="e.g. 1050"
          hint={`Per ${per}.`}
          error={errors.targetPrice}
        />
        <SelectField
          id="currency"
          label="Currency"
          showOptional={false}
          value={values.currency}
          onChange={(v) => set("currency", v as RequirementFormValues["currency"])}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          emptyLabel={null}
        />
      </div>
      <SelectField
        id="paymentTerms"
        label="Payment terms"
        value={values.paymentTerms}
        onChange={(v) => set("paymentTerms", v as RequirementFormValues["paymentTerms"])}
        options={PAYMENT_TERMS.map((t) => ({ value: t.id, label: t.label }))}
        emptyLabel="No preference"
      />
      <TextArea
        id="paymentNotes"
        label="Payment terms notes"
        rows={3}
        className={wide}
        value={values.paymentNotes}
        onChange={(v) => set("paymentNotes", v)}
        placeholder="e.g. LC at sight, confirmed by a UAE bank."
      />
    </FormSection>
  );
}

/* ------------------------------------------------------------------------ */

export function QualityStep({ values, set }: StepProps) {
  return (
    <FormSection title="Quality & compliance">
      <CertificationPicker
        selected={values.certifications}
        onChange={(c) => set("certifications", c)}
      />
      <TextArea
        id="inspection"
        label="Quality / inspection requirements"
        rows={3}
        className={wide}
        value={values.inspection}
        onChange={(v) => set("inspection", v)}
        placeholder="e.g. Pre-shipment inspection by SGS or equivalent at the loading port."
      />
      <TextArea
        id="packaging"
        label="Packaging requirements"
        rows={3}
        className={wide}
        value={values.packaging}
        onChange={(v) => set("packaging", v)}
        placeholder="e.g. 25 kg PP bags with private label."
      />
      <TextField
        id="originPreference"
        label="Country of origin preference"
        list="rfq-countries"
        value={values.originPreference}
        onChange={(v) => set("originPreference", v)}
        placeholder="e.g. India"
      />
      <datalist id="rfq-countries">
        {COUNTRIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </FormSection>
  );
}

function CertificationPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (certs: string[]) => void;
}) {
  const [custom, setCustom] = useState("");
  const toggle = (cert: string) =>
    onChange(selected.includes(cert) ? selected.filter((c) => c !== cert) : [...selected, cert]);
  const addCustom = () => {
    const c = custom.trim();
    if (c && !selected.some((s) => s.toLowerCase() === c.toLowerCase())) onChange([...selected, c]);
    setCustom("");
  };
  const customSelected = selected.filter((s) => !(EXAMPLE_CERTIFICATIONS as readonly string[]).includes(s));

  return (
    <FieldShell
      id="certification-custom"
      label="Certifications requested from supplier"
      hint="Examples only. Pick what you want the supplier to provide — what's actually required depends on the product and destination."
      className={wide}
    >
      <div role="group" aria-label="Example certifications" className="flex flex-wrap gap-2">
        {EXAMPLE_CERTIFICATIONS.map((cert) => {
          const on = selected.includes(cert);
          return (
            <button
              key={cert}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(cert)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${focusRing} ${
                on
                  ? "border-teal bg-teal text-on-brand"
                  : "border-line bg-surface text-ink-muted hover:border-teal/40 hover:text-ink"
              }`}
            >
              {on ? <X aria-hidden className="size-3" /> : <Plus aria-hidden className="size-3" />}
              {cert}
            </button>
          );
        })}
        {customSelected.map((cert) => (
          <button
            key={cert}
            type="button"
            aria-pressed
            onClick={() => toggle(cert)}
            className={`inline-flex items-center gap-1.5 rounded-full border border-teal bg-teal px-3 py-1.5 text-xs font-medium text-on-brand ${focusRing}`}
          >
            <X aria-hidden className="size-3" />
            {cert}
            <span className="sr-only">(remove)</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          id="certification-custom"
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add another, e.g. HACCP"
          aria-describedby="certification-custom-hint"
          className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-faint hover:border-teal/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!custom.trim()}
          className={`h-10 shrink-0 rounded-xl border border-line px-4 text-sm font-semibold text-ink hover:bg-teal-soft disabled:opacity-40 ${focusRing}`}
        >
          Add
        </button>
      </div>
    </FieldShell>
  );
}

/* ------------------------------------------------------------------------ */

export function SupplierStep({ values, set, errors }: StepProps) {
  return (
    <>
      <FormSection title="Supplier preferences">
        <TextField
          id="preferredRegions"
          label="Preferred supplier countries / regions"
          value={values.preferredRegions}
          onChange={(v) => set("preferredRegions", v)}
          placeholder="e.g. India, Pakistan"
        />
        <TextField
          id="minExperience"
          label="Minimum supplier experience (years)"
          inputMode="numeric"
          value={values.minExperience}
          onChange={(v) => set("minExperience", v)}
          placeholder="e.g. 5"
          error={errors.minExperience}
        />
        <Checkbox
          id="manufacturerRequired"
          label="Manufacturer required"
          description="Only suppliers who produce the goods themselves."
          checked={values.manufacturerRequired}
          onChange={(v) => set("manufacturerRequired", v)}
        />
        <Checkbox
          id="tradersAcceptable"
          label="Exporters / traders acceptable"
          description="Merchant exporters who source from producers."
          checked={values.tradersAcceptable}
          onChange={(v) => set("tradersAcceptable", v)}
        />
        <TextField
          id="supplierToInvite"
          label="Existing supplier to invite"
          className={wide}
          value={values.supplierToInvite}
          onChange={(v) => set("supplierToInvite", v)}
          placeholder="Company name"
          hint="Supplier search is coming later — for now, note the company name."
        />
      </FormSection>

      <FormSection title="Additional information">
        <TextArea
          id="additionalNotes"
          label="Additional notes"
          rows={3}
          className={wide}
          value={values.additionalNotes}
          onChange={(v) => set("additionalNotes", v)}
          hint="Can be shared with suppliers when your requirement is distributed."
        />
        <TextArea
          id="internalNotes"
          label="Private internal notes"
          rows={3}
          className={wide}
          value={values.internalNotes}
          onChange={(v) => set("internalNotes", v)}
          hint="Stays within your organisation — never shared with suppliers."
        />
      </FormSection>
    </>
  );
}
