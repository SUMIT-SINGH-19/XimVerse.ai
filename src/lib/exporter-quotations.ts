/*
 * Exporter quotations: the supply-side offer against one buyer opportunity.
 *
 * Shaped after the importer's Quotation (src/lib/importer-quotations.ts) so
 * the quotation an exporter submits can become the quotation an importer
 * compares: `requirementId`, `product`, `price`, `delivery`, `commercial` and
 * `compliance` use the importer's field names and vocabularies. Additions are
 * exporter-side (opportunity link, matched product, coverage, dates, deviation
 * severity, internal note) and are listed in `toBuyerFacingQuotation`, which
 * is the only shape a buyer-facing API may ever return.
 *
 * Never part of a quotation: the product's internal price band, margins, cost
 * structure, or anything about the buyer's identity. The link to the buyer is
 * the RFQ and opportunity references only.
 *
 * Business dates (validity, dispatch, deadlines) use the demo clock shared
 * with the opportunities mock; audit timestamps (createdAt, submittedAt) are
 * real.
 */

import type { Currency, Incoterm, PaymentTerm, QuantityUnit } from "./import-requirements";
import type { ProductSummary } from "./exporter-products";
import { EXPORTER_COMPANY_ID } from "./exporter-company";
import {
  credentialStatus,
  OPPORTUNITIES_NOW,
  PAYMENT_TERM_LABEL,
  tonnes,
  UNIT_SHORT,
  type BuyerOpportunity,
  type ShipmentDocumentStatus,
} from "./exporter-opportunities";

// ---------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------

/** Same ids as the importer's CURRENCIES; typed so a mismatch fails to compile. */
export const QUOTE_CURRENCIES = ["USD", "EUR", "GBP", "AED", "INR", "CNY"] as const satisfies readonly Currency[];

/** Same ids as the importer's INCOTERMS. */
export const QUOTE_INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const satisfies readonly Incoterm[];

export const PAYMENT_TERMS = Object.keys(PAYMENT_TERM_LABEL) as PaymentTerm[];

/** Matches the importer's QuotedDelivery.mode. */
export const SHIPMENT_MODES = ["Sea", "Air", "Road"] as const;
export type ShipmentMode = (typeof SHIPMENT_MODES)[number];

export type CostCoverage = "included" | "excluded" | "not-applicable";

export const COST_COVERAGE_LABEL: Record<CostCoverage, string> = {
  included: "Included",
  excluded: "Excluded",
  "not-applicable": "Not applicable",
};

/** Exporter's answer per shipment document. Maps to the importer's DocumentAvailability. */
export type ComplianceResponse = "can-provide" | "needs-arrangement" | "cannot-provide";

export const COMPLIANCE_RESPONSE_LABEL: Record<ComplianceResponse, string> = {
  "can-provide": "Can Provide",
  "needs-arrangement": "Needs Arrangement",
  "cannot-provide": "Cannot Provide",
};

/** The importer's DocumentAvailability ids, for the eventual buyer-facing projection. */
export const TO_DOCUMENT_AVAILABILITY = {
  "can-provide": "available",
  "needs-arrangement": "on-request",
  "cannot-provide": "not-offered",
} as const satisfies Record<ComplianceResponse, "available" | "on-request" | "not-offered">;

export type ExporterQuotationStatus =
  | "draft"
  | "submitted"
  | "under-review"
  | "shortlisted"
  | "revision-requested"
  | "negotiation"
  | "accepted"
  | "rejected"
  | "expired";

export const QUOTATION_STATUS_LABEL: Record<ExporterQuotationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  "under-review": "Under Review",
  shortlisted: "Shortlisted",
  "revision-requested": "Revision Requested",
  negotiation: "Negotiation",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};

/** Pipeline order, for display and sorting. */
export const QUOTATION_STATUS_ORDER: readonly ExporterQuotationStatus[] = [
  "draft",
  "submitted",
  "under-review",
  "shortlisted",
  "revision-requested",
  "negotiation",
  "accepted",
  "rejected",
  "expired",
];

/** Live quotations the buyer can still act on. */
export const ACTIVE_STATUSES: readonly ExporterQuotationStatus[] = [
  "submitted",
  "under-review",
  "shortlisted",
  "revision-requested",
  "negotiation",
];

/** Decided by the buyer — the basis for win rate. Expiry isn't a decision. */
export const DECIDED_STATUSES: readonly ExporterQuotationStatus[] = ["accepted", "rejected"];

/**
 * How each exporter status will read on the importer side
 * (QuotationStatus in importer-quotations.ts). Documentation for the future
 * shared lifecycle; nothing uses it to change importer data. Statuses with no
 * importer equivalent map to undefined.
 */
export const IMPORTER_STATUS_EQUIVALENT: Record<
  ExporterQuotationStatus,
  "new" | "under-review" | "shortlisted" | "clarification-required" | "not-selected" | "selected" | undefined
> = {
  draft: undefined,
  submitted: "new",
  "under-review": "under-review",
  shortlisted: "shortlisted",
  "revision-requested": "clarification-required",
  negotiation: undefined,
  accepted: "selected",
  rejected: "not-selected",
  expired: undefined,
};

// ---------------------------------------------------------------------------
// Deviations
// ---------------------------------------------------------------------------

export type DeviationSeverity = "info" | "warning" | "blocking";

export type DeviationField =
  | "specification"
  | "quantity"
  | "incoterm"
  | "coverage"
  | "delivery"
  | "packaging"
  | "private-label"
  | "payment"
  | "currency"
  | "validity"
  | "compliance"
  | "inspection"
  | "credential";

/**
 * A difference between what the buyer asked for and what the exporter offers.
 * Info: likely acceptable. Warning: the buyer must accept it. Blocking: the
 * offer can't be submitted as is (e.g. below the buyer's minimum quantity).
 */
export interface QuotationDeviation {
  id: string;
  field: DeviationField;
  severity: DeviationSeverity;
  buyerRequirement: string;
  exporterOffer: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Quotation model
// ---------------------------------------------------------------------------

/** Importer QuotedProduct, plus private label. */
export interface QuotedProductOffer {
  description: string;
  specificationAsRequested: boolean;
  hsCode?: string;
  quantity: { amount: number; unit: QuantityUnit };
  moq?: { amount: number; unit: QuantityUnit };
  packaging: string;
  packagingAsRequested: boolean;
  origin: string;
  privateLabel?: boolean;
}

/** Importer QuotedPrice, plus the pricing unit and the computed total. */
export interface QuotedPriceOffer {
  unitPrice: number;
  currency: Currency;
  incoterm: Incoterm;
  namedPlace: string;
  pricingUnit: QuantityUnit;
  /** unitPrice × quantity, computed in minor units and rounded to cents. */
  total: number;
}

/** Importer QuotedDelivery, plus explicit dispatch and delivery dates. */
export interface QuotedDeliveryOffer {
  portOfLoading: string;
  leadTimeDays: number;
  mode: ShipmentMode;
  /** YYYY-MM-DD */
  earliestDispatch: string;
  /** YYYY-MM-DD */
  estimatedDelivery: string;
}

/** Importer QuotedCommercialTerms. `notes` is shared with the buyer. */
export interface QuotedCommercialOffer {
  paymentTerm: PaymentTerm;
  advancePercent: number;
  paymentSummary: string;
  /** YYYY-MM-DD */
  validUntil: string;
  notes?: string;
}

export interface QuotedComplianceOffer {
  documents: { name: string; response: ComplianceResponse }[];
  inspection?: string;
  inspectionAccepted?: boolean;
}

/**
 * What Ximverse / the buyer has said back about a quotation. Shared with the
 * exporter by design; never contains another exporter's price or identity.
 */
export interface QuotationFeedback {
  /** ISO timestamp. */
  at: string;
  message: string;
  /** Negotiation: the buyer's counter price, per pricing unit. */
  counterOffer?: { unitPrice: number; currency: Currency };
  /** Rejection reason, if one was given. */
  reason?: string;
}

export interface ExporterQuotation {
  /**
   * QT-YYYY-NNNN, the importer's quotation id format. Exporter ranges:
   * 8000–8999 seeded demo history, 9001+ created in this browser.
   */
  id: string;
  /** The canonical RFQ id (importer: Quotation.requirementId). */
  requirementId: string;
  opportunityId: string;
  exporterProductId: string;
  /** The exporter company quoting (maps to the importer's Quotation.supplierId). */
  exporterCompanyId: string;
  status: ExporterQuotationStatus;
  product: QuotedProductOffer;
  price: QuotedPriceOffer;
  costCoverage: { freight: CostCoverage; insurance: CostCoverage };
  delivery: QuotedDeliveryOffer;
  commercial: QuotedCommercialOffer;
  compliance: QuotedComplianceOffer;
  deviations: QuotationDeviation[];
  /** Latest feedback from Ximverse / the buyer. */
  feedback?: QuotationFeedback;
  /** PRIVATE — never shared with the buyer or included in any buyer projection. */
  internalNote?: string;
  /** ISO timestamps (real time). */
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}

/**
 * What a buyer may eventually see. An allowlist, so a new private field can't
 * leak by default: no internal note, no exporter product or opportunity ids.
 * Any future API for importers must go through this.
 */
export function toBuyerFacingQuotation(q: ExporterQuotation) {
  return {
    id: q.id,
    requirementId: q.requirementId,
    supplierId: q.exporterCompanyId,
    status: q.status,
    product: q.product,
    price: q.price,
    costCoverage: q.costCoverage,
    delivery: q.delivery,
    commercial: q.commercial,
    compliance: q.compliance,
    deviations: q.deviations,
    submittedAt: q.submittedAt,
  };
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

/** Raw form state: strings as typed, converted on submit. */
export interface QuoteFormValues {
  specification: "" | "as-requested" | "differs";
  quantity: string;
  currency: Currency;
  unitPrice: string;
  incoterm: Incoterm;
  namedPlace: string;
  freight: CostCoverage;
  insurance: CostCoverage;
  portOfLoading: string;
  mode: ShipmentMode;
  leadTimeDays: string;
  dispatchDate: string;
  deliveryDate: string;
  packagingAsRequested: boolean;
  packaging: string;
  privateLabel: "" | "available" | "not-available";
  paymentTerm: PaymentTerm | "";
  advancePercent: string;
  paymentNotes: string;
  validityDays: string;
  /** Keyed by shipment document name. */
  documents: Record<string, ComplianceResponse | "">;
  inspectionAccepted: boolean;
  buyerNotes: string;
  internalNote: string;
}

export type QuoteField = keyof QuoteFormValues;

/** Today on the demo clock (same instant as the opportunities mock). */
export const DEMO_TODAY = OPPORTUNITIES_NOW.slice(0, 10);

const DAY_MS = 86_400_000;

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Default freight / insurance coverage for an Incoterm. Simplified, informational. */
export function defaultCoverage(term: Incoterm): { freight: CostCoverage; insurance: CostCoverage } {
  const sellerFreight = !["EXW", "FCA", "FOB"].includes(term);
  const sellerInsurance = ["CIF", "CIP", "DAP", "DPU", "DDP"].includes(term);
  return {
    freight: sellerFreight ? "included" : "not-applicable",
    insurance: sellerInsurance ? "included" : term === "CFR" || term === "CPT" ? "excluded" : "not-applicable",
  };
}

const DOCUMENT_DEFAULT: Record<ShipmentDocumentStatus, ComplianceResponse> = {
  "per-shipment": "can-provide",
  required: "can-provide",
  "needs-action": "needs-arrangement",
};

/** A first draft built from the opportunity, so the exporter only adds the commercial response. */
export function defaultQuoteForm(o: BuyerOpportunity, product: ProductSummary | undefined): QuoteFormValues {
  const term = o.delivery.incoterm?.term ?? "FOB";
  const lead = product?.supply.leadTimeDays.min ?? 14;
  const dispatch = addDays(DEMO_TODAY, lead + 1);
  return {
    specification: "",
    quantity: String(o.quantity.amount),
    currency: (QUOTE_CURRENCIES as readonly string[]).includes(o.extendedTerms?.currency ?? "")
      ? (o.extendedTerms!.currency as Currency)
      : "USD",
    unitPrice: "",
    incoterm: term,
    namedPlace: o.delivery.incoterm?.namedPlace ?? "",
    ...defaultCoverage(term),
    portOfLoading: "Mundra, India",
    mode: "Sea",
    leadTimeDays: String(lead),
    dispatchDate: dispatch,
    deliveryDate: addDays(dispatch, 26),
    packagingAsRequested: true,
    packaging: o.quality.packaging ?? "",
    privateLabel: o.extendedTerms?.privateLabel ? "available" : "",
    paymentTerm: o.commercial.paymentTerms ?? "",
    advancePercent: "0",
    paymentNotes: o.commercial.paymentNotes ?? "",
    validityDays: String(o.extendedTerms?.quoteValidityDays ?? 7),
    documents: Object.fromEntries(o.compliance.shipmentDocuments.map((d) => [d.name, DOCUMENT_DEFAULT[d.status]])),
    inspectionAccepted: Boolean(o.quality.inspection),
    buyerNotes: "",
    internalNote: "",
  };
}

// ---------------------------------------------------------------------------
// Parsing and money
// ---------------------------------------------------------------------------

/** Positive decimal with up to `decimals` places, else undefined. */
function parseDecimal(raw: string, decimals: number): number | undefined {
  const s = raw.trim();
  if (!new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`).test(s)) return undefined;
  const n = Number(s);
  return n > 0 ? n : undefined;
}

function parseWhole(raw: string): number | undefined {
  return /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : undefined;
}

/** Price string → integer minor units (cents), avoiding float drift. */
export function toMinor(raw: string): number | undefined {
  const s = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  const [whole, frac = ""] = s.split(".");
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return minor > 0 ? minor : undefined;
}

export function formatMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export interface QuoteTotals {
  quantity?: number;
  unitMinor?: number;
  totalMinor?: number;
}

export function quoteTotals(v: QuoteFormValues): QuoteTotals {
  const quantity = parseDecimal(v.quantity, 3);
  const unitMinor = toMinor(v.unitPrice);
  const totalMinor = quantity !== undefined && unitMinor !== undefined ? Math.round(unitMinor * quantity) : undefined;
  return { quantity, unitMinor, totalMinor };
}

export function validUntil(v: QuoteFormValues): string | undefined {
  const days = parseWhole(v.validityDays);
  return days && days > 0 ? addDays(DEMO_TODAY, days) : undefined;
}

/** Available capacity expressed in the buyer's unit, where it converts. */
export function availableInBuyerUnit(o: BuyerOpportunity, product: ProductSummary | undefined): number | undefined {
  if (!product) return undefined;
  const t = product.supply.availableCapacity.value;
  if (o.quantity.unit === "MT") return t;
  if (o.quantity.unit === "KG") return t * 1000;
  return undefined;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type QuoteErrors = Partial<Record<QuoteField, string>>;

export function quoteErrors(v: QuoteFormValues, o: BuyerOpportunity, product: ProductSummary | undefined): QuoteErrors {
  const e: QuoteErrors = {};
  const { quantity, unitMinor } = quoteTotals(v);
  const available = availableInBuyerUnit(o, product);

  if (!v.specification) e.specification = "Confirm whether the product meets the buyer's specification.";
  if (quantity === undefined) e.quantity = "Enter a quantity greater than 0.";
  else if (available !== undefined && quantity > available)
    e.quantity = `Can't exceed your available capacity (${available.toLocaleString("en-US")} ${UNIT_SHORT[o.quantity.unit]}).`;
  if (unitMinor === undefined) e.unitPrice = "Enter a unit price above 0, up to 2 decimal places.";
  if (!v.namedPlace.trim()) e.namedPlace = "Enter the named place for the Incoterm.";
  if (!v.portOfLoading.trim()) e.portOfLoading = "Enter the port of loading.";

  const lead = parseWhole(v.leadTimeDays);
  if (!lead || lead < 1 || lead > 365) e.leadTimeDays = "Enter whole days between 1 and 365.";
  if (!v.dispatchDate) e.dispatchDate = "Choose the earliest dispatch date.";
  else if (v.dispatchDate < DEMO_TODAY) e.dispatchDate = "Dispatch can't be in the past.";
  if (!v.deliveryDate) e.deliveryDate = "Choose the estimated delivery date.";
  else if (v.dispatchDate && v.deliveryDate <= v.dispatchDate) e.deliveryDate = "Delivery must be after dispatch.";

  if (!v.packagingAsRequested && !v.packaging.trim()) e.packaging = "Describe the packaging you're offering.";
  if (!v.paymentTerm) e.paymentTerm = "Choose a payment term.";
  const advance = parseWhole(v.advancePercent);
  if (advance === undefined || advance > 100) e.advancePercent = "Enter a whole percentage from 0 to 100.";

  const validity = parseWhole(v.validityDays);
  if (!validity || validity < 1 || validity > 90) e.validityDays = "Enter 1–90 days.";

  if (Object.values(v.documents).some((r) => !r)) e.documents = "Answer every shipment document.";
  return e;
}

// ---------------------------------------------------------------------------
// Deviation engine (deterministic)
// ---------------------------------------------------------------------------

function placeMatches(offered: string, requested: string): boolean {
  const first = (s: string) => s.toLowerCase().split(/[,()/]/)[0]?.trim() ?? "";
  return first(offered) !== "" && first(offered) === first(requested);
}

export function quoteDeviations(v: QuoteFormValues, o: BuyerOpportunity): QuotationDeviation[] {
  const out: QuotationDeviation[] = [];
  const add = (d: Omit<QuotationDeviation, "id">, key: string = d.field) => out.push({ id: key, ...d });
  const unit = UNIT_SHORT[o.quantity.unit];
  const { quantity } = quoteTotals(v);

  if (v.specification === "differs") {
    add({
      field: "specification",
      severity: "warning",
      buyerRequirement: "As specified",
      exporterOffer: "Differs — see notes",
      message: "Product differs from the buyer's specification",
    });
  }

  if (quantity !== undefined) {
    const requested = o.quantity.amount;
    const min = o.quantity.minimumAcceptable;
    const fmt = (n: number) => `${n.toLocaleString("en-US")} ${unit}`;
    if (min !== undefined && quantity < min) {
      add({
        field: "quantity",
        severity: "blocking",
        buyerRequirement: `${fmt(requested)} (minimum ${fmt(min)})`,
        exporterOffer: fmt(quantity),
        message: `Below the buyer's minimum acceptable quantity of ${fmt(min)}`,
      });
    } else if (quantity < requested) {
      add({
        field: "quantity",
        severity: min !== undefined ? "info" : "warning",
        buyerRequirement: fmt(requested),
        exporterOffer: fmt(quantity),
        message: min !== undefined ? `Partial quantity offer (meets the ${fmt(min)} minimum)` : "Partial quantity offer",
      });
    } else if (quantity > requested) {
      add({ field: "quantity", severity: "info", buyerRequirement: fmt(requested), exporterOffer: fmt(quantity), message: "Offers more than requested" });
    }
  }

  const wanted = o.delivery.incoterm;
  if (wanted) {
    const offered = `${v.incoterm} ${v.namedPlace.trim()}`;
    const requested = `${wanted.term} ${wanted.namedPlace}`;
    if (v.incoterm !== wanted.term) {
      add({ field: "incoterm", severity: "warning", buyerRequirement: requested, exporterOffer: offered, message: `Incoterm deviation: ${v.incoterm} instead of ${wanted.term}` });
    } else if (v.namedPlace.trim() && !placeMatches(v.namedPlace, wanted.namedPlace)) {
      add({ field: "incoterm", severity: "warning", buyerRequirement: requested, exporterOffer: offered, message: "Named place differs from the buyer's" });
    }
  }
  const expected = defaultCoverage(v.incoterm);
  if (expected.freight === "included" && v.freight !== "included") {
    add({ field: "coverage", severity: "warning", buyerRequirement: `Freight included (${v.incoterm})`, exporterOffer: COST_COVERAGE_LABEL[v.freight], message: `Freight not included, inconsistent with ${v.incoterm}` }, "coverage-freight");
  }
  if (expected.insurance === "included" && v.insurance !== "included") {
    add({ field: "coverage", severity: "warning", buyerRequirement: `Insurance included (${v.incoterm})`, exporterOffer: COST_COVERAGE_LABEL[v.insurance], message: `Insurance not included, inconsistent with ${v.incoterm}` }, "coverage-insurance");
  }

  if (v.deliveryDate && v.deliveryDate > o.delivery.requiredBy) {
    const late = daysBetween(o.delivery.requiredBy, v.deliveryDate);
    add({
      field: "delivery",
      severity: "warning",
      buyerRequirement: `By ${o.delivery.requiredBy}`,
      exporterOffer: v.deliveryDate,
      message: `Delivery deviation: ${late} ${late === 1 ? "day" : "days"} after the required date`,
    });
  }

  if (o.quality.packaging && !v.packagingAsRequested) {
    add({ field: "packaging", severity: "warning", buyerRequirement: o.quality.packaging, exporterOffer: v.packaging.trim() || "—", message: "Packaging differs from the buyer's requirement" });
  }
  if (o.extendedTerms?.privateLabel && v.privateLabel === "not-available") {
    add({ field: "private-label", severity: "warning", buyerRequirement: "Private label required", exporterOffer: "Not available", message: "Private label not available" });
  }

  const wantedPay = o.commercial.paymentTerms;
  if (wantedPay && v.paymentTerm) {
    const advance = parseWhole(v.advancePercent) ?? 0;
    const offered = `${PAYMENT_TERM_LABEL[v.paymentTerm]}${advance > 0 ? `, ${advance}% advance` : ""}`;
    const requested = o.commercial.paymentNotes ?? PAYMENT_TERM_LABEL[wantedPay];
    if (v.paymentTerm !== wantedPay) {
      add({ field: "payment", severity: "warning", buyerRequirement: requested, exporterOffer: offered, message: "Payment-term deviation" });
    } else if (advance > 0 && wantedPay !== "advance") {
      add({ field: "payment", severity: "warning", buyerRequirement: requested, exporterOffer: offered, message: `Asks for ${advance}% advance the buyer didn't offer` });
    }
  }

  const prefCurrency = o.extendedTerms?.currency;
  if (prefCurrency && prefCurrency !== v.currency) {
    add({ field: "currency", severity: "info", buyerRequirement: prefCurrency, exporterOffer: v.currency, message: `Quoted in ${v.currency}; buyer prefers ${prefCurrency}` });
  }
  const askedValidity = o.extendedTerms?.quoteValidityDays;
  const validity = parseWhole(v.validityDays);
  if (askedValidity && validity && validity < askedValidity) {
    add({ field: "validity", severity: "info", buyerRequirement: `${askedValidity} days`, exporterOffer: `${validity} days`, message: "Shorter validity than the buyer asked for" });
  }

  for (const d of o.compliance.shipmentDocuments) {
    const r = v.documents[d.name];
    if (r === "cannot-provide") {
      add({ field: "compliance", severity: "warning", buyerRequirement: `${d.name} required`, exporterOffer: "Cannot provide", message: `Cannot provide ${d.name}` }, `doc-${d.name}`);
    } else if (r === "needs-arrangement") {
      add({ field: "compliance", severity: "info", buyerRequirement: `${d.name} required`, exporterOffer: "Needs arrangement", message: `${d.name} still needs arrangement` }, `doc-${d.name}`);
    }
  }
  if (o.quality.inspection && !v.inspectionAccepted) {
    add({ field: "inspection", severity: "warning", buyerRequirement: o.quality.inspection, exporterOffer: "Not accepted", message: "Buyer's inspection requirement not accepted" });
  }
  for (const c of o.compliance.standingCredentials) {
    const status = credentialStatus(c);
    if (status !== "available") {
      add(
        {
          field: "credential",
          severity: status === "missing" ? "warning" : "info",
          buyerRequirement: c.name,
          exporterOffer: status === "missing" ? "Not on profile" : "Pending verification",
          message: `${c.name} ${status === "missing" ? "missing from your profile" : "pending verification"}`,
        },
        `cred-${c.name}`,
      );
    }
  }
  return out;
}

export const SEVERITY_ORDER: Record<DeviationSeverity, number> = { blocking: 0, warning: 1, info: 2 };

// ---------------------------------------------------------------------------
// Readiness (not the match score)
// ---------------------------------------------------------------------------

export interface ReadinessCheck {
  key: string;
  label: string;
  ok: boolean;
}

export function quoteReadiness(v: QuoteFormValues, o: BuyerOpportunity, errors: QuoteErrors) {
  const checks: ReadinessCheck[] = [
    { key: "product", label: "Product confirmed", ok: !errors.specification },
    { key: "quantity", label: "Quantity valid", ok: !errors.quantity },
    { key: "price", label: "Price entered", ok: !errors.unitPrice },
    { key: "incoterm", label: "Incoterm confirmed", ok: !errors.namedPlace && !errors.portOfLoading },
    { key: "delivery", label: "Delivery entered", ok: !errors.leadTimeDays && !errors.dispatchDate && !errors.deliveryDate },
    { key: "packaging", label: "Packaging confirmed", ok: !errors.packaging },
    { key: "payment", label: "Payment terms selected", ok: !errors.paymentTerm && !errors.advancePercent },
    { key: "validity", label: "Validity set", ok: !errors.validityDays },
    { key: "compliance", label: "Compliance confirmed", ok: !errors.documents },
  ];
  const pending = o.compliance.shipmentDocuments
    .filter((d) => v.documents[d.name] === "needs-arrangement")
    .map((d) => `${d.name} still needs arrangement`);
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return { checks, pending, score };
}

// ---------------------------------------------------------------------------
// Building the quotation
// ---------------------------------------------------------------------------

function paymentSummary(v: QuoteFormValues): string {
  const term = v.paymentTerm ? PAYMENT_TERM_LABEL[v.paymentTerm] : "";
  const advance = parseWhole(v.advancePercent) ?? 0;
  return advance > 0 ? `${advance}% advance, ${term}` : term;
}

/**
 * Next demo quotation id. Exporter demo submissions use a reserved 9000+ range
 * so they can't collide with the importer's mock quotations (QT-2026-01xx).
 * Deterministic: derived from how many are already stored.
 */
export function nextDemoQuotationId(existing: readonly { id: string }[]): string {
  const max = existing.reduce((m, q) => Math.max(m, Number(q.id.split("-")[2]) || 0), 9000);
  return `QT-${DEMO_TODAY.slice(0, 4)}-${max + 1}`;
}

export function buildQuotation(
  v: QuoteFormValues,
  o: BuyerOpportunity,
  product: ProductSummary,
  meta: { id: string; now: string; createdAt?: string },
): ExporterQuotation {
  const { quantity = 0, unitMinor = 0, totalMinor = 0 } = quoteTotals(v);
  const internal = v.internalNote.trim();
  const notes = [v.buyerNotes.trim(), v.paymentNotes.trim() && `Payment: ${v.paymentNotes.trim()}`].filter(Boolean).join("\n");
  return {
    id: meta.id,
    requirementId: o.rfqId,
    opportunityId: o.opportunityId,
    exporterProductId: product.id,
    exporterCompanyId: EXPORTER_COMPANY_ID,
    status: "submitted",
    product: {
      description: o.product.specification,
      specificationAsRequested: v.specification === "as-requested",
      hsCode: o.product.hsCode ?? product.hsCode,
      quantity: { amount: quantity, unit: o.quantity.unit },
      moq: { amount: product.supply.moq.value, unit: "MT" },
      packaging: v.packagingAsRequested ? (o.quality.packaging ?? v.packaging) : v.packaging.trim(),
      packagingAsRequested: v.packagingAsRequested,
      origin: product.origin,
      privateLabel: v.privateLabel ? v.privateLabel === "available" : undefined,
    },
    price: {
      unitPrice: unitMinor / 100,
      currency: v.currency,
      incoterm: v.incoterm,
      namedPlace: v.namedPlace.trim(),
      pricingUnit: o.quantity.unit,
      total: totalMinor / 100,
    },
    costCoverage: { freight: v.freight, insurance: v.insurance },
    delivery: {
      portOfLoading: v.portOfLoading.trim(),
      leadTimeDays: parseWhole(v.leadTimeDays) ?? 0,
      mode: v.mode,
      earliestDispatch: v.dispatchDate,
      estimatedDelivery: v.deliveryDate,
    },
    commercial: {
      paymentTerm: v.paymentTerm as PaymentTerm,
      advancePercent: parseWhole(v.advancePercent) ?? 0,
      paymentSummary: paymentSummary(v),
      validUntil: validUntil(v) ?? DEMO_TODAY,
      notes: notes || undefined,
    },
    compliance: {
      documents: o.compliance.shipmentDocuments.map((d) => ({ name: d.name, response: v.documents[d.name] as ComplianceResponse })),
      inspection: o.quality.inspection,
      inspectionAccepted: o.quality.inspection ? v.inspectionAccepted : undefined,
    },
    deviations: quoteDeviations(v, o),
    internalNote: internal || undefined,
    createdAt: meta.createdAt ?? meta.now,
    updatedAt: meta.now,
    submittedAt: meta.now,
  };
}

/** Tonnes for summaries where the unit converts. */
export function quotedTonnes(v: QuoteFormValues, o: BuyerOpportunity): number | undefined {
  const { quantity } = quoteTotals(v);
  return quantity === undefined ? undefined : tonnes({ amount: quantity, unit: o.quantity.unit });
}

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Fills fields added after a quotation was stored (e.g. exporterCompanyId on
 * quotations submitted before it existed), so older local records still load.
 */
export function normalizeQuotation(q: ExporterQuotation): ExporterQuotation {
  return q.exporterCompanyId ? q : { ...q, exporterCompanyId: EXPORTER_COMPANY_ID };
}

/** IDs issued to quotations created in this browser (see nextDemoQuotationId). */
export const LOCAL_QUOTATION_ID = /^QT-\d{4}-9\d{3,}$/;

/** Days until validUntil on the demo clock; negative once past. */
export function validityDaysLeft(q: Pick<ExporterQuotation, "commercial">, today = DEMO_TODAY): number {
  return daysBetween(today, q.commercial.validUntil);
}

/** Stored status, with live quotations past their validity shown as expired. */
export function effectiveStatus(q: ExporterQuotation, today = DEMO_TODAY): ExporterQuotationStatus {
  return ACTIVE_STATUSES.includes(q.status) && validityDaysLeft(q, today) < 0 ? "expired" : q.status;
}

export function validityLabel(q: ExporterQuotation, today = DEMO_TODAY): { label: string; urgent: boolean } {
  const status = effectiveStatus(q, today);
  if (!ACTIVE_STATUSES.includes(status)) {
    return status === "expired" ? { label: "Expired", urgent: false } : { label: "—", urgent: false };
  }
  const left = validityDaysLeft(q, today);
  if (left === 0) return { label: "Expires today", urgent: true };
  return { label: `Valid for ${left} more ${left === 1 ? "day" : "days"}`, urgent: left <= 3 };
}
