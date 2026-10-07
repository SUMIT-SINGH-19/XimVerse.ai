"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import { focusRing, iconButton } from "@/components/workspace/styles";
import type { ExporterProduct, MatchReadinessItem } from "@/lib/exporter-products";

const CATEGORIES = ["Rice", "Coconut", "Spices", "Pulses", "Other"] as const;

const input =
  "h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20 aria-invalid:border-orange";

type Errors = Partial<Record<string, string>>;

function FormField({
  id,
  label,
  error,
  hint,
  wide = false,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-orange">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>
      )}
    </div>
  );
}

function number(data: FormData, key: string): number {
  const raw = String(data.get(key) ?? "").trim();
  return raw === "" ? NaN : Number(raw);
}

/** Build a draft product from the form, or return field errors. */
function parse(data: FormData): { product: ExporterProduct } | { errors: Errors } {
  const text = (key: string) => String(data.get(key) ?? "").trim();
  const errors: Errors = {};

  const name = text("name");
  const hsCode = text("hsCode");
  const moq = number(data, "moq");
  const capacity = number(data, "capacity");
  const available = number(data, "available");
  const leadMin = number(data, "leadMin");
  const leadMax = number(data, "leadMax");

  if (!name) errors.name = "Enter the product name.";
  // Shape check only — HS codes aren't validated against any tariff schedule.
  if (hsCode && !/^\d{4,10}$/.test(hsCode)) errors.hsCode = "Use 4–10 digits.";
  if (!(moq > 0)) errors.moq = "Enter a quantity above 0.";
  if (!(capacity > 0)) errors.capacity = "Enter a quantity above 0.";
  if (!(available >= 0)) errors.available = "Enter 0 or more.";
  else if (available > capacity) errors.available = "Can't exceed monthly capacity.";
  if (!(leadMin > 0) || !(leadMax >= leadMin)) errors.lead = "Enter a valid range, e.g. 10 to 14.";
  if (Object.keys(errors).length) return { errors };

  const items: MatchReadinessItem[] = [
    { key: "hs", label: "HS Code added", done: Boolean(hsCode) },
    { key: "capacity", label: "Capacity available", done: available > 0 },
    { key: "lead", label: "Lead time added", done: true },
    { key: "specs", label: "Add specifications", done: false },
    { key: "packaging", label: "Add packaging options", done: false },
    { key: "certs", label: "Map certifications", done: false },
    { key: "markets", label: "Add market experience", done: false },
  ];
  const mt = (value: number) => ({ value, unit: "MT" as const });

  return {
    product: {
      id: `demo-${crypto.randomUUID()}`,
      name,
      sector: "Agriculture",
      category: text("category"),
      hsCode,
      origin: text("origin") || "India",
      productCode: text("productCode").toUpperCase() || "—",
      status: "draft",
      specifications: [],
      supply: {
        monthlyProductionCapacity: mt(capacity),
        monthlyExportCapacity: mt(capacity),
        availableCapacity: mt(available),
        moq: mt(moq),
        leadTimeDays: { min: leadMin, max: leadMax },
      },
      certifications: [],
      markets: { experienced: [], target: [] },
      commercial: { quoteCurrencies: [], incoterms: [], paymentTerms: [] },
      readiness: Math.round((items.filter((i) => i.done).length / items.length) * 100),
      readinessItems: items,
      updatedOn: new Date().toISOString().slice(0, 10),
      demo: true,
    },
  };
}

/**
 * Minimal product onboarding: the identity and supply fields matching needs
 * first. Adds to the in-memory demo catalogue only — nothing is persisted.
 */
export function AddProductForm({
  onAdd,
  onCancel,
}: {
  onAdd: (product: ExporterProduct) => void;
  onCancel: () => void;
}) {
  const [errors, setErrors] = useState<Errors>({});

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = parse(new FormData(e.currentTarget));
    if ("errors" in result) setErrors(result.errors);
    else onAdd(result.product);
  };

  const invalid = (key: string) =>
    errors[key] ? { "aria-invalid": true, "aria-describedby": `${key}-error` } : {};

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id="add-product-title" className="text-lg font-bold tracking-tight text-ink">
            Add Product
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Start with identity and supply. Specifications, packaging and certifications come next.
          </p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Close" className={`${iconButton} -mr-2`}>
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <p className="mb-5 flex items-start gap-2 rounded-xl bg-orange-soft px-4 py-3 text-sm text-ink">
          <Info className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden />
          Demo only: products added here stay in this browser tab and are not saved. Saving to your account
          arrives with the backend.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label="Product Name" error={errors.name} wide>
            <input id="name" name="name" className={input} placeholder="e.g. 1509 Steam Basmati Rice" {...invalid("name")} />
          </FormField>
          <FormField id="category" label="Category">
            <select id="category" name="category" className={input} defaultValue="Rice">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </FormField>
          <FormField id="hsCode" label="HS Code" error={errors.hsCode} hint="Format check only.">
            <input id="hsCode" name="hsCode" inputMode="numeric" className={`${input} font-mono`} placeholder="10063020" {...invalid("hsCode")} />
          </FormField>
          <FormField id="origin" label="Origin">
            <input id="origin" name="origin" className={input} placeholder="Karnal, Haryana, India" />
          </FormField>
          <FormField id="productCode" label="Product Code">
            <input id="productCode" name="productCode" className={`${input} font-mono uppercase`} placeholder="RICE-1509-ST" />
          </FormField>
          <FormField id="capacity" label="Monthly Capacity (MT)" error={errors.capacity}>
            <input id="capacity" name="capacity" type="number" min={0} className={input} placeholder="1000" {...invalid("capacity")} />
          </FormField>
          <FormField id="available" label="Available Capacity (MT)" error={errors.available}>
            <input id="available" name="available" type="number" min={0} className={input} placeholder="400" {...invalid("available")} />
          </FormField>
          <FormField id="moq" label="MOQ (MT)" error={errors.moq}>
            <input id="moq" name="moq" type="number" min={0} className={input} placeholder="25" {...invalid("moq")} />
          </FormField>
          <FormField id="leadMin" label="Lead Time (days)" error={errors.lead}>
            <div className="flex items-center gap-2">
              <input id="leadMin" name="leadMin" type="number" min={1} aria-label="Minimum lead time in days" className={input} placeholder="10" {...invalid("lead")} />
              <span className="text-ink-faint">to</span>
              <input name="leadMax" type="number" min={1} aria-label="Maximum lead time in days" className={input} placeholder="14" {...invalid("lead")} />
            </div>
          </FormField>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={onCancel}
          className={`h-10 rounded-lg px-4 text-sm font-semibold text-ink-muted hover:bg-canvas hover:text-ink ${focusRing}`}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={`h-10 rounded-lg bg-teal px-4 text-sm font-semibold text-on-brand transition hover:brightness-110 ${focusRing}`}
        >
          Add to Demo Catalogue
        </button>
      </footer>
    </form>
  );
}
