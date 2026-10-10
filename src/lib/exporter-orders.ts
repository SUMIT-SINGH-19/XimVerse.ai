/*
 * Orders: execution of a confirmed deal.
 *
 *   Deal ("we agreed what will happen") → Order ("now execute it") → Shipment(s)
 *
 * Aligned with the importer's Order (src/lib/importer-orders.ts) and document
 * vocabulary (src/lib/importer-documents.ts): ORD-YYYY-NNNN
 * ids, references by id, an immutable terms snapshot, and status derived from
 * an append-only event list (the supplier-confirmed event keeps its name).
 * Seeded exporter orders use ORD-2026-81xx and browser-created ones 9001+,
 * clear of the importer's ORD-2026-000x.
 *
 * Commercial terms are deep-copied from deal.terms at creation and never
 * change. Execution — production, payment readiness, documents — is state
 * derived by replaying events over the order's base.
 *
 * Shipments: one order -> many shipments. Allocations live on the shipment
 * records (exporter-shipments.ts) and are passed in when deriving order
 * state, so there is a single source for how much is allocated. Shipping
 * instructions, shipping bill and BL/AWB belong to each shipment, not here.
 *
 * Privacy: no PurchaseOrder object (it holds buyer addresses and contacts on
 * the importer side) — only a buyer-safe PO view.
 */

import type { DocumentStatus as ImporterDocumentStatus, DocumentType as ImporterDocumentType } from "./importer-documents";
import type { PaymentTerm } from "./import-requirements";
import { EXPORTER_COMPANY_ID } from "./exporter-company";
import { DEMO_TODAY, daysBetween, formatMoney } from "./exporter-quotations";
import { dealValueMinor, SEEDED_DEALS, type DealTerms, type ExporterDeal } from "./exporter-deals";

// ---------------------------------------------------------------------------
// Documents (shipment / order documents — never company credentials)
// ---------------------------------------------------------------------------

export type OrderDocumentStatus = "not-started" | "preparing" | "ready" | "verified" | "blocked" | "not-required";

export const DOCUMENT_STATUS_LABEL: Record<OrderDocumentStatus, string> = {
  "not-started": "Not Started",
  preparing: "Preparing",
  ready: "Ready",
  verified: "Verified",
  blocked: "Blocked",
  "not-required": "Not Required",
};

/** The importer's shipment document status for each exporter status. */
export const TO_IMPORTER_DOCUMENT_STATUS: Record<OrderDocumentStatus, ImporterDocumentStatus> = {
  "not-started": "not-started",
  preparing: "draft",
  ready: "available",
  verified: "approved",
  blocked: "needs-review",
  "not-required": "not-required",
};

export type OrderDocumentType =
  | "commercial-invoice"
  | "packing-list"
  | "certificate-of-origin"
  | "phytosanitary-certificate"
  | "fumigation-certificate"
  | "health-certificate"
  | "inspection-certificate"
  | "insurance-certificate"
  | "shipping-instructions"
  | "shipping-bill"
  | "transport-document";

/** The importer's DocumentType where one exists. */
export const TO_IMPORTER_DOCUMENT_TYPE: Partial<Record<OrderDocumentType, ImporterDocumentType>> = {
  "commercial-invoice": "commercial-invoice",
  "packing-list": "packing-list",
  "certificate-of-origin": "certificate-of-origin",
  "phytosanitary-certificate": "product-certificate",
  "fumigation-certificate": "product-certificate",
  "health-certificate": "product-certificate",
  "inspection-certificate": "inspection-certificate",
  "insurance-certificate": "insurance-certificate",
  "shipping-instructions": "shipping-instructions",
  "transport-document": "transport-document",
};

/**
 * pre-shipment: an order-level document, ready before shipment.
 * shipment-stage: legacy — shipping instructions, shipping bill and BL/AWB
 * now live on each shipment. Kept so older stored orders still parse.
 */
export type DocumentPhase = "pre-shipment" | "shipment-stage";

/** Document types owned by the shipment, not the order. */
export const SHIPMENT_LEVEL_TYPES: readonly OrderDocumentType[] = ["shipping-instructions", "shipping-bill", "transport-document"];

export interface OrderDocument {
  id: string;
  type: OrderDocumentType;
  label: string;
  phase: DocumentPhase;
  status: OrderDocumentStatus;
  /** The deal commitment this document fulfils, if any. */
  commitment?: "committed" | "arrangement-required";
}

const DOC_LABEL: Record<OrderDocumentType, string> = {
  "commercial-invoice": "Commercial Invoice",
  "packing-list": "Packing List",
  "certificate-of-origin": "Certificate of Origin",
  "phytosanitary-certificate": "Phytosanitary Certificate",
  "fumigation-certificate": "Fumigation Certificate",
  "health-certificate": "Health Certificate",
  "inspection-certificate": "Inspection Certificate",
  "insurance-certificate": "Insurance Certificate",
  "shipping-instructions": "Shipping Instructions",
  "shipping-bill": "Shipping Bill",
  "transport-document": "Bill of Lading / AWB",
};

function typeFromCommitment(name: string): OrderDocumentType | undefined {
  const n = name.toLowerCase();
  if (n.startsWith("inspection")) return "inspection-certificate";
  if (n.includes("origin")) return "certificate-of-origin";
  if (n.includes("phytosanitary")) return "phytosanitary-certificate";
  if (n.includes("fumigation")) return "fumigation-certificate";
  if (n.includes("health")) return "health-certificate";
  return undefined;
}

/** The order's document checklist, from its locked terms. */
export function documentsFromTerms(orderId: string, t: DealTerms): OrderDocument[] {
  const docs: OrderDocument[] = [];
  const add = (type: OrderDocumentType, phase: DocumentPhase, commitment?: OrderDocument["commitment"]) => {
    if (!docs.some((d) => d.type === type)) docs.push({ id: `${orderId}-${type}`, type, label: DOC_LABEL[type], phase, status: "not-started", commitment });
  };
  add("commercial-invoice", "pre-shipment");
  add("packing-list", "pre-shipment");
  for (const c of t.complianceCommitments) {
    const type = typeFromCommitment(c.name);
    if (type && c.commitment !== "not-committed") add(type, "pre-shipment", c.commitment);
  }
  if (t.costCoverage.insurance === "included") add("insurance-certificate", "pre-shipment");
  // Shipping instructions, shipping bill and BL/AWB are per shipment (exporter-shipments.ts).
  return docs;
}

/** Operational wording for a compliance document, from its commitment and status. */
export function complianceStatusText(d: OrderDocument): string {
  if (d.commitment === "arrangement-required") {
    const label = d.type === "fumigation-certificate" ? "Agency" : d.type === "inspection-certificate" ? "Inspector" : "Provider";
    if (d.status === "not-started") return `${label} not booked`;
    if (d.status === "preparing") return `${label} booked — in progress`;
  }
  return DOCUMENT_STATUS_LABEL[d.status];
}

// ---------------------------------------------------------------------------
// Payment readiness (operational, no banking)
// ---------------------------------------------------------------------------

export interface PaymentStep {
  id: string;
  label: string;
}

/** Steps to payment readiness per agreed term; the last step means ready. */
export const PAYMENT_STEPS: Record<PaymentTerm, readonly PaymentStep[]> = {
  lc: [
    { id: "awaiting-lc", label: "Awaiting LC" },
    { id: "lc-received", label: "LC Received" },
    { id: "under-review", label: "Under Review" },
    { id: "confirmed", label: "Confirmed" },
  ],
  advance: [
    { id: "awaiting-advance", label: "Awaiting Advance" },
    { id: "advance-received", label: "Advance Received" },
    { id: "confirmed", label: "Confirmed" },
  ],
  dp: [
    { id: "collection-bank-pending", label: "Collection Bank Pending" },
    { id: "collection-bank-nominated", label: "Collection Bank Nominated" },
    { id: "confirmed", label: "Ready for Document Collection" },
  ],
  da: [
    { id: "collection-bank-pending", label: "Collection Bank Pending" },
    { id: "collection-bank-nominated", label: "Collection Bank Nominated" },
    { id: "confirmed", label: "Ready for Acceptance" },
  ],
  "open-account": [
    { id: "credit-check-pending", label: "Credit Terms Pending" },
    { id: "confirmed", label: "Credit Terms Confirmed" },
  ],
  negotiable: [
    { id: "terms-pending", label: "Payment Terms Pending" },
    { id: "confirmed", label: "Payment Terms Confirmed" },
  ],
};

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type OrderEventType =
  | "created"
  | "supplier-confirmed"
  | "production-started"
  | "production-updated"
  | "cargo-ready-date-set"
  | "production-completed"
  | "payment-updated"
  | "document-updated"
  | "on-hold"
  | "resumed"
  | "completed"
  | "cancelled";

export interface OrderEvent {
  id: string;
  type: OrderEventType;
  by: "supplier" | "importer" | "system";
  /** ISO timestamp. */
  at: string;
  note?: string;
  /** production-started: YYYY-MM-DD planned start. */
  plannedStart?: string;
  /** production-updated / production-completed. */
  producedQuantity?: number;
  /** cargo-ready-date-set: YYYY-MM-DD. */
  expectedCargoReady?: string;
  /** production-completed: YYYY-MM-DD. */
  actualCargoReady?: string;
  /** payment-updated: a step id from PAYMENT_STEPS. */
  paymentStep?: string;
  document?: { id: string; status: OrderDocumentStatus };
}

/** A buyer-safe view of the purchase order: no addresses, no contacts. */
export interface PurchaseOrderView {
  number?: string;
  /** YYYY-MM-DD */
  issueDate?: string;
  status: "not-received" | "received" | "acknowledged";
}

/** One shipment's share of an order, as reported by the shipment layer. */
export interface ShipmentAllocation {
  shipmentId: string;
  quantity: number;
  /** Cargo has left origin. */
  shipped: boolean;
  delivered: boolean;
}

export interface ExporterOrder {
  /** ORD-YYYY-NNNN */
  id: string;
  dealId: string;
  requirementId: string;
  opportunityId: string;
  quotationId: string;
  negotiationId?: string;
  exporterCompanyId: string;
  /** ISO timestamp. */
  createdAt: string;
  /** Deep copy of deal.terms. Never changes. */
  terms: DealTerms;
  purchaseOrder: PurchaseOrderView;
  /** The order-level checklist as at creation; status changes are events. */
  documents: OrderDocument[];
  events: readonly OrderEvent[];
}

// ---------------------------------------------------------------------------
// Derived execution state
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "awaiting-confirmation"
  | "confirmed"
  | "production"
  | "pre-shipment"
  | "ready-to-ship"
  | "in-shipment"
  | "completed"
  | "on-hold"
  | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  "awaiting-confirmation": "Awaiting Exporter Confirmation",
  confirmed: "Confirmed",
  production: "In Production",
  "pre-shipment": "Pre-Shipment",
  "ready-to-ship": "Ready to Ship",
  "in-shipment": "In Shipment",
  completed: "Completed",
  "on-hold": "On Hold",
  cancelled: "Cancelled",
};

/** The importer OrderStatus the same moment corresponds to (documentation only). */
export const IMPORTER_ORDER_STATUS_EQUIVALENT: Record<OrderStatus, string> = {
  "awaiting-confirmation": "awaiting-confirmation",
  confirmed: "confirmed",
  production: "confirmed",
  "pre-shipment": "pre-shipment",
  "ready-to-ship": "pre-shipment",
  "in-shipment": "pre-shipment",
  completed: "completed",
  "on-hold": "confirmed",
  cancelled: "cancelled",
};

export const EXECUTION_STAGES = ["Order Confirmed", "Production", "Pre-Shipment", "Ready to Ship", "Shipment", "Delivery"] as const;
export type ExecutionStage = (typeof EXECUTION_STAGES)[number];

export type ProductionStatus = "not-started" | "in-progress" | "completed";

export interface OrderState {
  status: OrderStatus;
  stage: ExecutionStage | "Awaiting Confirmation";
  confirmed: boolean;
  production: {
    status: ProductionStatus;
    ordered: number;
    produced: number;
    /** 0–100, from produced / ordered. */
    progress: number;
    plannedStart?: string;
    actualStart?: string;
    expectedCargoReady?: string;
    actualCargoReady?: string;
    notes: string[];
  };
  paymentStep: PaymentStep;
  paymentReady: boolean;
  documents: OrderDocument[];
  shipments: readonly ShipmentAllocation[];
  /** Quantity ledger. Ordered never changes; the rest are derived. */
  quantities: {
    ordered: number;
    produced: number;
    allocated: number;
    /** Produced and not yet allocated to a shipment. */
    available: number;
    shipped: number;
    delivered: number;
  };
  updatedAt: string;
}

/**
 * Replays the order's events. `allocations` come from the order's shipments
 * (non-cancelled), so allocated / shipped / delivered quantities stay derived.
 */
export function orderState(o: ExporterOrder, allocations: readonly ShipmentAllocation[] = []): OrderState {
  const steps = PAYMENT_STEPS[o.terms.paymentTerm];
  let confirmed = false;
  let held = false;
  let cancelled = false;
  let completed = false;
  let paymentStep = steps[0];
  // Shipment-level types are ignored here (older stored orders may still carry them).
  const docs = new Map(o.documents.filter((d) => !SHIPMENT_LEVEL_TYPES.includes(d.type)).map((d) => [d.id, { ...d }]));
  const shipments = [...allocations];
  const p: OrderState["production"] = { status: "not-started", ordered: o.terms.quantity.amount, produced: 0, progress: 0, notes: [] };
  let updatedAt = o.createdAt;

  for (const e of o.events) {
    if (e.at > updatedAt) updatedAt = e.at;
    switch (e.type) {
      case "supplier-confirmed":
        confirmed = true;
        break;
      case "production-started":
        p.status = "in-progress";
        p.actualStart = e.at.slice(0, 10);
        p.plannedStart = e.plannedStart ?? p.plannedStart;
        break;
      case "production-updated":
        if (e.producedQuantity !== undefined) p.produced = Math.min(e.producedQuantity, p.ordered);
        break;
      case "cargo-ready-date-set":
        p.expectedCargoReady = e.expectedCargoReady;
        break;
      case "production-completed":
        p.status = "completed";
        p.produced = e.producedQuantity ?? p.ordered;
        p.actualCargoReady = e.actualCargoReady ?? e.at.slice(0, 10);
        break;
      case "payment-updated":
        paymentStep = steps.find((s) => s.id === e.paymentStep) ?? paymentStep;
        break;
      case "document-updated": {
        const d = e.document && docs.get(e.document.id);
        if (d && e.document) docs.set(d.id, { ...d, status: e.document.status });
        break;
      }
      case "on-hold":
        held = true;
        break;
      case "resumed":
        held = false;
        break;
      case "completed":
        completed = true;
        break;
      case "cancelled":
        cancelled = true;
        break;
    }
    if (e.note && e.by === "supplier" && (e.type === "production-updated" || e.type === "production-started" || e.type === "production-completed")) {
      p.notes.push(e.note);
    }
  }
  p.progress = p.ordered ? Math.round((p.produced / p.ordered) * 100) : 0;

  const documents = [...docs.values()];
  const allocated = shipments.reduce((t, a) => t + a.quantity, 0);
  const quantities = {
    ordered: p.ordered,
    produced: p.produced,
    allocated,
    available: Math.max(0, Math.min(p.produced, p.ordered) - allocated),
    shipped: shipments.filter((a) => a.shipped).reduce((t, a) => t + a.quantity, 0),
    delivered: shipments.filter((a) => a.delivered).reduce((t, a) => t + a.quantity, 0),
  };
  const base = { confirmed, production: p, paymentStep, paymentReady: paymentStep.id === "confirmed", documents, shipments, quantities, updatedAt };
  const readiness = preShipmentScore({ ...o, terms: o.terms }, { ...base, status: "confirmed", stage: "Order Confirmed" });

  let status: OrderStatus;
  if (cancelled) status = "cancelled";
  else if (completed) status = "completed";
  else if (held) status = "on-hold";
  else if (!confirmed) status = "awaiting-confirmation";
  // Completed once every ordered unit has been delivered by its shipments.
  else if (p.ordered > 0 && quantities.delivered >= p.ordered) status = "completed";
  // In shipment once cargo is allocated and production is done (or everything is allocated).
  else if (allocated > 0 && (p.status === "completed" || allocated >= p.ordered)) status = "in-shipment";
  else if (p.status === "completed") status = readiness === 100 ? "ready-to-ship" : "pre-shipment";
  else if (p.status === "in-progress") status = "production";
  else status = "confirmed";

  const stage: OrderState["stage"] =
    status === "awaiting-confirmation"
      ? "Awaiting Confirmation"
      : status === "completed"
        ? "Delivery"
        : status === "in-shipment"
          ? quantities.shipped >= p.ordered
            ? "Delivery"
            : "Shipment"
          : status === "ready-to-ship"
            ? "Ready to Ship"
            : status === "pre-shipment"
              ? "Pre-Shipment"
              : status === "production"
                ? "Production"
                : "Order Confirmed";

  return { ...base, status, stage };
}

export function isActiveOrder(status: OrderStatus): boolean {
  return status !== "completed" && status !== "cancelled";
}

export function orderValueMinor(o: ExporterOrder): number {
  return dealValueMinor(o.terms);
}

// ---------------------------------------------------------------------------
// Pre-shipment readiness
// ---------------------------------------------------------------------------

export interface ReadinessItem {
  key: string;
  label: string;
  done: boolean;
  detail?: string;
}

/** Only items relevant to this order. */
export function preShipmentReadiness(o: ExporterOrder, s: Omit<OrderState, "status" | "stage"> & Partial<Pick<OrderState, "status" | "stage">>): ReadinessItem[] {
  const docs = s.documents.filter((d) => d.phase === "pre-shipment" && d.status !== "not-required");
  const arrangements = docs.filter((d) => d.commitment === "arrangement-required");
  const inspection = docs.find((d) => d.type === "inspection-certificate");
  const paperwork = docs.filter((d) => d.commitment !== "arrangement-required" && d.type !== "inspection-certificate" && d.type !== "shipping-instructions");
  const prepared = (d: OrderDocument) => d.status === "ready" || d.status === "verified";

  const items: ReadinessItem[] = [
    { key: "terms", label: "Commercial terms locked", done: true },
    { key: "confirmed", label: "Exporter confirmed order", done: s.confirmed },
    {
      key: "production",
      label: "Production complete",
      done: s.production.status === "completed",
      detail: s.production.status === "in-progress" ? `${s.production.progress}% produced` : undefined,
    },
  ];
  if (o.terms.packaging) items.push({ key: "packaging", label: "Packaging confirmed", done: s.confirmed, detail: o.terms.packaging });
  items.push({
    key: "cargo-ready",
    label: "Cargo-ready date confirmed",
    done: Boolean(s.production.actualCargoReady || s.production.expectedCargoReady),
    detail: s.production.actualCargoReady ? "Cargo ready" : s.production.expectedCargoReady ? "Expected date set" : undefined,
  });
  items.push({ key: "payment", label: "Payment instrument confirmed", done: s.paymentReady, detail: s.paymentReady ? undefined : s.paymentStep.label });
  for (const d of arrangements) {
    items.push({ key: `arrange-${d.type}`, label: `${d.label.replace(/ Certificate$/, "")} arranged`, done: prepared(d), detail: complianceStatusText(d) });
  }
  if (inspection && inspection.commitment !== "arrangement-required") {
    items.push({ key: "inspection", label: "Inspection arranged", done: prepared(inspection), detail: DOCUMENT_STATUS_LABEL[inspection.status] });
  }
  const notPrepared = paperwork.filter((d) => !prepared(d));
  items.push({
    key: "documents",
    label: "Required shipment documents prepared",
    done: notPrepared.length === 0,
    detail: notPrepared.length ? `${notPrepared.length} of ${paperwork.length} not ready` : undefined,
  });
  return items;
}

function preShipmentScore(o: ExporterOrder, s: Omit<OrderState, "status" | "stage"> & Partial<Pick<OrderState, "status" | "stage">>): number {
  const items = preShipmentReadiness(o, s);
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}

export function readinessScore(o: ExporterOrder, s: OrderState): number {
  return preShipmentScore(o, s);
}

// ---------------------------------------------------------------------------
// Action required and SUMIT
// ---------------------------------------------------------------------------

export function actionsRequired(o: ExporterOrder, s: OrderState): string[] {
  if (s.status === "cancelled" || s.status === "completed") return [];
  const out: string[] = [];
  if (!s.confirmed) out.push("Confirm the order");
  else if (s.production.status === "not-started") out.push("Production not started");
  if (!s.production.expectedCargoReady && !s.production.actualCargoReady) out.push("Cargo-ready date missing");
  if (!s.paymentReady) out.push(`${o.terms.paymentTerm === "lc" ? "LC confirmation" : "Payment readiness"} pending (${s.paymentStep.label})`);
  for (const d of s.documents.filter((x) => x.commitment === "arrangement-required" && (x.status === "not-started" || x.status === "blocked"))) {
    out.push(`${d.label.replace(/ Certificate$/, "")} not arranged`);
  }
  const blocked = s.documents.filter((d) => d.status === "blocked");
  if (blocked.length) out.push(`${blocked.length} document${blocked.length === 1 ? "" : "s"} blocked`);
  const notStarted = s.documents.filter((d) => d.phase === "pre-shipment" && d.status === "not-started" && d.commitment !== "arrangement-required");
  if (notStarted.length) out.push(`${notStarted.length} required document${notStarted.length === 1 ? "" : "s"} not started`);
  return out;
}

/** Statements supported directly by the order data. No AI. */
export function orderInsights(o: ExporterOrder, s: OrderState): string[] {
  const out: string[] = [];
  const outstanding: string[] = [];
  if (!s.paymentReady) outstanding.push(o.terms.paymentTerm === "lc" ? "confirm the LC" : "complete payment readiness");
  for (const d of s.documents.filter((x) => x.commitment === "arrangement-required" && x.status === "not-started")) outstanding.push(`arrange ${d.label.replace(/ Certificate$/, "").toLowerCase()}`);
  const phyto = s.documents.find((d) => d.type === "phytosanitary-certificate" && d.status === "not-started");
  if (phyto) outstanding.push("prepare the phytosanitary certificate");

  if (s.production.status === "in-progress") {
    out.push(`Production is ${s.production.progress}% complete${outstanding.length ? `. Before shipment setup, ${outstanding.join(", ")}` : ""}.`);
  } else if (s.production.status === "completed" && outstanding.length) {
    out.push(`Production is complete. Remaining before shipment: ${outstanding.join(", ")}.`);
  } else if (!s.confirmed) {
    out.push(`Confirm the order to start execution of ${o.terms.quantity.amount.toLocaleString("en-US")} ${o.terms.quantity.unit} worth ${formatMoney(orderValueMinor(o), o.terms.currency)}.`);
  }

  const ready = s.production.actualCargoReady ?? s.production.expectedCargoReady;
  const delivery = o.terms.estimatedDelivery;
  if (ready && delivery) {
    const gap = daysBetween(ready, delivery);
    out.push(
      gap >= 0
        ? `Cargo is ${s.production.actualCargoReady ? "ready" : "expected to be ready"} ${gap} day${gap === 1 ? "" : "s"} before the agreed delivery date (transit time not included).`
        : `Cargo ready date is ${-gap} day${gap === -1 ? "" : "s"} after the agreed delivery date — review with Ximverse.`,
    );
  }
  if (s.status === "ready-to-ship") out.push("Every pre-shipment item is complete. Create a shipment to allocate the cargo.");
  if (s.quantities.allocated > 0 && s.quantities.available > 0) {
    out.push(`${s.quantities.available.toLocaleString("en-US")} ${o.terms.quantity.unit} produced and not yet allocated to a shipment.`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Creation and duplicate prevention
// ---------------------------------------------------------------------------

export function orderForDeal(dealId: string, orders: readonly ExporterOrder[]): ExporterOrder | undefined {
  return orders.find((o) => o.dealId === dealId);
}

export const LOCAL_ORDER_ID = /^ORD-\d{4}-9\d{3,}$/;

export function nextOrderId(local: readonly { id: string }[], year: number): string {
  const max = local.reduce((m, o) => Math.max(m, Number(o.id.split("-")[2]) || 0), 9000);
  return `ORD-${year}-${max + 1}`;
}

/** Builds an order from a deal. Terms are deep-copied, never re-derived. */
export function orderFromDeal(deal: ExporterDeal, id: string, createdAt: string, purchaseOrder: PurchaseOrderView = { status: "not-received" }): ExporterOrder {
  const terms = structuredClone(deal.terms);
  return {
    id,
    dealId: deal.id,
    requirementId: deal.requirementId,
    opportunityId: deal.opportunityId,
    quotationId: deal.quotationId,
    negotiationId: deal.negotiationId,
    exporterCompanyId: EXPORTER_COMPANY_ID,
    createdAt,
    terms,
    purchaseOrder,
    documents: documentsFromTerms(id, terms),
    events: [{ id: `${id}-e0`, type: "created", by: "supplier", at: createdAt }],
  };
}

// ---------------------------------------------------------------------------
// Seeded orders (demo), from seeded deals
// ---------------------------------------------------------------------------

function seededOrder(
  id: string,
  dealId: string,
  createdAt: string,
  po: PurchaseOrderView,
  events: (docId: (t: OrderDocumentType) => string) => Omit<OrderEvent, "id">[],
): ExporterOrder {
  const deal = SEEDED_DEALS.find((d) => d.id === dealId);
  if (!deal) throw new Error(`Seed ${id}: unknown deal ${dealId}`);
  const base = orderFromDeal(deal, id, createdAt, po);
  const docId = (t: OrderDocumentType) => `${id}-${t}`;
  const extra = events(docId).map((e, i) => ({ ...e, id: `${id}-e${i + 1}` }));
  return { ...base, events: [...base.events, ...extra] };
}

const at = (date: string, time = "06:00") => `${date}T${time}:00Z`;

export const SEEDED_ORDERS: readonly ExporterOrder[] = [
  // In production, 65% — LC received and under review.
  seededOrder("ORD-2026-8101", "DL-2026-8101", at("2026-09-14"), { number: "PO-2026-8101", issueDate: "2026-09-14", status: "acknowledged" }, (doc) => [
    { type: "supplier-confirmed", by: "supplier", at: at("2026-09-14", "09:00") },
    { type: "production-started", by: "supplier", at: at("2026-09-22"), plannedStart: "2026-09-21", note: "Milling started at Karnal unit." },
    { type: "payment-updated", by: "supplier", at: at("2026-09-24"), paymentStep: "lc-received" },
    { type: "production-updated", by: "supplier", at: at("2026-10-01"), producedQuantity: 40 },
    { type: "cargo-ready-date-set", by: "supplier", at: at("2026-10-02"), expectedCargoReady: "2026-10-09" },
    { type: "payment-updated", by: "supplier", at: at("2026-10-03"), paymentStep: "under-review" },
    { type: "production-updated", by: "supplier", at: at("2026-10-06"), producedQuantity: 65, note: "Sortexing on schedule." },
    { type: "document-updated", by: "supplier", at: at("2026-10-06", "10:00"), document: { id: doc("commercial-invoice"), status: "preparing" } },
  ]),
  // Production complete and every pre-shipment item done; executed in three shipments.
  seededOrder("ORD-2026-8102", "DL-2026-8102", at("2026-08-27"), { number: "PO-2026-8102", issueDate: "2026-08-27", status: "acknowledged" }, (doc) => [
    { type: "supplier-confirmed", by: "supplier", at: at("2026-08-27", "10:00") },
    { type: "payment-updated", by: "supplier", at: at("2026-08-29"), paymentStep: "lc-received" },
    { type: "production-started", by: "supplier", at: at("2026-09-02"), plannedStart: "2026-09-01" },
    { type: "cargo-ready-date-set", by: "supplier", at: at("2026-09-03"), expectedCargoReady: "2026-09-24" },
    { type: "payment-updated", by: "supplier", at: at("2026-09-05"), paymentStep: "confirmed" },
    { type: "production-updated", by: "supplier", at: at("2026-09-15"), producedQuantity: 110 },
    { type: "production-completed", by: "supplier", at: at("2026-09-23"), producedQuantity: 150, actualCargoReady: "2026-09-23", note: "150 MT bagged in 25 kg PP bags." },
    { type: "document-updated", by: "supplier", at: at("2026-09-24"), document: { id: doc("commercial-invoice"), status: "ready" } },
    { type: "document-updated", by: "supplier", at: at("2026-09-24", "07:00"), document: { id: doc("packing-list"), status: "ready" } },
    { type: "document-updated", by: "supplier", at: at("2026-09-25"), document: { id: doc("certificate-of-origin"), status: "verified" } },
    { type: "document-updated", by: "supplier", at: at("2026-09-26"), document: { id: doc("phytosanitary-certificate"), status: "ready" } },
    { type: "document-updated", by: "supplier", at: at("2026-09-25", "09:00"), document: { id: doc("fumigation-certificate"), status: "ready" } },
    { type: "document-updated", by: "supplier", at: at("2026-09-26", "08:00"), document: { id: doc("insurance-certificate"), status: "ready" } },
  ]),
  // Created from the deal, waiting for the exporter to confirm.
  seededOrder("ORD-2026-8103", "DL-2026-8103", at("2026-10-06", "08:00"), { number: "PO-2026-8103", issueDate: "2026-10-06", status: "received" }, () => []),
  // 500 MT produced, nothing allocated yet; fumigation and two certificates outstanding.
  seededOrder("ORD-2026-8104", "DL-2026-8104", at("2026-09-12", "15:00"), { number: "PO-2026-8104", issueDate: "2026-09-12", status: "acknowledged" }, (doc) => [
    { type: "supplier-confirmed", by: "supplier", at: at("2026-09-12", "16:00") },
    { type: "payment-updated", by: "supplier", at: at("2026-09-15"), paymentStep: "lc-received" },
    { type: "production-started", by: "supplier", at: at("2026-09-16"), plannedStart: "2026-09-15", note: "Parboiling at Sonipat unit." },
    { type: "cargo-ready-date-set", by: "supplier", at: at("2026-09-17"), expectedCargoReady: "2026-10-06" },
    { type: "payment-updated", by: "supplier", at: at("2026-09-17", "09:00"), paymentStep: "under-review" },
    { type: "payment-updated", by: "supplier", at: at("2026-09-19"), paymentStep: "confirmed" },
    { type: "production-updated", by: "supplier", at: at("2026-09-28"), producedQuantity: 250 },
    { type: "production-completed", by: "supplier", at: at("2026-10-05"), producedQuantity: 500, actualCargoReady: "2026-10-05", note: "500 MT bagged in 50 kg PP bags." },
    { type: "document-updated", by: "supplier", at: at("2026-10-05", "08:00"), document: { id: doc("commercial-invoice"), status: "ready" } },
    { type: "document-updated", by: "supplier", at: at("2026-10-05", "09:00"), document: { id: doc("packing-list"), status: "ready" } },
    { type: "document-updated", by: "supplier", at: at("2026-10-06"), document: { id: doc("certificate-of-origin"), status: "preparing" } },
    { type: "document-updated", by: "supplier", at: at("2026-10-06", "07:00"), document: { id: doc("phytosanitary-certificate"), status: "preparing" } },
    { type: "document-updated", by: "supplier", at: at("2026-10-06", "08:00"), document: { id: doc("insurance-certificate"), status: "ready" } },
  ]),
];

export const SEEDED_ORDER_IDS = SEEDED_ORDERS.map((o) => o.id);

export function findSeededOrder(id: string): ExporterOrder | undefined {
  return SEEDED_ORDERS.find((o) => o.id === id);
}

/** Days from the demo date to the agreed delivery; negative once past. */
export function daysToDelivery(o: ExporterOrder): number | undefined {
  return o.terms.estimatedDelivery ? daysBetween(DEMO_TODAY, o.terms.estimatedDelivery) : undefined;
}
