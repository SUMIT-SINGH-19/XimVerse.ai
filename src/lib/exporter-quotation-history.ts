/*
 * Seeded exporter quotation history (demo).
 *
 * Same ExporterQuotation shape the quote form produces, so list and detail
 * views treat seeded and browser-created quotations identically. Each seed
 * points at an opportunity in exporter-opportunities.ts, which supplies the
 * product, destination and buyer market — nothing is copied here.
 *
 * IDs use the reserved QT-2026-8xxx range: clear of the importer's mock
 * quotations (QT-2026-01xx) and of quotations created in this browser
 * (QT-2026-9001+). Deviations are stored objects, as the quote workflow would
 * have produced them; there's no separate comparison logic.
 */

import { EXPORTER_COMPANY_ID } from "./exporter-company";
import type {
  ComplianceResponse,
  CostCoverage,
  ExporterQuotation,
  ExporterQuotationStatus,
  QuotationDeviation,
  QuotationFeedback,
} from "./exporter-quotations";

const ORIGIN = "Karnal, Haryana, India";
const RICE_HS = "1006.30";

interface Seed {
  id: string;
  requirementId: string;
  opportunityId: string;
  productId: string;
  status: ExporterQuotationStatus;
  description: string;
  hsCode?: string;
  amount: number;
  unitPrice: number;
  currency: "USD" | "EUR";
  incoterm: "CIF" | "CFR";
  namedPlace: string;
  packaging: string;
  packagingAsRequested?: boolean;
  leadTimeDays: number;
  dispatch: string;
  delivery: string;
  paymentTerm: ExporterQuotation["commercial"]["paymentTerm"];
  paymentSummary: string;
  validUntil: string;
  submittedAt: string;
  updatedAt?: string;
  documents: [string, ComplianceResponse][];
  notes?: string;
  internalNote?: string;
  deviations?: QuotationDeviation[];
  feedback?: QuotationFeedback;
}

function coverage(term: "CIF" | "CFR"): { freight: CostCoverage; insurance: CostCoverage } {
  return term === "CIF" ? { freight: "included", insurance: "included" } : { freight: "included", insurance: "excluded" };
}

function seed(s: Seed): ExporterQuotation {
  return {
    id: s.id,
    requirementId: s.requirementId,
    opportunityId: s.opportunityId,
    exporterProductId: s.productId,
    exporterCompanyId: EXPORTER_COMPANY_ID,
    status: s.status,
    product: {
      description: s.description,
      specificationAsRequested: true,
      hsCode: s.hsCode ?? RICE_HS,
      quantity: { amount: s.amount, unit: "MT" },
      moq: { amount: 25, unit: "MT" },
      packaging: s.packaging,
      packagingAsRequested: s.packagingAsRequested ?? true,
      origin: ORIGIN,
    },
    price: {
      unitPrice: s.unitPrice,
      currency: s.currency,
      incoterm: s.incoterm,
      namedPlace: s.namedPlace,
      pricingUnit: "MT",
      // Whole-number prices, so this is exact.
      total: s.unitPrice * s.amount,
    },
    costCoverage: coverage(s.incoterm),
    delivery: {
      portOfLoading: "Mundra, India",
      leadTimeDays: s.leadTimeDays,
      mode: "Sea",
      earliestDispatch: s.dispatch,
      estimatedDelivery: s.delivery,
    },
    commercial: {
      paymentTerm: s.paymentTerm,
      advancePercent: 0,
      paymentSummary: s.paymentSummary,
      validUntil: s.validUntil,
      notes: s.notes,
    },
    compliance: { documents: s.documents.map(([name, response]) => ({ name, response })) },
    deviations: s.deviations ?? [],
    feedback: s.feedback,
    internalNote: s.internalNote,
    createdAt: s.submittedAt,
    updatedAt: s.updatedAt ?? s.submittedAt,
    submittedAt: s.submittedAt,
  };
}

export const SEEDED_QUOTATIONS: readonly ExporterQuotation[] = [
  seed({
    id: "QT-2026-8204",
    requirementId: "DEMO-RFQ-1003",
    opportunityId: "OPP-2026-0305",
    productId: "rice-1121-steam",
    status: "under-review",
    description: "Average grain length 8.35 mm min, moisture 12.5% max, broken 1% max.",
    amount: 300,
    unitPrice: 1025,
    currency: "USD",
    incoterm: "CIF",
    namedPlace: "Dammam, Saudi Arabia",
    packaging: "25 kg PP bags.",
    leadTimeDays: 12,
    dispatch: "2026-10-20",
    delivery: "2026-11-14",
    paymentTerm: "lc",
    paymentSummary: "Letter of Credit (LC), 30 days",
    validUntil: "2026-10-12",
    submittedAt: "2026-10-04T08:15:00Z",
    updatedAt: "2026-10-06T11:00:00Z",
    documents: [
      ["Certificate of Origin", "can-provide"],
      ["Phytosanitary Certificate", "can-provide"],
    ],
    notes: "Single shipment in 20 ft FCL.",
  }),
  seed({
    id: "QT-2026-8198",
    requirementId: "DEMO-RFQ-1006",
    opportunityId: "OPP-2026-0298",
    productId: "coconut-organic",
    status: "shortlisted",
    description: "Desiccated coconut, fine grade, fat 63% min, moisture 3% max. Certified organic.",
    hsCode: "0801.19",
    amount: 50,
    unitPrice: 920,
    currency: "EUR",
    incoterm: "CIF",
    namedPlace: "Hamburg, Germany",
    packaging: "25 kg multi-wall paper bags with PE liner.",
    leadTimeDays: 15,
    dispatch: "2026-10-22",
    delivery: "2026-11-10",
    paymentTerm: "dp",
    paymentSummary: "Documents Against Payment (DP)",
    validUntil: "2026-10-16",
    submittedAt: "2026-10-01T09:40:00Z",
    updatedAt: "2026-10-06T14:20:00Z",
    documents: [
      ["Health Certificate", "can-provide"],
      ["Phytosanitary Certificate", "can-provide"],
    ],
    deviations: [
      {
        id: "cred-EU Organic",
        field: "credential",
        severity: "info",
        buyerRequirement: "EU Organic",
        exporterOffer: "Pending verification",
        message: "EU Organic pending verification",
      },
    ],
  }),
  seed({
    id: "QT-2026-8187",
    requirementId: "DEMO-RFQ-1004",
    opportunityId: "OPP-2026-0304",
    productId: "rice-pr11",
    status: "revision-requested",
    description: "PR11 parboiled, broken 5% max, moisture 14% max.",
    amount: 80,
    unitPrice: 780,
    currency: "USD",
    incoterm: "CIF",
    namedPlace: "Felixstowe, UK",
    packaging: "25 kg PP bags.",
    packagingAsRequested: false,
    leadTimeDays: 10,
    dispatch: "2026-10-18",
    delivery: "2026-11-11",
    paymentTerm: "lc",
    paymentSummary: "Letter of Credit (LC), 30 days",
    validUntil: "2026-10-10",
    submittedAt: "2026-10-03T07:30:00Z",
    updatedAt: "2026-10-06T16:45:00Z",
    documents: [
      ["Phytosanitary Certificate", "can-provide"],
      ["Inspection Certificate", "can-provide"],
    ],
    internalNote: "Paper bags add about $8/MT — check with packaging vendor before revising.",
    deviations: [
      {
        id: "delivery",
        field: "delivery",
        severity: "warning",
        buyerRequirement: "By 2026-11-05",
        exporterOffer: "2026-11-11",
        message: "Delivery deviation: 6 days after the required date",
      },
      {
        id: "packaging",
        field: "packaging",
        severity: "warning",
        buyerRequirement: "20 kg paper bags.",
        exporterOffer: "25 kg PP bags.",
        message: "Packaging differs from the buyer's requirement",
      },
      {
        id: "cred-BRCGS Food Safety",
        field: "credential",
        severity: "warning",
        buyerRequirement: "BRCGS Food Safety",
        exporterOffer: "Not on profile",
        message: "BRCGS Food Safety missing from your profile",
      },
    ],
    feedback: {
      at: "2026-10-06T16:45:00Z",
      message: "Please revise the delivery date to meet 5 Nov and confirm 20 kg paper bag packaging.",
    },
  }),
  seed({
    id: "QT-2026-8174",
    requirementId: "DEMO-RFQ-1005",
    opportunityId: "OPP-2026-0301",
    productId: "rice-1121-golden-sella",
    status: "negotiation",
    description: "Golden sella, average grain length 8.2 mm min, broken 1% max.",
    amount: 120,
    unitPrice: 1060,
    currency: "USD",
    incoterm: "CIF",
    namedPlace: "Jebel Ali, UAE",
    packaging: "5 kg and 25 kg PP bags.",
    leadTimeDays: 14,
    dispatch: "2026-10-22",
    delivery: "2026-11-08",
    paymentTerm: "dp",
    paymentSummary: "Documents Against Payment (DP)",
    validUntil: "2026-10-11",
    submittedAt: "2026-10-02T10:05:00Z",
    updatedAt: "2026-10-07T06:30:00Z",
    documents: [["Certificate of Origin", "can-provide"]],
    feedback: {
      at: "2026-10-07T06:30:00Z",
      message: "The buyer asked whether you can meet $1,040 / MT for the full 120 MT.",
      counterOffer: { unitPrice: 1040, currency: "USD" },
    },
  }),
  seed({
    id: "QT-2026-8162",
    requirementId: "DEMO-RFQ-0991",
    opportunityId: "OPP-2026-0254",
    productId: "rice-1121-steam",
    status: "accepted",
    description: "Average grain length 8.35 mm min, broken 1% max, 25 kg PP bags.",
    amount: 100,
    unitPrice: 1090,
    currency: "USD",
    incoterm: "CIF",
    namedPlace: "Jebel Ali, UAE",
    packaging: "25 kg PP bags.",
    leadTimeDays: 12,
    dispatch: "2026-09-20",
    delivery: "2026-10-10",
    paymentTerm: "lc",
    paymentSummary: "Letter of Credit (LC)",
    validUntil: "2026-09-16",
    submittedAt: "2026-09-05T08:00:00Z",
    updatedAt: "2026-09-12T12:00:00Z",
    documents: [
      ["Certificate of Origin", "can-provide"],
      ["Phytosanitary Certificate", "can-provide"],
    ],
    feedback: { at: "2026-09-12T12:00:00Z", message: "The buyer selected your offer. Ximverse will set up the deal." },
  }),
  seed({
    id: "QT-2026-8151",
    requirementId: "DEMO-RFQ-0987",
    opportunityId: "OPP-2026-0249",
    productId: "rice-pr11",
    status: "rejected",
    description: "PR11 sella, broken 5% max.",
    amount: 200,
    unitPrice: 545,
    currency: "USD",
    incoterm: "CFR",
    namedPlace: "Sohar, Oman",
    packaging: "50 kg PP bags.",
    leadTimeDays: 9,
    dispatch: "2026-09-10",
    delivery: "2026-09-24",
    paymentTerm: "dp",
    paymentSummary: "Documents Against Payment (DP)",
    validUntil: "2026-09-08",
    submittedAt: "2026-08-28T09:30:00Z",
    updatedAt: "2026-09-03T10:00:00Z",
    documents: [["Certificate of Origin", "can-provide"]],
    feedback: {
      at: "2026-09-03T10:00:00Z",
      message: "The buyer chose another offer.",
      reason: "Price above shortlisted range",
    },
  }),
  seed({
    id: "QT-2026-8140",
    requirementId: "DEMO-RFQ-1000",
    opportunityId: "OPP-2026-0280",
    productId: "rice-1121-steam",
    // Stored as submitted; validity lapsed on 4 Oct, so it shows as Expired.
    status: "submitted",
    description: "Average grain length 8.35 mm min, broken 1% max.",
    amount: 40,
    unitPrice: 1095,
    currency: "USD",
    incoterm: "CIF",
    namedPlace: "Hamburg, Germany",
    packaging: "25 kg PP bags.",
    leadTimeDays: 12,
    dispatch: "2026-10-12",
    delivery: "2026-10-30",
    paymentTerm: "dp",
    paymentSummary: "Documents Against Payment (DP)",
    validUntil: "2026-10-04",
    submittedAt: "2026-09-27T07:00:00Z",
    documents: [],
  }),
];
