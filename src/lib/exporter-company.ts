/*
 * Exporter company profile: view types and mock data.
 *
 * This is the company-level trade profile Ximverse uses for verification,
 * RFQ matching and buyer trust: who the exporter is, what volume it can ship,
 * to which markets, under which certifications and terms. Product-level detail
 * (HS codes, specifications, packaging, per-product MOQ and price ranges)
 * belongs to the product catalogue, not here.
 *
 * Mock data until profiles are stored on a backend; the shapes are what the
 * page expects an API to return.
 */

import type { Quantity } from "./exporter-dashboard";

/** State of anything Ximverse checks: a registration, a certificate, a bank. */
export type VerificationStatus = "verified" | "pending" | "not-added" | "expired";

export const VERIFICATION_STATUS_LABEL: Record<VerificationStatus, string> = {
  verified: "Verified",
  pending: "Pending",
  "not-added": "Not Added",
  expired: "Expired",
};

export interface Range {
  min: number;
  max: number;
}

// ---------------------------------------------------------------------------
// Profile summary
// ---------------------------------------------------------------------------

export interface ProfileSummary {
  /** 0–100. */
  completion: number;
  /** ISO date. */
  lastUpdated: string;
}

export const PROFILE_SUMMARY: ProfileSummary = {
  completion: 82,
  lastUpdated: "2026-10-06",
};

// ---------------------------------------------------------------------------
// Company information
// ---------------------------------------------------------------------------

export interface CompanyInformation {
  legalName: string;
  tradeName: string;
  businessType: string;
  yearEstablished: number;
  companySize: string;
  headOffice: string;
  manufacturingLocations: readonly string[];
  website: string;
  businessEmail: string;
  businessPhone: string;
}

export const COMPANY_INFORMATION: CompanyInformation = {
  legalName: "Shree Agro Exports Pvt Ltd",
  tradeName: "Shree Agro Exports",
  businessType: "Manufacturer & Exporter",
  yearEstablished: 2014,
  companySize: "51–200 employees",
  headOffice: "Karnal, Haryana, India",
  manufacturingLocations: ["Karnal, Haryana", "Sonipat, Haryana"],
  website: "www.shreeagro.example",
  businessEmail: "exports@shreeagro.example",
  businessPhone: "+91 98XXXXXX21",
};

// ---------------------------------------------------------------------------
// Registrations and export identity
// ---------------------------------------------------------------------------

export interface RegistrationRecord {
  key: string;
  label: string;
  /** Number or name as registered; absent when not yet added. */
  value?: string;
  /** Render the value as an identifier (monospace, breakable). */
  identifier?: boolean;
  status: VerificationStatus;
}

export const REGISTRATIONS: readonly RegistrationRecord[] = [
  { key: "iec", label: "IEC", value: "33120XXXXX", identifier: true, status: "verified" },
  { key: "gstin", label: "GSTIN", value: "06XXXXX1234X1Z5", identifier: true, status: "verified" },
  { key: "pan", label: "PAN", value: "AXXXX1234X", identifier: true, status: "verified" },
  { key: "cin", label: "CIN", value: "UXXXXXHR2014PTCXXXXX", identifier: true, status: "verified" },
  { key: "udyam", label: "Udyam Registration", status: "not-added" },
  { key: "rcmc", label: "RCMC", value: "APEDA Registered", status: "verified" },
  { key: "epc", label: "Export Promotion Council", value: "APEDA", status: "verified" },
  { key: "ad-code", label: "AD Code", value: "XXXXXXX", identifier: true, status: "pending" },
  { key: "bank", label: "Primary Bank", value: "HDFC Bank", status: "pending" },
];

// ---------------------------------------------------------------------------
// Export capabilities
// ---------------------------------------------------------------------------

export interface ExportCapabilities {
  primaryIndustry: string;
  /** Broad categories only; individual products live in the catalogue. */
  productCategories: readonly string[];
  monthlyProductionCapacity: Quantity;
  monthlyExportCapacity: Quantity;
  /** 0–100: share of export capacity already committed. */
  exportUtilisation: number;
  minimumOrder: Quantity;
  leadTimeDays: Range;
  exportExperienceYears: number;
  annualTurnoverRange: string;
}

export const EXPORT_CAPABILITIES: ExportCapabilities = {
  primaryIndustry: "Agriculture & Food Products",
  productCategories: ["Basmati Rice", "Non-Basmati Rice", "Organic Coconut", "Coconut Products"],
  monthlyProductionCapacity: { value: 4500, unit: "MT" },
  monthlyExportCapacity: { value: 2800, unit: "MT" },
  exportUtilisation: 68,
  minimumOrder: { value: 20, unit: "MT" },
  leadTimeDays: { min: 10, max: 18 },
  exportExperienceYears: 8,
  annualTurnoverRange: "₹25 Cr – ₹50 Cr",
};

// ---------------------------------------------------------------------------
// Markets and trade lanes
// ---------------------------------------------------------------------------

export interface MarketsProfile {
  currentMarkets: readonly string[];
  targetMarkets: readonly string[];
  preferredPorts: readonly string[];
  preferredIncoterms: readonly string[];
  shipmentModes: readonly string[];
}

export const MARKETS_PROFILE: MarketsProfile = {
  currentMarkets: ["UAE", "Saudi Arabia", "Qatar", "Germany", "United Kingdom"],
  targetMarkets: ["USA", "Netherlands", "France", "Singapore"],
  preferredPorts: ["Mundra", "Nhava Sheva / JNPT"],
  preferredIncoterms: ["FOB", "CIF", "CFR"],
  shipmentModes: ["FCL", "LCL", "Air Freight"],
};

// ---------------------------------------------------------------------------
// Certifications
// ---------------------------------------------------------------------------

export interface Certification {
  key: string;
  name: string;
  /** Issuing body or category, e.g. "FSSAI" or "Food safety". */
  issuer: string;
  /**
   * "per-shipment" marks capabilities certified case by case rather than held
   * as a standing certificate (e.g. phytosanitary certificates).
   */
  status: VerificationStatus | "per-shipment";
  /** ISO date, when the certificate expires. */
  expiresOn?: string;
}

export const CERTIFICATIONS: readonly Certification[] = [
  { key: "apeda", name: "APEDA Registration", issuer: "APEDA · Export registration", status: "verified", expiresOn: "2027-03-15" },
  { key: "fssai", name: "FSSAI Licence", issuer: "FSSAI · Food safety", status: "verified", expiresOn: "2027-08-21" },
  { key: "iso-22000", name: "ISO 22000", issuer: "Food safety management", status: "verified", expiresOn: "2028-01-11" },
  { key: "haccp", name: "HACCP", issuer: "Food safety", status: "verified", expiresOn: "2027-06-30" },
  { key: "organic", name: "Organic Certification", issuer: "NPOP · Organic", status: "pending" },
  { key: "phyto", name: "Phytosanitary Capability", issuer: "Plant Quarantine · Per consignment", status: "per-shipment" },
];

// ---------------------------------------------------------------------------
// Trade preferences
// ---------------------------------------------------------------------------

export interface TradePreferences {
  currencies: readonly string[];
  paymentTerms: readonly string[];
  quoteValidityDays: number;
  /** Internal only; never shown to buyers. */
  minimumMargin: string;
  creditTerms: string;
}

export const TRADE_PREFERENCES: TradePreferences = {
  currencies: ["USD", "EUR", "GBP"],
  paymentTerms: ["Advance", "Letter of Credit", "Documents Against Payment"],
  quoteValidityDays: 7,
  minimumMargin: "8% over cost",
  creditTerms: "Available for approved buyers",
};

// ---------------------------------------------------------------------------
// Buyer matching
// ---------------------------------------------------------------------------

export interface BuyerMatchingProfile {
  /** 0–100: how completely these preferences describe the exporter. */
  strength: number;
  preferredRegions: readonly string[];
  preferredOrderSize: Range & { unit: Quantity["unit"] };
  preferredDestinations: readonly string[];
  industriesServed: readonly string[];
  productCategories: readonly string[];
  maxNewMonthlyCommitment: Quantity;
  fulfillableCertifications: readonly string[];
}

export const BUYER_MATCHING_PROFILE: BuyerMatchingProfile = {
  strength: 91,
  preferredRegions: ["Middle East", "Europe", "North America"],
  preferredOrderSize: { min: 50, max: 500, unit: "MT" },
  preferredDestinations: ["UAE", "Saudi Arabia", "Germany", "United Kingdom", "USA"],
  industriesServed: ["Food distribution", "Retail", "Food manufacturing", "HoReCa"],
  productCategories: EXPORT_CAPABILITIES.productCategories,
  maxNewMonthlyCommitment: { value: 1200, unit: "MT" },
  fulfillableCertifications: ["HACCP", "ISO 22000", "FSSAI", "Phytosanitary", "Halal"],
};

// ---------------------------------------------------------------------------
// Readiness and assistant
// ---------------------------------------------------------------------------

export interface ReadinessItem {
  key: string;
  label: string;
  done: boolean;
  /** Section the item is fixed in, for an in-page link. */
  sectionId: string;
}

export const READINESS_ITEMS: readonly ReadinessItem[] = [
  { key: "company", label: "Company information complete", done: true, sectionId: "company-information" },
  { key: "iec", label: "IEC verified", done: true, sectionId: "registration" },
  { key: "gstin", label: "GSTIN verified", done: true, sectionId: "registration" },
  { key: "capabilities", label: "Export capabilities added", done: true, sectionId: "capabilities" },
  { key: "markets", label: "Markets added", done: true, sectionId: "markets" },
  { key: "certs-verified", label: "4 certifications verified", done: true, sectionId: "certifications" },
  { key: "certs-pending", label: "1 certification pending", done: false, sectionId: "certifications" },
  { key: "bank", label: "Add bank verification", done: false, sectionId: "registration" },
];

export const SUMIT_PROFILE_INSIGHT =
  "Adding your US FDA registration and increasing the detail in your coconut product capabilities could improve matching for North American opportunities.";
