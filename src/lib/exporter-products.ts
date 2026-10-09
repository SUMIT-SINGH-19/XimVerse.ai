/*
 * Exporter product catalogue: view types and mock data.
 *
 * A product here is a *supply capability* — what the exporter can ship, in
 * what volume, to what specification, under which certifications — not a
 * storefront listing. Buyer prices are produced per RFQ in the quotation
 * workflow; the only price on a product is an optional internal band the
 * exporter keeps for itself.
 *
 * Company-level facts (IEC, GSTIN, turnover, company-wide capacity, bank)
 * live in exporter-company.ts. Product certifications reference the company's
 * certifications by key rather than restating them.
 *
 * Exporter-specific until importer and exporter schemas are designed together.
 */

import { CERTIFICATIONS, type Range } from "./exporter-company";
import type { Quantity } from "./exporter-dashboard";

export type ProductStatus = "draft" | "active" | "paused" | "needs-information";

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  "needs-information": "Needs Information",
};

/** Paused and draft products are not offered to buyer requirements. */
export function receivesMatches(status: ProductStatus): boolean {
  return status === "active" || status === "needs-information";
}

/**
 * One specification line. Free-form label/value pairs so rice, coconut, spices
 * or anything else can carry its own keys without a schema per category.
 */
export interface ProductSpecification {
  label: string;
  value: string;
}

export interface PackagingOption {
  label: string;
  /** Marks options made to the buyer's design rather than stock sizes. */
  custom?: boolean;
}

export interface ContainerLoad {
  container: string;
  /** Approximate payload, e.g. "≈ 25 MT". */
  load: string;
}

export interface ProductPackaging {
  options: readonly PackagingOption[];
  material?: string;
  privateLabel: boolean;
  palletisation?: string;
  containerLoads: readonly ContainerLoad[];
}

/** A company certification (by key) that covers this product. */
export interface ProductCertification {
  certificationKey: string;
  /** Product-specific scope, e.g. "Covers Karnal unit". */
  note?: string;
}

export interface MarketExperience {
  /** Markets this product has already shipped to. */
  experienced: readonly string[];
  /** Markets the exporter wants this product to reach. */
  target: readonly string[];
}

/**
 * The exporter's own reference band. Internal only: never sent to buyers,
 * never used as a published price.
 */
export interface InternalPriceBand extends Range {
  currency: "USD" | "EUR" | "INR";
  unit: Quantity["unit"];
}

export interface CommercialCapability {
  quoteCurrencies: readonly string[];
  incoterms: readonly string[];
  paymentTerms: readonly string[];
  internalPriceBand?: InternalPriceBand;
}

export interface SupplyCapability {
  monthlyProductionCapacity: Quantity;
  monthlyExportCapacity: Quantity;
  availableCapacity: Quantity;
  moq: Quantity;
  maxSingleOrder?: Quantity;
  leadTimeDays: Range;
}

export interface MatchReadinessItem {
  key: string;
  label: string;
  done: boolean;
}

export interface ExporterProduct {
  id: string;
  name: string;
  /** Broad sector, e.g. "Agriculture". */
  sector: string;
  category: string;
  subcategory?: string;
  hsCode: string;
  origin: string;
  /** Exporter's internal SKU / product code. */
  productCode: string;
  status: ProductStatus;
  specifications: readonly ProductSpecification[];
  supply: SupplyCapability;
  packaging?: ProductPackaging;
  certifications: readonly ProductCertification[];
  markets: MarketExperience;
  commercial: CommercialCapability;
  /** 0–100: how well the profile supports RFQ matching. */
  readiness: number;
  readinessItems: readonly MatchReadinessItem[];
  /** ISO date. */
  updatedOn: string;
  /** Created in this browser session only; not stored anywhere. */
  demo?: boolean;
}

// ---------------------------------------------------------------------------
// Mock catalogue
// ---------------------------------------------------------------------------

const RICE_PACKAGING: ProductPackaging = {
  options: [
    { label: "5 kg PP Bag" },
    { label: "10 kg PP Bag" },
    { label: "25 kg PP Bag" },
    { label: "50 kg PP Bag" },
    { label: "Custom Buyer Packaging", custom: true },
  ],
  material: "Woven PP / non-woven PP, BOPP printed on request",
  privateLabel: true,
  palletisation: "Available on request",
  containerLoads: [
    { container: "20 ft", load: "≈ 25 MT" },
    { container: "40 ft", load: "≈ 26–27 MT" },
  ],
};

const RICE_COMMERCIAL = {
  quoteCurrencies: ["USD", "EUR", "GBP"],
  incoterms: ["FOB", "CFR", "CIF"],
  paymentTerms: ["Advance", "LC", "DP"],
} as const;

function readiness(done: readonly string[], items: readonly [string, string][]): MatchReadinessItem[] {
  return items.map(([key, label]) => ({ key, label, done: done.includes(key) }));
}

const READINESS_LABELS: readonly [string, string][] = [
  ["hs", "HS Code added"],
  ["specs", "Specifications complete"],
  ["capacity", "Capacity available"],
  ["packaging", "Packaging added"],
  ["certs", "Certifications mapped"],
  ["markets", "Market experience added"],
  ["lead", "Lead time added"],
  ["report", "Add latest product test report"],
];

export const EXPORTER_PRODUCTS: readonly ExporterProduct[] = [
  {
    id: "rice-1121-steam",
    name: "1121 Steam Basmati Rice",
    sector: "Agriculture",
    category: "Rice",
    subcategory: "Basmati",
    hsCode: "10063020",
    origin: "Karnal, Haryana, India",
    productCode: "RICE-1121-ST",
    status: "active",
    specifications: [
      { label: "Variety", value: "1121" },
      { label: "Processing", value: "Steam" },
      { label: "Average Grain Length", value: "8.35 mm" },
      { label: "Moisture", value: "Max 12.5%" },
      { label: "Broken Grain", value: "Max 1%" },
      { label: "Foreign Matter", value: "Max 0.1%" },
      { label: "Purity", value: "95%" },
      { label: "Crop Year", value: "2026" },
    ],
    supply: {
      monthlyProductionCapacity: { value: 1800, unit: "MT" },
      monthlyExportCapacity: { value: 1500, unit: "MT" },
      availableCapacity: { value: 620, unit: "MT" },
      moq: { value: 25, unit: "MT" },
      maxSingleOrder: { value: 500, unit: "MT" },
      leadTimeDays: { min: 10, max: 14 },
    },
    packaging: RICE_PACKAGING,
    certifications: [
      { certificationKey: "apeda" },
      { certificationKey: "fssai" },
      { certificationKey: "haccp" },
      { certificationKey: "iso-22000", note: "Karnal processing unit" },
      { certificationKey: "phyto" },
    ],
    markets: {
      experienced: ["UAE", "Saudi Arabia", "Qatar", "Germany", "United Kingdom"],
      target: ["USA", "Netherlands", "France"],
    },
    commercial: {
      ...RICE_COMMERCIAL,
      internalPriceBand: { min: 950, max: 1150, currency: "USD", unit: "MT" },
    },
    readiness: 96,
    readinessItems: readiness(["hs", "specs", "capacity", "packaging", "certs", "markets", "lead"], READINESS_LABELS),
    updatedOn: "2026-10-06",
  },
  {
    id: "rice-1121-golden-sella",
    name: "1121 Golden Sella Basmati Rice",
    sector: "Agriculture",
    category: "Rice",
    subcategory: "Basmati",
    hsCode: "10063020",
    origin: "Karnal, Haryana, India",
    productCode: "RICE-1121-GS",
    status: "active",
    specifications: [
      { label: "Variety", value: "1121" },
      { label: "Processing", value: "Golden Sella (parboiled)" },
      { label: "Average Grain Length", value: "8.30 mm" },
      { label: "Moisture", value: "Max 12%" },
      { label: "Broken Grain", value: "Max 1%" },
      { label: "Colour", value: "Uniform golden" },
      { label: "Crop Year", value: "2026" },
    ],
    supply: {
      monthlyProductionCapacity: { value: 1400, unit: "MT" },
      monthlyExportCapacity: { value: 1200, unit: "MT" },
      availableCapacity: { value: 430, unit: "MT" },
      moq: { value: 25, unit: "MT" },
      maxSingleOrder: { value: 400, unit: "MT" },
      leadTimeDays: { min: 12, max: 16 },
    },
    packaging: RICE_PACKAGING,
    certifications: [
      { certificationKey: "apeda" },
      { certificationKey: "fssai" },
      { certificationKey: "haccp" },
      { certificationKey: "phyto" },
    ],
    markets: {
      experienced: ["Saudi Arabia", "UAE", "Qatar"],
      target: ["USA", "Singapore"],
    },
    commercial: {
      ...RICE_COMMERCIAL,
      internalPriceBand: { min: 980, max: 1120, currency: "USD", unit: "MT" },
    },
    readiness: 93,
    readinessItems: readiness(["hs", "specs", "capacity", "packaging", "certs", "markets", "lead"], READINESS_LABELS),
    updatedOn: "2026-10-03",
  },
  {
    id: "rice-pr11",
    name: "PR11 Non-Basmati Rice",
    sector: "Agriculture",
    category: "Rice",
    subcategory: "Non-Basmati",
    hsCode: "10063090",
    origin: "Sonipat, Haryana, India",
    productCode: "RICE-PR11",
    status: "active",
    specifications: [
      { label: "Variety", value: "PR11" },
      { label: "Processing", value: "Raw / Sella" },
      { label: "Average Grain Length", value: "6.2 mm" },
      { label: "Moisture", value: "Max 14%" },
      { label: "Broken Grain", value: "Max 5%" },
      { label: "Crop Year", value: "2026" },
    ],
    supply: {
      monthlyProductionCapacity: { value: 1200, unit: "MT" },
      monthlyExportCapacity: { value: 1000, unit: "MT" },
      availableCapacity: { value: 470, unit: "MT" },
      moq: { value: 25, unit: "MT" },
      maxSingleOrder: { value: 600, unit: "MT" },
      leadTimeDays: { min: 8, max: 12 },
    },
    packaging: RICE_PACKAGING,
    certifications: [
      { certificationKey: "apeda" },
      { certificationKey: "fssai" },
      { certificationKey: "phyto" },
    ],
    markets: {
      experienced: ["United Kingdom", "UAE"],
      target: ["Netherlands", "France"],
    },
    commercial: {
      quoteCurrencies: ["USD", "GBP"],
      incoterms: ["FOB", "CIF"],
      paymentTerms: ["Advance", "LC"],
      internalPriceBand: { min: 420, max: 520, currency: "USD", unit: "MT" },
    },
    readiness: 88,
    readinessItems: readiness(["hs", "specs", "capacity", "packaging", "markets", "lead"], READINESS_LABELS),
    updatedOn: "2026-09-28",
  },
  {
    id: "coconut-organic",
    name: "Organic Coconut",
    sector: "Agriculture",
    category: "Coconut",
    subcategory: "Desiccated coconut",
    hsCode: "080119",
    origin: "India",
    productCode: "COCO-ORG-DC",
    status: "needs-information",
    specifications: [
      { label: "Form", value: "Desiccated, fine grade" },
      { label: "Fat Content", value: "Min 60%" },
      { label: "Moisture", value: "Max 3%" },
    ],
    supply: {
      monthlyProductionCapacity: { value: 900, unit: "MT" },
      monthlyExportCapacity: { value: 800, unit: "MT" },
      availableCapacity: { value: 100, unit: "MT" },
      moq: { value: 20, unit: "MT" },
      leadTimeDays: { min: 10, max: 18 },
    },
    certifications: [
      { certificationKey: "fssai" },
      { certificationKey: "organic", note: "Verification in progress" },
    ],
    markets: {
      experienced: ["Germany"],
      target: ["USA", "Netherlands"],
    },
    commercial: {
      quoteCurrencies: ["USD", "EUR"],
      incoterms: ["FOB", "CIF"],
      paymentTerms: ["Advance", "DP"],
    },
    readiness: 64,
    readinessItems: [
      { key: "hs", label: "HS Code added", done: true },
      { key: "capacity", label: "Capacity available", done: true },
      { key: "lead", label: "Lead time added", done: true },
      { key: "specs", label: "Complete specifications (particle size, FFA, microbiology)", done: false },
      { key: "packaging", label: "Add packaging options", done: false },
      { key: "certs", label: "Organic certification pending verification", done: false },
      { key: "markets", label: "Add more market experience", done: false },
    ],
    updatedOn: "2026-09-21",
  },
];

/**
 * What other exporter screens need to reference a product. Leaves out the
 * internal price band and the rest of the profile.
 */
export type ProductSummary = Pick<
  ExporterProduct,
  "id" | "name" | "productCode" | "hsCode" | "origin" | "status" | "supply" | "readiness"
>;

export function toProductSummary({ id, name, productCode, hsCode, origin, status, supply, readiness }: ExporterProduct): ProductSummary {
  return { id, name, productCode, hsCode, origin, status, supply, readiness };
}

// ---------------------------------------------------------------------------
// Derived values and filter options
// ---------------------------------------------------------------------------

/** RFQ-ready: receiving matches and at least this complete. */
export const RFQ_READY_THRESHOLD = 80;

export function catalogueSummary(products: readonly ExporterProduct[]) {
  const listed = products.filter((p) => receivesMatches(p.status));
  const sum = (pick: (p: ExporterProduct) => number) => listed.reduce((t, p) => t + pick(p), 0);
  return {
    activeProducts: listed.length,
    rfqReady: listed.filter((p) => p.status === "active" && p.readiness >= RFQ_READY_THRESHOLD).length,
    monthlyCapacity: sum((p) => p.supply.monthlyExportCapacity.value),
    availableCapacity: sum((p) => p.supply.availableCapacity.value),
    /** Average readiness of listed products. */
    matchingCoverage: listed.length ? Math.round(sum((p) => p.readiness) / listed.length) : 0,
  };
}

export type ReadinessBand = "high" | "medium" | "low";

export const READINESS_BAND_LABEL: Record<ReadinessBand, string> = {
  high: "High (90%+)",
  medium: "Medium (75–89%)",
  low: "Low (below 75%)",
};

export function readinessBand(score: number): ReadinessBand {
  if (score >= 90) return "high";
  if (score >= 75) return "medium";
  return "low";
}

export type ProductSort = "readiness" | "available" | "updated";

export const PRODUCT_SORT_LABEL: Record<ProductSort, string> = {
  readiness: "Match readiness",
  available: "Available capacity",
  updated: "Recently updated",
};

/** Company certifications a product can be mapped to. */
export const CERTIFICATION_OPTIONS = CERTIFICATIONS.map((c) => ({ key: c.key, name: c.name }));

export function companyCertification(key: string) {
  return CERTIFICATIONS.find((c) => c.key === key);
}

export const SUMIT_PRODUCTS_INSIGHT =
  "Your 1121 Steam Basmati Rice profile is highly match-ready. Adding a current lab report could improve confidence for EU buyer requirements. Its 620 MT of available capacity may also fit three active Middle East RFQs.";
