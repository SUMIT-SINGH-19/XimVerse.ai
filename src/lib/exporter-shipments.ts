/*
 * Shipments: the cargo movements that execute an order.
 *
 *   Order ("what must be executed") → Shipment ("which cargo movement executes part or all of it")
 *
 * One order → many shipments. Each shipment allocates a fixed quantity of the
 * order at creation; allocated / shipped / delivered quantities are derived
 * from shipment records (see allocationsForOrder), and the order's ordered
 * quantity and commercial terms are never touched.
 *
 * Aligned with the importer's shipment model (src/lib/importer-shipments.ts):
 * SHP-YYYY-NNNN ids, the same TransportMode vocabulary, route / cargo naming,
 * and state derived by replaying an append-only event list. Seeded exporter
 * shipments use SHP-2026-81xx and browser-created ones 9001+, clear of the
 * importer's SHP-2026-000x. Unlike the importer (one shipment per order),
 * nothing here assumes a single shipment.
 *
 * Documents: order-level documents (invoice, packing list, certificates) stay
 * on the order and are read live from its state; the shipment owns only
 * shipment records — shipping instructions, shipping bill / LEO, BL / AWB and
 * container details.
 *
 * Demo only: every freight, customs and carrier state here is recorded by
 * hand in this demo. Nothing is filed on ICEGATE, booked with a carrier or
 * issued by customs.
 */

import type { TransportMode } from "./importer-shipments";
import type { Incoterm, QuantityUnit } from "./import-requirements";
import { COMPANY_INFORMATION, EXPORTER_COMPANY_ID } from "./exporter-company";
import { findOpportunity, UNIT_SHORT } from "./exporter-opportunities";
import { DEMO_TODAY, daysBetween } from "./exporter-quotations";
import type { CounterpartyAccess } from "./exporter-deals";
import {
  orderState,
  SEEDED_ORDERS,
  type ExporterOrder,
  type OrderDocument,
  type OrderState,
  type ShipmentAllocation,
} from "./exporter-orders";

export type { TransportMode };

// Local formatter (importing exporter-dashboard here would create an import cycle).
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const shortDate = (iso: string) => dateFormat.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

// ---------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------

export const TRANSPORT_MODE_LABEL: Record<TransportMode, string> = {
  sea: "Sea",
  air: "Air",
  road: "Road",
  rail: "Rail",
  multimodal: "Multimodal",
};

export type ShipmentType = "FCL" | "LCL";

export const CONTAINER_TYPES = [
  { id: "20GP", label: "20GP — 20 ft dry" },
  { id: "40GP", label: "40GP — 40 ft dry" },
  { id: "40HC", label: "40HC — 40 ft high cube" },
  { id: "20RF", label: "20RF — 20 ft reefer" },
  { id: "40RF", label: "40RF — 40 ft reefer" },
] as const;
export type ContainerType = (typeof CONTAINER_TYPES)[number]["id"];

/** Shipping bill workflow (demo states — no ICEGATE connection). */
export const SHIPPING_BILL_STEPS = [
  { id: "not-started", label: "Not Started" },
  { id: "data-preparing", label: "Data Preparing" },
  { id: "cha-review", label: "Ready for CHA Review" },
  { id: "ready-for-filing", label: "Ready for Filing" },
  { id: "filed", label: "Filed" },
  { id: "acknowledged", label: "Acknowledged" },
  { id: "leo-received", label: "LEO Received" },
] as const;
export type ShippingBillStatus = (typeof SHIPPING_BILL_STEPS)[number]["id"];

/** Customs state after filing (demo). LEO sets it to cleared. */
export type CustomsQueryStatus = "no-query" | "query-received" | "response-preparing" | "examination" | "cleared";

export const CUSTOMS_QUERY_LABEL: Record<CustomsQueryStatus, string> = {
  "no-query": "No Query",
  "query-received": "Query Received",
  "response-preparing": "Response Preparing",
  examination: "Examination Ordered",
  cleared: "Cleared",
};

/** Customs states that hold back LEO. */
export const OPEN_CUSTOMS_STATES: readonly CustomsQueryStatus[] = ["query-received", "response-preparing", "examination"];

/** BL / AWB lifecycle (demo — nothing is issued by a carrier here). */
export const TRANSPORT_DOCUMENT_STEPS = [
  { id: "not-available", label: "Not Available" },
  { id: "draft-received", label: "Draft Received" },
  { id: "under-review", label: "Under Review" },
  { id: "approved", label: "Approved" },
  { id: "final-issued", label: "Final Issued" },
] as const;
export type TransportDocumentStatus = (typeof TRANSPORT_DOCUMENT_STEPS)[number]["id"];

export function transportDocumentName(mode: TransportMode): string {
  return mode === "air" ? "Air Waybill" : mode === "sea" ? "Bill of Lading" : mode === "road" ? "CMR Consignment Note" : mode === "rail" ? "Rail Consignment Note" : "Multimodal Transport Document";
}

export type InstructionsStatus = "not-started" | "draft" | "ready";

export const INSTRUCTIONS_STATUS_LABEL: Record<InstructionsStatus, string> = {
  "not-started": "Not Started",
  draft: "Draft",
  ready: "Ready",
};

/** Physical milestones recorded at origin and on the move. */
export const PHYSICAL_MILESTONES = [
  { id: "stuffed", label: "Stuffing" },
  { id: "gate-in", label: "Gate-In" },
  { id: "loaded", label: "Loaded" },
  { id: "departed", label: "Departed" },
  { id: "arrived", label: "Arrived" },
  { id: "clearance", label: "Destination Clearance" },
  { id: "delivered", label: "Delivered" },
] as const;
export type PhysicalMilestone = (typeof PHYSICAL_MILESTONES)[number]["id"];

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/** Importer ShipmentRoute naming, plus FCL / LCL. */
export interface ShipmentRoute {
  mode: TransportMode;
  shipmentType?: ShipmentType;
  origin: string;
  portOfLoading: string;
  portOfDischarge: string;
  finalDelivery: string;
}

export interface CargoDetails {
  packages?: number;
  packageType?: string;
  netWeightKg?: number;
  grossWeightKg?: number;
  marks?: string;
  packagingDescription?: string;
}

export interface ContainerDetails {
  type?: ContainerType;
  count?: number;
  /** Comma-separated container numbers. */
  numbers?: string;
  /** Comma-separated seal numbers. */
  seals?: string;
}

/** Vessel or flight, and the forwarder's / carrier's tracking reference (demo — no tracking API). */
export interface VesselDetails {
  /** Vessel name, or flight number for air. */
  name: string;
  voyage: string;
  trackingReference: string;
}

/** Shipment-specific shipping instructions. Consignee / notify come from Ximverse. */
export interface ShippingInstructions {
  productDescription?: string;
  blInstructions?: string;
  specialInstructions?: string;
}

export type ShipmentEventType =
  | "created"
  | "forwarder-assigned"
  | "carrier-assigned"
  | "booking-added"
  | "schedule-updated"
  | "cargo-updated"
  | "container-updated"
  | "vessel-updated"
  | "instructions-updated"
  | "instructions-ready"
  | "cha-assigned"
  | "dossier-shared"
  | "shipping-bill-updated"
  | "customs-updated"
  | "transport-document-updated"
  | "milestone"
  | "cancelled";

export interface ShipmentEvent {
  id: string;
  type: ShipmentEventType;
  by: "supplier" | "freight-forwarder" | "carrier" | "customs-broker" | "system";
  /** ISO timestamp. */
  at: string;
  /** Every shipment event in this demo is hand-recorded — no external system. */
  demo?: boolean;
  note?: string;
  /** Forwarder, carrier or CHA name. */
  party?: string;
  bookingReference?: string;
  schedule?: { etd?: string; eta?: string };
  cargo?: Partial<CargoDetails>;
  container?: Partial<ContainerDetails>;
  vessel?: Partial<VesselDetails>;
  instructions?: Partial<ShippingInstructions>;
  shippingBill?: ShippingBillStatus;
  customs?: CustomsQueryStatus;
  transportDocument?: TransportDocumentStatus;
  milestone?: PhysicalMilestone;
}

export interface ExporterShipment {
  /** SHP-YYYY-NNNN */
  id: string;
  orderId: string;
  dealId: string;
  requirementId: string;
  opportunityId: string;
  quotationId: string;
  negotiationId?: string;
  exporterCompanyId: string;
  /** ISO timestamp. */
  createdAt: string;
  /** This shipment's share of the order. Fixed at creation. */
  allocation: { quantity: number; unit: QuantityUnit };
  route: ShipmentRoute;
  /** Cargo details as at creation; updates are events. */
  cargo: CargoDetails;
  /** Idempotency key from the setup form — one setup produces one shipment. */
  setupKey?: string;
  events: readonly ShipmentEvent[];
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

export type ShipmentStatus =
  | "preparing"
  | "freight-setup"
  | "customs-preparation"
  | "ready-to-ship"
  | "at-origin"
  | "loaded"
  | "in-transit"
  | "arrived"
  | "destination-clearance"
  | "delivered"
  | "cancelled";

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  preparing: "Preparing",
  "freight-setup": "Freight Setup",
  "customs-preparation": "Customs Preparation",
  "ready-to-ship": "Ready to Ship",
  "at-origin": "At Origin",
  loaded: "Loaded",
  "in-transit": "In Transit",
  arrived: "Arrived",
  "destination-clearance": "Destination Clearance",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** The importer ShipmentStatus for the same moment (documentation only). */
export const IMPORTER_SHIPMENT_STATUS_EQUIVALENT: Record<ShipmentStatus, string> = {
  preparing: "preparing",
  "freight-setup": "preparing",
  "customs-preparation": "preparing",
  "ready-to-ship": "ready-to-ship",
  "at-origin": "at-origin",
  loaded: "at-origin",
  "in-transit": "in-transit",
  arrived: "arrived",
  "destination-clearance": "customs",
  delivered: "delivered",
  cancelled: "preparing",
};

const PRE_DEPARTURE: readonly ShipmentStatus[] = ["preparing", "freight-setup", "customs-preparation", "ready-to-ship", "at-origin", "loaded"];

export function isPreDeparture(status: ShipmentStatus): boolean {
  return PRE_DEPARTURE.includes(status);
}

export function isActiveShipment(status: ShipmentStatus): boolean {
  return status !== "delivered" && status !== "cancelled";
}

export interface ShipmentState {
  status: ShipmentStatus;
  forwarder?: string;
  carrier?: string;
  cha?: string;
  dossierShared: boolean;
  bookingReference?: string;
  schedule: { etd?: string; eta?: string; atd?: string; ata?: string };
  cargo: CargoDetails;
  container: ContainerDetails;
  vessel: Partial<VesselDetails>;
  instructions: ShippingInstructions;
  instructionsStatus: InstructionsStatus;
  shippingBill: ShippingBillStatus;
  /** When each shipping-bill step was reached. */
  shippingBillAt: Partial<Record<ShippingBillStatus, string>>;
  customs: CustomsQueryStatus;
  transportDocument: TransportDocumentStatus;
  /** When each physical milestone happened. */
  milestones: Partial<Record<PhysicalMilestone, string>>;
  /** When key setup events happened (first occurrence). */
  firstAt: Partial<Record<"forwarder" | "carrier" | "booking" | "container", string>>;
  updatedAt: string;
}

export function usesContainers(route: ShipmentRoute): boolean {
  return (route.mode === "sea" || route.mode === "multimodal") && route.shipmentType === "FCL";
}

export function shippingBillIndex(s: ShippingBillStatus): number {
  return SHIPPING_BILL_STEPS.findIndex((x) => x.id === s);
}

export function transportDocumentIndex(s: TransportDocumentStatus): number {
  return TRANSPORT_DOCUMENT_STEPS.findIndex((x) => x.id === s);
}

/** Replays a shipment's events, in order, over its base. */
export function shipmentState(sh: ExporterShipment): ShipmentState {
  const st: ShipmentState = {
    status: "preparing",
    dossierShared: false,
    schedule: {},
    cargo: { ...sh.cargo },
    container: {},
    vessel: {},
    instructions: {},
    instructionsStatus: "not-started",
    shippingBill: "not-started",
    shippingBillAt: {},
    customs: "no-query",
    transportDocument: "not-available",
    milestones: {},
    firstAt: {},
    updatedAt: sh.createdAt,
  };
  let cancelled = false;
  for (const e of sh.events) {
    if (e.at > st.updatedAt) st.updatedAt = e.at;
    switch (e.type) {
      case "forwarder-assigned":
        st.forwarder = e.party;
        st.firstAt.forwarder ??= e.at;
        break;
      case "carrier-assigned":
        st.carrier = e.party;
        st.firstAt.carrier ??= e.at;
        break;
      case "booking-added":
        st.bookingReference = e.bookingReference;
        st.firstAt.booking ??= e.at;
        break;
      case "schedule-updated":
        st.schedule = { ...st.schedule, ...e.schedule };
        break;
      case "cargo-updated":
        st.cargo = { ...st.cargo, ...e.cargo };
        break;
      case "container-updated":
        st.container = { ...st.container, ...e.container };
        if (st.container.numbers) st.firstAt.container ??= e.at;
        break;
      case "vessel-updated":
        st.vessel = { ...st.vessel, ...e.vessel };
        break;
      case "instructions-updated":
        st.instructions = { ...st.instructions, ...e.instructions };
        // Editing after "ready" sends instructions back to draft.
        st.instructionsStatus = "draft";
        break;
      case "instructions-ready":
        st.instructionsStatus = "ready";
        break;
      case "cha-assigned":
        st.cha = e.party;
        break;
      case "dossier-shared":
        st.dossierShared = true;
        break;
      case "shipping-bill-updated":
        if (e.shippingBill) {
          st.shippingBill = e.shippingBill;
          st.shippingBillAt[e.shippingBill] ??= e.at;
          if (e.shippingBill === "leo-received") st.customs = "cleared";
        }
        break;
      case "customs-updated":
        if (e.customs) st.customs = e.customs;
        break;
      case "transport-document-updated":
        if (e.transportDocument) st.transportDocument = e.transportDocument;
        break;
      case "milestone":
        if (e.milestone) st.milestones[e.milestone] ??= e.at;
        break;
      case "cancelled":
        cancelled = true;
        break;
    }
  }
  st.schedule.atd = st.milestones.departed?.slice(0, 10);
  st.schedule.ata = st.milestones.arrived?.slice(0, 10);

  // Physical milestones decide once they happen. Before that, the status is
  // the earliest phase not yet complete: cargo → freight → export clearance.
  const m = st.milestones;
  st.status = cancelled
    ? "cancelled"
    : m.delivered
      ? "delivered"
      : m.clearance
        ? "destination-clearance"
        : m.arrived
          ? "arrived"
          : m.departed
            ? "in-transit"
            : m.loaded
              ? "loaded"
              : m["gate-in"] || m.stuffed
                ? "at-origin"
                : !cargoComplete(st)
                  ? "preparing"
                  : !freightBooked(st)
                    ? "freight-setup"
                    : st.shippingBill === "leo-received" && st.instructionsStatus === "ready"
                      ? "ready-to-ship"
                      : "customs-preparation";
  return st;
}

/** Forwarder, booking and ETD in place — freight setup is done. */
export function freightBooked(st: ShipmentState): boolean {
  return Boolean(st.forwarder && st.bookingReference && st.schedule.etd);
}

export type ShipmentPhase = "Setup" | "Export Clearance" | "Origin" | "Transit" | "Destination" | "Completed" | "Cancelled";

const PHASE: Record<ShipmentStatus, ShipmentPhase> = {
  preparing: "Setup",
  "freight-setup": "Setup",
  "customs-preparation": "Export Clearance",
  "ready-to-ship": "Origin",
  "at-origin": "Origin",
  loaded: "Origin",
  "in-transit": "Transit",
  arrived: "Destination",
  "destination-clearance": "Destination",
  delivered: "Completed",
  cancelled: "Cancelled",
};

/** Where the shipment is in its workflow, in a phrase. */
export function shipmentStage(sh: ExporterShipment, st: ShipmentState): { phase: ShipmentPhase; detail: string } {
  const phase = PHASE[st.status];
  const sbLabel = SHIPPING_BILL_STEPS[shippingBillIndex(st.shippingBill)].label;
  switch (st.status) {
    case "preparing":
      return { phase, detail: "Cargo details incomplete" };
    case "freight-setup":
      return { phase, detail: !st.forwarder ? "Forwarder not assigned" : !st.bookingReference ? "Booking pending" : "ETD not set" };
    case "customs-preparation":
      return { phase, detail: st.shippingBill === "leo-received" ? "Shipping Instructions pending" : `Shipping Bill: ${sbLabel} (demo)` };
    case "ready-to-ship":
      return { phase, detail: "LEO received (demo) · awaiting departure" };
    case "at-origin":
      return { phase, detail: st.milestones["gate-in"] ? "Gated in · awaiting loading" : "Stuffed · awaiting gate-in" };
    case "loaded":
      return { phase, detail: "Loaded · awaiting departure" };
    case "in-transit":
      return { phase, detail: `To ${sh.route.portOfDischarge}` };
    case "arrived":
      return { phase, detail: `At ${sh.route.portOfDischarge}` };
    case "destination-clearance":
      return { phase, detail: "Destination customs clearance" };
    case "delivered":
      return { phase, detail: st.milestones.delivered ? `Delivered ${shortDate(st.milestones.delivered)}` : "Delivered" };
    case "cancelled":
      return { phase, detail: "Cancelled" };
  }
}

// ---------------------------------------------------------------------------
// Allocation (one order → many shipments)
// ---------------------------------------------------------------------------

export function shipmentsForOrder(orderId: string, shipments: readonly ExporterShipment[]): ExporterShipment[] {
  return shipments.filter((s) => s.orderId === orderId);
}

/** The order's allocations, from its non-cancelled shipments. */
export function allocationsForOrder(orderId: string, shipments: readonly ExporterShipment[]): ShipmentAllocation[] {
  return shipmentsForOrder(orderId, shipments).flatMap((s) => {
    const st = shipmentState(s);
    if (st.status === "cancelled") return [];
    return [{ shipmentId: s.id, quantity: s.allocation.quantity, shipped: Boolean(st.milestones.departed), delivered: Boolean(st.milestones.delivered) }];
  });
}

/** Order state with its shipment allocations applied. */
export function orderStateWithShipments(order: ExporterOrder, shipments: readonly ExporterShipment[]): OrderState {
  return orderState(order, allocationsForOrder(order.id, shipments));
}

export interface ShipmentEligibility {
  ok: boolean;
  /** Produced, unallocated quantity — the most a new shipment can take. */
  available: number;
  blockers: string[];
  /** Not required to create a shipment, but outstanding. */
  warnings: string[];
}

export function shipmentEligibility(order: ExporterOrder, os: OrderState): ShipmentEligibility {
  const unit = UNIT_SHORT[order.terms.quantity.unit];
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (os.status === "cancelled") blockers.push("Order is cancelled");
  if (os.status === "completed") blockers.push("Order is completed");
  if (!os.confirmed) blockers.push("Confirm the order first");
  if (os.production.produced <= 0) blockers.push("No produced quantity yet");
  if (!os.production.actualCargoReady && !os.production.expectedCargoReady) blockers.push("Set a cargo-ready date on the order");
  if (os.production.produced > 0 && os.quantities.available <= 0) {
    blockers.push(os.quantities.allocated >= os.quantities.ordered ? "Order is fully allocated" : "All produced cargo is already allocated");
  }
  if (os.production.status === "in-progress") {
    warnings.push(`Production in progress — ${os.production.produced.toLocaleString("en-US")} of ${os.production.ordered.toLocaleString("en-US")} ${unit} produced`);
  }
  if (!os.paymentReady) warnings.push(`Payment not yet confirmed (${os.paymentStep.label})`);
  for (const d of os.documents.filter((x) => x.commitment === "arrangement-required" && (x.status === "not-started" || x.status === "blocked"))) {
    warnings.push(`${d.label.replace(/ Certificate$/, "")} not arranged`);
  }
  const certs = certificates(os.documents).filter((d) => !isReady(d) && d.commitment !== "arrangement-required");
  if (certs.length) warnings.push(`${certs.length} certificate${certs.length === 1 ? "" : "s"} not ready`);
  return { ok: blockers.length === 0, available: os.quantities.available, blockers, warnings };
}

export const LOCAL_SHIPMENT_ID = /^SHP-\d{4}-9\d{3,}$/;

export function nextShipmentId(local: readonly { id: string }[], year: number): string {
  const max = local.reduce((m, s) => Math.max(m, Number(s.id.split("-")[2]) || 0), 9000);
  return `SHP-${year}-${max + 1}`;
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export interface ReadinessItem {
  key: string;
  label: string;
  done: boolean;
  detail?: string;
  /** How SUMIT names the item when it's outstanding. */
  short?: string;
}

/** "a, b and c". */
const joinAnd = (items: readonly string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : (items[0] ?? ""));

const isReady = (d?: OrderDocument) => Boolean(d && (d.status === "ready" || d.status === "verified"));
const CERT_TYPES = new Set(["certificate-of-origin", "phytosanitary-certificate", "fumigation-certificate", "health-certificate", "inspection-certificate"]);
const certificates = (docs: readonly OrderDocument[]) => docs.filter((d) => CERT_TYPES.has(d.type) && d.status !== "not-required");

export function cargoComplete(st: ShipmentState): boolean {
  return Boolean(st.cargo.packages && st.cargo.netWeightKg && st.cargo.grossWeightKg);
}

export function containerComplete(st: ShipmentState): boolean {
  return Boolean(st.container.type && st.container.count && st.container.numbers && st.container.seals);
}

/** Readiness for the export-clearance workflow. */
export function customsReadiness(sh: ExporterShipment, st: ShipmentState, os: OrderState): ReadinessItem[] {
  const doc = (type: string) => os.documents.find((d) => d.type === type);
  const certs = certificates(os.documents);
  const certsReady = certs.filter(isReady);
  const sb = shippingBillIndex(st.shippingBill);
  const items: ReadinessItem[] = [
    { key: "invoice", label: "Commercial Invoice ready", done: isReady(doc("commercial-invoice")), detail: "Order document", short: "the commercial invoice" },
    { key: "packing", label: "Packing List ready", done: isReady(doc("packing-list")), detail: "Order document", short: "the packing list" },
  ];
  if (certs.length) {
    const outstanding = certs.filter((c) => !isReady(c)).map((c) => c.label.replace(/ Certificate$/, ""));
    items.push({
      key: "certificates",
      label: "Required certificates ready",
      done: outstanding.length === 0,
      detail: `${certsReady.length} of ${certs.length} ready${outstanding.length ? ` — ${outstanding.join(", ")} outstanding` : ""}`,
      short: `${joinAnd(outstanding.map((c) => c.toLowerCase()))} preparation`,
    });
  }
  items.push({ key: "instructions", label: "Shipping Instructions ready", done: st.instructionsStatus === "ready", short: "Shipping Instructions" });
  items.push({ key: "cargo", label: "Cargo details complete", done: cargoComplete(st), detail: "Packages, net and gross weight", short: "cargo details" });
  if (usesContainers(sh.route)) items.push({ key: "container", label: "Container details complete", done: containerComplete(st), detail: "Type, count, container and seal numbers", short: "container details" });
  items.push({ key: "cha", label: "CHA assigned", done: Boolean(st.cha), detail: st.cha, short: "CHA assignment" });
  items.push({ key: "sb-data", label: "Shipping Bill data prepared", done: sb >= shippingBillIndex("cha-review"), short: "Shipping Bill data" });
  items.push({ key: "sb-filed", label: "Shipping Bill filed (demo)", done: sb >= shippingBillIndex("filed"), short: "Shipping Bill filing" });
  items.push({ key: "leo", label: "LEO received (demo)", done: st.shippingBill === "leo-received", short: "LEO" });
  return items;
}

/** Readiness to move the cargo: forwarder, carrier, booking and schedule. */
export function freightReadiness(sh: ExporterShipment, st: ShipmentState, os: OrderState): ReadinessItem[] {
  const items: ReadinessItem[] = [
    {
      key: "cargo-ready",
      label: "Cargo-ready date",
      done: Boolean(os.production.actualCargoReady || os.production.expectedCargoReady),
      detail: os.production.actualCargoReady ? `Ready ${shortDate(os.production.actualCargoReady)}` : os.production.expectedCargoReady ? `Expected ${shortDate(os.production.expectedCargoReady)}` : undefined,
    },
    { key: "forwarder", label: "Forwarder assigned", done: Boolean(st.forwarder), detail: st.forwarder, short: "a forwarder" },
    { key: "carrier", label: sh.route.mode === "air" ? "Airline assigned" : "Carrier assigned", done: Boolean(st.carrier), detail: st.carrier, short: sh.route.mode === "air" ? "an airline" : "a carrier" },
    { key: "booking", label: "Booking reference", done: Boolean(st.bookingReference), detail: st.bookingReference, short: "a booking reference" },
    { key: "ports", label: "Ports confirmed", done: Boolean(sh.route.portOfLoading && sh.route.portOfDischarge), detail: `${sh.route.portOfLoading} → ${sh.route.portOfDischarge}`, short: "ports" },
  ];
  if (usesContainers(sh.route)) items.push({ key: "container", label: "Container planned", done: Boolean(st.container.type && st.container.count), short: "a container plan" });
  items.push({ key: "etd", label: "ETD set", done: Boolean(st.schedule.etd), detail: st.schedule.etd ? shortDate(st.schedule.etd) : undefined, short: "an ETD" });
  items.push({ key: "instructions", label: "Shipping Instructions ready", done: st.instructionsStatus === "ready", short: "Shipping Instructions" });
  return items;
}

export function score(items: readonly ReadinessItem[]): number {
  return items.length ? Math.round((items.filter((i) => i.done).length / items.length) * 100) : 0;
}

// ---------------------------------------------------------------------------
// Milestones, actions, SUMIT
// ---------------------------------------------------------------------------

export interface MilestoneRow {
  key: string;
  label: string;
  /** ISO timestamp or date, only when it has happened. */
  at?: string;
  /** Planned date (cargo-ready, ETD, ETA) while it hasn't happened. */
  expected?: string;
  demo?: boolean;
}

export function shipmentMilestones(sh: ExporterShipment, st: ShipmentState, os: OrderState): MilestoneRow[] {
  const rows: MilestoneRow[] = [
    { key: "created", label: "Shipment created", at: sh.createdAt },
    { key: "cargo-ready", label: "Cargo ready", at: os.production.actualCargoReady, expected: os.production.expectedCargoReady },
    { key: "forwarder", label: "Forwarder assigned", at: st.firstAt.forwarder },
    { key: "booking", label: "Booking confirmed", at: st.firstAt.booking },
  ];
  if (usesContainers(sh.route)) rows.push({ key: "container", label: "Container assigned", at: st.firstAt.container });
  rows.push(
    { key: "stuffed", label: "Stuffing", at: st.milestones.stuffed },
    { key: "sb-prepared", label: "Shipping Bill prepared", at: st.shippingBillAt["ready-for-filing"], demo: true },
    { key: "sb-filed", label: "Customs filed", at: st.shippingBillAt.filed, demo: true },
    { key: "leo", label: "LEO received", at: st.shippingBillAt["leo-received"], demo: true },
    { key: "gate-in", label: "Gate-In", at: st.milestones["gate-in"] },
    { key: "loaded", label: "Loaded", at: st.milestones.loaded },
    { key: "departed", label: "Departed", at: st.milestones.departed, expected: st.schedule.etd },
    { key: "in-transit", label: "In Transit", at: st.milestones.departed },
    { key: "arrived", label: "Arrived", at: st.milestones.arrived, expected: st.schedule.eta },
    { key: "clearance", label: "Destination Clearance", at: st.milestones.clearance },
    { key: "delivered", label: "Delivered", at: st.milestones.delivered },
  );
  return rows;
}

/** Derived to-dos; each disappears once resolved. */
export function shipmentActions(sh: ExporterShipment, st: ShipmentState, os: OrderState): string[] {
  if (st.status === "cancelled" || st.status === "delivered") return [];
  const out: string[] = [];
  if (isPreDeparture(st.status)) {
    if (!st.forwarder) out.push("Forwarder not assigned");
    if (!st.carrier) out.push(sh.route.mode === "air" ? "Airline not assigned" : "Carrier not assigned");
    if (!st.bookingReference) out.push("Booking reference missing");
    if (!st.schedule.etd) out.push("ETD not set");
    if (!cargoComplete(st)) out.push("Cargo details incomplete");
    if (usesContainers(sh.route) && !containerComplete(st)) out.push("Container details missing");
    if (st.instructionsStatus !== "ready") out.push("Shipping Instructions incomplete");
    if (!st.cha) out.push("CHA not assigned");
    if (shippingBillIndex(st.shippingBill) < shippingBillIndex("cha-review")) out.push("Shipping Bill not prepared");
    const certs = certificates(os.documents).filter((d) => !isReady(d));
    if (certs.length) out.push(`${certs.length} required certificate${certs.length === 1 ? "" : "s"} incomplete`);
    const paper = ["commercial-invoice", "packing-list"].filter((t) => !isReady(os.documents.find((d) => d.type === t)));
    if (paper.length) out.push(`${paper.length === 2 ? "Commercial Invoice and Packing List" : paper[0] === "commercial-invoice" ? "Commercial Invoice" : "Packing List"} not ready`);
    if (!os.paymentReady) out.push(`Payment not confirmed on the order (${os.paymentStep.label})`);
    if (st.customs === "query-received" || st.customs === "response-preparing") out.push("Respond to customs query (demo)");
    if (st.customs === "examination") out.push("Customs examination pending (demo)");
    if (st.shippingBill === "filed" || st.shippingBill === "acknowledged") out.push("Awaiting LEO (demo)");
  } else if (st.status === "in-transit" && st.transportDocument !== "final-issued") {
    out.push(`${transportDocumentName(sh.route.mode)} final not issued`);
  } else if (st.status === "arrived" || st.status === "destination-clearance") {
    out.push("Confirm delivery");
  }
  return out;
}

export function nextAction(sh: ExporterShipment, st: ShipmentState, os: OrderState): string {
  const actions = shipmentActions(sh, st, os);
  if (actions.length) return actions[0];
  switch (st.status) {
    case "ready-to-ship":
      return usesContainers(sh.route) ? "Record stuffing or gate-in" : "Record gate-in";
    case "at-origin":
      return st.milestones["gate-in"] ? "Record loading" : "Record gate-in";
    case "loaded":
      return "Record departure";
    case "in-transit":
      return st.schedule.eta ? `Track arrival — ETA ${shortDate(st.schedule.eta)}` : "Track arrival";
    case "delivered":
      return "No further action — delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return "Continue setup";
  }
}

/** Rule-based statements the data supports. No AI. */
export function shipmentInsights(sh: ExporterShipment, st: ShipmentState, order: ExporterOrder, os: OrderState): string[] {
  const out: string[] = [];
  const unit = UNIT_SHORT[sh.allocation.unit];
  if (isPreDeparture(st.status)) {
    const customs = customsReadiness(sh, st, os);
    const remaining = customs.filter((i) => !i.done).map((i) => i.short ?? i.label);
    out.push(
      remaining.length
        ? `This shipment is ${score(customs)}% customs-ready. ${listPhrase(remaining)} remain${remaining.length === 1 ? "s" : ""}.`
        : "Every export-clearance item is complete (demo states).",
    );
  }
  if (os.quantities.available > 0) {
    out.push(`${os.quantities.available.toLocaleString("en-US")} ${unit} remains unallocated on order ${order.id}.`);
  } else if (os.quantities.allocated < os.quantities.ordered) {
    out.push(`${(os.quantities.ordered - os.quantities.allocated).toLocaleString("en-US")} ${unit} of order ${order.id} is not yet produced or allocated.`);
  }
  const ready = os.production.actualCargoReady ?? os.production.expectedCargoReady;
  if (ready && st.schedule.etd && isPreDeparture(st.status)) {
    const gap = daysBetween(ready, st.schedule.etd);
    out.push(
      gap >= 0
        ? `Cargo is ${os.production.actualCargoReady ? "ready" : "expected"} on ${shortDate(ready)} and ETD is ${shortDate(st.schedule.etd)}, leaving a ${gap}-day origin buffer.`
        : `ETD (${shortDate(st.schedule.etd)}) is ${-gap} day${gap === -1 ? "" : "s"} before the cargo-ready date — review the booking.`,
    );
  }
  if (st.status === "ready-to-ship" && st.schedule.etd) out.push(`LEO received (demo); awaiting departure on ${shortDate(st.schedule.etd)}.`);
  if (st.status === "in-transit" && st.schedule.eta) {
    const days = daysBetween(DEMO_TODAY, st.schedule.eta);
    out.push(days >= 0 ? `ETA ${shortDate(st.schedule.eta)} — ${days} day${days === 1 ? "" : "s"} from today.` : `ETA ${shortDate(st.schedule.eta)} has passed — confirm arrival.`);
  }
  const delivery = order.terms.estimatedDelivery;
  if (delivery && st.schedule.eta && st.status !== "delivered") {
    const slack = daysBetween(st.schedule.eta, delivery);
    out.push(slack >= 0 ? `ETA is ${slack} day${slack === 1 ? "" : "s"} before the agreed delivery date.` : `ETA is ${-slack} day${slack === -1 ? "" : "s"} after the agreed delivery date.`);
  }
  return out;
}

/** "a, b and 2 more" — first letter capitalised. */
function listPhrase(items: readonly string[]): string {
  const text = joinAnd(items.length > 3 ? [...items.slice(0, 2), `${items.length - 2} more`] : items);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Days until ETA when in transit; used for "arriving soon". */
export function isArrivingSoon(st: ShipmentState): boolean {
  if (st.status !== "in-transit" || !st.schedule.eta) return false;
  return daysBetween(DEMO_TODAY, st.schedule.eta) <= 7;
}

// ---------------------------------------------------------------------------
// Privacy and setup defaults
// ---------------------------------------------------------------------------

/** What shipping instructions show for consignee / notify party. */
export function counterpartyLine(access: CounterpartyAccess | undefined): string {
  return access === "approved" || access === "shared"
    ? "Provided to the forwarder by Ximverse (not stored in this demo)"
    : "Protected — Ximverse provides consignee details to the forwarder";
}

export const SHIPPER = `${COMPANY_INFORMATION.legalName}, ${COMPANY_INFORMATION.headOffice}`;

/** Freight terms on the BL follow the Incoterm. */
export function freightTerms(incoterm: Incoterm): string {
  return ["EXW", "FCA", "FOB"].includes(incoterm) ? "Freight Collect" : "Freight Prepaid";
}

/** Who arranges main carriage under the Incoterm. */
export function mainCarriageBy(incoterm: Incoterm): "exporter" | "buyer" {
  return ["EXW", "FCA", "FOB"].includes(incoterm) ? "buyer" : "exporter";
}

/** Prefill for a new shipment from the order (all editable except the allocation basis). */
export function setupDefaults(order: ExporterOrder, quantity: number): { route: ShipmentRoute; cargo: CargoDetails } {
  const t = order.terms;
  const opp = findOpportunity(order.requirementId);
  const destinationTerm = !["EXW", "FCA", "FOB"].includes(t.incoterm);
  const bag = t.packaging?.match(/(\d+(?:\.\d+)?)\s*kg/i);
  const kg = t.quantity.unit === "MT" ? quantity * 1000 : t.quantity.unit === "KG" ? quantity : undefined;
  return {
    route: {
      mode: "sea",
      shipmentType: "FCL",
      origin: COMPANY_INFORMATION.headOffice,
      portOfLoading: t.portOfLoading ?? "Mundra, India",
      portOfDischarge: destinationTerm ? t.namedPlace : (opp?.delivery.destinationLocation ?? t.namedPlace),
      finalDelivery: opp?.delivery.destinationLocation ?? t.namedPlace,
    },
    cargo: {
      packagingDescription: t.packaging,
      packageType: t.packaging && /bag/i.test(t.packaging) ? "Bags" : undefined,
      netWeightKg: kg,
      packages: bag && kg ? Math.round(kg / Number(bag[1])) : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Seeded shipments (demo), from seeded orders
// ---------------------------------------------------------------------------

type SeedEvent = Omit<ShipmentEvent, "id" | "demo" | "by"> & { by?: ShipmentEvent["by"] };

function seededShipment(
  id: string,
  orderId: string,
  quantity: number,
  createdAt: string,
  route: Partial<ShipmentRoute>,
  cargo: CargoDetails,
  events: SeedEvent[],
): ExporterShipment {
  const order = SEEDED_ORDERS.find((o) => o.id === orderId);
  if (!order) throw new Error(`Seed ${id}: unknown order ${orderId}`);
  const defaults = setupDefaults(order, quantity);
  return {
    id,
    orderId,
    dealId: order.dealId,
    requirementId: order.requirementId,
    opportunityId: order.opportunityId,
    quotationId: order.quotationId,
    negotiationId: order.negotiationId,
    exporterCompanyId: EXPORTER_COMPANY_ID,
    createdAt,
    allocation: { quantity, unit: order.terms.quantity.unit },
    route: { ...defaults.route, ...route },
    cargo: { ...defaults.cargo, ...cargo },
    events: [
      { id: `${id}-e0`, type: "created", by: "supplier", at: createdAt, demo: true },
      ...events.map((e, i) => ({ by: "supplier" as const, ...e, id: `${id}-e${i + 1}`, demo: true })),
    ],
  };
}

const t = (date: string, time = "06:00") => `${date}T${time}:00Z`;

const FORWARDER = "Coastline Forwarding (demo)";
const CHA = "Kandla Clearing Agency (demo)";

/** Full clearance and loading sequence, used by the departed seeds. */
function clearedAndLoaded(d: { prep: string; filed: string; leo: string; loaded: string; departed: string }, booking: string, containers: ContainerDetails, vessel: { name: string; voyage: string }): SeedEvent[] {
  return [
    { type: "forwarder-assigned", at: t(d.prep), party: FORWARDER },
    { type: "carrier-assigned", at: t(d.prep, "07:00"), party: "Gulf Demo Line" },
    { type: "booking-added", at: t(d.prep, "08:00"), bookingReference: booking, by: "freight-forwarder" },
    { type: "cha-assigned", at: t(d.prep, "09:00"), party: CHA },
    { type: "container-updated", at: t(d.prep, "10:00"), container: containers },
    { type: "vessel-updated", at: t(d.prep, "10:30"), vessel },
    { type: "instructions-updated", at: t(d.prep, "11:00"), instructions: { productDescription: "1121 Golden Sella Basmati Rice, HS 1006.30, in 25 kg PP bags", blInstructions: "Consigned to order of the LC issuing bank; notify as per LC." } },
    { type: "instructions-ready", at: t(d.prep, "11:30") },
    { type: "dossier-shared", at: t(d.prep, "12:00") },
    { type: "shipping-bill-updated", at: t(d.prep, "12:30"), shippingBill: "data-preparing" },
    { type: "shipping-bill-updated", at: t(d.prep, "13:00"), shippingBill: "cha-review", by: "customs-broker" },
    { type: "shipping-bill-updated", at: t(d.prep, "14:00"), shippingBill: "ready-for-filing", by: "customs-broker" },
    { type: "milestone", at: t(d.filed, "05:00"), milestone: "stuffed" },
    { type: "shipping-bill-updated", at: t(d.filed, "06:00"), shippingBill: "filed", by: "customs-broker" },
    { type: "milestone", at: t(d.filed, "08:00"), milestone: "gate-in" },
    { type: "shipping-bill-updated", at: t(d.filed, "10:00"), shippingBill: "acknowledged", by: "customs-broker" },
    { type: "transport-document-updated", at: t(d.filed, "11:00"), transportDocument: "draft-received", by: "carrier" },
    { type: "shipping-bill-updated", at: t(d.leo, "15:00"), shippingBill: "leo-received", by: "customs-broker" },
    { type: "transport-document-updated", at: t(d.leo, "16:00"), transportDocument: "approved" },
    { type: "milestone", at: t(d.loaded, "04:00"), milestone: "loaded", by: "carrier" },
    { type: "milestone", at: t(d.departed, "16:00"), milestone: "departed", by: "carrier" },
    { type: "transport-document-updated", at: t(d.departed, "18:00"), transportDocument: "final-issued", by: "carrier" },
  ];
}

const QATAR_CARGO = (qty: number): CargoDetails => ({ packages: qty * 40, packageType: "Bags", netWeightKg: qty * 1000, grossWeightKg: qty * 1000 + qty * 5, marks: "SAE/HMD/GS" });

export const SEEDED_SHIPMENTS: readonly ExporterShipment[] = [
  // A — Preparing: forwarder and ETD set; no booking, customs not started. Partial (60 of 100 MT).
  seededShipment("SHP-2026-8101", "ORD-2026-8101", 60, t("2026-10-06", "09:00"), { portOfDischarge: "Jebel Ali, UAE" }, { packages: 2400, packageType: "Bags", netWeightKg: 60_000 }, [
    { type: "forwarder-assigned", at: t("2026-10-06", "10:00"), party: FORWARDER },
    { type: "schedule-updated", at: t("2026-10-06", "11:00"), schedule: { etd: "2026-10-13", eta: "2026-10-19" } },
  ]),
  // D — Delivered: the first 50 MT of the Qatar order.
  seededShipment("SHP-2026-8102", "ORD-2026-8102", 50, t("2026-09-23", "10:00"), {}, QATAR_CARGO(50), [
    { type: "schedule-updated", at: t("2026-09-23", "11:00"), schedule: { etd: "2026-09-26", eta: "2026-10-01" } },
    ...clearedAndLoaded({ prep: "2026-09-24", filed: "2026-09-25", leo: "2026-09-25", loaded: "2026-09-26", departed: "2026-09-26" }, "DEMO-BKG-24117", { type: "20GP", count: 2, numbers: "DMOU 2041178, DMOU 2041183", seals: "SL 77120, SL 77121" }, { name: "Demo Voyager", voyage: "026W" }),
    { type: "milestone", at: t("2026-10-01", "09:00"), milestone: "arrived", by: "carrier" },
    { type: "milestone", at: t("2026-10-03", "12:00"), milestone: "delivered" },
  ]),
  // C — In transit: second 50 MT, final BL issued, ETA in two days.
  seededShipment("SHP-2026-8103", "ORD-2026-8102", 50, t("2026-09-29", "10:00"), {}, QATAR_CARGO(50), [
    { type: "schedule-updated", at: t("2026-09-29", "11:00"), schedule: { etd: "2026-10-03", eta: "2026-10-09" } },
    ...clearedAndLoaded({ prep: "2026-09-30", filed: "2026-10-01", leo: "2026-10-02", loaded: "2026-10-03", departed: "2026-10-03" }, "DEMO-BKG-24166", { type: "20GP", count: 2, numbers: "DMOU 2041290, DMOU 2041306", seals: "SL 77188, SL 77189" }, { name: "Demo Meridian", voyage: "031W" }),
  ]),
  // B — Ready to ship: final 50 MT, LEO received, awaiting departure.
  seededShipment("SHP-2026-8104", "ORD-2026-8102", 50, t("2026-10-03", "10:00"), {}, QATAR_CARGO(50), [
    { type: "forwarder-assigned", at: t("2026-10-03", "11:00"), party: FORWARDER },
    { type: "carrier-assigned", at: t("2026-10-03", "11:30"), party: "Gulf Demo Line" },
    { type: "booking-added", at: t("2026-10-03", "12:00"), bookingReference: "DEMO-BKG-24205", by: "freight-forwarder" },
    { type: "schedule-updated", at: t("2026-10-03", "12:30"), schedule: { etd: "2026-10-09", eta: "2026-10-14" } },
    { type: "cha-assigned", at: t("2026-10-04"), party: CHA },
    { type: "container-updated", at: t("2026-10-04", "07:00"), container: { type: "20GP", count: 2, numbers: "DMOU 2041377, DMOU 2041382", seals: "SL 77230, SL 77231" } },
    { type: "vessel-updated", at: t("2026-10-04", "07:30"), vessel: { name: "Demo Horizon", voyage: "034W" } },
    { type: "instructions-updated", at: t("2026-10-04", "08:00"), instructions: { productDescription: "1121 Golden Sella Basmati Rice, HS 1006.30, in 25 kg PP bags", blInstructions: "Consigned to order of the LC issuing bank; notify as per LC." } },
    { type: "instructions-ready", at: t("2026-10-04", "08:30") },
    { type: "dossier-shared", at: t("2026-10-04", "09:00") },
    { type: "shipping-bill-updated", at: t("2026-10-04", "10:00"), shippingBill: "data-preparing" },
    { type: "shipping-bill-updated", at: t("2026-10-04", "12:00"), shippingBill: "cha-review", by: "customs-broker" },
    { type: "shipping-bill-updated", at: t("2026-10-05"), shippingBill: "ready-for-filing", by: "customs-broker" },
    { type: "shipping-bill-updated", at: t("2026-10-05", "09:00"), shippingBill: "filed", by: "customs-broker" },
    { type: "shipping-bill-updated", at: t("2026-10-05", "14:00"), shippingBill: "acknowledged", by: "customs-broker" },
    { type: "transport-document-updated", at: t("2026-10-06"), transportDocument: "draft-received", by: "carrier" },
    { type: "shipping-bill-updated", at: t("2026-10-06", "09:00"), shippingBill: "leo-received", by: "customs-broker" },
  ]),
];

export const SEEDED_SHIPMENT_IDS = SEEDED_SHIPMENTS.map((s) => s.id);

export function findSeededShipment(id: string): ExporterShipment | undefined {
  return SEEDED_SHIPMENTS.find((s) => s.id === id);
}
