/*
 * Buyer opportunities: importer RFQs as an exporter is allowed to see them.
 *
 * One source for the dashboard, the opportunities list and the detail page.
 *
 * This is a *projection* of the importer's ImportRequirement
 * (src/lib/import-requirements.ts), not a second RFQ schema. Field names and
 * vocabularies follow the importer model — product / quantity / delivery /
 * commercial / quality — so the two sides describe the same requirement the
 * same way. The RFQ ID is the canonical Ximverse reference; RFQ-2026-0048 here
 * is the importer's RFQ-2026-0048 seen from the supply side.
 *
 * Every other opportunity is exporter-only demo data and uses the DEMO-RFQ-
 * namespace, so it can never collide with an ID the importer's create flow
 * issues (RFQ-2026-0049 onwards).
 *
 * What's left out, by construction:
 *   - buyer identity and contact (company, person, email, phone, address);
 *   - target price, internal notes, invited-supplier name, attachments,
 *     importer activity and other suppliers' quotations.
 *
 * Those fields don't exist on these types — they aren't hidden in the UI,
 * they're never in the object. Real authorisation must enforce the same rule
 * server-side: exporter responses are built from this projection, never from
 * the full requirement.
 *
 * Added on the exporter side: the opportunity reference and status (this
 * exporter's relationship to the RFQ), timeline points, the buyer's region /
 * industry (company-profile facts, non-identifying), a compliance split into
 * standing credentials vs shipment documents, and the match against this
 * exporter's catalogue. Fields the importer form doesn't capture yet live in
 * `extendedTerms` and are flagged as such in the UI.
 *
 * Vocabularies are imported as *types only*, so the importer's mock data never
 * ends up in exporter bundles. Labels below are keyed by the importer's ids,
 * so a new unit or payment term there fails to compile here until it's labelled.
 */

import type { Incoterm, PaymentTerm, QuantityUnit, RequirementStatus } from "./import-requirements";
import { CERTIFICATIONS } from "./exporter-company";

export type { Incoterm, PaymentTerm, QuantityUnit };

// ---------------------------------------------------------------------------
// Vocabulary labels (keyed by the importer's ids)
// ---------------------------------------------------------------------------

export const UNIT_SHORT: Record<QuantityUnit, string> = {
  KG: "kg",
  MT: "MT",
  UNITS: "units",
  LITRES: "litres",
  CBM: "CBM",
  CONTAINERS: "containers",
};

export const PAYMENT_TERM_LABEL: Record<PaymentTerm, string> = {
  advance: "Advance",
  lc: "Letter of Credit (LC)",
  dp: "Documents Against Payment (DP)",
  da: "Documents Against Acceptance (DA)",
  "open-account": "Open Account",
  negotiable: "Negotiable / Other",
};

/** The RFQ statuses an exporter can encounter (drafts are never shared). */
export type VisibleRfqStatus = Extract<
  RequirementStatus,
  "published" | "receiving-quotes" | "under-review" | "supplier-selected" | "closed"
>;

export const RFQ_STATUS_LABEL: Record<VisibleRfqStatus, string> = {
  published: "Published",
  "receiving-quotes": "Receiving Quotes",
  "under-review": "Under Review",
  "supplier-selected": "Supplier Selected",
  closed: "Closed",
};

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/** One structured specification line; keys differ per product. */
export interface SpecificationItem {
  label: string;
  value: string;
}

/** Mirrors ImportRequirement.product. */
export interface OpportunityProduct {
  name: string;
  category: string;
  /** The buyer's specification text, as written. */
  specification: string;
  /** The same specification structured by Ximverse for comparison. */
  specificationItems?: readonly SpecificationItem[];
  hsCode?: string;
}

/**
 * Mirrors ImportRequirement.quantity. Any importer unit, not just MT — the
 * exporter catalogue's MT-only Quantity is deliberately not used here.
 */
export interface OpportunityQuantity {
  amount: number;
  unit: QuantityUnit;
  minimumAcceptable?: number;
}

/**
 * Incoterm with its named place: destination port for C/D terms, loading port
 * for F terms. The importer model stores only the term today.
 */
export interface OpportunityIncoterm {
  term: Incoterm;
  namedPlace: string;
}

/** Mirrors ImportRequirement.delivery, with a named-place Incoterm. */
export interface OpportunityDelivery {
  destinationCountry: string;
  destinationLocation: string;
  /** YYYY-MM-DD */
  requiredBy: string;
  incoterm?: OpportunityIncoterm;
}

/** ImportRequirement.commercial without targetPrice. */
export interface OpportunityCommercial {
  paymentTerms?: PaymentTerm;
  paymentNotes?: string;
}

/** ImportRequirement.quality minus certifications (see OpportunityCompliance). */
export interface OpportunityQuality {
  inspection?: string;
  packaging?: string;
  originPreference?: string;
}

/**
 * A credential the exporter holds independently of any shipment (APEDA, FSSAI,
 * ISO 22000…). Status is read from the company profile via
 * `companyCertificationKey`, so it can never disagree with Company Profile.
 */
export interface StandingCredentialRequirement {
  name: string;
  companyCertificationKey?: string;
  /** Asked for by the buyer, or a standard requirement for this product/lane. */
  source: "buyer" | "export-requirement";
}

export type CredentialStatus = "available" | "pending" | "missing";

/** A document issued for this consignment (CoO, phytosanitary, inspection…). */
export type ShipmentDocumentStatus = "per-shipment" | "required" | "needs-action";

export interface ShipmentDocumentRequirement {
  name: string;
  status: ShipmentDocumentStatus;
  note?: string;
}

/**
 * The importer's single certifications list, split by Ximverse into standing
 * credentials and shipment documents.
 */
export interface OpportunityCompliance {
  standingCredentials: readonly StandingCredentialRequirement[];
  shipmentDocuments: readonly ShipmentDocumentRequirement[];
}

/**
 * Terms the importer RFQ form doesn't capture yet. Opportunity-level demo data
 * until the RFQ schema grows these fields; flagged in the UI.
 */
export interface ExtendedTerms {
  privateLabel?: boolean;
  partialShipment?: boolean;
  shipmentPreference?: string;
  currency?: string;
  quoteValidityDays?: number;
}

/** ImportRequirement.supplierPreferences without supplierToInvite or preferredRegions. */
export interface SupplierRequirements {
  manufacturerRequired: boolean;
  tradersAcceptable: boolean;
  minimumExperienceYears?: number;
}

export const BUYER_REGIONS = ["Middle East", "Europe", "North America", "Asia Pacific"] as const;
export type BuyerRegion = (typeof BUYER_REGIONS)[number];

/** Facts from the buyer's company profile that don't identify the buyer. */
export interface BuyerContext {
  country: string;
  region: BuyerRegion;
  industry?: string;
}

export type MatchFactor =
  | "product"
  | "specification"
  | "capacity"
  | "destination"
  | "certification"
  | "lead-time"
  | "commercial";

/**
 * One reason behind a match score. Shaped so a matching service (or SUMIT)
 * can emit these later; today they're written by hand.
 */
export interface OpportunityMatchReason {
  factor: MatchFactor;
  kind: "strength" | "gap";
  label: string;
}

export interface OpportunityMatch {
  /** 0–100. */
  score: number;
  /** ExporterProduct.id of the catalogue product that produced the match. */
  matchedProductId: string;
  reasons: readonly OpportunityMatchReason[];
}

/** This exporter's progress on the opportunity — not the RFQ's status. */
export type OpportunityStatus = "new" | "viewed" | "considering" | "quoted" | "closed";

export const OPPORTUNITY_STATUS_LABEL: Record<OpportunityStatus, string> = {
  new: "New",
  viewed: "Viewed",
  considering: "Considering",
  quoted: "Quotation Submitted",
  closed: "Closed",
};

export interface BuyerOpportunity {
  /** Canonical Ximverse requirement reference, shared with the importer side. */
  rfqId: string;
  /** This exporter's opportunity: RFQ + exporter + matched product. */
  opportunityId: string;
  rfqStatus: VisibleRfqStatus;
  status: OpportunityStatus;
  /** ISO timestamps. */
  rfqPublishedAt: string;
  matchedAt: string;
  sharedAt: string;
  /** Belongs to the RFQ conceptually; the importer schema doesn't have it yet. */
  quotesDueAt: string;
  product: OpportunityProduct;
  quantity: OpportunityQuantity;
  delivery: OpportunityDelivery;
  commercial: OpportunityCommercial;
  quality: OpportunityQuality;
  compliance: OpportunityCompliance;
  extendedTerms?: ExtendedTerms;
  supplierRequirements: SupplierRequirements;
  buyer: BuyerContext;
  /** The importer's notes marked "may be shared with suppliers". */
  buyerNotes?: string;
  match: OpportunityMatch;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

/**
 * The instant the mock data describes, so "closes in 18h" stays stable.
 * Same moment as the importer mock (MOCK_NOW in import-requirements.ts).
 */
export const OPPORTUNITIES_NOW = "2026-10-07T09:30:00Z";

const FOOD = "Agriculture & Food";
const RICE_HS = "1006.30";
const MANUFACTURER_PREFERRED: SupplierRequirements = {
  manufacturerRequired: true,
  tradersAcceptable: false,
  minimumExperienceYears: 5,
};
const ANY_SUPPLIER: SupplierRequirements = { manufacturerRequired: false, tradersAcceptable: true };

const strength = (factor: MatchFactor, label: string): OpportunityMatchReason => ({ factor, kind: "strength", label });
const gap = (factor: MatchFactor, label: string): OpportunityMatchReason => ({ factor, kind: "gap", label });
const standing = (
  name: string,
  companyCertificationKey?: string,
  source: StandingCredentialRequirement["source"] = "export-requirement",
): StandingCredentialRequirement => ({ name, companyCertificationKey, source });
const doc = (name: string, status: ShipmentDocumentStatus = "per-shipment", note?: string): ShipmentDocumentRequirement => ({
  name,
  status,
  note,
});

const APEDA = standing("APEDA Registration", "apeda");
const FSSAI = standing("FSSAI Licence", "fssai");

export const BUYER_OPPORTUNITIES: readonly BuyerOpportunity[] = [
  {
    // The importer's RFQ-2026-0048, projected for this exporter.
    rfqId: "RFQ-2026-0048",
    opportunityId: "OPP-2026-0312",
    rfqStatus: "receiving-quotes",
    status: "new",
    rfqPublishedAt: "2026-09-29T04:30:00Z",
    matchedAt: "2026-10-06T08:00:00Z",
    sharedAt: "2026-10-06T10:00:00Z",
    quotesDueAt: "2026-10-08T03:30:00Z",
    product: {
      name: "1121 Steam Basmati Rice",
      category: FOOD,
      specification:
        "1121 Steam Basmati Rice. Average grain length 8.35 mm minimum, moisture 12.5% max, broken 2% max, sortexed and double polished. Current crop.",
      specificationItems: [
        { label: "Variety", value: "1121" },
        { label: "Processing", value: "Steam" },
        { label: "Average Grain Length", value: "8.35 mm minimum" },
        { label: "Moisture", value: "Max 12.5%" },
        { label: "Broken Grain", value: "Max 2%" },
        { label: "Finish", value: "Sortexed, double polished" },
        { label: "Crop Year", value: "Current crop (2026)" },
      ],
      hsCode: RICE_HS,
    },
    quantity: { amount: 500, unit: "MT", minimumAcceptable: 250 },
    delivery: {
      destinationCountry: "United Arab Emirates",
      destinationLocation: "Jebel Ali, UAE",
      requiredBy: "2026-11-30",
      incoterm: { term: "CIF", namedPlace: "Jebel Ali, UAE" },
    },
    commercial: { paymentTerms: "lc", paymentNotes: "LC at sight, confirmed by a UAE bank." },
    quality: {
      inspection: "Pre-shipment inspection by SGS or equivalent at loading port.",
      packaging: "25 kg non-woven PP bags with buyer's private label.",
      originPreference: "India",
    },
    compliance: {
      standingCredentials: [APEDA, FSSAI],
      shipmentDocuments: [
        doc("Certificate of Origin"),
        doc("Phytosanitary Certificate"),
        doc("Fumigation Certificate", "needs-action", "Book a fumigation agency before stuffing."),
        doc("Inspection Certificate", "required", "SGS or equivalent, at loading port."),
      ],
    },
    extendedTerms: {
      privateLabel: true,
      partialShipment: true,
      shipmentPreference: "20 ft FCL; split across two vessels acceptable",
      currency: "USD",
      quoteValidityDays: 7,
    },
    supplierRequirements: MANUFACTURER_PREFERRED,
    buyer: { country: "United Arab Emirates", region: "Middle East", industry: "Food importer / distributor" },
    buyerNotes: "Shipment can be split across two vessels if needed.",
    match: {
      score: 93,
      matchedProductId: "rice-1121-steam",
      reasons: [
        strength("product", "Exact product match"),
        strength("specification", "Specification within your 1121 Steam profile"),
        strength("destination", "Previous UAE export experience"),
        strength("certification", "Required credentials available"),
        strength("lead-time", "Lead time fits the 30 Nov delivery"),
        gap("capacity", "500 MT uses 81% of your 620 MT available — buyer accepts 250 MT minimum"),
        gap("certification", "Fumigation certificate must be arranged for this shipment"),
      ],
    },
  },
  {
    rfqId: "DEMO-RFQ-1001",
    opportunityId: "OPP-2026-0311",
    rfqStatus: "published",
    status: "new",
    rfqPublishedAt: "2026-10-05T06:00:00Z",
    matchedAt: "2026-10-06T07:00:00Z",
    sharedAt: "2026-10-06T08:20:00Z",
    quotesDueAt: "2026-10-09T12:00:00Z",
    product: {
      name: "1121 Golden Sella Basmati Rice",
      category: FOOD,
      specification: "Golden sella, average grain length 8.30 mm min, moisture 12% max, uniform colour.",
      specificationItems: [
        { label: "Variety", value: "1121" },
        { label: "Processing", value: "Golden Sella (parboiled)" },
        { label: "Average Grain Length", value: "8.30 mm minimum" },
        { label: "Moisture", value: "Max 12%" },
        { label: "Colour", value: "Uniform golden" },
      ],
      hsCode: RICE_HS,
    },
    quantity: { amount: 250, unit: "MT", minimumAcceptable: 150 },
    delivery: {
      destinationCountry: "Saudi Arabia",
      destinationLocation: "Jeddah, Saudi Arabia",
      requiredBy: "2026-10-28",
      incoterm: { term: "CFR", namedPlace: "Jeddah, Saudi Arabia" },
    },
    commercial: { paymentTerms: "advance", paymentNotes: "30% advance, 70% against documents." },
    quality: { packaging: "40 kg PP bags." },
    compliance: {
      standingCredentials: [APEDA, standing("SFDA Registration", undefined, "buyer")],
      shipmentDocuments: [doc("Certificate of Origin"), doc("Health Certificate")],
    },
    extendedTerms: { currency: "USD", quoteValidityDays: 10 },
    supplierRequirements: MANUFACTURER_PREFERRED,
    buyer: { country: "Saudi Arabia", region: "Middle East", industry: "Wholesale" },
    match: {
      score: 92,
      matchedProductId: "rice-1121-golden-sella",
      reasons: [
        strength("product", "Exact product match"),
        strength("capacity", "Capacity available — 430 MT free for 250 MT"),
        strength("destination", "Destination experience: Saudi Arabia"),
        gap("certification", "SFDA registration not on your profile"),
      ],
    },
  },
  {
    rfqId: "DEMO-RFQ-1002",
    opportunityId: "OPP-2026-0309",
    rfqStatus: "receiving-quotes",
    status: "considering",
    rfqPublishedAt: "2026-10-03T05:00:00Z",
    matchedAt: "2026-10-04T09:00:00Z",
    sharedAt: "2026-10-05T07:00:00Z",
    quotesDueAt: "2026-10-07T20:30:00Z",
    product: {
      name: "1121 Steam Basmati Rice",
      category: FOOD,
      specification: "Average grain length 8.3 mm min, broken 2% max, double polished.",
      specificationItems: [
        { label: "Variety", value: "1121" },
        { label: "Processing", value: "Steam" },
        { label: "Average Grain Length", value: "8.30 mm minimum" },
        { label: "Broken Grain", value: "Max 2%" },
      ],
      hsCode: RICE_HS,
    },
    quantity: { amount: 60, unit: "MT" },
    delivery: {
      destinationCountry: "Qatar",
      destinationLocation: "Hamad Port, Qatar",
      requiredBy: "2026-11-01",
      incoterm: { term: "CFR", namedPlace: "Hamad Port, Qatar" },
    },
    commercial: { paymentTerms: "advance" },
    quality: { packaging: "10 kg BOPP printed bags." },
    compliance: {
      standingCredentials: [standing("HACCP", "haccp", "buyer")],
      shipmentDocuments: [doc("Certificate of Origin"), doc("Halal Certificate", "required", "Issued by an approved certifier per consignment.")],
    },
    extendedTerms: { privateLabel: false, partialShipment: false, currency: "USD", quoteValidityDays: 5 },
    supplierRequirements: ANY_SUPPLIER,
    buyer: { country: "Qatar", region: "Middle East", industry: "Retail" },
    match: {
      score: 91,
      matchedProductId: "rice-1121-steam",
      reasons: [
        strength("product", "Exact product match"),
        strength("destination", "Destination experience: Qatar"),
        strength("certification", "Required credentials available"),
        gap("commercial", "Small lot: 60 MT is close to your 25 MT MOQ economics"),
      ],
    },
  },
  {
    rfqId: "DEMO-RFQ-1003",
    opportunityId: "OPP-2026-0305",
    rfqStatus: "receiving-quotes",
    status: "quoted",
    rfqPublishedAt: "2026-10-01T04:00:00Z",
    matchedAt: "2026-10-02T08:30:00Z",
    sharedAt: "2026-10-03T09:10:00Z",
    quotesDueAt: "2026-10-10T12:00:00Z",
    product: {
      name: "1121 Steam Basmati Rice",
      category: FOOD,
      specification: "Average grain length 8.35 mm min, moisture 12.5% max, broken 1% max.",
      specificationItems: [
        { label: "Variety", value: "1121" },
        { label: "Processing", value: "Steam" },
        { label: "Average Grain Length", value: "8.35 mm minimum" },
        { label: "Moisture", value: "Max 12.5%" },
        { label: "Broken Grain", value: "Max 1%" },
      ],
      hsCode: RICE_HS,
    },
    quantity: { amount: 300, unit: "MT", minimumAcceptable: 200 },
    delivery: {
      destinationCountry: "Saudi Arabia",
      destinationLocation: "Dammam, Saudi Arabia",
      requiredBy: "2026-11-20",
      incoterm: { term: "CIF", namedPlace: "Dammam, Saudi Arabia" },
    },
    commercial: { paymentTerms: "lc", paymentNotes: "LC 30 days." },
    quality: { packaging: "25 kg PP bags." },
    compliance: {
      standingCredentials: [APEDA, FSSAI],
      shipmentDocuments: [doc("Certificate of Origin"), doc("Phytosanitary Certificate")],
    },
    extendedTerms: { currency: "USD", quoteValidityDays: 7 },
    supplierRequirements: MANUFACTURER_PREFERRED,
    buyer: { country: "Saudi Arabia", region: "Middle East", industry: "Food importer / distributor" },
    match: {
      score: 86,
      matchedProductId: "rice-1121-steam",
      reasons: [
        strength("product", "Exact product match"),
        strength("destination", "Destination experience: Saudi Arabia"),
        gap("capacity", "Uses about half of your available capacity"),
      ],
    },
  },
  {
    rfqId: "DEMO-RFQ-1004",
    opportunityId: "OPP-2026-0304",
    rfqStatus: "published",
    status: "quoted",
    rfqPublishedAt: "2026-10-01T10:00:00Z",
    matchedAt: "2026-10-02T09:00:00Z",
    sharedAt: "2026-10-02T11:30:00Z",
    quotesDueAt: "2026-10-12T12:00:00Z",
    product: {
      name: "PR11 Non-Basmati Rice",
      category: FOOD,
      specification: "PR11 parboiled, broken 5% max, moisture 14% max.",
      specificationItems: [
        { label: "Variety", value: "PR11" },
        { label: "Processing", value: "Parboiled" },
        { label: "Broken Grain", value: "Max 5%" },
        { label: "Moisture", value: "Max 14%" },
      ],
      hsCode: RICE_HS,
    },
    quantity: { amount: 80, unit: "MT" },
    delivery: {
      destinationCountry: "United Kingdom",
      destinationLocation: "Felixstowe, UK",
      requiredBy: "2026-11-05",
      incoterm: { term: "CIF", namedPlace: "Felixstowe, UK" },
    },
    commercial: { paymentTerms: "lc", paymentNotes: "LC 30 days." },
    quality: { inspection: "Pre-shipment inspection at loading port.", packaging: "20 kg paper bags." },
    compliance: {
      standingCredentials: [standing("BRCGS Food Safety", undefined, "buyer"), FSSAI],
      shipmentDocuments: [doc("Phytosanitary Certificate"), doc("Inspection Certificate", "required")],
    },
    extendedTerms: { currency: "GBP" },
    supplierRequirements: ANY_SUPPLIER,
    buyer: { country: "United Kingdom", region: "Europe", industry: "Retail" },
    match: {
      score: 88,
      matchedProductId: "rice-pr11",
      reasons: [
        strength("product", "Exact product match"),
        strength("capacity", "Capacity available — 470 MT free for 80 MT"),
        strength("destination", "Destination experience: United Kingdom"),
        gap("certification", "BRCGS not on your profile"),
      ],
    },
  },
  {
    rfqId: "DEMO-RFQ-1005",
    opportunityId: "OPP-2026-0301",
    rfqStatus: "under-review",
    status: "quoted",
    rfqPublishedAt: "2026-09-29T08:00:00Z",
    matchedAt: "2026-09-30T10:00:00Z",
    sharedAt: "2026-10-01T06:45:00Z",
    quotesDueAt: "2026-10-13T12:00:00Z",
    product: {
      name: "1121 Golden Sella Basmati Rice",
      category: FOOD,
      specification: "Golden sella, average grain length 8.2 mm min, broken 1% max.",
      specificationItems: [
        { label: "Variety", value: "1121" },
        { label: "Processing", value: "Golden Sella" },
        { label: "Average Grain Length", value: "8.20 mm minimum" },
        { label: "Broken Grain", value: "Max 1%" },
      ],
      hsCode: RICE_HS,
    },
    quantity: { amount: 120, unit: "MT" },
    delivery: {
      destinationCountry: "United Arab Emirates",
      destinationLocation: "Jebel Ali, UAE",
      requiredBy: "2026-11-15",
      incoterm: { term: "CIF", namedPlace: "Jebel Ali, UAE" },
    },
    commercial: { paymentTerms: "dp" },
    quality: { packaging: "5 kg and 25 kg PP bags." },
    compliance: { standingCredentials: [FSSAI], shipmentDocuments: [doc("Certificate of Origin")] },
    supplierRequirements: ANY_SUPPLIER,
    buyer: { country: "United Arab Emirates", region: "Middle East", industry: "HoReCa" },
    match: {
      score: 90,
      matchedProductId: "rice-1121-golden-sella",
      reasons: [
        strength("product", "Exact product match"),
        strength("destination", "Destination experience: UAE"),
        strength("certification", "Required credentials available"),
        gap("lead-time", "Lead time close to requirement"),
      ],
    },
  },
  {
    rfqId: "DEMO-RFQ-1006",
    opportunityId: "OPP-2026-0298",
    rfqStatus: "published",
    status: "quoted",
    rfqPublishedAt: "2026-09-29T07:00:00Z",
    matchedAt: "2026-09-30T11:00:00Z",
    sharedAt: "2026-09-30T13:00:00Z",
    quotesDueAt: "2026-10-14T12:00:00Z",
    product: {
      name: "Organic Coconut",
      category: FOOD,
      specification: "Desiccated coconut, fine grade, fat 63% min, moisture 3% max. Certified organic.",
      specificationItems: [
        { label: "Form", value: "Desiccated, fine grade" },
        { label: "Fat Content", value: "Min 63%" },
        { label: "Moisture", value: "Max 3%" },
        { label: "Organic", value: "Certified (EU)" },
      ],
      hsCode: "0801.19",
    },
    quantity: { amount: 50, unit: "MT" },
    delivery: {
      destinationCountry: "Germany",
      destinationLocation: "Hamburg, Germany",
      requiredBy: "2026-11-12",
      incoterm: { term: "CIF", namedPlace: "Hamburg, Germany" },
    },
    commercial: { paymentTerms: "dp" },
    quality: { packaging: "25 kg multi-wall paper bags with PE liner." },
    compliance: {
      standingCredentials: [standing("EU Organic", "organic", "buyer"), standing("ISO 22000", "iso-22000", "buyer")],
      shipmentDocuments: [doc("Health Certificate", "required"), doc("Phytosanitary Certificate")],
    },
    extendedTerms: { currency: "EUR", quoteValidityDays: 14 },
    supplierRequirements: ANY_SUPPLIER,
    buyer: { country: "Germany", region: "Europe", industry: "Food manufacturing" },
    match: {
      score: 84,
      matchedProductId: "coconut-organic",
      reasons: [
        strength("product", "Product category match"),
        strength("destination", "Destination experience: Germany"),
        gap("certification", "Organic certification pending verification"),
        gap("certification", "ISO 22000 held, but not mapped to your coconut product"),
        gap("capacity", "Limited available capacity — 100 MT free"),
      ],
    },
  },
  {
    rfqId: "DEMO-RFQ-1007",
    opportunityId: "OPP-2026-0315",
    rfqStatus: "published",
    status: "new",
    rfqPublishedAt: "2026-10-06T12:00:00Z",
    matchedAt: "2026-10-07T04:30:00Z",
    sharedAt: "2026-10-07T05:15:00Z",
    quotesDueAt: "2026-10-16T12:00:00Z",
    product: {
      name: "PR11 Non-Basmati Rice",
      category: FOOD,
      specification: "PR11 raw, broken 5% max, sortexed.",
      specificationItems: [
        { label: "Variety", value: "PR11" },
        { label: "Processing", value: "Raw" },
        { label: "Broken Grain", value: "Max 5%" },
        { label: "Finish", value: "Sortexed" },
      ],
      hsCode: RICE_HS,
    },
    quantity: { amount: 200, unit: "MT" },
    delivery: {
      destinationCountry: "Netherlands",
      destinationLocation: "Rotterdam, Netherlands",
      requiredBy: "2026-12-01",
      incoterm: { term: "CIF", namedPlace: "Rotterdam, Netherlands" },
    },
    commercial: { paymentTerms: "lc" },
    quality: { packaging: "25 kg PP bags." },
    compliance: { standingCredentials: [FSSAI], shipmentDocuments: [doc("Phytosanitary Certificate")] },
    extendedTerms: { currency: "EUR" },
    supplierRequirements: ANY_SUPPLIER,
    buyer: { country: "Netherlands", region: "Europe", industry: "Food importer / distributor" },
    match: {
      score: 79,
      matchedProductId: "rice-pr11",
      reasons: [
        strength("product", "Exact product match"),
        strength("capacity", "Capacity available — 470 MT free for 200 MT"),
        gap("destination", "No prior destination experience (Netherlands is a target market)"),
      ],
    },
  },
  {
    rfqId: "DEMO-RFQ-1008",
    opportunityId: "OPP-2026-0296",
    rfqStatus: "published",
    status: "viewed",
    rfqPublishedAt: "2026-09-28T12:00:00Z",
    matchedAt: "2026-09-29T10:00:00Z",
    sharedAt: "2026-09-29T15:40:00Z",
    quotesDueAt: "2026-10-11T12:00:00Z",
    product: {
      name: "Desiccated Coconut",
      category: FOOD,
      specification: "Medium grade, fat 60% min, USDA organic preferred.",
      specificationItems: [
        { label: "Form", value: "Desiccated, medium grade" },
        { label: "Fat Content", value: "Min 60%" },
        { label: "Organic", value: "USDA preferred" },
      ],
      hsCode: "0801.11",
    },
    quantity: { amount: 40_000, unit: "KG" },
    delivery: {
      destinationCountry: "United States",
      destinationLocation: "Los Angeles, USA",
      requiredBy: "2026-12-10",
      incoterm: { term: "FOB", namedPlace: "Mundra, India" },
    },
    commercial: { paymentTerms: "open-account", paymentNotes: "Net 30 after arrival." },
    quality: { packaging: "25 kg bags." },
    compliance: {
      standingCredentials: [standing("FDA Food Facility Registration", undefined, "buyer"), standing("USDA Organic", undefined, "buyer")],
      shipmentDocuments: [doc("Certificate of Origin")],
    },
    extendedTerms: { currency: "USD" },
    supplierRequirements: ANY_SUPPLIER,
    buyer: { country: "United States", region: "North America", industry: "Health foods" },
    match: {
      score: 72,
      matchedProductId: "coconut-organic",
      reasons: [
        strength("product", "Product category match"),
        gap("destination", "No prior destination experience"),
        gap("certification", "FDA registration and USDA Organic not on your profile"),
      ],
    },
  },
  {
    rfqId: "DEMO-RFQ-1000",
    opportunityId: "OPP-2026-0280",
    rfqStatus: "closed",
    status: "closed",
    rfqPublishedAt: "2026-09-22T06:00:00Z",
    matchedAt: "2026-09-23T08:00:00Z",
    sharedAt: "2026-09-24T09:00:00Z",
    quotesDueAt: "2026-10-05T12:00:00Z",
    product: {
      name: "1121 Steam Basmati Rice",
      category: FOOD,
      specification: "Average grain length 8.35 mm min, broken 1% max.",
      specificationItems: [
        { label: "Variety", value: "1121" },
        { label: "Average Grain Length", value: "8.35 mm minimum" },
        { label: "Broken Grain", value: "Max 1%" },
      ],
      hsCode: RICE_HS,
    },
    quantity: { amount: 40, unit: "MT" },
    delivery: {
      destinationCountry: "Germany",
      destinationLocation: "Hamburg, Germany",
      requiredBy: "2026-11-01",
      incoterm: { term: "CIF", namedPlace: "Hamburg, Germany" },
    },
    commercial: { paymentTerms: "dp" },
    quality: {},
    compliance: { standingCredentials: [standing("ISO 22000", "iso-22000", "buyer")], shipmentDocuments: [] },
    supplierRequirements: ANY_SUPPLIER,
    buyer: { country: "Germany", region: "Europe", industry: "Retail" },
    match: {
      score: 89,
      matchedProductId: "rice-1121-steam",
      reasons: [strength("product", "Exact product match"), strength("destination", "Destination experience: Germany")],
    },
  },
  {
    // Historical: quoted and selected (see QT-2026-8162).
    rfqId: "DEMO-RFQ-0991",
    opportunityId: "OPP-2026-0254",
    rfqStatus: "supplier-selected",
    status: "closed",
    rfqPublishedAt: "2026-09-02T06:00:00Z",
    matchedAt: "2026-09-02T09:00:00Z",
    sharedAt: "2026-09-02T10:30:00Z",
    quotesDueAt: "2026-09-09T12:00:00Z",
    product: {
      name: "1121 Steam Basmati Rice",
      category: FOOD,
      specification: "Average grain length 8.35 mm min, broken 1% max, 25 kg PP bags.",
      specificationItems: [
        { label: "Variety", value: "1121" },
        { label: "Processing", value: "Steam" },
        { label: "Broken Grain", value: "Max 1%" },
      ],
      hsCode: RICE_HS,
    },
    quantity: { amount: 100, unit: "MT" },
    delivery: {
      destinationCountry: "United Arab Emirates",
      destinationLocation: "Jebel Ali, UAE",
      requiredBy: "2026-10-15",
      incoterm: { term: "CIF", namedPlace: "Jebel Ali, UAE" },
    },
    commercial: { paymentTerms: "lc", paymentNotes: "LC at sight." },
    quality: { packaging: "25 kg PP bags." },
    compliance: { standingCredentials: [APEDA, FSSAI], shipmentDocuments: [doc("Certificate of Origin"), doc("Phytosanitary Certificate")] },
    extendedTerms: { currency: "USD", quoteValidityDays: 7 },
    supplierRequirements: MANUFACTURER_PREFERRED,
    buyer: { country: "United Arab Emirates", region: "Middle East", industry: "Food importer / distributor" },
    match: {
      score: 95,
      matchedProductId: "rice-1121-steam",
      reasons: [strength("product", "Exact product match"), strength("destination", "Previous UAE export experience")],
    },
  },
  {
    // Historical: quoted and not selected (see QT-2026-8151).
    rfqId: "DEMO-RFQ-0987",
    opportunityId: "OPP-2026-0249",
    rfqStatus: "closed",
    status: "closed",
    rfqPublishedAt: "2026-08-25T05:00:00Z",
    matchedAt: "2026-08-25T08:00:00Z",
    sharedAt: "2026-08-25T09:00:00Z",
    quotesDueAt: "2026-09-01T12:00:00Z",
    product: {
      name: "PR11 Non-Basmati Rice",
      category: FOOD,
      specification: "PR11 sella, broken 5% max.",
      specificationItems: [
        { label: "Variety", value: "PR11" },
        { label: "Processing", value: "Sella" },
        { label: "Broken Grain", value: "Max 5%" },
      ],
      hsCode: RICE_HS,
    },
    quantity: { amount: 200, unit: "MT" },
    delivery: {
      destinationCountry: "Oman",
      destinationLocation: "Sohar, Oman",
      requiredBy: "2026-10-01",
      incoterm: { term: "CFR", namedPlace: "Sohar, Oman" },
    },
    commercial: { paymentTerms: "dp" },
    quality: { packaging: "50 kg PP bags." },
    compliance: { standingCredentials: [FSSAI], shipmentDocuments: [doc("Certificate of Origin")] },
    extendedTerms: { currency: "USD" },
    supplierRequirements: ANY_SUPPLIER,
    buyer: { country: "Oman", region: "Middle East", industry: "Wholesale" },
    match: {
      score: 82,
      matchedProductId: "rice-pr11",
      reasons: [strength("product", "Exact product match"), gap("destination", "No prior destination experience")],
    },
  },
];

export const SUMIT_OPPORTUNITIES_INSIGHT =
  "4 opportunities strongly match your catalogue and 2 close within 24 hours. RFQ-2026-0048 is your strongest: your 1121 Steam Basmati product matches the specification, credentials and UAE destination experience.";

/** Mock SUMIT notes per opportunity. Static text; nothing is generated. */
const OPPORTUNITY_INSIGHTS: Partial<Record<string, readonly string[]>> = {
  "RFQ-2026-0048": [
    "This opportunity strongly fits your 1121 Steam Basmati product. Required credentials are in place and your typical lead time fits the buyer's delivery window.",
    "500 MT would commit 81% of your available capacity. The buyer accepts 250 MT minimum and split shipments, so a partial or two-vessel offer is an option.",
    "Before quoting, confirm CIF freight to Jebel Ali and book fumigation — the buyer requested CIF pricing and a fumigation certificate.",
  ],
  "DEMO-RFQ-1001": [
    "Strong product and destination fit. SFDA registration is the only gap — check whether the buyer will accept your APEDA documentation in the meantime.",
  ],
  "DEMO-RFQ-1002": ["Closes today. A 60 MT CFR lot is small but straightforward — quote quickly or pass."],
};

export function opportunityInsights(o: BuyerOpportunity): readonly string[] {
  return (
    OPPORTUNITY_INSIGHTS[o.rfqId] ?? [
      `${o.match.score}% match with your catalogue. Review the gaps under "Why Ximverse Matched You" before preparing a quotation.`,
    ]
  );
}

// ---------------------------------------------------------------------------
// Lookups and derived values
// ---------------------------------------------------------------------------

export function findOpportunity(rfqId: string): BuyerOpportunity | undefined {
  return BUYER_OPPORTUNITIES.find((o) => o.rfqId === rfqId);
}

export const HIGH_MATCH = 90;
const HOUR = 3_600_000;

export function isOpen(o: BuyerOpportunity): boolean {
  return o.status !== "closed";
}

export function hoursUntilDue(o: BuyerOpportunity, now = OPPORTUNITIES_NOW): number {
  return (Date.parse(o.quotesDueAt) - Date.parse(now)) / HOUR;
}

export type DeadlineUrgency = "closed" | "within-24h" | "within-3d" | "later";

export interface DeadlineInfo {
  urgency: DeadlineUrgency;
  /** e.g. "Closes in 18h", "Closes in 4 days", "Closed". */
  label: string;
}

export function deadlineInfo(o: BuyerOpportunity, now = OPPORTUNITIES_NOW): DeadlineInfo {
  const h = hoursUntilDue(o, now);
  if (o.status === "closed" || h <= 0) return { urgency: "closed", label: "Closed" };
  if (h < 24) return { urgency: "within-24h", label: `Closes in ${Math.max(1, Math.floor(h))}h` };
  if (h < 72) return { urgency: "within-3d", label: `Closes in ${Math.floor(h / 24)}d ${Math.floor(h % 24)}h` };
  return { urgency: "later", label: `Closes in ${Math.floor(h / 24)} days` };
}

/** Open, not yet quoted, and due within three days. */
export function isClosingSoon(o: BuyerOpportunity, now = OPPORTUNITIES_NOW): boolean {
  const { urgency } = deadlineInfo(o, now);
  return o.status !== "quoted" && (urgency === "within-24h" || urgency === "within-3d");
}

/** Quantity in tonnes where the unit allows it; undefined for units, litres, CBM, containers. */
export function tonnes(q: { amount: number; unit: QuantityUnit }): number | undefined {
  if (q.unit === "MT") return q.amount;
  if (q.unit === "KG") return q.amount / 1000;
  return undefined;
}

export function opportunitySummary(list: readonly BuyerOpportunity[]) {
  const open = list.filter(isOpen);
  return {
    open: open.length,
    highMatch: open.filter((o) => o.match.score >= HIGH_MATCH).length,
    closingSoon: open.filter((o) => isClosingSoon(o)).length,
    /** Tonnes across open opportunities with a weight-based unit. */
    potentialVolume: open.reduce((t, o) => t + (tonnes(o.quantity) ?? 0), 0),
    quoted: open.filter((o) => o.status === "quoted").length,
    newCount: open.filter((o) => o.status === "new").length,
  };
}

/** A standing credential's status, read from the exporter's company profile. */
export function credentialStatus(req: StandingCredentialRequirement): CredentialStatus {
  const cert = req.companyCertificationKey && CERTIFICATIONS.find((c) => c.key === req.companyCertificationKey);
  if (!cert) return "missing";
  if (cert.status === "verified" || cert.status === "per-shipment") return "available";
  return cert.status === "pending" ? "pending" : "missing";
}

export type CapacityFit = "strong" | "moderate" | "tight" | "partial" | "insufficient" | "not-comparable";

export interface CapacityFitResult {
  fit: CapacityFit;
  /** Tonnes, when the requested unit converts. */
  requested?: number;
  available: number;
  remaining?: number;
  /** Share of available capacity the full order would use, 0–1+. */
  utilisation?: number;
}

/**
 * Demo calculation: compares the requested quantity with a product's available
 * capacity. Reads only — nothing is reserved or deducted.
 */
export function capacityFit(o: BuyerOpportunity, availableTonnes: number): CapacityFitResult {
  const requested = tonnes(o.quantity);
  if (requested === undefined) return { fit: "not-comparable", available: availableTonnes };
  const minimum = o.quantity.minimumAcceptable !== undefined ? tonnes({ ...o.quantity, amount: o.quantity.minimumAcceptable }) : undefined;
  const utilisation = requested / availableTonnes;
  const fit: CapacityFit =
    utilisation <= 0.5
      ? "strong"
      : utilisation <= 0.85
        ? "moderate"
        : utilisation <= 1
          ? "tight"
          : minimum !== undefined && minimum <= availableTonnes
            ? "partial"
            : "insufficient";
  return { fit, requested, available: availableTonnes, remaining: availableTonnes - requested, utilisation };
}

export const CAPACITY_FIT_LABEL: Record<CapacityFit, string> = {
  strong: "Strong",
  moderate: "Moderate",
  tight: "Tight",
  partial: "Partial only",
  insufficient: "Insufficient",
  "not-comparable": "Not comparable",
};

export interface TimelinePoint {
  key: string;
  label: string;
  /** ISO timestamp or date. */
  at: string;
  /** Whether it has happened, relative to the mock clock. */
  past: boolean;
}

export function opportunityTimeline(o: BuyerOpportunity, now = OPPORTUNITIES_NOW): TimelinePoint[] {
  const points = [
    { key: "published", label: "Buyer RFQ published", at: o.rfqPublishedAt },
    { key: "matched", label: "Matched with your catalogue", at: o.matchedAt },
    { key: "shared", label: "Shared with you", at: o.sharedAt },
    { key: "deadline", label: "Quotation deadline", at: o.quotesDueAt },
    { key: "delivery", label: "Required delivery", at: o.delivery.requiredBy },
  ];
  return points.map((p) => ({ ...p, past: Date.parse(p.at) <= Date.parse(now) }));
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatOpportunityQuantity(q: { amount: number; unit: QuantityUnit }): string {
  const short = UNIT_SHORT[q.unit];
  const unit = q.amount === 1 && short.endsWith("s") ? short.slice(0, -1) : short;
  return `${q.amount.toLocaleString("en-US")} ${unit}`;
}

/** "CIF Jebel Ali, UAE", "FOB Mundra, India". */
export function formatIncoterm(d: OpportunityDelivery): string {
  return d.incoterm ? `${d.incoterm.term} ${d.incoterm.namedPlace}` : "—";
}

const COUNTRY_SHORT: Record<string, string> = {
  "United Arab Emirates": "UAE",
  "United States": "USA",
};

export function shortCountry(country: string): string {
  return COUNTRY_SHORT[country] ?? country;
}

// Fixed zone so server and browser render the same text; the exporter is in India.
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Kolkata",
});

/** "8 Oct 2026, 09:00 IST". */
export function formatDateTime(iso: string): string {
  return `${dateTimeFormat.format(new Date(iso))} IST`;
}

/** Route segment for an opportunity's detail page. */
export function opportunitySlug(o: BuyerOpportunity): string {
  return o.rfqId;
}
