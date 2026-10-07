import type {
  Currency,
  ImportRequirement,
  Incoterm,
  PaymentTerm,
  ProductCategory,
  QuantityUnit,
  RequirementAttachment,
  RequirementStatus,
} from "@/lib/import-requirements";

/** Raw form state: strings exactly as typed, converted on save. */
export interface RequirementFormValues {
  productName: string;
  category: ProductCategory | "";
  specification: string;
  hsCode: string;
  attachments: RequirementAttachment[];

  quantity: string;
  unit: QuantityUnit | "";
  minQuantity: string;
  destinationCountry: string;
  destinationLocation: string;
  requiredBy: string;
  incoterm: Incoterm | "";

  targetPrice: string;
  currency: Currency;
  paymentTerms: PaymentTerm | "";
  paymentNotes: string;

  certifications: string[];
  inspection: string;
  packaging: string;
  originPreference: string;

  preferredRegions: string;
  manufacturerRequired: boolean;
  tradersAcceptable: boolean;
  minExperience: string;
  supplierToInvite: string;
  additionalNotes: string;
  internalNotes: string;
}

export const EMPTY_FORM: RequirementFormValues = {
  productName: "",
  category: "",
  specification: "",
  hsCode: "",
  attachments: [],
  quantity: "",
  unit: "",
  minQuantity: "",
  destinationCountry: "",
  destinationLocation: "",
  requiredBy: "",
  incoterm: "",
  targetPrice: "",
  currency: "USD",
  paymentTerms: "",
  paymentNotes: "",
  certifications: [],
  inspection: "",
  packaging: "",
  originPreference: "",
  preferredRegions: "",
  manufacturerRequired: false,
  tradersAcceptable: true,
  minExperience: "",
  supplierToInvite: "",
  additionalNotes: "",
  internalNotes: "",
};

export type FieldName = keyof RequirementFormValues;
export type FormErrors = Partial<Record<FieldName, string>>;

export const FORM_STEPS = [
  { id: "product", label: "Product", fields: ["productName", "category", "specification", "hsCode"] },
  {
    id: "delivery",
    label: "Quantity & Delivery",
    fields: ["quantity", "unit", "minQuantity", "destinationCountry", "destinationLocation", "requiredBy"],
  },
  { id: "commercial", label: "Commercial", fields: ["targetPrice"] },
  { id: "quality", label: "Quality & Compliance", fields: [] },
  { id: "supplier", label: "Supplier Preferences", fields: ["minExperience"] },
  { id: "review", label: "Review", fields: [] },
] as const satisfies readonly { id: string; label: string; fields: readonly FieldName[] }[];

export type StepId = (typeof FORM_STEPS)[number]["id"];

function positiveNumber(raw: string): number | undefined {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Today in the viewer's time zone, as YYYY-MM-DD. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Every validation error in the form, keyed by field. */
export function validate(v: RequirementFormValues): FormErrors {
  const e: FormErrors = {};

  if (!v.productName.trim()) e.productName = "Enter the product you need.";
  if (!v.category) e.category = "Choose a product category.";
  if (!v.specification.trim()) e.specification = "Describe the product so suppliers can quote accurately.";
  else if (v.specification.trim().length < 10) e.specification = "Add a little more detail (at least 10 characters).";
  if (v.hsCode.trim() && !/^\d{4}(\.?\d{2}){0,3}$/.test(v.hsCode.trim())) {
    e.hsCode = "Use 4–10 digits, e.g. 1006.30 — or leave it blank.";
  }

  const qty = positiveNumber(v.quantity);
  if (!v.quantity.trim()) e.quantity = "Enter a quantity.";
  else if (qty === undefined) e.quantity = "Quantity must be a number greater than 0.";
  if (!v.unit) e.unit = "Choose a unit.";
  if (v.minQuantity.trim()) {
    const min = positiveNumber(v.minQuantity);
    if (min === undefined) e.minQuantity = "Must be a number greater than 0.";
    else if (qty !== undefined && min > qty) e.minQuantity = "Can't be more than the total quantity.";
  }
  if (!v.destinationCountry.trim()) e.destinationCountry = "Enter the destination country.";
  if (!v.destinationLocation.trim()) e.destinationLocation = "Enter the destination port or location.";
  if (!v.requiredBy) e.requiredBy = "Choose the date you need the goods by.";
  else if (v.requiredBy <= todayISO()) e.requiredBy = "Choose a date in the future.";

  if (v.targetPrice.trim() && positiveNumber(v.targetPrice) === undefined) {
    e.targetPrice = "Target price must be a number greater than 0.";
  }
  if (v.minExperience.trim() && !/^\d{1,2}$/.test(v.minExperience.trim())) {
    e.minExperience = "Enter whole years, e.g. 5.";
  }
  return e;
}

export function stepErrors(step: StepId, all: FormErrors): FormErrors {
  const fields: readonly FieldName[] = FORM_STEPS.find((s) => s.id === step)!.fields;
  return Object.fromEntries(Object.entries(all).filter(([k]) => fields.includes(k as FieldName)));
}

export function firstInvalidStep(all: FormErrors): StepId | undefined {
  return FORM_STEPS.find((s) => Object.keys(stepErrors(s.id, all)).length > 0)?.id;
}

const optional = (s: string) => s.trim() || undefined;

/**
 * Builds a requirement from the form. Drafts may be incomplete, so unparseable
 * numbers fall back to 0 and missing choices to neutral defaults.
 */
export function toRequirement(
  v: RequirementFormValues,
  meta: { id: string; status: RequirementStatus; createdAt: string; now: string; previous?: ImportRequirement },
): ImportRequirement {
  const price = positiveNumber(v.targetPrice);
  const experience = v.minExperience.trim() ? Number(v.minExperience) : undefined;
  const event =
    meta.status === "draft"
      ? meta.previous
        ? "Draft updated"
        : "Draft created"
      : "Requirement structured — ready for sourcing";

  return {
    id: meta.id,
    status: meta.status,
    createdAt: meta.createdAt,
    updatedAt: meta.now,
    product: {
      name: v.productName.trim(),
      category: v.category || "Other",
      specification: v.specification.trim(),
      hsCode: optional(v.hsCode),
    },
    quantity: {
      amount: positiveNumber(v.quantity) ?? 0,
      unit: v.unit || "UNITS",
      minimumAcceptable: positiveNumber(v.minQuantity),
    },
    delivery: {
      destinationCountry: v.destinationCountry.trim(),
      destinationLocation: v.destinationLocation.trim(),
      requiredBy: v.requiredBy,
      incoterm: v.incoterm || undefined,
    },
    commercial: {
      targetPrice: price ? { amount: price, currency: v.currency } : undefined,
      paymentTerms: v.paymentTerms || undefined,
      paymentNotes: optional(v.paymentNotes),
    },
    quality: {
      certifications: v.certifications,
      inspection: optional(v.inspection),
      packaging: optional(v.packaging),
      originPreference: optional(v.originPreference),
    },
    supplierPreferences: {
      preferredRegions: optional(v.preferredRegions),
      manufacturerRequired: v.manufacturerRequired,
      tradersAcceptable: v.tradersAcceptable,
      minimumExperienceYears: Number.isFinite(experience) ? experience : undefined,
      supplierToInvite: optional(v.supplierToInvite),
    },
    attachments: v.attachments,
    additionalNotes: optional(v.additionalNotes),
    internalNotes: optional(v.internalNotes),
    quotationCount: 0,
    activity: [
      { id: `ev-${meta.now}`, at: meta.now, message: event },
      ...(meta.previous?.activity ?? []),
    ],
  };
}
