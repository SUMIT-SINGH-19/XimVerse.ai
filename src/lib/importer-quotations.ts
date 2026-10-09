/**
 * Supplier quotations received against import requirements.
 *
 * Each quotation references its requirement by `requirementId`; nothing from
 * the requirement is copied in. All suppliers and quotations here are MOCK
 * data with fictional companies.
 */

import {
  MOCK_NOW,
  MOCK_REQUIREMENTS,
  formatPrice,
  formatQuantity,
  paymentTermLabel,
  type Currency,
  type ImportRequirement,
  type Incoterm,
  type PaymentTerm,
  type QuantityUnit,
} from "./import-requirements";
import { formatDate } from "./format";
import { findSupplier, isManufacturer, SUPPLIER_TYPE_LABEL, type Supplier } from "./importer-suppliers";

// Supplier data lives in importer-suppliers.ts; re-exported for existing imports.
export { SUPPLIER_TYPE_LABEL, type SupplierSummary, type SupplierType } from "./importer-suppliers";

/* ------------------------------------------------------------------------ */
/* Types                                                                     */
/* ------------------------------------------------------------------------ */

export type QuotationStatus =
  | "new"
  | "under-review"
  | "shortlisted"
  | "clarification-required"
  | "not-selected"
  | "selected";

export const QUOTATION_STATUSES: readonly { id: QuotationStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "under-review", label: "Under Review" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "clarification-required", label: "Clarification Required" },
  { id: "not-selected", label: "Not Selected" },
  { id: "selected", label: "Selected" },
];

export function quotationStatusLabel(status: QuotationStatus): string {
  return QUOTATION_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export interface QuotedProduct {
  description: string;
  /** Supplier declares the offer meets the requested specification. */
  specificationAsRequested: boolean;
  hsCode?: string;
  quantity: { amount: number; unit: QuantityUnit };
  moq?: { amount: number; unit: QuantityUnit };
  packaging: string;
  packagingAsRequested: boolean;
  origin: string;
}

export interface QuotedPrice {
  unitPrice: number;
  currency: Currency;
  incoterm: Incoterm;
  /** The named port or place the Incoterm applies to. */
  namedPlace: string;
}

export interface QuotedDelivery {
  portOfLoading: string;
  /** Days from order confirmation until goods are ready to ship. */
  leadTimeDays: number;
  /** Supplier's estimated transit time, when they arrange the main carriage. */
  transitDays?: number;
  mode: "Sea" | "Air" | "Road";
  shipmentNote?: string;
}

export interface QuotedCommercialTerms {
  paymentTerm: PaymentTerm;
  /** Share of the order value due before shipment. */
  advancePercent: number;
  /** Short form, e.g. "LC at sight". */
  paymentSummary: string;
  paymentDetail: string;
  /** YYYY-MM-DD */
  validUntil: string;
  notes?: string;
}

export type DocumentAvailability = "available" | "on-request" | "not-offered";

export interface QuotationCompliance {
  /** Documents the supplier declares they can provide. */
  documents: { name: string; availability: DocumentAvailability }[];
  /** Whether the supplier accepts the inspection the requirement asks for. */
  inspectionAccepted: boolean;
  inspection: string;
  qualityTerms?: string;
}

export interface Quotation {
  id: string;
  requirementId: string;
  supplierId: string;
  status: QuotationStatus;
  /** ISO timestamp. */
  receivedAt: string;
  product: QuotedProduct;
  price: QuotedPrice;
  delivery: QuotedDelivery;
  commercial: QuotedCommercialTerms;
  compliance: QuotationCompliance;
}

/* ------------------------------------------------------------------------ */
/* Mock data                                                                 */
/* ------------------------------------------------------------------------ */

const BASMATI_SPEC =
  "1121 Steam Basmati, average grain length 8.35 mm, moisture 12.5% max, broken 2% max, sortexed and double polished.";
const RICE_DOCS = (fumigation: DocumentAvailability = "available", inspection: DocumentAvailability = "available") => [
  { name: "Certificate of Origin", availability: "available" as const },
  { name: "Phytosanitary Certificate", availability: "available" as const },
  { name: "Fumigation Certificate", availability: fumigation },
  { name: "Inspection Certificate", availability: inspection },
];
const SGS_ACCEPTED = "SGS (or equivalent) pre-shipment inspection at loading port accepted.";
const LC_AT_SIGHT = {
  paymentTerm: "lc" as const,
  advancePercent: 0,
  paymentSummary: "LC at sight",
  paymentDetail: "Irrevocable Letter of Credit payable at sight.",
};

export const MOCK_QUOTATIONS: readonly Quotation[] = [
  /* RFQ-2026-0048 · Basmati Rice ---------------------------------------- */
  {
    id: "QT-2026-0108",
    requirementId: "RFQ-2026-0048",
    supplierId: "sup-shakti",
    status: "new",
    receivedAt: "2026-10-07T07:40:00Z",
    product: {
      description: BASMATI_SPEC,
      specificationAsRequested: true,
      hsCode: "1006.30",
      quantity: { amount: 500, unit: "MT" },
      moq: { amount: 100, unit: "MT" },
      packaging: "25 kg non-woven PP bags with buyer's private label",
      packagingAsRequested: true,
      origin: "India",
    },
    price: { unitPrice: 1020, currency: "USD", incoterm: "CIF", namedPlace: "Jebel Ali" },
    delivery: { portOfLoading: "Mundra", leadTimeDays: 18, transitDays: 6, mode: "Sea", shipmentNote: "20 × 20′ containers" },
    commercial: { ...LC_AT_SIGHT, validUntil: "2026-10-21", notes: "Price holds for shipment in a single lot." },
    compliance: {
      documents: RICE_DOCS("available", "on-request"),
      inspectionAccepted: true,
      inspection: SGS_ACCEPTED,
      qualityTerms: "Quality and weight final as per load-port inspection.",
    },
  },
  {
    id: "QT-2026-0107",
    requirementId: "RFQ-2026-0048",
    supplierId: "sup-punjab",
    status: "under-review",
    receivedAt: "2026-10-06T10:15:00Z",
    product: {
      description: BASMATI_SPEC,
      specificationAsRequested: true,
      hsCode: "1006.30",
      quantity: { amount: 500, unit: "MT" },
      moq: { amount: 200, unit: "MT" },
      packaging: "25 kg non-woven PP bags with buyer's private label",
      packagingAsRequested: true,
      origin: "India",
    },
    price: { unitPrice: 980, currency: "USD", incoterm: "FOB", namedPlace: "Mundra" },
    delivery: { portOfLoading: "Mundra", leadTimeDays: 14, mode: "Sea" },
    commercial: {
      paymentTerm: "advance",
      advancePercent: 30,
      paymentSummary: "30% advance / 70% against documents",
      paymentDetail: "30% advance with order; 70% against scanned shipping documents.",
      validUntil: "2026-10-14",
      notes: "Buyer to nominate vessel and arrange ocean freight.",
    },
    compliance: { documents: RICE_DOCS(), inspectionAccepted: true, inspection: SGS_ACCEPTED },
  },
  {
    id: "QT-2026-0106",
    requirementId: "RFQ-2026-0048",
    supplierId: "sup-indus",
    status: "shortlisted",
    receivedAt: "2026-10-05T08:30:00Z",
    product: {
      description: BASMATI_SPEC,
      specificationAsRequested: true,
      quantity: { amount: 500, unit: "MT" },
      moq: { amount: 50, unit: "MT" },
      packaging: "25 kg non-woven PP bags with buyer's private label",
      packagingAsRequested: true,
      origin: "India",
    },
    price: { unitPrice: 1045, currency: "USD", incoterm: "CIF", namedPlace: "Jebel Ali" },
    delivery: { portOfLoading: "Mundra", leadTimeDays: 12, transitDays: 6, mode: "Sea" },
    commercial: { ...LC_AT_SIGHT, validUntil: "2026-10-19" },
    compliance: {
      documents: RICE_DOCS("on-request", "available"),
      inspectionAccepted: true,
      inspection: SGS_ACCEPTED,
    },
  },
  {
    id: "QT-2026-0105",
    requirementId: "RFQ-2026-0048",
    supplierId: "sup-greenfield",
    status: "clarification-required",
    receivedAt: "2026-10-04T12:00:00Z",
    product: {
      description: BASMATI_SPEC,
      specificationAsRequested: true,
      quantity: { amount: 450, unit: "MT" },
      moq: { amount: 450, unit: "MT" },
      packaging: "25 kg non-woven PP bags with buyer's private label",
      packagingAsRequested: true,
      origin: "India",
    },
    price: { unitPrice: 1010, currency: "USD", incoterm: "CFR", namedPlace: "Jebel Ali" },
    delivery: { portOfLoading: "Kandla", leadTimeDays: 20, transitDays: 7, mode: "Sea" },
    commercial: {
      paymentTerm: "dp",
      advancePercent: 0,
      paymentSummary: "D/P at sight",
      paymentDetail: "Documents against payment at sight through the buyer's bank.",
      validUntil: "2026-10-09",
    },
    compliance: {
      documents: RICE_DOCS("available", "not-offered"),
      inspectionAccepted: false,
      inspection: "Supplier's in-house lab report only; third-party inspection not offered.",
    },
  },
  {
    id: "QT-2026-0104",
    requirementId: "RFQ-2026-0048",
    supplierId: "sup-heritage",
    status: "shortlisted",
    receivedAt: "2026-10-03T09:20:00Z",
    product: {
      description: BASMATI_SPEC,
      specificationAsRequested: true,
      hsCode: "1006.30",
      quantity: { amount: 500, unit: "MT" },
      moq: { amount: 250, unit: "MT" },
      packaging: "25 kg non-woven PP bags with buyer's private label",
      packagingAsRequested: true,
      origin: "India",
    },
    price: { unitPrice: 1060, currency: "USD", incoterm: "CIF", namedPlace: "Jebel Ali" },
    delivery: { portOfLoading: "Mundra", leadTimeDays: 50, transitDays: 7, mode: "Sea", shipmentNote: "New-crop milling from mid-November" },
    commercial: {
      paymentTerm: "lc",
      advancePercent: 0,
      paymentSummary: "LC 30 days",
      paymentDetail: "Irrevocable Letter of Credit, payable 30 days from bill of lading date.",
      validUntil: "2026-10-31",
    },
    compliance: {
      documents: RICE_DOCS(),
      inspectionAccepted: true,
      inspection: SGS_ACCEPTED,
      qualityTerms: "Replacement or credit note for quality claims raised within 21 days of arrival.",
    },
  },
  {
    id: "QT-2026-0103",
    requirementId: "RFQ-2026-0048",
    supplierId: "sup-northstar",
    status: "under-review",
    receivedAt: "2026-10-03T06:00:00Z",
    product: {
      description: BASMATI_SPEC,
      specificationAsRequested: true,
      quantity: { amount: 500, unit: "MT" },
      moq: { amount: 100, unit: "MT" },
      packaging: "25 kg non-woven PP bags with buyer's private label",
      packagingAsRequested: true,
      origin: "India",
    },
    price: { unitPrice: 1075, currency: "USD", incoterm: "DAP", namedPlace: "Jebel Ali Free Zone warehouse" },
    delivery: { portOfLoading: "Mundra", leadTimeDays: 21, transitDays: 8, mode: "Sea" },
    commercial: {
      paymentTerm: "open-account",
      advancePercent: 0,
      paymentSummary: "Open account, 30 days",
      paymentDetail: "Payment 30 days after delivery, subject to credit approval.",
      validUntil: "2026-10-17",
    },
    compliance: {
      documents: RICE_DOCS("on-request", "available"),
      inspectionAccepted: true,
      inspection: SGS_ACCEPTED,
    },
  },
  {
    id: "QT-2026-0102",
    requirementId: "RFQ-2026-0048",
    supplierId: "sup-bharat",
    status: "not-selected",
    receivedAt: "2026-10-02T14:30:00Z",
    product: {
      description: "1121 Steam Basmati, average grain length 8.3 mm, moisture 13% max, broken 3% max.",
      specificationAsRequested: false,
      hsCode: "1006.30",
      quantity: { amount: 500, unit: "MT" },
      moq: { amount: 100, unit: "MT" },
      packaging: "25 kg non-woven PP bags with buyer's private label",
      packagingAsRequested: true,
      origin: "India",
    },
    price: { unitPrice: 86_500, currency: "INR", incoterm: "FOB", namedPlace: "Kandla" },
    delivery: { portOfLoading: "Kandla", leadTimeDays: 15, mode: "Sea" },
    commercial: {
      paymentTerm: "advance",
      advancePercent: 50,
      paymentSummary: "50% advance / 50% before dispatch",
      paymentDetail: "50% advance with order; balance before goods leave the mill.",
      validUntil: "2026-10-16",
    },
    compliance: { documents: RICE_DOCS(), inspectionAccepted: true, inspection: SGS_ACCEPTED },
  },
  {
    id: "QT-2026-0101",
    requirementId: "RFQ-2026-0048",
    supplierId: "sup-goldencrop",
    status: "new",
    receivedAt: "2026-10-02T11:05:00Z",
    product: {
      description: "1121 Sella (parboiled) Basmati, average grain length 8.3 mm, moisture 12% max, broken 2% max.",
      specificationAsRequested: false,
      quantity: { amount: 500, unit: "MT" },
      moq: { amount: 100, unit: "MT" },
      packaging: "50 kg plain PP bags",
      packagingAsRequested: false,
      origin: "Pakistan",
    },
    price: { unitPrice: 955, currency: "USD", incoterm: "FOB", namedPlace: "Karachi" },
    delivery: { portOfLoading: "Karachi", leadTimeDays: 16, mode: "Sea" },
    commercial: { ...LC_AT_SIGHT, validUntil: "2026-10-23" },
    compliance: { documents: RICE_DOCS("available", "on-request"), inspectionAccepted: true, inspection: SGS_ACCEPTED },
  },

  /* RFQ-2026-0047 · Refined Sunflower Oil ------------------------------- */
  {
    id: "QT-2026-0098",
    requirementId: "RFQ-2026-0047",
    supplierId: "sup-blacksea",
    status: "under-review",
    receivedAt: "2026-09-30T08:10:00Z",
    product: {
      description: "Refined, deodorised, winterised sunflower oil. FFA 0.1% max, peroxide value 2 meq/kg max.",
      specificationAsRequested: true,
      hsCode: "1512.19",
      quantity: { amount: 200, unit: "MT" },
      moq: { amount: 100, unit: "MT" },
      packaging: "Flexitanks in 20′ containers",
      packagingAsRequested: true,
      origin: "Ukraine",
    },
    price: { unitPrice: 1165, currency: "USD", incoterm: "CFR", namedPlace: "Nhava Sheva (Mumbai)" },
    delivery: { portOfLoading: "Odesa", leadTimeDays: 20, transitDays: 24, mode: "Sea" },
    commercial: {
      paymentTerm: "dp",
      advancePercent: 0,
      paymentSummary: "D/P at sight",
      paymentDetail: "Documents against payment at sight.",
      validUntil: "2026-10-20",
    },
    compliance: {
      documents: [
        { name: "Certificate of Origin", availability: "available" },
        { name: "Health Certificate", availability: "available" },
      ],
      inspectionAccepted: true,
      inspection: "Independent surveyor at loading port.",
    },
  },
  {
    id: "QT-2026-0097",
    requirementId: "RFQ-2026-0047",
    supplierId: "sup-pampas",
    status: "under-review",
    receivedAt: "2026-09-28T15:45:00Z",
    product: {
      description: "Refined, deodorised, winterised sunflower oil. FFA 0.1% max, peroxide value 2 meq/kg max.",
      specificationAsRequested: true,
      quantity: { amount: 200, unit: "MT" },
      moq: { amount: 200, unit: "MT" },
      packaging: "Flexitanks in 20′ containers",
      packagingAsRequested: true,
      origin: "Argentina",
    },
    price: { unitPrice: 1140, currency: "USD", incoterm: "FOB", namedPlace: "Rosario" },
    delivery: { portOfLoading: "Rosario", leadTimeDays: 25, mode: "Sea" },
    commercial: { ...LC_AT_SIGHT, validUntil: "2026-10-12" },
    compliance: {
      documents: [
        { name: "Certificate of Origin", availability: "available" },
        { name: "Health Certificate", availability: "available" },
      ],
      inspectionAccepted: true,
      inspection: "Independent surveyor at loading port.",
    },
  },
  {
    id: "QT-2026-0096",
    requirementId: "RFQ-2026-0047",
    supplierId: "sup-volga",
    status: "clarification-required",
    receivedAt: "2026-10-01T07:20:00Z",
    product: {
      description: "Refined, deodorised sunflower oil. FFA 0.1% max, peroxide value 2 meq/kg max.",
      specificationAsRequested: true,
      quantity: { amount: 150, unit: "MT" },
      moq: { amount: 150, unit: "MT" },
      packaging: "Flexitanks in 20′ containers",
      packagingAsRequested: true,
      origin: "Russia",
    },
    price: { unitPrice: 1190, currency: "USD", incoterm: "CFR", namedPlace: "Mumbai" },
    delivery: { portOfLoading: "Novorossiysk", leadTimeDays: 18, transitDays: 28, mode: "Sea" },
    commercial: {
      paymentTerm: "advance",
      advancePercent: 50,
      paymentSummary: "50% advance / 50% against documents",
      paymentDetail: "50% advance; balance against copy of shipping documents.",
      validUntil: "2026-10-15",
    },
    compliance: {
      documents: [
        { name: "Certificate of Origin", availability: "available" },
        { name: "Health Certificate", availability: "on-request" },
      ],
      inspectionAccepted: true,
      inspection: "Independent surveyor at loading port.",
    },
  },

  /* RFQ-2026-0044 · Cotton Yarn (supplier already selected) ------------- */
  {
    id: "QT-2026-0091",
    requirementId: "RFQ-2026-0044",
    supplierId: "sup-coimbatore",
    status: "selected",
    receivedAt: "2026-09-05T06:30:00Z",
    product: {
      description: "30s combed cotton yarn for knitting, 100% cotton, compact spun.",
      specificationAsRequested: true,
      hsCode: "5205.24",
      quantity: { amount: 40_000, unit: "KG" },
      moq: { amount: 10_000, unit: "KG" },
      packaging: "Cartons on pallets",
      packagingAsRequested: true,
      origin: "India",
    },
    price: { unitPrice: 3.05, currency: "USD", incoterm: "CFR", namedPlace: "Chittagong" },
    delivery: { portOfLoading: "Chennai", leadTimeDays: 21, transitDays: 9, mode: "Sea" },
    commercial: { ...LC_AT_SIGHT, validUntil: "2026-09-30" },
    compliance: {
      documents: [{ name: "Certificate of Origin", availability: "available" }],
      inspectionAccepted: true,
      inspection: "Mill test certificate with each lot.",
    },
  },
  {
    id: "QT-2026-0090",
    requirementId: "RFQ-2026-0044",
    supplierId: "sup-tiruppur",
    status: "not-selected",
    receivedAt: "2026-09-04T11:00:00Z",
    product: {
      description: "30s combed cotton yarn for knitting, 100% cotton, compact spun.",
      specificationAsRequested: true,
      quantity: { amount: 40_000, unit: "KG" },
      packaging: "Cartons on pallets",
      packagingAsRequested: true,
      origin: "India",
    },
    price: { unitPrice: 2.95, currency: "USD", incoterm: "FOB", namedPlace: "Tuticorin" },
    delivery: { portOfLoading: "Tuticorin", leadTimeDays: 18, mode: "Sea" },
    commercial: {
      paymentTerm: "advance",
      advancePercent: 20,
      paymentSummary: "20% advance / 80% against documents",
      paymentDetail: "20% advance; balance against shipping documents.",
      validUntil: "2026-09-25",
    },
    compliance: {
      documents: [{ name: "Certificate of Origin", availability: "available" }],
      inspectionAccepted: true,
      inspection: "Mill test certificate with each lot.",
    },
  },
  {
    id: "QT-2026-0089",
    requirementId: "RFQ-2026-0044",
    supplierId: "sup-saigon",
    status: "not-selected",
    receivedAt: "2026-09-03T03:40:00Z",
    product: {
      description: "30s combed cotton yarn, 100% cotton, ring spun.",
      specificationAsRequested: false,
      quantity: { amount: 40_000, unit: "KG" },
      packaging: "Cartons on pallets",
      packagingAsRequested: true,
      origin: "Vietnam",
    },
    price: { unitPrice: 3.18, currency: "USD", incoterm: "CFR", namedPlace: "Chittagong" },
    delivery: { portOfLoading: "Ho Chi Minh City", leadTimeDays: 25, transitDays: 10, mode: "Sea" },
    commercial: { ...LC_AT_SIGHT, validUntil: "2026-09-28" },
    compliance: {
      documents: [{ name: "Certificate of Origin", availability: "available" }],
      inspectionAccepted: true,
      inspection: "Mill test certificate with each lot.",
    },
  },

  /* Earlier rounds — each led to an agreed negotiation and an order. ---- */
  {
    id: "QT-2026-0075",
    requirementId: "RFQ-2026-0042",
    supplierId: "sup-pampas",
    status: "selected",
    receivedAt: "2026-09-01T14:00:00Z",
    product: {
      description: "Refined, bleached, deodorised soybean oil. FFA 0.1% max.",
      specificationAsRequested: true,
      hsCode: "1507.90",
      quantity: { amount: 200, unit: "MT" },
      moq: { amount: 200, unit: "MT" },
      packaging: "Flexitanks in 20 ft containers",
      packagingAsRequested: true,
      origin: "Argentina",
    },
    price: { unitPrice: 1085, currency: "USD", incoterm: "FOB", namedPlace: "Rosario" },
    delivery: { portOfLoading: "Rosario", leadTimeDays: 28, mode: "Sea" },
    commercial: { ...LC_AT_SIGHT, validUntil: "2026-09-25" },
    compliance: {
      documents: [
        { name: "Certificate of Origin", availability: "available" },
        { name: "Health Certificate", availability: "available" },
      ],
      inspectionAccepted: true,
      inspection: "Independent surveyor at loading port.",
    },
  },
  {
    id: "QT-2026-0074",
    requirementId: "RFQ-2026-0041",
    supplierId: "sup-indus",
    status: "selected",
    receivedAt: "2026-08-16T09:30:00Z",
    product: {
      description: "Red lentils (masoor), split, machine cleaned and sortexed.",
      specificationAsRequested: true,
      hsCode: "0713.40",
      quantity: { amount: 100, unit: "MT" },
      moq: { amount: 25, unit: "MT" },
      packaging: "50 kg PP bags",
      packagingAsRequested: true,
      origin: "India",
    },
    price: { unitPrice: 845, currency: "USD", incoterm: "CIF", namedPlace: "Nhava Sheva" },
    delivery: { portOfLoading: "Mundra", leadTimeDays: 15, transitDays: 3, mode: "Sea" },
    commercial: { ...LC_AT_SIGHT, validUntil: "2026-09-05" },
    compliance: {
      documents: [
        { name: "Certificate of Origin", availability: "available" },
        { name: "Phytosanitary Certificate", availability: "available" },
      ],
      inspectionAccepted: true,
      inspection: "Third-party inspection at the buyer's cost.",
    },
  },
  {
    id: "QT-2026-0073",
    requirementId: "RFQ-2026-0040",
    supplierId: "sup-coimbatore",
    status: "selected",
    receivedAt: "2026-07-27T06:00:00Z",
    product: {
      description: "40s combed compact cotton yarn, 100% cotton, for weaving and knitting.",
      specificationAsRequested: true,
      hsCode: "5205.26",
      quantity: { amount: 20_000, unit: "KG" },
      moq: { amount: 10_000, unit: "KG" },
      packaging: "Cartons on pallets",
      packagingAsRequested: true,
      origin: "India",
    },
    price: { unitPrice: 3.45, currency: "USD", incoterm: "CFR", namedPlace: "Chittagong" },
    delivery: { portOfLoading: "Chennai", leadTimeDays: 24, transitDays: 9, mode: "Sea" },
    commercial: { ...LC_AT_SIGHT, validUntil: "2026-08-20" },
    compliance: {
      documents: [{ name: "Certificate of Origin", availability: "available" }],
      inspectionAccepted: true,
      inspection: "Mill test certificate with each lot.",
    },
  },
  {
    id: "QT-2026-0072",
    requirementId: "RFQ-2026-0039",
    supplierId: "sup-punjab",
    status: "selected",
    receivedAt: "2026-07-08T10:00:00Z",
    product: {
      description: "1121 Steam Basmati, average grain length 8.35 mm, moisture 12.5% max, broken 2% max.",
      specificationAsRequested: true,
      hsCode: "1006.30",
      quantity: { amount: 250, unit: "MT" },
      moq: { amount: 200, unit: "MT" },
      packaging: "25 kg PP bags",
      packagingAsRequested: true,
      origin: "India",
    },
    price: { unitPrice: 995, currency: "USD", incoterm: "FOB", namedPlace: "Mundra" },
    delivery: { portOfLoading: "Mundra", leadTimeDays: 14, mode: "Sea" },
    commercial: {
      paymentTerm: "advance",
      advancePercent: 30,
      paymentSummary: "30% advance / 70% against documents",
      paymentDetail: "30% advance with order; 70% against scanned shipping documents.",
      validUntil: "2026-07-25",
    },
    compliance: { documents: RICE_DOCS(), inspectionAccepted: true, inspection: SGS_ACCEPTED },
  },
  {
    id: "QT-2026-0071",
    requirementId: "RFQ-2026-0038",
    supplierId: "sup-blacksea",
    status: "selected",
    receivedAt: "2026-06-08T08:00:00Z",
    product: {
      description: "Refined, deodorised, winterised sunflower oil. FFA 0.1% max, peroxide value 2 meq/kg max.",
      specificationAsRequested: true,
      hsCode: "1512.19",
      quantity: { amount: 100, unit: "MT" },
      moq: { amount: 100, unit: "MT" },
      packaging: "Flexitanks in 20 ft containers",
      packagingAsRequested: true,
      origin: "Ukraine",
    },
    price: { unitPrice: 1120, currency: "USD", incoterm: "CFR", namedPlace: "Nhava Sheva (Mumbai)" },
    delivery: { portOfLoading: "Odesa", leadTimeDays: 18, transitDays: 24, mode: "Sea" },
    commercial: {
      paymentTerm: "dp",
      advancePercent: 0,
      paymentSummary: "D/P at sight",
      paymentDetail: "Documents against payment at sight.",
      validUntil: "2026-06-25",
    },
    compliance: {
      documents: [
        { name: "Certificate of Origin", availability: "available" },
        { name: "Health Certificate", availability: "available" },
      ],
      inspectionAccepted: true,
      inspection: "Independent surveyor at loading port.",
    },
  },
];

export const QUOTATION_ID_PATTERN = /^QT-\d{4}-\d{4,}$/;

/* ------------------------------------------------------------------------ */
/* Lookups                                                                   */
/* ------------------------------------------------------------------------ */

export function findQuotation(id: string): Quotation | undefined {
  return MOCK_QUOTATIONS.find((q) => q.id === id);
}

export function supplierOf(q: Quotation): Supplier {
  const supplier = findSupplier(q.supplierId);
  if (!supplier) throw new Error(`Quotation ${q.id} references unknown supplier ${q.supplierId}`);
  return supplier;
}

/** A supplier's quotation history, newest first — derived, never stored on the supplier. */
export function quotationsFromSupplier(supplierId: string): Quotation[] {
  return MOCK_QUOTATIONS.filter((q) => q.supplierId === supplierId).toSorted((a, b) =>
    b.receivedAt.localeCompare(a.receivedAt),
  );
}

export function requirementOf(q: Quotation): ImportRequirement | undefined {
  return MOCK_REQUIREMENTS.find((r) => r.id === q.requirementId);
}

export function quotationsFor(requirementId: string): Quotation[] {
  return MOCK_QUOTATIONS.filter((q) => q.requirementId === requirementId);
}

/** No further decisions can be taken once a supplier is chosen or the requirement is closed. */
export function isDecisionOpen(r: ImportRequirement | undefined): boolean {
  return !!r && r.status !== "supplier-selected" && r.status !== "closed";
}

/* ------------------------------------------------------------------------ */
/* Formatting                                                                */
/* ------------------------------------------------------------------------ */

const SINGULAR_UNIT: Record<QuantityUnit, string> = {
  KG: "kg",
  MT: "MT",
  UNITS: "unit",
  LITRES: "litre",
  CBM: "CBM",
  CONTAINERS: "container",
};

export function formatUnitPrice(q: Quotation): string {
  return `${formatPrice(q.price.unitPrice, q.price.currency)} / ${SINGULAR_UNIT[q.product.quantity.unit]}`;
}

export function quotedValue(q: Quotation): number {
  return q.price.unitPrice * q.product.quantity.amount;
}

export function formatQuotedValue(q: Quotation): string {
  return formatPrice(quotedValue(q), q.price.currency);
}

export function formatIncoterm(q: Quotation): string {
  return `${q.price.incoterm} ${q.price.namedPlace}`;
}

const DAY_MS = 86_400_000;

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z") + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate.slice(0, 10)}T00:00:00Z`)) / DAY_MS);
}

/** Readiness date if the order were confirmed on the snapshot date. */
export function estimatedReadiness(q: Quotation): string {
  return addDays(MOCK_NOW, q.delivery.leadTimeDays);
}

export function estimatedArrival(q: Quotation): string | undefined {
  return q.delivery.transitDays === undefined ? undefined : addDays(estimatedReadiness(q), q.delivery.transitDays);
}

export function validityDaysLeft(q: Quotation): number {
  return daysBetween(MOCK_NOW, q.commercial.validUntil);
}

export function formatValidity(q: Quotation): string {
  const left = validityDaysLeft(q);
  if (left < 0) return `Expired ${formatDate(q.commercial.validUntil)}`;
  if (left === 0) return "Expires today";
  return `Until ${formatDate(q.commercial.validUntil)} (${left} ${left === 1 ? "day" : "days"})`;
}

/* ------------------------------------------------------------------------ */
/* Incoterm coverage (informational)                                         */
/* ------------------------------------------------------------------------ */

export interface IncotermCoverage {
  included: string[];
  buyer: string[];
  freightIncluded: boolean;
  insurance: "included" | "seller-risk" | "not-included";
}

/**
 * A simplified, informational reading of common Incoterms® 2020
 * responsibilities. Actual obligations depend on the sales contract.
 */
export function incotermCoverage(incoterm: Incoterm): IncotermCoverage {
  const destination = ["Destination import duties and taxes", "Destination customs clearance"];
  switch (incoterm) {
    case "EXW":
      return {
        included: ["Product, made available at the supplier's premises"],
        buyer: ["Export clearance and loading", "Inland transport to port", "Main freight", "Insurance", ...destination, "Delivery to your premises"],
        freightIncluded: false,
        insurance: "not-included",
      };
    case "FCA":
      return {
        included: ["Product", "Export clearance", "Delivery to your nominated carrier"],
        buyer: ["Main freight", "Insurance", ...destination, "Delivery to your premises"],
        freightIncluded: false,
        insurance: "not-included",
      };
    case "FOB":
      return {
        included: ["Product", "Export clearance", "Loading on the vessel at the named port"],
        buyer: ["Ocean freight", "Marine insurance", "Destination port charges", ...destination, "Inland delivery"],
        freightIncluded: false,
        insurance: "not-included",
      };
    case "CFR":
    case "CPT":
      return {
        included: ["Product", "Export clearance", "Main freight to the named place"],
        buyer: ["Insurance (risk passes to you at loading)", ...destination, "Inland delivery"],
        freightIncluded: true,
        insurance: "not-included",
      };
    case "CIF":
    case "CIP":
      return {
        included: ["Product", "Export clearance", "Main freight to the named place", "Insurance (minimum cover)"],
        buyer: [...destination, "Destination handling", "Inland delivery"],
        freightIncluded: true,
        insurance: "included",
      };
    case "DAP":
      return {
        included: ["Product", "Export clearance", "Transport to the named place"],
        buyer: ["Unloading at the named place", ...destination],
        freightIncluded: true,
        insurance: "seller-risk",
      };
    case "DPU":
      return {
        included: ["Product", "Export clearance", "Transport to the named place", "Unloading"],
        buyer: destination,
        freightIncluded: true,
        insurance: "seller-risk",
      };
    case "DDP":
      return {
        included: ["Product", "Export clearance", "Transport to the named place", "Import duties and clearance"],
        buyer: ["Unloading at the named place"],
        freightIncluded: true,
        insurance: "seller-risk",
      };
  }
}

export const INSURANCE_LABEL: Record<IncotermCoverage["insurance"], string> = {
  included: "Included",
  "seller-risk": "Seller's risk to destination",
  "not-included": "Not included",
};

/* ------------------------------------------------------------------------ */
/* Deviations: requirement vs quotation                                      */
/* ------------------------------------------------------------------------ */

export type DeviationKind = "deviation" | "match" | "note";

export interface QuotationDeviation {
  id: string;
  kind: DeviationKind;
  message: string;
}

const ARRIVAL_TERMS: readonly Incoterm[] = ["CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];

function placeTokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[,()/]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Loose match between a quoted named place and the requested destination. */
function placeMatches(namedPlace: string, destination: string): boolean {
  const dest = destination.toLowerCase();
  return placeTokens(namedPlace).some((t) => dest.includes(t) || t.includes(placeTokens(destination)[0] ?? ""));
}

const AVAILABILITY_TEXT: Record<DocumentAvailability, string> = {
  available: "available",
  "on-request": "only on request",
  "not-offered": "not offered",
};

/** Compares a quotation with its requirement. Deterministic; no AI involved. */
export function quotationDeviations(q: Quotation, r: ImportRequirement): QuotationDeviation[] {
  const out: QuotationDeviation[] = [];
  const add = (id: string, kind: DeviationKind, message: string) => out.push({ id, kind, message });
  const s = supplierOf(q);

  // Product
  add("spec", q.product.specificationAsRequested ? "match" : "deviation",
    q.product.specificationAsRequested ? "Specification as requested" : "Specification differs from your requirement");

  const offered = q.product.quantity.amount;
  const requested = r.quantity.amount;
  if (offered < requested) {
    const min = r.quantity.minimumAcceptable;
    const minNote = min ? (offered >= min ? ` (meets your ${formatQuantity({ amount: min, unit: r.quantity.unit })} minimum)` : ` (below your ${formatQuantity({ amount: min, unit: r.quantity.unit })} minimum)`) : "";
    add("quantity", "deviation", `Offers ${formatQuantity(q.product.quantity)} of the ${formatQuantity(r.quantity)} requested${minNote}`);
  } else {
    add("quantity", "match", "Quantity requirement matched");
  }

  if (r.quality.originPreference) {
    const ok = q.product.origin.toLowerCase() === r.quality.originPreference.toLowerCase();
    add("origin", ok ? "match" : "deviation",
      ok ? `Origin ${q.product.origin}, as preferred` : `Origin ${q.product.origin}; you prefer ${r.quality.originPreference}`);
  }
  if (r.quality.packaging) {
    add("packaging", q.product.packagingAsRequested ? "match" : "deviation",
      q.product.packagingAsRequested ? "Requested packaging matched" : `Packaging differs: ${q.product.packaging}`);
  }

  // Terms of delivery
  const wanted = r.delivery.incoterm;
  if (wanted) {
    if (q.price.incoterm !== wanted) {
      add("incoterm", "deviation", `Proposes ${formatIncoterm(q)} instead of ${wanted}`);
    } else if (ARRIVAL_TERMS.includes(wanted) && !placeMatches(q.price.namedPlace, r.delivery.destinationLocation)) {
      add("incoterm", "deviation", `Quoted ${formatIncoterm(q)}, not to ${r.delivery.destinationLocation}`);
    } else {
      add("incoterm", "match", `Incoterm matched (${formatIncoterm(q)})`);
    }
  }

  // Timing
  const arrival = estimatedArrival(q);
  const ready = estimatedReadiness(q);
  if (arrival) {
    const late = daysBetween(r.delivery.requiredBy, arrival);
    add("timing", late > 0 ? "deviation" : "match",
      late > 0
        ? `Estimated arrival is ${late} ${late === 1 ? "day" : "days"} later than your required date`
        : "Estimated to arrive before your required date");
  } else {
    const late = daysBetween(r.delivery.requiredBy, ready);
    if (late > 0) add("timing", "deviation", `Goods ready ${late} days after your required date`);
    else add("timing", "note", `Ready to ship around ${formatDate(ready)}; arrival depends on the freight you arrange`);
  }

  // Payment
  const wantedPay = r.commercial.paymentTerms;
  if (wantedPay) {
    if (q.commercial.advancePercent > 0) {
      add("payment", "deviation", `Payment requires ${q.commercial.advancePercent}% advance; you requested ${paymentTermLabel(wantedPay)}`);
    } else if (q.commercial.paymentTerm !== wantedPay) {
      add("payment", "deviation", `Proposes ${q.commercial.paymentSummary} instead of ${paymentTermLabel(wantedPay)}`);
    } else {
      add("payment", "match", `Payment terms matched (${q.commercial.paymentSummary})`);
    }
  }

  // Documents and inspection
  const missing = r.quality.certifications
    .map((name) => ({ name, availability: q.compliance.documents.find((d) => d.name === name)?.availability ?? "not-offered" }))
    .filter((d) => d.availability !== "available");
  if (r.quality.certifications.length) {
    if (missing.length === 0) add("docs", "match", "All requested certificates declared available");
    for (const d of missing) add(`doc-${d.name}`, "deviation", `${d.name} ${AVAILABILITY_TEXT[d.availability]}`);
  }
  if (r.quality.inspection) {
    add("inspection", q.compliance.inspectionAccepted ? "match" : "deviation",
      q.compliance.inspectionAccepted ? "Inspection requirement accepted" : "Your inspection requirement is not accepted");
  }

  // Supplier
  const p = r.supplierPreferences;
  if (p.manufacturerRequired) {
    const isMaker = isManufacturer(s.type);
    add("supplier-type", isMaker ? "match" : "deviation",
      isMaker ? "Manufacturer, as required" : `Supplier type is ${SUPPLIER_TYPE_LABEL[s.type].toLowerCase()}; you require a manufacturer`);
  }
  if (p.minimumExperienceYears !== undefined && s.yearsExporting < p.minimumExperienceYears) {
    add("experience", "deviation", `${s.yearsExporting} years exporting; you asked for ${p.minimumExperienceYears}+`);
  }

  // Price vs target — only when the basis is the same.
  const target = r.commercial.targetPrice;
  if (target && target.currency === q.price.currency && q.price.incoterm === wanted) {
    const diff = q.price.unitPrice - target.amount;
    if (diff > 0) {
      add("target", "note", `Quoted unit price is ${formatPrice(diff, target.currency)} above your target (same Incoterm)`);
    } else {
      add("target", "match", "At or below your target price (same Incoterm)");
    }
  }

  // Validity
  const left = validityDaysLeft(q);
  if (left < 0) add("validity", "note", `Offer validity expired on ${formatDate(q.commercial.validUntil)}`);
  else if (left <= 3) add("validity", "note", `Offer valid only until ${formatDate(q.commercial.validUntil)}`);

  return out;
}

export function deviationCount(q: Quotation): number {
  const r = requirementOf(q);
  return r ? quotationDeviations(q, r).filter((d) => d.kind === "deviation").length : 0;
}
