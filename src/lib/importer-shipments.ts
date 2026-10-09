/**
 * Shipments: the physical movement of an order's cargo.
 *
 * A shipment references its order, requirement and supplier by ID. It freezes
 * only the logistics facts needed to execute it (cargo, route, mode, planned
 * schedule); commercial terms stay on the order. Freight booking, customs
 * status and the lifecycle start from a base and change only through
 * append-only events. Documents live in the canonical document layer
 * (importer-documents.ts); readiness functions here take them as input.
 *
 * Designed for one shipment per order today; the order link is a plain
 * reference so split shipments can be added later.
 *
 * Mock shipments are fictional demo data tied to existing demo orders. No
 * carrier, tracking, freight or customs system is connected.
 */

import { MOCK_NOW, type Incoterm, type QuantityUnit } from "./import-requirements";
import { orderStatus, type Order } from "./importer-orders";
import type { TradeDocument } from "./importer-documents";

// Document vocabulary now lives in the canonical document layer; re-exported
// for existing type imports (e.g. exporter-orders.ts).
export type { DocumentSource, DocumentStatus, DocumentType } from "./importer-documents";

/* ------------------------------------------------------------------------ */
/* Types                                                                     */
/* ------------------------------------------------------------------------ */

export const TRANSPORT_MODES = [
  { id: "sea", label: "Sea" },
  { id: "air", label: "Air" },
  { id: "road", label: "Road" },
  { id: "rail", label: "Rail" },
  { id: "multimodal", label: "Multimodal" },
] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number]["id"];

export function modeLabel(mode: TransportMode): string {
  return TRANSPORT_MODES.find((m) => m.id === mode)?.label ?? mode;
}

export const PACKAGE_TYPES = ["Bags", "Cartons", "Pallets", "Drums", "IBC", "Crates", "Bundles", "Containers", "Other"] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

export interface ShipmentRoute {
  mode: TransportMode;
  origin: string;
  portOfLoading: string;
  portOfDischarge: string;
  finalDelivery: string;
  transshipmentAllowed: boolean;
}

export interface ShipmentCargo {
  product: string;
  quantity: { amount: number; unit: QuantityUnit };
  packages: number;
  packageType: PackageType;
  grossWeight: number;
  netWeight: number;
  weightUnit: "kg" | "MT";
  volumeCbm?: number;
  packagingDescription: string;
}

export interface ShipmentSchedule {
  /** All YYYY-MM-DD, planned dates (not live). */
  readyDate: string;
  etd: string;
  eta: string;
}

export interface ShipmentParties {
  freightForwarder?: string;
  customsBroker?: string;
  carrier?: string;
}

export type FreightBookingStatus = "not-started" | "rfq-needed" | "awaiting-confirmation" | "booked";

export const FREIGHT_STATUS_LABEL: Record<FreightBookingStatus, string> = {
  "not-started": "Not Started",
  "rfq-needed": "RFQ Needed",
  "awaiting-confirmation": "Awaiting Confirmation",
  booked: "Booked",
};

export interface FreightBooking {
  status: FreightBookingStatus;
  reference?: string;
  /** Who arranges the main carriage, from the Incoterm. */
  arrangedBy: "importer" | "supplier";
}

export type CustomsStatus = "not-started" | "preparing" | "ready-for-filing" | "filed" | "under-assessment" | "cleared";

export const CUSTOMS_STATUS_LABEL: Record<CustomsStatus, string> = {
  "not-started": "Not Started",
  preparing: "Preparing",
  "ready-for-filing": "Ready for Filing",
  filed: "Filed",
  "under-assessment": "Under Assessment",
  cleared: "Cleared",
};

/** Lifecycle status; each maps to exactly one stage. */
export type ShipmentStatus = "preparing" | "ready-to-ship" | "at-origin" | "in-transit" | "arrived" | "customs" | "delivered";

export const SHIPMENT_STATUSES: readonly { id: ShipmentStatus; label: string; stage: ShipmentStage }[] = [
  { id: "preparing", label: "Preparing", stage: "pre-shipment" },
  { id: "ready-to-ship", label: "Ready to Ship", stage: "ready-to-ship" },
  { id: "at-origin", label: "At Origin", stage: "origin" },
  { id: "in-transit", label: "In Transit", stage: "in-transit" },
  { id: "arrived", label: "Arrived", stage: "arrived" },
  { id: "customs", label: "Customs Clearance", stage: "customs" },
  { id: "delivered", label: "Delivered", stage: "delivered" },
];

export type ShipmentStage = "planning" | "pre-shipment" | "ready-to-ship" | "origin" | "in-transit" | "arrived" | "customs" | "delivered";

export const SHIPMENT_STAGES: readonly { id: ShipmentStage; label: string }[] = [
  { id: "planning", label: "Planning" },
  { id: "pre-shipment", label: "Pre-Shipment" },
  { id: "ready-to-ship", label: "Ready to Ship" },
  { id: "origin", label: "Origin" },
  { id: "in-transit", label: "In Transit" },
  { id: "arrived", label: "Arrived" },
  { id: "customs", label: "Customs" },
  { id: "delivered", label: "Delivered" },
];

export function shipmentStatusLabel(s: ShipmentStatus): string {
  return SHIPMENT_STATUSES.find((x) => x.id === s)!.label;
}

export function stageOf(s: ShipmentStatus): ShipmentStage {
  return SHIPMENT_STATUSES.find((x) => x.id === s)!.stage;
}

export function stageLabel(stage: ShipmentStage): string {
  return SHIPMENT_STAGES.find((x) => x.id === stage)!.label;
}

/** The only allowed forward move from each status. Nothing moves backwards. */
export const NEXT_STATUS: Partial<Record<ShipmentStatus, ShipmentStatus>> = {
  preparing: "ready-to-ship",
  "ready-to-ship": "at-origin",
  "at-origin": "in-transit",
  "in-transit": "arrived",
  arrived: "customs",
  customs: "delivered",
};

export type ShipmentEventType =
  | "created"
  | "booking-updated"
  | "schedule-updated"
  | "cargo-ready"
  | "status-changed"
  | "customs-updated";

export interface ShipmentEvent {
  id: string;
  type: ShipmentEventType;
  by: "importer" | "supplier" | "carrier" | "customs-broker" | "system";
  /** ISO timestamp. */
  at: string;
  /** Recorded with a demo action — no external system involved. */
  demo?: boolean;
  note?: string;
  booking?: { status: FreightBookingStatus; reference?: string; carrier?: string; forwarder?: string };
  schedule?: Partial<ShipmentSchedule>;
  status?: ShipmentStatus;
  customs?: CustomsStatus;
}

export interface Shipment {
  id: string;
  orderId: string;
  requirementId: string;
  supplierId: string;
  /** ISO timestamp. */
  createdAt: string;
  route: ShipmentRoute;
  cargo: ShipmentCargo;
  /** Schedule as planned at creation; updates are events. */
  schedule: ShipmentSchedule;
  parties: ShipmentParties;
  incoterm: Incoterm;
  hsCode?: string;
  booking: FreightBooking;
  events: ShipmentEvent[];
  local?: boolean;
}

export const SHIPMENT_ID_PATTERN = /^SHP-\d{4}-\d{4,}$/;

/* ------------------------------------------------------------------------ */
/* Derived state                                                             */
/* ------------------------------------------------------------------------ */

export interface ShipmentState {
  status: ShipmentStatus;
  stage: ShipmentStage;
  booking: FreightBooking & { carrier?: string; forwarder?: string };
  schedule: ShipmentSchedule;
  /** Explicit customs events (demo or historical), if any. */
  customsEvent?: CustomsStatus;
  cargoReady: boolean;
  updatedAt: string;
}

/** Applies a shipment's events, in order, to its base. */
export function shipmentState(s: Shipment): ShipmentState {
  let status: ShipmentStatus = "preparing";
  let booking: ShipmentState["booking"] = { ...s.booking, carrier: s.parties.carrier, forwarder: s.parties.freightForwarder };
  let schedule = { ...s.schedule };
  let customsEvent: CustomsStatus | undefined;
  let cargoReady = false;
  let updatedAt = s.createdAt;

  for (const e of s.events) {
    if (e.at > updatedAt) updatedAt = e.at;
    switch (e.type) {
      case "booking-updated":
        if (e.booking) {
          booking = {
            ...booking,
            status: e.booking.status,
            reference: e.booking.reference ?? booking.reference,
            carrier: e.booking.carrier ?? booking.carrier,
            forwarder: e.booking.forwarder ?? booking.forwarder,
          };
        }
        break;
      case "schedule-updated":
        schedule = { ...schedule, ...e.schedule };
        break;
      case "cargo-ready":
        cargoReady = true;
        break;
      case "status-changed":
        if (e.status) status = e.status;
        break;
      case "customs-updated":
        customsEvent = e.customs;
        break;
    }
  }
  return { status, stage: stageOf(status), booking, schedule, customsEvent, cargoReady, updatedAt };
}

/** Complete = available or approved and not expired (derived in the document layer). */
const isDone = (d?: TradeDocument) => !!d && d.complete;

export type ReadinessStatus = "complete" | "pending" | "not-started" | "not-required";

export const READINESS_STATUS_LABEL: Record<ReadinessStatus, string> = {
  complete: "Complete",
  pending: "Pending",
  "not-started": "Not Started",
  "not-required": "Not Required",
};

function docReadiness(d?: TradeDocument): ReadinessStatus {
  if (!d || d.status === "not-required") return "not-required";
  if (isDone(d)) return "complete";
  // Requested, draft, needs review — or provided but expired.
  if (d.status !== "not-started") return "pending";
  return "not-started";
}

export interface ReadinessItem {
  id: string;
  label: string;
  status: ReadinessStatus;
  /** Must be complete before the shipment can be marked Ready to Ship. */
  requiredForReady: boolean;
}

/** The pre-shipment coordination checklist. */
export function preShipmentChecklist(
  s: Shipment,
  state: ShipmentState,
  supplierConfirmed: boolean,
  documents: readonly TradeDocument[],
): ReadinessItem[] {
  const docs = documents.filter((d) => d.shipmentId === s.id);
  const doc = (type: TradeDocument["type"]) => docs.find((d) => d.type === type);
  const productCerts = docs.filter((d) => d.type === "product-certificate");
  const coo = doc("certificate-of-origin");
  const certStatus: ReadinessStatus =
    productCerts.length === 0
      ? "not-required"
      : productCerts.every(isDone)
        ? "complete"
        : productCerts.some((d) => d.status !== "not-started")
          ? "pending"
          : "not-started";
  const bookingStatus: ReadinessStatus =
    state.booking.status === "booked" ? "complete" : state.booking.status === "not-started" ? "not-started" : "pending";

  return [
    { id: "po", label: "Purchase Order", status: "complete", requiredForReady: true },
    { id: "confirmation", label: "Supplier Confirmation", status: supplierConfirmed ? "complete" : "pending", requiredForReady: true },
    { id: "invoice", label: "Commercial Invoice", status: docReadiness(doc("commercial-invoice")), requiredForReady: true },
    { id: "packing", label: "Packing List", status: docReadiness(doc("packing-list")), requiredForReady: true },
    {
      id: "coo",
      label: "Certificate of Origin",
      status: docReadiness(coo),
      requiredForReady: !!coo && coo.status !== "not-required",
    },
    { id: "certificates", label: "Product / Regulatory Certificates", status: certStatus, requiredForReady: false },
    { id: "freight", label: "Freight Booking", status: bookingStatus, requiredForReady: true },
    { id: "broker", label: "Customs Broker / CHA", status: s.parties.customsBroker ? "complete" : "not-started", requiredForReady: false },
    { id: "instructions", label: "Shipping Instructions", status: docReadiness(doc("shipping-instructions")), requiredForReady: false },
  ];
}

export function blockingItems(items: readonly ReadinessItem[]): ReadinessItem[] {
  return items.filter((i) => i.requiredForReady && i.status !== "complete");
}

/** Customs readiness: explicit (demo/historical) events win; otherwise derived from documents. */
export function customsStatus(s: Shipment, state: ShipmentState, documents: readonly TradeDocument[]): CustomsStatus {
  if (state.customsEvent) return state.customsEvent;
  const doc = (type: TradeDocument["type"]) => documents.find((d) => d.shipmentId === s.id && d.type === type);
  const ci = doc("commercial-invoice");
  const pl = doc("packing-list");
  if (isDone(ci) && isDone(pl) && s.parties.customsBroker) return "ready-for-filing";
  if ([ci, pl].some((d) => d && d.status !== "not-started")) return "preparing";
  return "not-started";
}

/** The single most useful next step, derived from status and readiness. */
export function nextAction(s: Shipment, state: ShipmentState, checklist: readonly ReadinessItem[], documents: readonly TradeDocument[]): string {
  switch (state.status) {
    case "preparing": {
      const blocking = blockingItems(checklist)[0];
      if (blocking) {
        if (blocking.id === "freight") return state.booking.arrangedBy === "importer" ? "Arrange freight booking" : "Await supplier's freight booking";
        if (blocking.id === "confirmation") return "Obtain supplier confirmation";
        return `Complete ${blocking.label}`;
      }
      return "Mark shipment Ready to Ship";
    }
    case "ready-to-ship":
      return "Await cargo handover to carrier";
    case "at-origin":
      return "Await departure";
    case "in-transit":
      if (!s.parties.customsBroker) return "Assign a customs broker before arrival";
      return customsStatus(s, state, documents) === "ready-for-filing" ? "Await arrival" : "Prepare customs documents";
    case "arrived":
      return "Start customs clearance";
    case "customs":
      return customsStatus(s, state, documents) === "cleared" ? "Mark shipment delivered" : "Await customs clearance";
    case "delivered":
      return "No further action — shipment delivered";
  }
}

export interface Milestone {
  id: string;
  label: string;
  /** ISO timestamp when recorded, if it has happened. */
  at?: string;
  demo?: boolean;
}

/** Standard milestones with the recorded date of each, if reached. */
export function milestones(s: Shipment, documents: readonly TradeDocument[]): Milestone[] {
  const find = (pred: (e: ShipmentEvent) => boolean) => s.events.find(pred);
  const statusEvent = (status: ShipmentStatus) => find((e) => e.type === "status-changed" && e.status === status);
  // First document activity for this shipment, from the document layer.
  const docsStarted = documents
    .filter((d) => d.shipmentId === s.id)
    .flatMap((d) => d.events)
    .sort((a, b) => a.at.localeCompare(b.at))[0];
  const booked = find((e) => e.type === "booking-updated" && e.booking?.status === "booked");
  const customsStart = find((e) => e.type === "customs-updated" && e.customs !== "cleared");
  const customsCleared = find((e) => e.type === "customs-updated" && e.customs === "cleared");
  const pick = (e?: { at: string; demo?: boolean }) => (e ? { at: e.at, demo: e.demo } : {});
  return [
    { id: "created", label: "Shipment created", at: s.createdAt },
    { id: "docs", label: "Documents preparation started", ...pick(docsStarted) },
    { id: "booked", label: "Freight booked", ...pick(booked) },
    { id: "cargo-ready", label: "Cargo ready", ...pick(find((e) => e.type === "cargo-ready")) },
    { id: "ready", label: "Ready to ship", ...pick(statusEvent("ready-to-ship")) },
    { id: "handover", label: "Cargo handed to carrier", ...pick(statusEvent("at-origin")) },
    { id: "departed", label: "Departed origin", ...pick(statusEvent("in-transit")) },
    { id: "arrived", label: "Arrived at destination", ...pick(statusEvent("arrived")) },
    { id: "customs-started", label: "Customs started", ...pick(customsStart) },
    { id: "customs-cleared", label: "Customs cleared", ...pick(customsCleared) },
    { id: "delivered", label: "Delivered", ...pick(statusEvent("delivered")) },
  ];
}

const DAY = 86_400_000;
/** In transit with an ETA within 7 days of the demo snapshot date. */
export function isArrivingSoon(state: ShipmentState): boolean {
  if (state.status !== "in-transit") return false;
  const days = (Date.parse(`${state.schedule.eta}T00:00:00Z`) - Date.parse(MOCK_NOW.slice(0, 10) + "T00:00:00Z")) / DAY;
  return days <= 7;
}

/* ------------------------------------------------------------------------ */
/* Creation                                                                  */
/* ------------------------------------------------------------------------ */

export type ShipmentEligibility =
  | { ok: true }
  | { ok: false; reason: "not-found" | "cancelled" | "not-confirmed" | "shipment-exists" | "not-eligible-status"; shipment?: Shipment };

export function shipmentForOrder(orderId: string, shipments: readonly Shipment[]): Shipment | undefined {
  return shipments.find((s) => s.orderId === orderId);
}

export function shipmentEligibility(order: Order | undefined, shipments: readonly Shipment[]): ShipmentEligibility {
  if (!order) return { ok: false, reason: "not-found" };
  const existing = shipmentForOrder(order.id, shipments);
  if (existing) return { ok: false, reason: "shipment-exists", shipment: existing };
  const status = orderStatus(order);
  if (status === "cancelled") return { ok: false, reason: "cancelled" };
  if (!order.events.some((e) => e.type === "supplier-confirmed")) return { ok: false, reason: "not-confirmed" };
  if (status !== "confirmed" && status !== "pre-shipment") return { ok: false, reason: "not-eligible-status" };
  return { ok: true };
}

export function nextShipmentId(existing: readonly Shipment[], year: number): string {
  const max = existing.reduce((m, s) => Math.max(m, Number(s.id.split("-")[2]) || 0), 0);
  return `SHP-${year}-${String(max + 1).padStart(4, "0")}`;
}

export function freightArrangedBy(incoterm: Incoterm): FreightBooking["arrangedBy"] {
  return ["EXW", "FCA", "FOB"].includes(incoterm) ? "importer" : "supplier";
}

/* ------------------------------------------------------------------------ */
/* Mock data                                                                 */
/* ------------------------------------------------------------------------ */

export const MOCK_SHIPMENTS: readonly Shipment[] = [
  // Historical: delivered (order ORD-2026-0001 is completed).
  {
    id: "SHP-2026-0001",
    orderId: "ORD-2026-0001",
    requirementId: "RFQ-2026-0038",
    supplierId: "sup-blacksea",
    createdAt: "2026-06-22T06:00:00Z",
    route: { mode: "sea", origin: "Odesa, Ukraine", portOfLoading: "Odesa", portOfDischarge: "Nhava Sheva", finalDelivery: "JNPT Warehouse 7, Nhava Sheva, India", transshipmentAllowed: true },
    cargo: { product: "Refined Sunflower Oil", quantity: { amount: 100, unit: "MT" }, packages: 5, packageType: "Containers", grossWeight: 101_500, netWeight: 100_000, weightUnit: "kg", packagingDescription: "Flexitanks in 5 × 20 ft containers" },
    schedule: { readyDate: "2026-06-30", etd: "2026-07-04", eta: "2026-08-12" },
    parties: { freightForwarder: "Supplier-nominated", customsBroker: "Harbourline Customs Services (demo)", carrier: "Blue Anchor Lines (demo)" },
    incoterm: "CFR",
    hsCode: "1512.19",
    booking: { status: "not-started", arrangedBy: "supplier" },
    events: [
      { id: "e1", type: "created", by: "importer", at: "2026-06-22T06:00:00Z" },
      { id: "e3", type: "booking-updated", by: "supplier", at: "2026-06-25T09:00:00Z", booking: { status: "booked", reference: "BAL-ODS-24117" } },
      { id: "e8", type: "cargo-ready", by: "supplier", at: "2026-06-30T12:00:00Z" },
      { id: "e9", type: "status-changed", by: "importer", at: "2026-07-01T06:00:00Z", status: "ready-to-ship" },
      { id: "e10", type: "status-changed", by: "carrier", at: "2026-07-03T09:00:00Z", status: "at-origin" },
      { id: "e11", type: "status-changed", by: "carrier", at: "2026-07-05T04:00:00Z", status: "in-transit", note: "Departed Odesa." },
      { id: "e13", type: "schedule-updated", by: "carrier", at: "2026-07-20T06:00:00Z", schedule: { eta: "2026-08-18" }, note: "ETA revised after transshipment delay." },
      { id: "e14", type: "status-changed", by: "carrier", at: "2026-08-18T10:00:00Z", status: "arrived" },
      { id: "e15", type: "status-changed", by: "customs-broker", at: "2026-08-19T05:00:00Z", status: "customs" },
      { id: "e16", type: "customs-updated", by: "customs-broker", at: "2026-08-19T05:00:00Z", customs: "filed" },
      { id: "e17", type: "customs-updated", by: "customs-broker", at: "2026-08-24T11:00:00Z", customs: "cleared" },
      { id: "e18", type: "status-changed", by: "importer", at: "2026-08-27T09:00:00Z", status: "delivered", note: "Received at JNPT Warehouse 7." },
    ],
  },
  // In transit, arriving soon (order ORD-2026-0002 is in pre-shipment).
  {
    id: "SHP-2026-0002",
    orderId: "ORD-2026-0002",
    requirementId: "RFQ-2026-0039",
    supplierId: "sup-punjab",
    createdAt: "2026-09-20T06:30:00Z",
    route: { mode: "sea", origin: "Amritsar, India", portOfLoading: "Mundra", portOfDischarge: "Jebel Ali", finalDelivery: "Jebel Ali Free Zone, Dubai, UAE", transshipmentAllowed: false },
    cargo: { product: "Basmati Rice", quantity: { amount: 250, unit: "MT" }, packages: 10_000, packageType: "Bags", grossWeight: 251_200, netWeight: 250_000, weightUnit: "kg", volumeCbm: 340, packagingDescription: "25 kg PP bags in 10 × 20 ft containers" },
    schedule: { readyDate: "2026-09-28", etd: "2026-10-02", eta: "2026-10-08" },
    parties: { freightForwarder: "Gulfway Logistics (demo)", customsBroker: "Al Marsa Clearing (demo)", carrier: "Blue Anchor Lines (demo)" },
    incoterm: "FOB",
    hsCode: "1006.30",
    booking: { status: "rfq-needed", arrangedBy: "importer" },
    events: [
      { id: "e1", type: "created", by: "importer", at: "2026-09-20T06:30:00Z" },
      { id: "e2", type: "booking-updated", by: "importer", at: "2026-09-23T08:00:00Z", booking: { status: "booked", reference: "GWL-MUN-0931" }, note: "Booked through Gulfway Logistics (demo)." },
      { id: "e8", type: "cargo-ready", by: "supplier", at: "2026-09-28T09:00:00Z" },
      { id: "e9", type: "status-changed", by: "importer", at: "2026-09-29T05:00:00Z", status: "ready-to-ship" },
      { id: "e10", type: "status-changed", by: "carrier", at: "2026-10-01T12:00:00Z", status: "at-origin" },
      { id: "e12", type: "status-changed", by: "carrier", at: "2026-10-03T03:00:00Z", status: "in-transit", note: "Departed Mundra." },
      { id: "e14", type: "schedule-updated", by: "carrier", at: "2026-10-04T06:00:00Z", schedule: { etd: "2026-10-03", eta: "2026-10-09" }, note: "Departed a day late; ETA revised." },
    ],
  },
  // Preparing: documents and freight still outstanding (order ORD-2026-0003 is confirmed).
  {
    id: "SHP-2026-0003",
    orderId: "ORD-2026-0003",
    requirementId: "RFQ-2026-0040",
    supplierId: "sup-coimbatore",
    createdAt: "2026-10-01T05:00:00Z",
    route: { mode: "sea", origin: "Coimbatore, India", portOfLoading: "Chennai", portOfDischarge: "Chittagong", finalDelivery: "Chattogram EPZ, Chittagong, Bangladesh", transshipmentAllowed: true },
    cargo: { product: "Compact Cotton Yarn", quantity: { amount: 20_000, unit: "KG" }, packages: 40, packageType: "Pallets", grossWeight: 21_400, netWeight: 20_000, weightUnit: "kg", volumeCbm: 58, packagingDescription: "Cartons on 40 pallets, 1 × 40 ft container" },
    schedule: { readyDate: "2026-10-14", etd: "2026-10-18", eta: "2026-10-27" },
    parties: {},
    incoterm: "CFR",
    hsCode: "5205.26",
    booking: { status: "not-started", arrangedBy: "supplier" },
    events: [
      { id: "e1", type: "created", by: "importer", at: "2026-10-01T05:00:00Z" },
      { id: "e4", type: "booking-updated", by: "supplier", at: "2026-10-05T06:00:00Z", booking: { status: "awaiting-confirmation" }, note: "Supplier requested space with their carrier." },
    ],
  },
];
