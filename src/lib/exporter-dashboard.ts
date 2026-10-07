/*
 * Exporter dashboard: view types and mock data.
 *
 * These are exporter-side *views*, not the marketplace's domain model. They
 * stay local to the exporter until real RFQ / quotation / order entities exist
 * on a backend; then the mocks below are replaced by API calls returning the
 * same shapes.
 */

// ---------------------------------------------------------------------------
// Buyer opportunities
// ---------------------------------------------------------------------------

/**
 * A buyer requirement (RFQ) as an exporter sees it.
 *
 * Ximverse brokers the buyer relationship, so this type deliberately has no
 * buyer name, email, phone or contact person — only what an exporter needs to
 * decide whether and how to quote. Keep it that way: identity is released by
 * Ximverse at the appropriate stage, and must ultimately be withheld by the
 * backend, not just left out of the UI.
 */
export interface BuyerOpportunity {
  rfqId: string;
  product: string;
  /** Grade, packing and similar detail, if the buyer gave any. */
  specification?: string;
  buyerCountry: string;
  /** Buyer's industry / market segment, e.g. "Food distribution". */
  buyerMarket?: string;
  quantity: Quantity;
  incoterm: Incoterm;
  /** ISO date (YYYY-MM-DD) the buyer needs delivery by. */
  requiredBy: string;
  paymentPreference?: string;
  certifications?: readonly string[];
  /** 0–100: how well the requirement fits this exporter's profile. */
  matchScore: number;
  status: OpportunityStatus;
}

export type OpportunityStatus = "new" | "viewed" | "quoted";

export const OPPORTUNITY_STATUS_LABEL: Record<OpportunityStatus, string> = {
  new: "New",
  viewed: "Viewed",
  quoted: "Quoted",
};

export interface Quantity {
  value: number;
  unit: "MT";
}

export interface Incoterm {
  term: "EXW" | "FOB" | "CFR" | "CIF" | "DAP";
  /** Named port or place, e.g. "Jebel Ali". */
  place: string;
}

export const BUYER_OPPORTUNITIES: readonly BuyerOpportunity[] = [
  {
    rfqId: "RFQ-XM-1042",
    product: "Basmati Rice",
    specification: "1121 Steam, 25 kg bags",
    buyerCountry: "UAE",
    buyerMarket: "Food distribution",
    quantity: { value: 100, unit: "MT" },
    incoterm: { term: "CIF", place: "Jebel Ali" },
    requiredBy: "2026-10-20",
    paymentPreference: "LC at sight",
    certifications: ["HACCP", "Phytosanitary"],
    matchScore: 96,
    status: "new",
  },
  {
    rfqId: "RFQ-XM-1041",
    product: "1121 Basmati Rice",
    specification: "Sella, 40 kg bags",
    buyerCountry: "Saudi Arabia",
    buyerMarket: "Wholesale",
    quantity: { value: 250, unit: "MT" },
    incoterm: { term: "CFR", place: "Jeddah" },
    requiredBy: "2026-10-28",
    paymentPreference: "30% advance, 70% against documents",
    certifications: ["SFDA registration"],
    matchScore: 92,
    status: "new",
  },
  {
    rfqId: "RFQ-XM-1038",
    product: "Non-Basmati Rice",
    specification: "IR64 parboiled, 5% broken",
    buyerCountry: "United Kingdom",
    buyerMarket: "Retail",
    quantity: { value: 80, unit: "MT" },
    incoterm: { term: "CIF", place: "Felixstowe" },
    requiredBy: "2026-11-05",
    paymentPreference: "LC 30 days",
    certifications: ["BRCGS"],
    matchScore: 88,
    status: "viewed",
  },
  {
    rfqId: "RFQ-XM-1034",
    product: "Organic Coconut",
    specification: "Desiccated, fine grade",
    buyerCountry: "Germany",
    buyerMarket: "Food manufacturing",
    quantity: { value: 50, unit: "MT" },
    incoterm: { term: "CIF", place: "Hamburg" },
    requiredBy: "2026-11-12",
    paymentPreference: "CAD",
    certifications: ["EU Organic", "ISO 22000"],
    matchScore: 84,
    status: "new",
  },
  {
    rfqId: "RFQ-XM-1029",
    product: "Coconut Products",
    specification: "Virgin coconut oil and copra",
    buyerCountry: "USA",
    buyerMarket: "Health foods",
    quantity: { value: 120, unit: "MT" },
    incoterm: { term: "FOB", place: "Mundra" },
    requiredBy: "2026-11-18",
    paymentPreference: "TT 50/50",
    certifications: ["FDA registration", "USDA Organic"],
    matchScore: 81,
    status: "viewed",
  },
];

// ---------------------------------------------------------------------------
// Quotations
// ---------------------------------------------------------------------------

export type QuotationStatus =
  | "draft"
  | "submitted"
  | "under-review"
  | "shortlisted"
  | "negotiation"
  | "won"
  | "lost";

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  "under-review": "Under Review",
  shortlisted: "Shortlisted",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export interface Money {
  amount: number;
  currency: "USD" | "EUR" | "INR";
}

export interface QuotationSummary {
  quotationId: string;
  product: string;
  destinationCountry: string;
  /** Price per unit of `quantity`. */
  price: Money;
  quantity: Quantity;
  /** ISO date the quote was submitted. */
  submittedOn: string;
  status: QuotationStatus;
}

export const RECENT_QUOTATIONS: readonly QuotationSummary[] = [
  {
    quotationId: "QT-2041",
    product: "Basmati Rice",
    destinationCountry: "UAE",
    price: { amount: 1080, currency: "USD" },
    quantity: { value: 100, unit: "MT" },
    submittedOn: "2026-10-06",
    status: "shortlisted",
  },
  {
    quotationId: "QT-2037",
    product: "Rice",
    destinationCountry: "Saudi Arabia",
    price: { amount: 1025, currency: "USD" },
    quantity: { value: 200, unit: "MT" },
    submittedOn: "2026-10-04",
    status: "under-review",
  },
  {
    quotationId: "QT-2028",
    product: "Organic Coconut",
    destinationCountry: "Germany",
    price: { amount: 920, currency: "EUR" },
    quantity: { value: 40, unit: "MT" },
    submittedOn: "2026-10-01",
    status: "negotiation",
  },
];

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/** Order stages, in sequence. */
export const ORDER_STAGES = [
  "Order Confirmed",
  "Production",
  "Documentation",
  "Customs Clearance",
  "Shipment",
  "In Transit",
  "Delivered",
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];

export interface ActiveOrder {
  orderId: string;
  product: string;
  destinationCountry: string;
  stage: OrderStage;
  /** 0–100 overall completion. */
  progress: number;
}

export const ACTIVE_ORDERS: readonly ActiveOrder[] = [
  { orderId: "ORD-XM-3021", product: "Basmati Rice", destinationCountry: "UAE", stage: "Documentation", progress: 65 },
  { orderId: "ORD-XM-3018", product: "Rice", destinationCountry: "Saudi Arabia", stage: "Customs Clearance", progress: 82 },
  { orderId: "ORD-XM-3012", product: "Coconut", destinationCountry: "Germany", stage: "Production", progress: 35 },
];

// ---------------------------------------------------------------------------
// KPIs, actions and assistant prompts
// ---------------------------------------------------------------------------

export interface ExporterKpi {
  key: string;
  label: string;
  /** Pre-formatted headline figure. */
  value: string;
  detail: string;
  /** Highlights the detail line when it calls for attention. */
  emphasis?: boolean;
  /** Nav slug the card links to. */
  slug: string;
}

export const EXPORTER_KPIS: readonly ExporterKpi[] = [
  { key: "opportunities", label: "Buyer Opportunities", value: "12", detail: "+4 new today", emphasis: true, slug: "opportunities" },
  { key: "quotations", label: "Quotations Submitted", value: "8", detail: "3 awaiting response", slug: "quotations" },
  { key: "deals", label: "Active Deals", value: "5", detail: "₹28.4L potential value", slug: "deals" },
  { key: "orders", label: "Active Orders", value: "3", detail: "2 require action", emphasis: true, slug: "orders" },
  { key: "revenue", label: "Revenue", value: "₹42.6L", detail: "This month", slug: "analytics" },
];

export interface ActionItem {
  key: string;
  count: number;
  /** Completes the sentence after the count, e.g. "opportunities closing within 24 hours". */
  label: string;
  urgent?: boolean;
  slug: string;
}

export const ACTION_ITEMS: readonly ActionItem[] = [
  { key: "closing", count: 3, label: "opportunities closing within 24 hours", urgent: true, slug: "opportunities" },
  { key: "revisions", count: 2, label: "quotations awaiting revision", slug: "quotations" },
  { key: "missing-doc", count: 1, label: "shipment document missing", urgent: true, slug: "documents" },
  { key: "repricing", count: 1, label: "buyer requested updated pricing", slug: "quotations" },
];

export const SUMIT_PROMPTS: readonly string[] = [
  "Which opportunities should I prioritise?",
  "Compare my active quotations.",
  "What documents are missing?",
  "Which markets have the highest demand for my products?",
];

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10-20" → "20 Oct 2026". */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`));
}

export function formatQuantity({ value, unit }: Quantity): string {
  return `${value.toLocaleString("en-IN")} ${unit}`;
}

/** e.g. "$1,080 / MT". */
export function formatUnitPrice({ amount, currency }: Money, unit: Quantity["unit"]): string {
  const price = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
  return `${price} / ${unit}`;
}
