/**
 * Suppliers in the importer's sourcing network — the one canonical supplier
 * dataset. Quotations reference these by `supplierId`.
 *
 * Every supplier here is FICTIONAL demo data. Profiles, products,
 * certifications and credentials are supplier-declared and have not been
 * verified by XimVerse.
 */

import {
  MOCK_NOW,
  type ImportRequirement,
  type Currency,
  type Incoterm,
  type PaymentTerm,
  type ProductCategory,
  type QuantityUnit,
} from "./import-requirements";

/* ------------------------------------------------------------------------ */
/* Types                                                                     */
/* ------------------------------------------------------------------------ */

export type SupplierType = "manufacturer" | "manufacturer-exporter" | "exporter" | "trading-company";

export const SUPPLIER_TYPES: readonly { id: SupplierType; label: string }[] = [
  { id: "manufacturer", label: "Manufacturer" },
  { id: "manufacturer-exporter", label: "Manufacturer & exporter" },
  { id: "exporter", label: "Exporter" },
  { id: "trading-company", label: "Trading company" },
];

export const SUPPLIER_TYPE_LABEL = Object.fromEntries(SUPPLIER_TYPES.map((t) => [t.id, t.label])) as Record<
  SupplierType,
  string
>;

/** Produces the goods itself (as opposed to sourcing from producers). */
export function isManufacturer(type: SupplierType): boolean {
  return type === "manufacturer" || type === "manufacturer-exporter";
}

/** Self-reported profile depth. Never a XimVerse verification. */
export type ProfileStatus = "documents-declared" | "basic-profile";

export const PROFILE_STATUS_LABEL: Record<ProfileStatus, string> = {
  "documents-declared": "Documents declared (demo)",
  "basic-profile": "Basic profile (demo)",
};

export const DEMO_DISCLAIMER = "Demo supplier profile — not verified by XimVerse.";

export type ExportRegion =
  | "Middle East"
  | "South Asia"
  | "Southeast Asia"
  | "East Asia"
  | "Europe"
  | "Africa"
  | "North America"
  | "Latin America";

export interface SupplierProduct {
  id: string;
  name: string;
  category: ProductCategory;
  specification: string;
  origin: string;
  moq: { amount: number; unit: QuantityUnit };
  packaging: string;
  /** Indicative production / preparation lead time, in days. */
  leadTimeDays: [number, number];
  /** Illustrative HS code for the demo product. */
  hsCode?: string;
}

export interface SupplierCertification {
  name: string;
  scope?: string;
}

export type CredentialStatus = "declared" | "available-on-request" | "not-provided";

export const CREDENTIAL_STATUS_LABEL: Record<CredentialStatus, string> = {
  declared: "Declared",
  "available-on-request": "Available on request",
  "not-provided": "Not provided",
};

export interface SupplierCredential {
  name: string;
  status: CredentialStatus;
}

export interface SupplierMarkets {
  regions: ExportRegion[];
  countries: string[];
}

export interface SupplierCapability {
  /** Supplier-declared annual export volume, free text. */
  annualCapacity?: string;
  typicalOrder: string;
  portsOfLoading: string[];
  incoterms: Incoterm[];
  currencies: Currency[];
  paymentTerms: PaymentTerm[];
  privateLabel: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  legalName: string;
  type: SupplierType;
  country: string;
  city: string;
  established: number;
  yearsExporting: number;
  employees: string;
  primaryBusiness: string;
  languages: string[];
  profileStatus: ProfileStatus;
  /** Share of profile fields the supplier has filled in (demo), 0–100. */
  profileCompleteness: number;
  /** Completed transactions on XimVerse (demo figure). */
  previousTransactions: number;
  categories: ProductCategory[];
  products: SupplierProduct[];
  markets: SupplierMarkets;
  capability: SupplierCapability;
  certifications: SupplierCertification[];
  quality: { approach: string; inspection: string };
  credentials: SupplierCredential[];
}

/** The supplier facts a quotation needs. */
export type SupplierSummary = Pick<
  Supplier,
  "id" | "name" | "country" | "type" | "yearsExporting" | "profileStatus" | "previousTransactions"
>;

/* ------------------------------------------------------------------------ */
/* Mock data                                                                 */
/* ------------------------------------------------------------------------ */

const BASMATI_1121: Omit<SupplierProduct, "id" | "origin" | "moq"> = {
  name: "1121 Steam Basmati Rice",
  category: "Agriculture & Food",
  specification: "Average grain length 8.35 mm, moisture 12.5% max, broken 2% max, sortexed and double polished.",
  packaging: "5–50 kg PP / non-woven bags; private label available",
  leadTimeDays: [12, 25],
  hsCode: "1006.30",
};

const SUNFLOWER_OIL: Omit<SupplierProduct, "id" | "origin" | "moq" | "leadTimeDays"> = {
  name: "Refined Sunflower Oil",
  category: "Agriculture & Food",
  specification: "Refined, deodorised, winterised. FFA 0.1% max, peroxide value 2 meq/kg max.",
  packaging: "Flexitanks; 1–5 L PET bottles",
  hsCode: "1512.19",
};

const COTTON_YARN_30S: Omit<SupplierProduct, "id" | "origin" | "moq" | "leadTimeDays"> = {
  name: "30s Combed Cotton Yarn",
  category: "Textiles",
  specification: "100% cotton, combed, for knitting.",
  packaging: "Cartons on pallets",
  hsCode: "5205.24",
};

const INDIA_EXPORTER_CREDENTIALS: SupplierCredential[] = [
  { name: "Company registration", status: "declared" },
  { name: "Import Export Code (IEC)", status: "declared" },
  { name: "GST registration", status: "declared" },
  { name: "Certification copies", status: "available-on-request" },
  { name: "Product test reports", status: "available-on-request" },
];

const credentials = (registration: CredentialStatus, exportReg: CredentialStatus, tax: CredentialStatus, certs: CredentialStatus, tests: CredentialStatus, exportName = "Export registration", taxName = "Tax registration"): SupplierCredential[] => [
  { name: "Company registration", status: registration },
  { name: exportName, status: exportReg },
  { name: taxName, status: tax },
  { name: "Certification copies", status: certs },
  { name: "Product test reports", status: tests },
];

const RICE_MARKETS_GULF: SupplierMarkets = {
  regions: ["Middle East", "Europe"],
  countries: ["United Arab Emirates", "Saudi Arabia", "Oman", "Kuwait", "United Kingdom"],
};

export const SUPPLIERS: readonly Supplier[] = [
  {
    id: "sup-shakti",
    name: "Shakti Agro Exports",
    legalName: "Shakti Agro Exports Pvt. Ltd.",
    type: "manufacturer-exporter",
    country: "India",
    city: "Karnal",
    established: 2009,
    yearsExporting: 14,
    employees: "200–500",
    primaryBusiness: "Basmati and non-basmati rice milling and export",
    languages: ["English", "Hindi", "Arabic"],
    profileStatus: "documents-declared",
    profileCompleteness: 92,
    previousTransactions: 6,
    categories: ["Agriculture & Food"],
    products: [
      { ...BASMATI_1121, id: "p1", origin: "India", moq: { amount: 100, unit: "MT" } },
      {
        id: "p2",
        name: "1121 Sella Basmati Rice",
        category: "Agriculture & Food",
        specification: "Parboiled (golden / creamy sella), average grain length 8.3 mm, broken 1% max.",
        origin: "India",
        moq: { amount: 100, unit: "MT" },
        packaging: "5–50 kg PP / non-woven bags",
        leadTimeDays: [14, 25],
        hsCode: "1006.30",
      },
      {
        id: "p3",
        name: "PR-11 Long Grain White Rice",
        category: "Agriculture & Food",
        specification: "Non-basmati, average grain length 6.8 mm, broken 5% max.",
        origin: "India",
        moq: { amount: 200, unit: "MT" },
        packaging: "25 / 50 kg PP bags",
        leadTimeDays: [10, 20],
        hsCode: "1006.30",
      },
    ],
    markets: RICE_MARKETS_GULF,
    capability: {
      annualCapacity: "≈ 60,000 MT milled rice per year",
      typicalOrder: "100–1,000 MT",
      portsOfLoading: ["Mundra", "Kandla"],
      incoterms: ["FOB", "CFR", "CIF"],
      currencies: ["USD", "AED"],
      paymentTerms: ["lc", "advance", "dp"],
      privateLabel: true,
    },
    certifications: [
      { name: "APEDA registration" },
      { name: "FSSAI licence" },
      { name: "ISO 22000", scope: "Rice milling and packing" },
      { name: "HACCP" },
      { name: "BRCGS Food Safety" },
    ],
    quality: {
      approach: "In-house lab tests every lot for grain length, moisture and broken percentage.",
      inspection: "Accepts SGS, Intertek or buyer-nominated pre-shipment inspection.",
    },
    credentials: INDIA_EXPORTER_CREDENTIALS,
  },
  {
    id: "sup-punjab",
    name: "Punjab Grain International",
    legalName: "Punjab Grain International Ltd.",
    type: "manufacturer",
    country: "India",
    city: "Amritsar",
    established: 1998,
    yearsExporting: 22,
    employees: "500–1,000",
    primaryBusiness: "Integrated rice procurement, milling and export",
    languages: ["English", "Hindi", "Punjabi"],
    profileStatus: "documents-declared",
    profileCompleteness: 88,
    previousTransactions: 11,
    categories: ["Agriculture & Food"],
    products: [
      { ...BASMATI_1121, id: "p1", origin: "India", moq: { amount: 200, unit: "MT" } },
      {
        id: "p2",
        name: "Pusa Basmati 1509",
        category: "Agriculture & Food",
        specification: "Steam and sella, average grain length 8.2 mm, moisture 12.5% max.",
        origin: "India",
        moq: { amount: 200, unit: "MT" },
        packaging: "25 / 50 kg PP bags",
        leadTimeDays: [12, 22],
        hsCode: "1006.30",
      },
    ],
    markets: { regions: ["Middle East", "Europe", "North America"], countries: ["Saudi Arabia", "United Arab Emirates", "Iran", "Netherlands", "United States"] },
    capability: {
      annualCapacity: "≈ 120,000 MT per year",
      typicalOrder: "200–2,000 MT",
      portsOfLoading: ["Mundra", "Nhava Sheva"],
      incoterms: ["FOB", "CFR"],
      currencies: ["USD", "EUR"],
      paymentTerms: ["advance", "lc"],
      privateLabel: true,
    },
    certifications: [{ name: "APEDA registration" }, { name: "FSSAI licence" }, { name: "ISO 22000" }, { name: "ISO 9001" }],
    quality: {
      approach: "Variety-wise procurement with DNA purity testing on basmati lots.",
      inspection: "Third-party inspection at loading port accepted.",
    },
    credentials: INDIA_EXPORTER_CREDENTIALS,
  },
  {
    id: "sup-indus",
    name: "Indus Foods Exporters",
    legalName: "Indus Foods Exporters LLP",
    type: "exporter",
    country: "India",
    city: "New Delhi",
    established: 2017,
    yearsExporting: 6,
    employees: "10–50",
    primaryBusiness: "Merchant export of rice and pulses sourced from partner mills",
    languages: ["English", "Hindi"],
    profileStatus: "documents-declared",
    profileCompleteness: 74,
    previousTransactions: 2,
    categories: ["Agriculture & Food"],
    products: [
      { ...BASMATI_1121, id: "p1", origin: "India", moq: { amount: 50, unit: "MT" }, leadTimeDays: [10, 18] },
      {
        id: "p2",
        name: "Red Lentils (Masoor)",
        category: "Agriculture & Food",
        specification: "Whole and split, machine cleaned, sortexed.",
        origin: "India",
        moq: { amount: 25, unit: "MT" },
        packaging: "25 / 50 kg PP bags",
        leadTimeDays: [10, 15],
        hsCode: "0713.40",
      },
    ],
    markets: { regions: ["Middle East", "Africa"], countries: ["United Arab Emirates", "Qatar", "Kenya", "Tanzania"] },
    capability: {
      typicalOrder: "50–500 MT",
      portsOfLoading: ["Mundra"],
      incoterms: ["FOB", "CIF"],
      currencies: ["USD"],
      paymentTerms: ["lc", "advance"],
      privateLabel: true,
    },
    certifications: [{ name: "APEDA registration" }, { name: "FSSAI licence" }],
    quality: {
      approach: "Relies on partner mills' lab reports; spot checks before stuffing.",
      inspection: "Third-party inspection at buyer's cost.",
    },
    credentials: INDIA_EXPORTER_CREDENTIALS,
  },
  {
    id: "sup-greenfield",
    name: "GreenField Commodities",
    legalName: "GreenField Commodities",
    type: "exporter",
    country: "India",
    city: "Ahmedabad",
    established: 2021,
    yearsExporting: 3,
    employees: "1–10",
    primaryBusiness: "Agricultural commodity export",
    languages: ["English", "Gujarati", "Hindi"],
    profileStatus: "basic-profile",
    profileCompleteness: 48,
    previousTransactions: 0,
    categories: ["Agriculture & Food"],
    products: [
      { ...BASMATI_1121, id: "p1", origin: "India", moq: { amount: 450, unit: "MT" }, leadTimeDays: [18, 25] },
      {
        id: "p2",
        name: "Groundnut Kernels",
        category: "Agriculture & Food",
        specification: "Bold, 40/50 count, moisture 7% max.",
        origin: "India",
        moq: { amount: 25, unit: "MT" },
        packaging: "50 kg jute bags",
        leadTimeDays: [15, 20],
      },
    ],
    markets: { regions: ["Middle East"], countries: ["United Arab Emirates"] },
    capability: {
      typicalOrder: "Full container loads",
      portsOfLoading: ["Kandla"],
      incoterms: ["FOB", "CFR"],
      currencies: ["USD"],
      paymentTerms: ["dp", "advance"],
      privateLabel: false,
    },
    certifications: [{ name: "FSSAI licence" }],
    quality: {
      approach: "Supplier's own lab report per lot.",
      inspection: "Third-party inspection not offered.",
    },
    credentials: credentials("declared", "declared", "declared", "not-provided", "not-provided", "Import Export Code (IEC)", "GST registration"),
  },
  {
    id: "sup-heritage",
    name: "Heritage Rice Mills",
    legalName: "Heritage Rice Mills Pvt. Ltd.",
    type: "manufacturer",
    country: "India",
    city: "Kurukshetra",
    established: 1988,
    yearsExporting: 31,
    employees: "500–1,000",
    primaryBusiness: "Basmati rice milling, ageing and packing",
    languages: ["English", "Hindi", "Arabic"],
    profileStatus: "documents-declared",
    profileCompleteness: 95,
    previousTransactions: 9,
    categories: ["Agriculture & Food"],
    products: [
      { ...BASMATI_1121, id: "p1", origin: "India", moq: { amount: 250, unit: "MT" }, leadTimeDays: [30, 55] },
      {
        id: "p2",
        name: "Traditional Aged Basmati",
        category: "Agriculture & Food",
        specification: "Aged 12 months minimum, average grain length 7.5 mm.",
        origin: "India",
        moq: { amount: 100, unit: "MT" },
        packaging: "1–25 kg consumer and catering packs",
        leadTimeDays: [20, 40],
        hsCode: "1006.30",
      },
    ],
    markets: { regions: ["Middle East", "Europe", "North America"], countries: ["United Arab Emirates", "Saudi Arabia", "United Kingdom", "Germany", "Canada", "United States"] },
    capability: {
      annualCapacity: "≈ 90,000 MT per year",
      typicalOrder: "250–2,000 MT",
      portsOfLoading: ["Mundra"],
      incoterms: ["FOB", "CIF", "CFR"],
      currencies: ["USD", "EUR", "GBP"],
      paymentTerms: ["lc"],
      privateLabel: true,
    },
    certifications: [
      { name: "APEDA registration" },
      { name: "FSSAI licence" },
      { name: "BRCGS Food Safety" },
      { name: "ISO 22000" },
      { name: "HACCP" },
    ],
    quality: {
      approach: "Accredited in-house laboratory; pesticide residue testing for EU and UK lots.",
      inspection: "SGS or equivalent pre-shipment inspection accepted.",
    },
    credentials: INDIA_EXPORTER_CREDENTIALS,
  },
  {
    id: "sup-northstar",
    name: "NorthStar Agro Trading",
    legalName: "NorthStar Agro Trading FZCO",
    type: "trading-company",
    country: "United Arab Emirates",
    city: "Dubai",
    established: 2015,
    yearsExporting: 9,
    employees: "10–50",
    primaryBusiness: "Regional distribution of rice and edible oils from Indian and Black Sea origins",
    languages: ["English", "Arabic", "Hindi"],
    profileStatus: "documents-declared",
    profileCompleteness: 81,
    previousTransactions: 3,
    categories: ["Agriculture & Food"],
    products: [
      { ...BASMATI_1121, id: "p1", origin: "India", moq: { amount: 100, unit: "MT" }, leadTimeDays: [15, 30] },
      { ...SUNFLOWER_OIL, id: "p2", origin: "Ukraine", moq: { amount: 100, unit: "MT" }, leadTimeDays: [20, 35] },
    ],
    markets: { regions: ["Middle East", "Africa"], countries: ["United Arab Emirates", "Oman", "Bahrain", "Kenya"] },
    capability: {
      typicalOrder: "100–1,000 MT",
      portsOfLoading: ["Mundra", "Jebel Ali"],
      incoterms: ["DAP", "CIF", "CFR"],
      currencies: ["USD", "AED"],
      paymentTerms: ["open-account", "lc"],
      privateLabel: true,
    },
    certifications: [{ name: "ISO 9001" }],
    quality: {
      approach: "Sources from audited mills; retains samples from every lot.",
      inspection: "Pre-shipment inspection accepted.",
    },
    credentials: credentials("declared", "declared", "declared", "available-on-request", "available-on-request", "Dubai trade licence", "VAT registration"),
  },
  {
    id: "sup-bharat",
    name: "Bharat Harvest Exports",
    legalName: "Bharat Harvest Exports Pvt. Ltd.",
    type: "manufacturer-exporter",
    country: "India",
    city: "Kaithal",
    established: 2012,
    yearsExporting: 11,
    employees: "100–200",
    primaryBusiness: "Rice milling and export",
    languages: ["English", "Hindi"],
    profileStatus: "documents-declared",
    profileCompleteness: 79,
    previousTransactions: 4,
    categories: ["Agriculture & Food"],
    products: [
      {
        ...BASMATI_1121,
        id: "p1",
        specification: "Average grain length 8.3 mm, moisture 13% max, broken 3% max.",
        origin: "India",
        moq: { amount: 100, unit: "MT" },
      },
      {
        id: "p2",
        name: "Sugandha Basmati Rice",
        category: "Agriculture & Food",
        specification: "Steam, average grain length 8.0 mm, broken 3% max.",
        origin: "India",
        moq: { amount: 100, unit: "MT" },
        packaging: "25 / 50 kg PP bags",
        leadTimeDays: [12, 20],
        hsCode: "1006.30",
      },
    ],
    markets: { regions: ["Middle East", "Africa"], countries: ["Saudi Arabia", "Yemen", "Benin", "Nigeria"] },
    capability: {
      annualCapacity: "≈ 30,000 MT per year",
      typicalOrder: "100–500 MT",
      portsOfLoading: ["Kandla"],
      incoterms: ["FOB", "CFR"],
      currencies: ["INR", "USD"],
      paymentTerms: ["advance"],
      privateLabel: false,
    },
    certifications: [{ name: "APEDA registration" }, { name: "FSSAI licence" }, { name: "ISO 9001" }],
    quality: {
      approach: "Lot-wise moisture and broken testing.",
      inspection: "Third-party inspection accepted.",
    },
    credentials: INDIA_EXPORTER_CREDENTIALS,
  },
  {
    id: "sup-goldencrop",
    name: "Golden Crop International",
    legalName: "Golden Crop International (Pvt.) Ltd.",
    type: "manufacturer",
    country: "Pakistan",
    city: "Lahore",
    established: 2005,
    yearsExporting: 17,
    employees: "200–500",
    primaryBusiness: "Basmati and long-grain rice milling",
    languages: ["English", "Urdu"],
    profileStatus: "documents-declared",
    profileCompleteness: 70,
    previousTransactions: 1,
    categories: ["Agriculture & Food"],
    products: [
      {
        id: "p1",
        name: "1121 Sella Basmati Rice",
        category: "Agriculture & Food",
        specification: "Parboiled, average grain length 8.3 mm, moisture 12% max, broken 2% max.",
        origin: "Pakistan",
        moq: { amount: 100, unit: "MT" },
        packaging: "25 / 50 kg PP bags",
        leadTimeDays: [14, 20],
        hsCode: "1006.30",
      },
      {
        id: "p2",
        name: "Super Kernel Basmati Rice",
        category: "Agriculture & Food",
        specification: "Steam, average grain length 7.3 mm, broken 2% max.",
        origin: "Pakistan",
        moq: { amount: 100, unit: "MT" },
        packaging: "25 / 50 kg PP bags",
        leadTimeDays: [14, 20],
        hsCode: "1006.30",
      },
    ],
    markets: { regions: ["Middle East", "Europe", "Africa"], countries: ["United Arab Emirates", "Oman", "Italy", "Kenya"] },
    capability: {
      annualCapacity: "≈ 50,000 MT per year",
      typicalOrder: "100–500 MT",
      portsOfLoading: ["Karachi", "Port Qasim"],
      incoterms: ["FOB", "CFR"],
      currencies: ["USD"],
      paymentTerms: ["lc"],
      privateLabel: false,
    },
    certifications: [{ name: "ISO 22000" }, { name: "HACCP" }],
    quality: {
      approach: "Colour sorting and lot-wise lab analysis.",
      inspection: "SGS pre-shipment inspection accepted.",
    },
    credentials: credentials("declared", "declared", "declared", "available-on-request", "not-provided", "Export registration (TDAP)", "NTN registration"),
  },
  {
    id: "sup-blacksea",
    name: "Black Sea Agri Trading",
    legalName: "Black Sea Agri Trading LLC",
    type: "trading-company",
    country: "Ukraine",
    city: "Odesa",
    established: 2011,
    yearsExporting: 12,
    employees: "10–50",
    primaryBusiness: "Export of vegetable oils and grains from Black Sea crushers",
    languages: ["English", "Ukrainian", "Russian"],
    profileStatus: "documents-declared",
    profileCompleteness: 77,
    previousTransactions: 2,
    categories: ["Agriculture & Food"],
    products: [
      { ...SUNFLOWER_OIL, id: "p1", origin: "Ukraine", moq: { amount: 100, unit: "MT" }, leadTimeDays: [15, 25] },
      {
        id: "p2",
        name: "Crude Sunflower Oil",
        category: "Agriculture & Food",
        specification: "Crude, degummed. FFA 1.5% max.",
        origin: "Ukraine",
        moq: { amount: 1_000, unit: "MT" },
        packaging: "Bulk vessel / flexitanks",
        leadTimeDays: [20, 35],
        hsCode: "1512.11",
      },
      {
        id: "p3",
        name: "Feed Corn",
        category: "Agriculture & Food",
        specification: "Moisture 14% max, broken 5% max.",
        origin: "Ukraine",
        moq: { amount: 5_000, unit: "MT" },
        packaging: "Bulk",
        leadTimeDays: [20, 40],
      },
    ],
    markets: { regions: ["South Asia", "Middle East", "Europe"], countries: ["India", "Egypt", "Turkey", "Spain"] },
    capability: {
      annualCapacity: "≈ 150,000 MT across products",
      typicalOrder: "100 MT (flexitanks) to 10,000 MT (bulk)",
      portsOfLoading: ["Odesa", "Izmail"],
      incoterms: ["FOB", "CFR"],
      currencies: ["USD", "EUR"],
      paymentTerms: ["dp", "lc"],
      privateLabel: false,
    },
    certifications: [{ name: "ISO 9001" }, { name: "GMP+ FSA", scope: "Feed products" }],
    quality: {
      approach: "Crusher certificates of analysis per lot.",
      inspection: "Independent surveyor at loading port.",
    },
    credentials: credentials("declared", "declared", "declared", "available-on-request", "available-on-request"),
  },
  {
    id: "sup-pampas",
    name: "Pampas Oleaginosas S.A.",
    legalName: "Pampas Oleaginosas S.A.",
    type: "manufacturer-exporter",
    country: "Argentina",
    city: "Rosario",
    established: 1996,
    yearsExporting: 25,
    employees: "1,000+",
    primaryBusiness: "Oilseed crushing and refining",
    languages: ["Spanish", "English"],
    profileStatus: "basic-profile",
    profileCompleteness: 52,
    previousTransactions: 0,
    categories: ["Agriculture & Food"],
    products: [
      { ...SUNFLOWER_OIL, id: "p1", origin: "Argentina", moq: { amount: 200, unit: "MT" }, leadTimeDays: [20, 30] },
      {
        id: "p2",
        name: "Refined Soybean Oil",
        category: "Agriculture & Food",
        specification: "Refined, bleached, deodorised. FFA 0.1% max.",
        origin: "Argentina",
        moq: { amount: 200, unit: "MT" },
        packaging: "Flexitanks; bulk",
        leadTimeDays: [20, 30],
        hsCode: "1507.90",
      },
    ],
    markets: { regions: ["South Asia", "Africa", "Latin America"], countries: ["India", "Bangladesh", "Egypt", "Chile"] },
    capability: {
      annualCapacity: "≈ 400,000 MT oil per year",
      typicalOrder: "200 MT and above",
      portsOfLoading: ["Rosario", "San Lorenzo"],
      incoterms: ["FOB"],
      currencies: ["USD"],
      paymentTerms: ["lc"],
      privateLabel: false,
    },
    certifications: [{ name: "ISO 22000" }, { name: "FSSC 22000" }],
    quality: {
      approach: "Refinery QC laboratory; certificate of analysis per shipment.",
      inspection: "Independent surveyor at loading port.",
    },
    credentials: credentials("declared", "not-provided", "declared", "not-provided", "not-provided"),
  },
  {
    id: "sup-volga",
    name: "Volga Seed Processing",
    legalName: "Volga Seed Processing JSC",
    type: "manufacturer",
    country: "Russia",
    city: "Saratov",
    established: 2014,
    yearsExporting: 8,
    employees: "200–500",
    primaryBusiness: "Sunflower seed crushing and oil refining",
    languages: ["Russian", "English"],
    profileStatus: "documents-declared",
    profileCompleteness: 68,
    previousTransactions: 1,
    categories: ["Agriculture & Food"],
    products: [
      {
        ...SUNFLOWER_OIL,
        id: "p1",
        specification: "Refined, deodorised. FFA 0.1% max, peroxide value 2 meq/kg max.",
        origin: "Russia",
        moq: { amount: 150, unit: "MT" },
        leadTimeDays: [15, 25],
      },
      {
        id: "p2",
        name: "Sunflower Meal",
        category: "Agriculture & Food",
        specification: "Protein 36% min, granulated.",
        origin: "Russia",
        moq: { amount: 2_000, unit: "MT" },
        packaging: "Bulk",
        leadTimeDays: [20, 30],
      },
    ],
    markets: { regions: ["South Asia", "Middle East", "East Asia"], countries: ["India", "Turkey", "China", "Iran"] },
    capability: {
      annualCapacity: "≈ 180,000 MT oil per year",
      typicalOrder: "150–3,000 MT",
      portsOfLoading: ["Novorossiysk"],
      incoterms: ["FOB", "CFR"],
      currencies: ["USD", "CNY"],
      paymentTerms: ["advance"],
      privateLabel: false,
    },
    certifications: [{ name: "ISO 22000" }, { name: "HACCP" }],
    quality: {
      approach: "Plant laboratory; certificate of analysis per lot.",
      inspection: "Independent surveyor at loading port.",
    },
    credentials: credentials("declared", "declared", "declared", "available-on-request", "not-provided"),
  },
  {
    id: "sup-coimbatore",
    name: "Coimbatore Spinning Mills",
    legalName: "Coimbatore Spinning Mills Ltd.",
    type: "manufacturer",
    country: "India",
    city: "Coimbatore",
    established: 2001,
    yearsExporting: 19,
    employees: "1,000+",
    primaryBusiness: "Cotton spinning: combed and compact yarns",
    languages: ["English", "Tamil"],
    profileStatus: "documents-declared",
    profileCompleteness: 90,
    previousTransactions: 7,
    categories: ["Textiles"],
    products: [
      { ...COTTON_YARN_30S, id: "p1", specification: "100% cotton, combed, compact spun, for knitting.", origin: "India", moq: { amount: 10_000, unit: "KG" }, leadTimeDays: [18, 25] },
      {
        id: "p2",
        name: "40s Combed Compact Cotton Yarn",
        category: "Textiles",
        specification: "100% cotton, compact spun, for weaving and knitting.",
        origin: "India",
        moq: { amount: 10_000, unit: "KG" },
        packaging: "Cartons on pallets",
        leadTimeDays: [20, 28],
        hsCode: "5205.26",
      },
      {
        id: "p3",
        name: "Organic Cotton Yarn",
        category: "Textiles",
        specification: "30s–40s, combed, certified organic fibre.",
        origin: "India",
        moq: { amount: 5_000, unit: "KG" },
        packaging: "Cartons on pallets",
        leadTimeDays: [25, 35],
      },
    ],
    markets: { regions: ["South Asia", "East Asia", "Europe"], countries: ["Bangladesh", "Sri Lanka", "China", "Portugal"] },
    capability: {
      annualCapacity: "≈ 18,000 MT yarn per year",
      typicalOrder: "10–100 MT",
      portsOfLoading: ["Chennai", "Tuticorin"],
      incoterms: ["FOB", "CFR", "CIF"],
      currencies: ["USD"],
      paymentTerms: ["lc"],
      privateLabel: false,
    },
    certifications: [
      { name: "ISO 9001" },
      { name: "OEKO-TEX Standard 100" },
      { name: "GOTS", scope: "Organic yarn line" },
    ],
    quality: {
      approach: "Uster testing on every lot; mill test certificate with each shipment.",
      inspection: "Buyer inspection at the mill accepted.",
    },
    credentials: INDIA_EXPORTER_CREDENTIALS,
  },
  {
    id: "sup-tiruppur",
    name: "Tiruppur Yarn Traders",
    legalName: "Tiruppur Yarn Traders",
    type: "trading-company",
    country: "India",
    city: "Tiruppur",
    established: 2016,
    yearsExporting: 7,
    employees: "1–10",
    primaryBusiness: "Yarn trading for knitting units and export",
    languages: ["English", "Tamil"],
    profileStatus: "documents-declared",
    profileCompleteness: 63,
    previousTransactions: 1,
    categories: ["Textiles"],
    products: [
      { ...COTTON_YARN_30S, id: "p1", origin: "India", moq: { amount: 5_000, unit: "KG" }, leadTimeDays: [10, 20] },
      {
        id: "p2",
        name: "Polyester-Cotton Blended Yarn",
        category: "Textiles",
        specification: "PC 65/35, 30s, carded.",
        origin: "India",
        moq: { amount: 5_000, unit: "KG" },
        packaging: "Cartons",
        leadTimeDays: [10, 20],
      },
    ],
    markets: { regions: ["South Asia"], countries: ["Bangladesh", "Sri Lanka"] },
    capability: {
      typicalOrder: "5–40 MT",
      portsOfLoading: ["Tuticorin"],
      incoterms: ["FOB"],
      currencies: ["USD", "INR"],
      paymentTerms: ["advance"],
      privateLabel: false,
    },
    certifications: [],
    quality: {
      approach: "Relies on spinning mills' test certificates.",
      inspection: "Buyer inspection at warehouse accepted.",
    },
    credentials: credentials("declared", "declared", "declared", "not-provided", "not-provided", "Import Export Code (IEC)", "GST registration"),
  },
  {
    id: "sup-saigon",
    name: "Saigon Fibre Co.",
    legalName: "Saigon Fibre Company Limited",
    type: "manufacturer",
    country: "Vietnam",
    city: "Ho Chi Minh City",
    established: 2013,
    yearsExporting: 10,
    employees: "500–1,000",
    primaryBusiness: "Cotton and blended yarn spinning",
    languages: ["Vietnamese", "English"],
    profileStatus: "documents-declared",
    profileCompleteness: 72,
    previousTransactions: 0,
    categories: ["Textiles"],
    products: [
      {
        ...COTTON_YARN_30S,
        id: "p1",
        name: "30s Combed Ring-Spun Cotton Yarn",
        specification: "100% cotton, combed, ring spun.",
        origin: "Vietnam",
        moq: { amount: 10_000, unit: "KG" },
        leadTimeDays: [20, 30],
      },
      {
        id: "p2",
        name: "Recycled Polyester Yarn",
        category: "Textiles",
        specification: "Ne 30/1, from post-consumer PET.",
        origin: "Vietnam",
        moq: { amount: 10_000, unit: "KG" },
        packaging: "Cartons on pallets",
        leadTimeDays: [20, 30],
      },
    ],
    markets: { regions: ["South Asia", "East Asia", "North America"], countries: ["Bangladesh", "South Korea", "Japan", "United States"] },
    capability: {
      annualCapacity: "≈ 12,000 MT yarn per year",
      typicalOrder: "10–60 MT",
      portsOfLoading: ["Ho Chi Minh City"],
      incoterms: ["FOB", "CFR"],
      currencies: ["USD"],
      paymentTerms: ["lc"],
      privateLabel: false,
    },
    certifications: [{ name: "ISO 9001" }, { name: "OEKO-TEX Standard 100" }],
    quality: {
      approach: "Lot testing for count, strength and evenness.",
      inspection: "Buyer inspection accepted.",
    },
    credentials: credentials("declared", "declared", "declared", "available-on-request", "available-on-request"),
  },

  /* Suppliers without quotation history ------------------------------- */
  {
    id: "sup-andes",
    name: "Andes Metals Trading",
    legalName: "Andes Metals Trading SpA",
    type: "trading-company",
    country: "Chile",
    city: "Santiago",
    established: 2009,
    yearsExporting: 15,
    employees: "10–50",
    primaryBusiness: "Trading of copper cathodes and concentrates",
    languages: ["Spanish", "English"],
    profileStatus: "basic-profile",
    profileCompleteness: 45,
    previousTransactions: 0,
    categories: ["Metals & Minerals"],
    products: [
      {
        id: "p1",
        name: "Copper Cathodes",
        category: "Metals & Minerals",
        specification: "Grade A, 99.99% Cu minimum.",
        origin: "Chile",
        moq: { amount: 100, unit: "MT" },
        packaging: "Bundles on pallets",
        leadTimeDays: [20, 40],
        hsCode: "7403.11",
      },
      {
        id: "p2",
        name: "Copper Wire Rod",
        category: "Metals & Minerals",
        specification: "8 mm, ETP grade.",
        origin: "Chile",
        moq: { amount: 50, unit: "MT" },
        packaging: "Coils",
        leadTimeDays: [25, 45],
      },
    ],
    markets: { regions: ["East Asia", "South Asia", "Europe"], countries: ["China", "India", "South Korea", "Italy"] },
    capability: {
      typicalOrder: "100–1,000 MT",
      portsOfLoading: ["San Antonio", "Antofagasta"],
      incoterms: ["FOB", "CIF"],
      currencies: ["USD"],
      paymentTerms: ["lc", "dp"],
      privateLabel: false,
    },
    certifications: [{ name: "ISO 9001" }],
    quality: {
      approach: "Assay certificates from producing smelters.",
      inspection: "Independent assay at loading port accepted.",
    },
    credentials: credentials("declared", "not-provided", "declared", "not-provided", "not-provided"),
  },
  {
    id: "sup-anatolia",
    name: "Anatolia Textile Trading",
    legalName: "Anatolia Tekstil Ticaret A.Ş.",
    type: "trading-company",
    country: "Turkey",
    city: "Denizli",
    established: 2007,
    yearsExporting: 12,
    employees: "50–200",
    primaryBusiness: "Export of yarns and home textiles from Turkish mills",
    languages: ["Turkish", "English", "German"],
    profileStatus: "documents-declared",
    profileCompleteness: 84,
    previousTransactions: 0,
    categories: ["Textiles"],
    products: [
      {
        id: "p1",
        name: "Ne 30/1 Combed Cotton Yarn",
        category: "Textiles",
        specification: "100% cotton, combed, compact spun.",
        origin: "Turkey",
        moq: { amount: 5_000, unit: "KG" },
        packaging: "Cartons on pallets",
        leadTimeDays: [15, 25],
        hsCode: "5205.24",
      },
      {
        id: "p2",
        name: "Cotton Terry Towels",
        category: "Textiles",
        specification: "500 GSM, 100% cotton, private label.",
        origin: "Turkey",
        moq: { amount: 2_000, unit: "UNITS" },
        packaging: "Cartons",
        leadTimeDays: [30, 45],
      },
    ],
    markets: { regions: ["Europe", "Middle East", "North America"], countries: ["Germany", "United Kingdom", "United Arab Emirates", "United States"] },
    capability: {
      typicalOrder: "5–50 MT yarn; 2,000+ units textiles",
      portsOfLoading: ["Izmir"],
      incoterms: ["EXW", "FOB", "CIF", "DAP"],
      currencies: ["EUR", "USD"],
      paymentTerms: ["advance", "lc", "da"],
      privateLabel: true,
    },
    certifications: [{ name: "OEKO-TEX Standard 100" }, { name: "ISO 9001" }],
    quality: {
      approach: "Mill certificates plus own pre-shipment checks.",
      inspection: "Third-party inspection accepted.",
    },
    credentials: credentials("declared", "declared", "declared", "available-on-request", "available-on-request"),
  },
];

const BY_ID = new Map(SUPPLIERS.map((s) => [s.id, s]));

export function findSupplier(id: string): Supplier | undefined {
  return BY_ID.get(id);
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

export function yearsInBusiness(s: Supplier): number {
  return new Date(MOCK_NOW).getUTCFullYear() - s.established;
}

export function leadTimeRange(s: Supplier): [number, number] {
  return [
    Math.min(...s.products.map((p) => p.leadTimeDays[0])),
    Math.max(...s.products.map((p) => p.leadTimeDays[1])),
  ];
}

export const ALL_CERTIFICATIONS = [...new Set(SUPPLIERS.flatMap((s) => s.certifications.map((c) => c.name)))].sort();
export const ALL_REGIONS = [...new Set(SUPPLIERS.flatMap((s) => s.markets.regions))].sort() as ExportRegion[];
export const ALL_SUPPLIER_COUNTRIES = [...new Set(SUPPLIERS.map((s) => s.country))].sort();
export const ALL_SUPPLIER_CATEGORIES = [...new Set(SUPPLIERS.flatMap((s) => s.categories))].sort();

/* ------------------------------------------------------------------------ */
/* Relevance to the importer's requirements (deterministic, no AI)           */
/* ------------------------------------------------------------------------ */

export interface RequirementMatch {
  requirement: ImportRequirement;
  /** "product": lists a product named like the requirement; "category": same category only. */
  kind: "product" | "category";
  /** The supplier declares the requirement's destination country as an export market. */
  servesDestination: boolean;
}

/** Requirements still being sourced. */
export function isSourcing(r: ImportRequirement): boolean {
  return r.status !== "closed" && r.status !== "supplier-selected";
}

export function requirementMatches(s: Supplier, requirements: readonly ImportRequirement[]): RequirementMatch[] {
  return requirements.filter(isSourcing).flatMap((r) => {
    const wanted = r.product.name.trim().toLowerCase();
    const product = wanted && s.products.some((p) => p.name.toLowerCase().includes(wanted));
    const category = s.categories.includes(r.product.category);
    if (!product && !category) return [];
    return [{ requirement: r, kind: product ? "product" : "category", servesDestination: s.markets.countries.includes(r.delivery.destinationCountry) } as RequirementMatch];
  });
}

/**
 * Transparent ranking used by the "Relevance to your requirements" sort:
 * 3 per requirement whose product the supplier lists, 1 per requirement in a
 * shared category only, 1 per matched requirement whose destination the
 * supplier exports to, and 1 if the supplier has quoted before.
 */
export function relevanceScore(matches: readonly RequirementMatch[], hasQuoted: boolean): number {
  return (
    matches.reduce((sum, m) => sum + (m.kind === "product" ? 3 : 1) + (m.servesDestination ? 1 : 0), 0) +
    (hasQuoted ? 1 : 0)
  );
}
