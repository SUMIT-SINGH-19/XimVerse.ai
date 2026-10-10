"use client";

/*
 * Shipments created in this browser, and events appended to any shipment.
 *
 *   ximverse:exporter:shipments  { v: 1, created: ExporterShipment[], appended: { [shipmentId]: ShipmentEvent[] } }
 *
 * Seeded shipments are combined at read time, never copied in. Creation
 * re-checks the allocation against current data at write time and is
 * idempotent per setup form (setupKey), so double clicks or two tabs can't
 * over-allocate an order. Every action appends one event — nothing earlier is
 * rewritten — and all of them are demo records.
 */

import { useMemo, useSyncExternalStore } from "react";
import { EXPORTER_COMPANY_ID } from "./exporter-company";
import { negotiationNow } from "./exporter-negotiations";
import { loadOrders } from "./exporter-order-store";
import type { ExporterOrder } from "./exporter-orders";
import {
  cargoComplete,
  containerComplete,
  nextShipmentId,
  orderStateWithShipments,
  SEEDED_SHIPMENTS,
  shipmentEligibility,
  shipmentState,
  SHIPPING_BILL_STEPS,
  shippingBillIndex,
  TRANSPORT_DOCUMENT_STEPS,
  transportDocumentIndex,
  usesContainers,
  type CargoDetails,
  type ContainerDetails,
  type CustomsQueryStatus,
  type ExporterShipment,
  type PhysicalMilestone,
  type ShipmentEvent,
  type ShipmentRoute,
  type ShippingInstructions,
} from "./exporter-shipments";

export const SHIPMENTS_KEY = "ximverse:exporter:shipments";
const CHANGE_EVENT = "ximverse:exporter:shipments-change";

interface StoredState {
  v: 1;
  created: ExporterShipment[];
  appended: Record<string, ShipmentEvent[]>;
}

const EMPTY: StoredState = { v: 1, created: [], appended: {} };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(SHIPMENTS_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): StoredState {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw);
    return data && data.v === 1 ? { ...EMPTY, ...data } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function commit(next: StoredState): boolean {
  try {
    window.localStorage.setItem(SHIPMENTS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function combine(s: StoredState): ExporterShipment[] {
  const seededIds = new Set(SEEDED_SHIPMENTS.map((x) => x.id));
  return [...SEEDED_SHIPMENTS, ...s.created.filter((x) => !seededIds.has(x.id))].map((x) => ({
    ...x,
    events: [...x.events, ...(s.appended[x.id] ?? [])],
  }));
}

/** All shipments, live. Server render and hydration see the seeds only. */
export function useExporterShipments(): ExporterShipment[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => combine(parse(raw)), [raw]);
}

export type ActionResult = { ok: true; id?: string } | { ok: false; reason: string };

const fail = (reason: string): ActionResult => ({ ok: false, reason });

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export interface ShipmentSetup {
  quantity: number;
  route: ShipmentRoute;
  cargo: CargoDetails;
  /** One setup form → at most one shipment. */
  setupKey: string;
}

export function createShipment(order: ExporterOrder, setup: ShipmentSetup): ActionResult {
  const s = parse(readRaw());
  const all = combine(s);
  const repeat = all.find((x) => x.setupKey === setup.setupKey);
  if (repeat) return { ok: true, id: repeat.id };

  // Re-validate against what's stored now, not what the form saw.
  const os = orderStateWithShipments(order, all);
  const eligibility = shipmentEligibility(order, os);
  if (!eligibility.ok) return fail(eligibility.blockers[0] ?? "Order isn't eligible for a shipment");
  const q = setup.quantity;
  if (!(q > 0)) return fail("Enter a quantity greater than 0");
  if (q > eligibility.available) return fail(`Only ${eligibility.available} ${order.terms.quantity.unit} is available to allocate`);
  if (os.quantities.allocated + q > os.quantities.ordered) return fail("Allocation would exceed the ordered quantity");
  if (!setup.route.portOfLoading.trim() || !setup.route.portOfDischarge.trim()) return fail("Enter the ports of loading and discharge");

  const now = negotiationNow();
  const id = nextShipmentId(s.created, Number(now.slice(0, 4)));
  const shipment: ExporterShipment = {
    id,
    orderId: order.id,
    dealId: order.dealId,
    requirementId: order.requirementId,
    opportunityId: order.opportunityId,
    quotationId: order.quotationId,
    negotiationId: order.negotiationId,
    exporterCompanyId: EXPORTER_COMPANY_ID,
    createdAt: now,
    allocation: { quantity: q, unit: order.terms.quantity.unit },
    route: { ...setup.route, shipmentType: setup.route.mode === "sea" || setup.route.mode === "multimodal" ? setup.route.shipmentType : undefined },
    cargo: { ...setup.cargo },
    setupKey: setup.setupKey,
    events: [{ id: `${id}-e0`, type: "created", by: "supplier", at: now, demo: true }],
  };
  return commit({ ...s, created: [...s.created, shipment] }) ? { ok: true, id } : fail("Couldn't save — browser storage unavailable");
}

// ---------------------------------------------------------------------------
// Execution actions — each validated, each appends one demo event
// ---------------------------------------------------------------------------

function current(id: string) {
  const s = parse(readRaw());
  const all = combine(s);
  const sh = all.find((x) => x.id === id);
  if (!sh) return undefined;
  const order = loadOrders().find((o) => o.id === sh.orderId);
  return { s, all, sh, st: shipmentState(sh), order, os: order ? orderStateWithShipments(order, all) : undefined };
}

function append(id: string, event: Omit<ShipmentEvent, "id" | "at" | "demo">): ActionResult {
  const c = current(id);
  if (!c) return fail("Shipment not found");
  if (c.st.status === "cancelled") return fail("Shipment is cancelled");
  const next: ShipmentEvent = { ...event, id: `${id}-e${c.sh.events.length}`, at: negotiationNow(), demo: true };
  return commit({ ...c.s, appended: { ...c.s.appended, [id]: [...(c.s.appended[id] ?? []), next] } }) ? { ok: true } : fail("Couldn't save");
}

export function assignForwarder(id: string, name: string): ActionResult {
  return name.trim() ? append(id, { type: "forwarder-assigned", by: "supplier", party: name.trim() }) : fail("Enter the forwarder name");
}

export function assignCarrier(id: string, name: string): ActionResult {
  return name.trim() ? append(id, { type: "carrier-assigned", by: "supplier", party: name.trim() }) : fail("Enter the carrier name");
}

export function addBooking(id: string, reference: string): ActionResult {
  const c = current(id);
  if (!c?.st.forwarder) return fail("Assign a forwarder first");
  return reference.trim() ? append(id, { type: "booking-added", by: "freight-forwarder", bookingReference: reference.trim() }) : fail("Enter the booking reference");
}

export function updateSchedule(id: string, etd?: string, eta?: string): ActionResult {
  if (!etd && !eta) return fail("Enter an ETD or ETA");
  const c = current(id);
  if (!c) return fail("Shipment not found");
  const nextEtd = etd || c.st.schedule.etd;
  const nextEta = eta || c.st.schedule.eta;
  if (nextEtd && nextEta && nextEta < nextEtd) return fail("ETA can't be before ETD");
  if (c.st.milestones.departed && etd) return fail("Cargo has departed — ETD can't change");
  return append(id, { type: "schedule-updated", by: "supplier", schedule: { ...(etd ? { etd } : {}), ...(eta ? { eta } : {}) } });
}

export function updateCargo(id: string, cargo: Partial<CargoDetails>): ActionResult {
  const c = current(id);
  if (!c) return fail("Shipment not found");
  const merged = { ...c.st.cargo, ...cargo };
  for (const k of ["packages", "netWeightKg", "grossWeightKg"] as const) {
    if (merged[k] !== undefined && !(Number(merged[k]) > 0)) return fail("Packages and weights must be above 0");
  }
  if (merged.netWeightKg && merged.grossWeightKg && merged.grossWeightKg < merged.netWeightKg) return fail("Gross weight can't be below net weight");
  return append(id, { type: "cargo-updated", by: "supplier", cargo });
}

export function updateContainer(id: string, container: Partial<ContainerDetails>): ActionResult {
  const c = current(id);
  if (!c) return fail("Shipment not found");
  if (!usesContainers(c.sh.route)) return fail("Containers apply to FCL sea shipments only");
  if (container.count !== undefined && !(container.count > 0)) return fail("Container count must be above 0");
  return append(id, { type: "container-updated", by: "supplier", container });
}

export function updateVessel(id: string, name?: string, voyage?: string): ActionResult {
  if (!name && !voyage) return fail("Enter a vessel / flight or voyage");
  return append(id, { type: "vessel-updated", by: "supplier", vessel: { ...(name ? { name } : {}), ...(voyage ? { voyage } : {}) } });
}

export function updateInstructions(id: string, instructions: Partial<ShippingInstructions>): ActionResult {
  return append(id, { type: "instructions-updated", by: "supplier", instructions });
}

/** Needs a description, complete cargo details and both ports. */
export function markInstructionsReady(id: string): ActionResult {
  const c = current(id);
  if (!c) return fail("Shipment not found");
  if (!c.st.instructions.productDescription?.trim()) return fail("Add the product description");
  if (!cargoComplete(c.st)) return fail("Complete packages, net and gross weight first");
  if (c.st.instructionsStatus === "ready") return fail("Already ready");
  return append(id, { type: "instructions-ready", by: "supplier" });
}

export function assignCha(id: string, name: string): ActionResult {
  return name.trim() ? append(id, { type: "cha-assigned", by: "supplier", party: name.trim() }) : fail("Enter the CHA name");
}

export function shareDossier(id: string): ActionResult {
  const c = current(id);
  if (!c?.st.cha) return fail("Assign a CHA first");
  if (c.st.dossierShared) return fail("Already shared");
  return append(id, { type: "dossier-shared", by: "supplier" });
}

/** Moves the shipping bill one step forward, with the prerequisites of each step. */
export function advanceShippingBill(id: string): ActionResult {
  const c = current(id);
  if (!c || !c.os) return fail("Shipment not found");
  const i = shippingBillIndex(c.st.shippingBill);
  const next = SHIPPING_BILL_STEPS[i + 1]?.id;
  if (!next) return fail("Shipping bill is complete");
  const doc = (type: string) => c.os!.documents.find((d) => d.type === type);
  const ready = (type: string) => ["ready", "verified"].includes(doc(type)?.status ?? "");
  if (next === "cha-review" && !c.st.cha) return fail("Assign a CHA before CHA review");
  if (next === "ready-for-filing") {
    if (c.st.instructionsStatus !== "ready") return fail("Shipping Instructions must be ready");
    if (!cargoComplete(c.st)) return fail("Complete the cargo details first");
    if (usesContainers(c.sh.route) && !containerComplete(c.st)) return fail("Complete the container details first");
    if (!ready("commercial-invoice") || !ready("packing-list")) return fail("Commercial Invoice and Packing List must be ready on the order");
  }
  if (next === "leo-received" && (c.st.customs === "query-received" || c.st.customs === "response-preparing")) return fail("Resolve the customs query first");
  return append(id, { type: "shipping-bill-updated", by: next === "data-preparing" ? "supplier" : "customs-broker", shippingBill: next });
}

export function updateCustoms(id: string, customs: CustomsQueryStatus): ActionResult {
  const c = current(id);
  if (!c) return fail("Shipment not found");
  const i = shippingBillIndex(c.st.shippingBill);
  if (i < shippingBillIndex("filed") || c.st.shippingBill === "leo-received") return fail("Customs queries apply between filing and LEO");
  if (c.st.customs === customs) return fail("No change");
  return append(id, { type: "customs-updated", by: "customs-broker", customs });
}

/** BL / AWB one step forward; final issue needs the cargo loaded. */
export function advanceTransportDocument(id: string): ActionResult {
  const c = current(id);
  if (!c) return fail("Shipment not found");
  const next = TRANSPORT_DOCUMENT_STEPS[transportDocumentIndex(c.st.transportDocument) + 1]?.id;
  if (!next) return fail("Already final");
  if (next === "final-issued" && !c.st.milestones.loaded && !c.st.milestones.departed) return fail("Final issue comes after loading");
  return append(id, { type: "transport-document-updated", by: "carrier", transportDocument: next });
}

/** Physical milestones, in order, each once. */
export function recordMilestone(id: string, milestone: PhysicalMilestone): ActionResult {
  const c = current(id);
  if (!c) return fail("Shipment not found");
  const m = c.st.milestones;
  if (m[milestone]) return fail("Already recorded");
  const leo = c.st.shippingBill === "leo-received";
  switch (milestone) {
    case "stuffed":
    case "gate-in":
      if (!c.st.bookingReference) return fail("Add the booking reference first");
      break;
    case "loaded":
      if (!leo) return fail("LEO is required before loading");
      break;
    case "departed":
      if (!leo) return fail("LEO is required before departure");
      if (c.sh.route.mode === "sea" && !m.loaded) return fail("Record loading first");
      break;
    case "arrived":
      if (!m.departed) return fail("Record departure first");
      break;
    case "delivered":
      if (!m.arrived) return fail("Record arrival first");
      break;
  }
  return append(id, { type: "milestone", by: milestone === "loaded" || milestone === "departed" || milestone === "arrived" ? "carrier" : "supplier", milestone });
}
