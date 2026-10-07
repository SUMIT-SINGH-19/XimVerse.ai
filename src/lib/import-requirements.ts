/**
 * Import requirements (RFQs): what an importer needs to buy, structured so it
 * can later be sent to suppliers for quotation.
 *
 * Types are shaped like the API objects they will eventually come from. The
 * requirements themselves are MOCK data until a backend exists.
 */

/* ------------------------------------------------------------------------ */
/* Vocabularies                                                              */
/* ------------------------------------------------------------------------ */

export type RequirementStatus =
  | "draft"
  | "ready"
  | "published"
  | "receiving-quotes"
  | "under-review"
  | "supplier-selected"
  | "closed";

export const REQUIREMENT_STATUSES: readonly { id: RequirementStatus; label: string }[] = [
  { id: "draft", label: "Draft" },
  // Structured and complete, but not yet distributed to suppliers.
  { id: "ready", label: "Ready for Sourcing" },
  { id: "published", label: "Published" },
  { id: "receiving-quotes", label: "Receiving Quotes" },
  { id: "under-review", label: "Under Review" },
  { id: "supplier-selected", label: "Supplier Selected" },
  { id: "closed", label: "Closed" },
];

export function statusLabel(status: RequirementStatus): string {
  return REQUIREMENT_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export const PRODUCT_CATEGORIES = [
  "Agriculture & Food",
  "Chemicals",
  "Metals & Minerals",
  "Machinery",
  "Textiles",
  "Electronics",
  "Automotive",
  "Other",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const QUANTITY_UNITS = [
  { id: "KG", label: "KG", short: "kg" },
  { id: "MT", label: "MT (metric tonnes)", short: "MT" },
  { id: "UNITS", label: "Units", short: "units" },
  { id: "LITRES", label: "Litres", short: "litres" },
  { id: "CBM", label: "CBM", short: "CBM" },
  { id: "CONTAINERS", label: "Containers", short: "containers" },
] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number]["id"];

export function unitShort(unit: QuantityUnit): string {
  return QUANTITY_UNITS.find((u) => u.id === unit)?.short ?? unit;
}

export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;
export type Incoterm = (typeof INCOTERMS)[number];

export const CURRENCIES = ["USD", "EUR", "GBP", "AED", "INR", "CNY"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PAYMENT_TERMS = [
  { id: "advance", label: "Advance" },
  { id: "lc", label: "Letter of Credit (LC)" },
  { id: "dp", label: "Documents Against Payment (DP)" },
  { id: "da", label: "Documents Against Acceptance (DA)" },
  { id: "open-account", label: "Open Account" },
  { id: "negotiable", label: "Negotiable / Other" },
] as const;
export type PaymentTerm = (typeof PAYMENT_TERMS)[number]["id"];

export function paymentTermLabel(term: PaymentTerm): string {
  return PAYMENT_TERMS.find((t) => t.id === term)?.label ?? term;
}

/** Suggestions only; nothing here implies a certificate is legally required. */
export const EXAMPLE_CERTIFICATIONS = [
  "Certificate of Origin",
  "Phytosanitary Certificate",
  "Fumigation Certificate",
  "Health Certificate",
  "Inspection Certificate",
] as const;

export const ATTACHMENT_KINDS = [
  { id: "specification", label: "Product specification" },
  { id: "image", label: "Reference image" },
  { id: "technical-sheet", label: "Technical sheet" },
  { id: "previous-spec", label: "Previous purchase specification" },
  { id: "other", label: "Other document" },
] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]["id"];

export function attachmentKindLabel(kind: AttachmentKind): string {
  return ATTACHMENT_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

/* ------------------------------------------------------------------------ */
/* Model                                                                     */
/* ------------------------------------------------------------------------ */

export interface ProductRequirement {
  name: string;
  category: ProductCategory;
  specification: string;
  hsCode?: string;
}

export interface Quantity {
  amount: number;
  unit: QuantityUnit;
  minimumAcceptable?: number;
}

export interface DeliveryRequirement {
  destinationCountry: string;
  destinationLocation: string;
  /** YYYY-MM-DD */
  requiredBy: string;
  incoterm?: Incoterm;
}

export interface CommercialTerms {
  /** Price per unit of the requested quantity. */
  targetPrice?: { amount: number; currency: Currency };
  paymentTerms?: PaymentTerm;
  paymentNotes?: string;
}

export interface QualityRequirements {
  /** Certifications the importer asks the supplier to provide. */
  certifications: string[];
  inspection?: string;
  packaging?: string;
  originPreference?: string;
}

export interface SupplierPreferences {
  preferredRegions?: string;
  manufacturerRequired: boolean;
  tradersAcceptable: boolean;
  minimumExperienceYears?: number;
  supplierToInvite?: string;
}

export interface RequirementAttachment {
  id: string;
  name: string;
  kind: AttachmentKind;
  sizeBytes: number;
}

export interface RequirementActivity {
  id: string;
  /** ISO timestamp. */
  at: string;
  message: string;
}

export interface ImportRequirement {
  id: string;
  status: RequirementStatus;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  product: ProductRequirement;
  quantity: Quantity;
  delivery: DeliveryRequirement;
  commercial: CommercialTerms;
  quality: QualityRequirements;
  supplierPreferences: SupplierPreferences;
  attachments: RequirementAttachment[];
  /** May be shared with suppliers. */
  additionalNotes?: string;
  /** Never leaves the importer's organisation. */
  internalNotes?: string;
  quotationCount: number;
  activity: RequirementActivity[];
}

/* ------------------------------------------------------------------------ */
/* Mock data                                                                 */
/* ------------------------------------------------------------------------ */

/** The moment the mock data describes; "updated 2 days ago" is relative to it. */
export const MOCK_NOW = "2026-10-07T09:30:00Z";

const NO_PREFERENCES: SupplierPreferences = { manufacturerRequired: false, tradersAcceptable: true };

export const MOCK_REQUIREMENTS: readonly ImportRequirement[] = [
  {
    id: "RFQ-2026-0048",
    status: "receiving-quotes",
    createdAt: "2026-09-28T06:15:00Z",
    updatedAt: "2026-10-07T07:40:00Z",
    product: {
      name: "Basmati Rice",
      category: "Agriculture & Food",
      specification:
        "1121 Steam Basmati Rice. Average grain length 8.35 mm minimum, moisture 12.5% max, broken 2% max, sortexed and double polished. Current crop.",
      hsCode: "1006.30",
    },
    quantity: { amount: 500, unit: "MT", minimumAcceptable: 250 },
    delivery: {
      destinationCountry: "United Arab Emirates",
      destinationLocation: "Jebel Ali, UAE",
      requiredBy: "2026-11-30",
      incoterm: "CIF",
    },
    commercial: {
      targetPrice: { amount: 1050, currency: "USD" },
      paymentTerms: "lc",
      paymentNotes: "LC at sight, confirmed by a UAE bank.",
    },
    quality: {
      certifications: ["Certificate of Origin", "Phytosanitary Certificate", "Fumigation Certificate"],
      inspection: "Pre-shipment inspection by SGS or equivalent at loading port.",
      packaging: "25 kg non-woven PP bags with buyer's private label.",
      originPreference: "India",
    },
    supplierPreferences: {
      preferredRegions: "India, Pakistan",
      manufacturerRequired: true,
      tradersAcceptable: false,
      minimumExperienceYears: 5,
    },
    attachments: [
      { id: "att-1", name: "basmati-1121-spec.pdf", kind: "specification", sizeBytes: 248_000 },
      { id: "att-2", name: "private-label-artwork.png", kind: "image", sizeBytes: 1_420_000 },
    ],
    additionalNotes: "Shipment can be split across two vessels if needed.",
    internalNotes: "Ramadan demand — prefer arrival before mid-December.",
    quotationCount: 8,
    activity: [
      { id: "a1", at: "2026-10-07T07:40:00Z", message: "8th quotation received" },
      { id: "a2", at: "2026-10-02T11:05:00Z", message: "First quotation received" },
      { id: "a3", at: "2026-09-29T04:30:00Z", message: "Requirement published" },
      { id: "a4", at: "2026-09-28T06:15:00Z", message: "Requirement created" },
    ],
  },
  {
    id: "RFQ-2026-0047",
    status: "under-review",
    createdAt: "2026-09-22T09:00:00Z",
    updatedAt: "2026-10-06T13:20:00Z",
    product: {
      name: "Refined Sunflower Oil",
      category: "Agriculture & Food",
      specification:
        "100% refined, deodorised, winterised sunflower oil. FFA 0.1% max, peroxide value 2 meq/kg max.",
      hsCode: "1512.19",
    },
    quantity: { amount: 200, unit: "MT" },
    delivery: {
      destinationCountry: "India",
      destinationLocation: "Mumbai, India",
      requiredBy: "2026-12-15",
      incoterm: "CFR",
    },
    commercial: {
      targetPrice: { amount: 1180, currency: "USD" },
      paymentTerms: "dp",
    },
    quality: {
      certifications: ["Certificate of Origin", "Health Certificate"],
      packaging: "Flexitanks, 20 ft containers.",
    },
    supplierPreferences: { preferredRegions: "Ukraine, Russia, Argentina", manufacturerRequired: false, tradersAcceptable: true },
    attachments: [],
    quotationCount: 3,
    activity: [
      { id: "a1", at: "2026-10-06T13:20:00Z", message: "Moved to review" },
      { id: "a2", at: "2026-09-23T08:00:00Z", message: "Requirement published" },
      { id: "a3", at: "2026-09-22T09:00:00Z", message: "Requirement created" },
    ],
  },
  {
    id: "RFQ-2026-0046",
    status: "published",
    createdAt: "2026-10-03T10:45:00Z",
    updatedAt: "2026-10-04T05:10:00Z",
    product: {
      name: "Copper Cathodes",
      category: "Metals & Minerals",
      specification: "Grade A copper cathodes, 99.99% Cu minimum, LME registered brand preferred.",
      hsCode: "7403.11",
    },
    quantity: { amount: 100, unit: "MT" },
    delivery: {
      destinationCountry: "India",
      destinationLocation: "Chennai, India",
      requiredBy: "2026-12-20",
      incoterm: "FOB",
    },
    commercial: { paymentTerms: "lc", paymentNotes: "LC 30 days." },
    quality: {
      certifications: ["Certificate of Origin", "Inspection Certificate"],
      inspection: "Third-party assay certificate required.",
    },
    supplierPreferences: { preferredRegions: "Chile, Zambia, DR Congo", manufacturerRequired: false, tradersAcceptable: true, minimumExperienceYears: 3 },
    attachments: [],
    quotationCount: 0,
    activity: [
      { id: "a1", at: "2026-10-04T05:10:00Z", message: "Requirement published" },
      { id: "a2", at: "2026-10-03T10:45:00Z", message: "Requirement created" },
    ],
  },
  {
    id: "RFQ-2026-0045",
    status: "draft",
    createdAt: "2026-10-05T12:00:00Z",
    updatedAt: "2026-10-06T08:25:00Z",
    product: {
      name: "Industrial Pumps",
      category: "Machinery",
      specification: "Centrifugal process pumps, 50 m³/h at 40 m head, SS316 wetted parts, 415 V / 50 Hz motors.",
    },
    quantity: { amount: 24, unit: "UNITS" },
    delivery: {
      destinationCountry: "India",
      destinationLocation: "Nhava Sheva, India",
      requiredBy: "2027-01-10",
      incoterm: "CIF",
    },
    commercial: { paymentTerms: "negotiable" },
    quality: { certifications: [] },
    supplierPreferences: { manufacturerRequired: true, tradersAcceptable: false },
    attachments: [{ id: "att-1", name: "pump-datasheet.pdf", kind: "technical-sheet", sizeBytes: 612_000 }],
    quotationCount: 0,
    activity: [
      { id: "a1", at: "2026-10-06T08:25:00Z", message: "Draft updated" },
      { id: "a2", at: "2026-10-05T12:00:00Z", message: "Draft created" },
    ],
  },
  {
    id: "RFQ-2026-0044",
    status: "supplier-selected",
    createdAt: "2026-08-30T07:30:00Z",
    updatedAt: "2026-09-26T10:00:00Z",
    product: {
      name: "Cotton Yarn",
      category: "Textiles",
      specification: "30s combed cotton yarn for knitting, 100% cotton, compact spun.",
      hsCode: "5205.24",
    },
    quantity: { amount: 40, unit: "MT" },
    delivery: {
      destinationCountry: "Bangladesh",
      destinationLocation: "Chittagong, Bangladesh",
      requiredBy: "2026-11-05",
      incoterm: "CFR",
    },
    commercial: { targetPrice: { amount: 3.1, currency: "USD" }, paymentTerms: "lc" },
    quality: { certifications: ["Certificate of Origin"], packaging: "Cartons on pallets." },
    supplierPreferences: NO_PREFERENCES,
    attachments: [],
    quotationCount: 5,
    activity: [
      { id: "a1", at: "2026-09-26T10:00:00Z", message: "Supplier selected" },
      { id: "a2", at: "2026-08-31T06:00:00Z", message: "Requirement published" },
      { id: "a3", at: "2026-08-30T07:30:00Z", message: "Requirement created" },
    ],
  },
  {
    id: "RFQ-2026-0043",
    status: "closed",
    createdAt: "2026-07-14T05:00:00Z",
    updatedAt: "2026-08-20T09:45:00Z",
    product: {
      name: "Lithium-ion Battery Cells",
      category: "Electronics",
      specification: "LFP prismatic cells, 3.2 V 280 Ah, cycle life ≥ 6000.",
      hsCode: "8507.60",
    },
    quantity: { amount: 2, unit: "CONTAINERS" },
    delivery: {
      destinationCountry: "India",
      destinationLocation: "Nhava Sheva, India",
      requiredBy: "2026-09-15",
      incoterm: "CIF",
    },
    commercial: { paymentTerms: "advance", paymentNotes: "30% advance, 70% against B/L copy." },
    quality: { certifications: ["Certificate of Origin", "Inspection Certificate"] },
    supplierPreferences: { preferredRegions: "China", manufacturerRequired: true, tradersAcceptable: false },
    attachments: [],
    quotationCount: 6,
    activity: [
      { id: "a1", at: "2026-08-20T09:45:00Z", message: "Requirement closed" },
      { id: "a2", at: "2026-07-15T04:00:00Z", message: "Requirement published" },
      { id: "a3", at: "2026-07-14T05:00:00Z", message: "Requirement created" },
    ],
  },
];

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

export const REQUIREMENT_ID_PATTERN = /^RFQ-\d{4}-\d{4,}$/;

/** Next sequential reference after the highest one in `existing`. */
export function nextRequirementId(existing: readonly ImportRequirement[], year: number): string {
  const max = existing.reduce((m, r) => Math.max(m, Number(r.id.split("-")[2]) || 0), 0);
  return `RFQ-${year}-${String(max + 1).padStart(4, "0")}`;
}

export function formatQuantity(q: { amount: number; unit: QuantityUnit }): string {
  const short = unitShort(q.unit);
  const unit = q.amount === 1 && short.endsWith("s") ? short.slice(0, -1) : short;
  return `${q.amount.toLocaleString("en-US")} ${unit}`;
}

export function formatPrice(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Whether suppliers could currently be quoting on it. */
export function isAwaitingQuotations(r: ImportRequirement): boolean {
  return r.status === "published" || r.status === "receiving-quotes";
}

export function isActive(r: ImportRequirement): boolean {
  return r.status !== "draft" && r.status !== "closed";
}
