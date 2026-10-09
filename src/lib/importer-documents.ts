/**
 * Trade documents — the canonical document layer for import shipments.
 *
 * Which documents a shipment has, and whether each is required (and why), is
 * seeded deterministically from the shipment and its requirement. Status and
 * metadata change only through append-only document events. Shipment
 * readiness, customs readiness and compliance all read these records.
 *
 * Metadata only: no document file is ever stored. Requiredness comes only from
 * structured XimVerse data (requested certifications, Incoterm, transport
 * mode, shipment workflow) — never from assumed regulations.
 */

import { MOCK_NOW, MOCK_REQUIREMENTS, type ImportRequirement } from "./import-requirements";
import type { Shipment, TransportMode } from "./importer-shipments";

/* ------------------------------------------------------------------------ */
/* Vocabulary                                                                */
/* ------------------------------------------------------------------------ */

export type DocumentStatus = "not-started" | "requested" | "draft" | "available" | "needs-review" | "approved" | "not-required";

export const DOCUMENT_STATUSES: readonly { id: DocumentStatus; label: string }[] = [
  { id: "not-started", label: "Not Started" },
  { id: "requested", label: "Requested" },
  { id: "draft", label: "Draft" },
  { id: "available", label: "Available" },
  { id: "needs-review", label: "Needs Review" },
  { id: "approved", label: "Approved" },
  { id: "not-required", label: "Not Required" },
];

export const DOCUMENT_STATUS_LABEL = Object.fromEntries(DOCUMENT_STATUSES.map((s) => [s.id, s.label])) as Record<DocumentStatus, string>;

export type DocumentType =
  | "commercial-invoice"
  | "packing-list"
  | "certificate-of-origin"
  | "transport-document"
  | "insurance-certificate"
  | "inspection-certificate"
  | "product-certificate"
  | "import-permit"
  | "shipping-instructions";

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  "commercial-invoice": "Commercial Invoice",
  "packing-list": "Packing List",
  "certificate-of-origin": "Certificate of Origin",
  "transport-document": "Transport Document",
  "insurance-certificate": "Insurance Certificate",
  "inspection-certificate": "Inspection Certificate",
  "product-certificate": "Product Certificate",
  "import-permit": "Import Permit",
  "shipping-instructions": "Shipping Instructions",
};

export type DocumentCategory = "Commercial" | "Packing" | "Origin" | "Transport" | "Insurance" | "Inspection" | "Regulatory / Product" | "Customs" | "Other";

export const DOCUMENT_CATEGORY: Record<DocumentType, DocumentCategory> = {
  "commercial-invoice": "Commercial",
  "packing-list": "Packing",
  "certificate-of-origin": "Origin",
  "transport-document": "Transport",
  "insurance-certificate": "Insurance",
  "inspection-certificate": "Inspection",
  "product-certificate": "Regulatory / Product",
  "import-permit": "Customs",
  "shipping-instructions": "Other",
};

/** Who is expected to provide or own the document. */
export type DocumentSource = "importer" | "supplier" | "carrier" | "freight-forwarder" | "customs-broker" | "inspector" | "authority" | "other";

export const DOCUMENT_SOURCE_LABEL: Record<DocumentSource, string> = {
  importer: "Importer (you)",
  supplier: "Supplier",
  carrier: "Carrier",
  "freight-forwarder": "Freight Forwarder",
  "customs-broker": "Customs Broker",
  inspector: "Inspection Agency",
  authority: "Authority",
  other: "Other",
};

export const TRANSPORT_DOCUMENT_LABEL: Record<TransportMode, string> = {
  sea: "Bill of Lading",
  air: "Air Waybill",
  road: "CMR Consignment Note",
  rail: "Rail Consignment Note",
  multimodal: "Multimodal Transport Document",
};

export interface DocumentMetadata {
  displayName?: string;
  /** Declared filename only — no file exists. */
  filename?: string;
  number?: string;
  issuer?: string;
  /** YYYY-MM-DD */
  issueDate?: string;
  /** YYYY-MM-DD */
  expiryDate?: string;
  country?: string;
  notes?: string;
}

export type RequirementLevel = "required" | "optional" | "not-required";

export const REQUIREMENT_LEVEL_LABEL: Record<RequirementLevel, string> = {
  required: "Required",
  optional: "Optional",
  "not-required": "Not Required",
};

export type DocumentEventType =
  | "status-set"
  | "requested"
  | "marked-available"
  | "issued"
  | "sent-for-review"
  | "approved"
  | "marked-needs-review"
  | "metadata-updated";

export interface DocumentEvent {
  id: string;
  documentId: string;
  type: DocumentEventType;
  by: DocumentSource | "system";
  /** ISO timestamp. */
  at: string;
  /** The status after this event (absent for metadata-only updates). */
  status?: DocumentStatus;
  metadata?: DocumentMetadata;
  note?: string;
  /** Recorded with a demo action — no file was uploaded or received. */
  demo?: boolean;
}

export type ValidityState = "no-expiry" | "valid" | "expiring-soon" | "expired";

export const VALIDITY_LABEL: Record<ValidityState, string> = {
  "no-expiry": "No Expiry",
  valid: "Valid",
  "expiring-soon": "Expiring Soon",
  expired: "Expired",
};

/** Expiring soon = expiry within 30 days of the demo snapshot date. */
export const EXPIRY_WINDOW_DAYS = 30;

export interface TradeDocument {
  id: string;
  /** Short code within the shipment, e.g. "CI". */
  code: string;
  shipmentId: string;
  orderId: string;
  requirementId: string;
  supplierId: string;
  type: DocumentType;
  label: string;
  category: DocumentCategory;
  source: DocumentSource;
  requirement: { level: RequirementLevel; reason: string };
  /** Must be complete before the shipment can be marked Ready to Ship. */
  requiredForReady: boolean;
  status: DocumentStatus;
  metadata: DocumentMetadata;
  validity: ValidityState;
  /** Available or approved AND not expired. */
  complete: boolean;
  createdAt: string;
  updatedAt: string;
  events: DocumentEvent[];
}

export const DOCUMENT_ID_PATTERN = /^DOC-\d{4}-\d{4,}-[A-Z0-9]+$/;

/* ------------------------------------------------------------------------ */
/* Derivations                                                               */
/* ------------------------------------------------------------------------ */

const DAY = 86_400_000;

/** The single expiry rule used everywhere. */
export function validityOf(expiryDate: string | undefined, today = MOCK_NOW.slice(0, 10)): ValidityState {
  if (!expiryDate) return "no-expiry";
  const days = (Date.parse(`${expiryDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY;
  if (days < 0) return "expired";
  if (days <= EXPIRY_WINDOW_DAYS) return "expiring-soon";
  return "valid";
}

export function daysUntilExpiry(expiryDate: string, today = MOCK_NOW.slice(0, 10)): number {
  return Math.round((Date.parse(`${expiryDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
}

export function documentIdFor(shipmentId: string, code: string): string {
  return `DOC-${shipmentId.replace(/^SHP-/, "")}-${code}`;
}

interface DocumentSeed {
  code: string;
  type: DocumentType;
  label: string;
  source: DocumentSource;
  status: DocumentStatus;
  level: RequirementLevel;
  reason: string;
  requiredForReady: boolean;
}

/**
 * Which documents a shipment needs, from its requirement's requested
 * certifications, its Incoterm and its transport mode. No other rules.
 */
export function seedDocuments(shipment: Shipment, requirement: ImportRequirement | undefined): DocumentSeed[] {
  const certs = requirement?.quality.certifications ?? [];
  const cooRequested = certs.includes("Certificate of Origin");
  const inspectionRequested = certs.includes("Inspection Certificate");
  const inspectionTerms = !!requirement?.quality.inspection;
  const productCerts = certs.filter((c) => c !== "Certificate of Origin" && c !== "Inspection Certificate");
  const insured = shipment.incoterm === "CIF" || shipment.incoterm === "CIP";
  const transport = TRANSPORT_DOCUMENT_LABEL[shipment.route.mode];

  const seeds: DocumentSeed[] = [
    { code: "CI", type: "commercial-invoice", label: "Commercial Invoice", source: "supplier", status: "not-started", level: "required", reason: "Required for shipment workflow", requiredForReady: true },
    { code: "PL", type: "packing-list", label: "Packing List", source: "supplier", status: "not-started", level: "required", reason: "Required for shipment workflow", requiredForReady: true },
    cooRequested
      ? { code: "COO", type: "certificate-of-origin", label: "Certificate of Origin", source: "supplier", status: "not-started", level: "required", reason: "Required by import requirement (Certificate of Origin requested)", requiredForReady: true }
      : { code: "COO", type: "certificate-of-origin", label: "Certificate of Origin", source: "supplier", status: "not-required", level: "not-required", reason: "Not requested in the import requirement", requiredForReady: false },
    ...productCerts.map<DocumentSeed>((c, i) => ({
      code: `CERT${i + 1}`,
      type: "product-certificate",
      label: c,
      source: "supplier",
      status: "not-started",
      level: "required",
      reason: `Required by import requirement (${c} requested)`,
      requiredForReady: false,
    })),
    ...(inspectionRequested || inspectionTerms
      ? [
          {
            code: "INSP",
            type: "inspection-certificate",
            label: "Inspection Certificate",
            source: "inspector",
            status: "not-started",
            level: inspectionRequested ? "required" : "optional",
            reason: inspectionRequested ? "Required by import requirement (Inspection Certificate requested)" : "Inspection terms set in the import requirement",
            requiredForReady: false,
          } satisfies DocumentSeed,
        ]
      : []),
    { code: "TD", type: "transport-document", label: transport, source: "carrier", status: "not-started", level: "required", reason: `Required for selected transport mode (${transport})`, requiredForReady: false },
    insured
      ? { code: "INS", type: "insurance-certificate", label: "Insurance Certificate", source: "supplier", status: "not-started", level: "required", reason: `Required by Incoterm (${shipment.incoterm}: supplier provides insurance)`, requiredForReady: false }
      : { code: "INS", type: "insurance-certificate", label: "Insurance Certificate", source: "importer", status: "not-required", level: "not-required", reason: `Not required for this shipment (${shipment.incoterm}: buyer arranges cargo insurance separately)`, requiredForReady: false },
    { code: "PERMIT", type: "import-permit", label: "Import Permit", source: "importer", status: "not-required", level: "not-required", reason: "Not required for this shipment (no import permit recorded in the requirement)", requiredForReady: false },
    { code: "SI", type: "shipping-instructions", label: "Shipping Instructions", source: "importer", status: "not-started", level: "optional", reason: "Issued by you to coordinate loading", requiredForReady: false },
  ];
  return seeds;
}

function requirementFor(shipment: Shipment): ImportRequirement | undefined {
  return MOCK_REQUIREMENTS.find((r) => r.id === shipment.requirementId);
}

/** Builds canonical documents for shipments from their seeds plus document events. */
export function buildDocuments(
  shipments: readonly Shipment[],
  eventsByDocument: Readonly<Record<string, readonly DocumentEvent[]>>,
): TradeDocument[] {
  return shipments.flatMap((sh) =>
    seedDocuments(sh, requirementFor(sh)).map((seed) => {
      const id = documentIdFor(sh.id, seed.code);
      const events = [...(eventsByDocument[id] ?? [])].sort((a, b) => a.at.localeCompare(b.at));
      let status = seed.status;
      let metadata: DocumentMetadata = {};
      let updatedAt = sh.createdAt;
      for (const e of events) {
        if (e.status) status = e.status;
        if (e.metadata) metadata = { ...metadata, ...e.metadata };
        if (e.at > updatedAt) updatedAt = e.at;
      }
      const validity = validityOf(metadata.expiryDate);
      return {
        id,
        code: seed.code,
        shipmentId: sh.id,
        orderId: sh.orderId,
        requirementId: sh.requirementId,
        supplierId: sh.supplierId,
        type: seed.type,
        label: seed.label,
        category: DOCUMENT_CATEGORY[seed.type],
        source: seed.source,
        requirement: { level: seed.level, reason: seed.reason },
        requiredForReady: seed.requiredForReady,
        status,
        metadata,
        validity,
        complete: (status === "available" || status === "approved") && validity !== "expired",
        createdAt: sh.createdAt,
        updatedAt,
        events,
      };
    }),
  );
}

export function documentsForShipment(shipmentId: string, docs: readonly TradeDocument[]): TradeDocument[] {
  return docs.filter((d) => d.shipmentId === shipmentId);
}

/** "Missing" = required but not yet provided at all. */
export function isMissing(d: TradeDocument): boolean {
  return d.requirement.level === "required" && ["not-started", "requested", "draft"].includes(d.status);
}

export function describeDocumentEvent(e: DocumentEvent, label: string): string {
  switch (e.type) {
    case "status-set":
      return `${label} marked ${DOCUMENT_STATUS_LABEL[e.status!].toLowerCase()}`;
    case "requested":
      return `${label} requested`;
    case "marked-available":
      return `${label} marked available`;
    case "issued":
      return `${label} marked issued`;
    case "sent-for-review":
      return `${label} sent for review`;
    case "approved":
      return `${label} approved for workflow`;
    case "marked-needs-review":
      return `${label} marked needs review`;
    case "metadata-updated":
      return `${label} metadata updated`;
  }
}

export type DocumentAction = "request" | "mark-available" | "issue" | "send-for-review" | "approve" | "mark-needs-review" | "update-metadata";

/**
 * Actions allowed for a document's current status. The transport document can
 * only become available once cargo is with the carrier.
 */
export function allowedDocumentActions(d: TradeDocument, cargoWithCarrier: boolean): DocumentAction[] {
  if (d.status === "not-required") return [];
  const out: DocumentAction[] = [];
  const own = d.source === "importer";
  if (d.status === "not-started" && !own) out.push("request");
  if (["not-started", "requested", "draft"].includes(d.status)) {
    if (own) out.push("issue");
    else if (d.type !== "transport-document" || cargoWithCarrier) out.push("mark-available");
  }
  if (d.status === "available") out.push("send-for-review");
  if (d.status === "available" || d.status === "needs-review") out.push("approve");
  if (d.status === "approved") out.push("mark-needs-review");
  out.push("update-metadata");
  return out;
}

/** The next step for a document, in plain words. */
export function documentNextAction(d: TradeDocument, cargoWithCarrier: boolean): string {
  if (d.status === "not-required") return "No action required";
  if (d.validity === "expired" && (d.status === "available" || d.status === "approved")) return "Obtain a valid replacement — this document has expired";
  switch (d.status) {
    case "not-started":
      if (d.source === "importer") return "Issue the document";
      if (d.type === "transport-document" && !cargoWithCarrier) return "Becomes available after cargo handover to the carrier";
      return "Request the document";
    case "requested":
    case "draft":
      return d.source === "importer" ? "Issue the document" : `Await ${DOCUMENT_SOURCE_LABEL[d.source].toLowerCase()}`;
    case "available":
      return "Review the document";
    case "needs-review":
      return "Resolve the review and approve for workflow";
    case "approved":
      return d.validity === "expiring-soon" ? "Approved — check expiry before it lapses" : "No action required";
  }
}

export function nextDocumentEventId(): string {
  return `de-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ------------------------------------------------------------------------ */
/* Demo document history (for the three demo shipments)                     */
/* ------------------------------------------------------------------------ */

const ev = (
  documentId: string,
  n: number,
  type: DocumentEventType,
  at: string,
  by: DocumentEvent["by"],
  status?: DocumentStatus,
  metadata?: DocumentMetadata,
  note?: string,
): DocumentEvent => ({ id: `${documentId}-e${n}`, documentId, type, at, by, status, metadata, note });

export const MOCK_DOCUMENT_EVENTS: readonly DocumentEvent[] = [
  /* SHP-2026-0001 — delivered: documents complete. */
  ev("DOC-2026-0001-SI", 1, "issued", "2026-06-22T07:00:00Z", "importer", "available", { number: "SI-0001", issuer: "Meridian Imports Pvt. Ltd.", issueDate: "2026-06-22", filename: "shipping-instructions-SHP-0001.pdf", country: "India" }, "Shipping instructions sent to supplier."),
  ev("DOC-2026-0001-CI", 1, "approved", "2026-06-29T08:00:00Z", "supplier", "approved", { number: "BSA/INV/2026/0412", issuer: "Black Sea Agri Trading LLC", issueDate: "2026-06-28", filename: "BSA-INV-0412.pdf", country: "Ukraine" }),
  ev("DOC-2026-0001-PL", 1, "approved", "2026-06-29T08:00:00Z", "supplier", "approved", { number: "BSA/PL/2026/0412", issuer: "Black Sea Agri Trading LLC", issueDate: "2026-06-28", filename: "BSA-PL-0412.pdf", country: "Ukraine" }),
  ev("DOC-2026-0001-COO", 1, "marked-available", "2026-06-30T10:00:00Z", "supplier", "available", { number: "UA-COO-118402", issuer: "Chamber of commerce, Odesa (demo)", issueDate: "2026-06-30", filename: "coo-118402.pdf", country: "Ukraine" }),
  ev("DOC-2026-0001-COO", 2, "approved", "2026-07-01T05:00:00Z", "importer", "approved"),
  ev("DOC-2026-0001-CERT1", 1, "marked-available", "2026-06-30T10:00:00Z", "supplier", "available", { number: "HC-UA-55021", issuer: "Food safety authority, Ukraine (demo)", issueDate: "2026-06-30", filename: "health-cert-55021.pdf", country: "Ukraine" }),
  ev("DOC-2026-0001-CERT1", 2, "approved", "2026-07-01T05:00:00Z", "importer", "approved"),
  ev("DOC-2026-0001-TD", 1, "marked-available", "2026-07-05T08:00:00Z", "carrier", "available", { number: "BALU-ODS-240711", issuer: "Blue Anchor Lines (demo)", issueDate: "2026-07-05", filename: "bl-240711.pdf", country: "Ukraine" }),
  ev("DOC-2026-0001-TD", 2, "approved", "2026-07-06T06:00:00Z", "importer", "approved"),

  /* SHP-2026-0002 — in transit: one certificate needs review, one expires soon. */
  ev("DOC-2026-0002-COO", 1, "requested", "2026-09-20T06:30:00Z", "importer", "requested"),
  ev("DOC-2026-0002-CI", 1, "status-set", "2026-09-22T06:00:00Z", "supplier", "draft", undefined, "Draft invoice shared by supplier."),
  ev("DOC-2026-0002-SI", 1, "issued", "2026-09-23T09:00:00Z", "importer", "available", { number: "SI-0002", issuer: "Meridian Imports Pvt. Ltd.", issueDate: "2026-09-23", country: "India" }),
  ev("DOC-2026-0002-CI", 2, "approved", "2026-09-26T07:00:00Z", "supplier", "approved", { number: "PGI/EXP/2026/0931", issuer: "Punjab Grain International Ltd.", issueDate: "2026-09-25", filename: "PGI-INV-0931.pdf", country: "India" }),
  ev("DOC-2026-0002-PL", 1, "approved", "2026-09-26T07:00:00Z", "supplier", "approved", { number: "PGI/PL/2026/0931", issuer: "Punjab Grain International Ltd.", issueDate: "2026-09-25", filename: "PGI-PL-0931.pdf", country: "India" }),
  ev("DOC-2026-0002-COO", 2, "marked-available", "2026-09-27T10:00:00Z", "supplier", "available", { number: "IN-COO-2026-77310", issuer: "Export promotion council (demo)", issueDate: "2026-09-27", filename: "coo-77310.pdf", country: "India" }),
  ev("DOC-2026-0002-CERT1", 1, "marked-available", "2026-09-27T10:00:00Z", "supplier", "available", { number: "PSC-AMR-2026-4418", issuer: "Plant protection authority, India (demo)", issueDate: "2026-09-27", expiryDate: "2026-10-27", filename: "phyto-4418.pdf", country: "India" }),
  ev("DOC-2026-0002-CERT2", 1, "marked-available", "2026-10-01T13:00:00Z", "supplier", "available", { number: "FUM-MUN-2026-0915", issuer: "Fumigation operator, Mundra (demo)", issueDate: "2026-10-01", filename: "fumigation-0915.pdf", country: "India" }),
  ev("DOC-2026-0002-TD", 1, "marked-available", "2026-10-03T08:00:00Z", "carrier", "available", { number: "BALU-MUN-261003", issuer: "Blue Anchor Lines (demo)", issueDate: "2026-10-03", filename: "bl-261003.pdf", country: "India" }),
  ev("DOC-2026-0002-CERT2", 2, "marked-needs-review", "2026-10-05T07:00:00Z", "importer", "needs-review", undefined, "Fumigation date on the certificate differs from the packing list date."),

  /* SHP-2026-0003 — preparing: documents still outstanding. */
  ev("DOC-2026-0003-CI", 1, "status-set", "2026-10-04T08:00:00Z", "supplier", "draft", { filename: "CSM-INV-draft.pdf" }, "Draft invoice shared by supplier."),
  ev("DOC-2026-0003-COO", 1, "requested", "2026-10-04T09:00:00Z", "importer", "requested"),
];

export const MOCK_EVENTS_BY_DOCUMENT: Record<string, DocumentEvent[]> = MOCK_DOCUMENT_EVENTS.reduce<Record<string, DocumentEvent[]>>((acc, e) => {
  (acc[e.documentId] ??= []).push(e);
  return acc;
}, {});
