"use client";

import { useSyncExternalStore } from "react";
import { MOCK_NOW, type ImportRequirement } from "@/lib/import-requirements";
import type { Order } from "@/lib/importer-orders";
import {
  blockingItems,
  customsStatus,
  freightArrangedBy,
  initialDocuments,
  MOCK_SHIPMENTS,
  NEXT_STATUS,
  nextShipmentId,
  preShipmentChecklist,
  shipmentEligibility,
  shipmentState,
  type CustomsStatus,
  type DocumentStatus,
  type Shipment,
  type ShipmentCargo,
  type ShipmentEvent,
  type ShipmentParties,
  type ShipmentRoute,
  type ShipmentSchedule,
  type ShipmentStatus,
} from "@/lib/importer-shipments";

/*
 * Shipments created in this browser tab and events added to any shipment
 * (document states, demo bookings, schedule updates, status progression),
 * persisted in sessionStorage. No carrier, tracking or customs system is
 * connected, and nothing is sent anywhere.
 */

const KEY = "ximverse.importer.shipments";

interface StoredState {
  created: Shipment[];
  appended: Record<string, ShipmentEvent[]>;
}

const EMPTY: StoredState = { created: [], appended: {} };

function load(): StoredState {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as StoredState) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

let state: StoredState | null = null;
const listeners = new Set<() => void>();

function snapshot(): StoredState {
  state ??= load();
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: StoredState) {
  state = next;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: keep the in-memory state for this page.
  }
  listeners.forEach((l) => l());
}

function combine(s: StoredState): Shipment[] {
  return [...MOCK_SHIPMENTS, ...s.created].map((sh) => ({ ...sh, events: [...sh.events, ...(s.appended[sh.id] ?? [])] }));
}

const SERVER_SHIPMENTS = combine(EMPTY);
let cachedFor: StoredState | null = null;
let cached: Shipment[] = SERVER_SHIPMENTS;

function shipmentsSnapshot(): Shipment[] {
  const s = snapshot();
  if (s !== cachedFor) {
    cachedFor = s;
    cached = combine(s);
  }
  return cached;
}

export function useShipments(): Shipment[] {
  return useSyncExternalStore(subscribe, shipmentsSnapshot, () => SERVER_SHIPMENTS);
}

export function useShipmentsLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

function now(): string {
  const t = new Date().toISOString();
  return t > MOCK_NOW ? t : MOCK_NOW;
}

function eventId(): string {
  return `se-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function append(shipmentId: string, event: Omit<ShipmentEvent, "id" | "at">) {
  const s = snapshot();
  const full: ShipmentEvent = { ...event, id: eventId(), at: now() };
  commit({ ...s, appended: { ...s.appended, [shipmentId]: [...(s.appended[shipmentId] ?? []), full] } });
}

function find(shipmentId: string): Shipment | undefined {
  return combine(snapshot()).find((s) => s.id === shipmentId);
}

export interface NewShipmentInput {
  route: ShipmentRoute;
  cargo: ShipmentCargo;
  schedule: ShipmentSchedule;
  parties: ShipmentParties;
}

/** Creates a shipment from an eligible order. Returns its ID, or undefined if not eligible (e.g. one exists). */
export function createShipment(order: Order, requirement: ImportRequirement, input: NewShipmentInput): string | undefined {
  const s = snapshot();
  const all = combine(s);
  if (!shipmentEligibility(order, all).ok) return undefined;
  const at = now();
  const shipment: Shipment = {
    id: nextShipmentId(all, new Date().getFullYear()),
    orderId: order.id,
    requirementId: order.requirementId,
    supplierId: order.supplierId,
    createdAt: at,
    route: input.route,
    // Shipping quantity is always the full order quantity for now.
    cargo: { ...input.cargo, product: order.terms.productName, quantity: { ...order.terms.quantity } },
    schedule: input.schedule,
    parties: input.parties,
    incoterm: order.terms.incoterm,
    hsCode: order.terms.hsCode,
    documents: initialDocuments(requirement, order, input.route.mode, at),
    booking: { status: "not-started", arrangedBy: freightArrangedBy(order.terms.incoterm) },
    events: [{ id: "e1", type: "created", by: "importer", at, note: `From order ${order.id}` }],
    local: true,
  };
  commit({ ...s, created: [...s.created, shipment] });
  return shipment.id;
}

/** Records a document's state. `demo` marks simulated availability — no file is stored. */
export function updateDocument(shipmentId: string, documentId: string, status: DocumentStatus, demo = false) {
  append(shipmentId, {
    type: "document-updated",
    by: "importer",
    demo,
    document: { id: documentId, status },
    note: demo ? "Marked available for the demo. No file was uploaded." : undefined,
  });
}

export function simulateFreightBooking(shipmentId: string, reference: string, carrier?: string) {
  append(shipmentId, {
    type: "booking-updated",
    by: "importer",
    demo: true,
    booking: { status: "booked", reference, carrier: carrier || undefined },
    note: "Demo booking — no carrier or forwarder system is connected.",
  });
}

export function markCargoReady(shipmentId: string) {
  append(shipmentId, { type: "cargo-ready", by: "importer", note: "Recorded by you." });
}

/** Returns an error message if the schedule would be invalid. */
export function updateSchedule(shipmentId: string, schedule: ShipmentSchedule): string | undefined {
  if (schedule.readyDate > schedule.etd) return "Ready date must be on or before ETD.";
  if (schedule.etd > schedule.eta) return "ETA must be on or after ETD.";
  append(shipmentId, { type: "schedule-updated", by: "importer", schedule, note: "Planned dates updated by you." });
}

const DEMO_STATUSES: readonly ShipmentStatus[] = ["at-origin", "in-transit", "arrived", "customs"];

/**
 * Moves a shipment to its next status. Only the single allowed next step is
 * accepted, Ready to Ship requires the readiness checklist, and Delivered
 * requires customs clearance. Returns an error message when blocked.
 */
export function advanceStatus(shipmentId: string, to: ShipmentStatus, supplierConfirmed: boolean): string | undefined {
  const sh = find(shipmentId);
  if (!sh) return "Shipment not found.";
  const st = shipmentState(sh);
  if (NEXT_STATUS[st.status] !== to) return "That status change isn't allowed from the current status.";
  if (to === "ready-to-ship") {
    const blocking = blockingItems(preShipmentChecklist(sh, st, supplierConfirmed));
    if (blocking.length) return `Complete ${blocking.length} required ${blocking.length === 1 ? "item" : "items"} before marking this shipment Ready to Ship.`;
  }
  if (to === "delivered" && customsStatus(sh, st) !== "cleared") return "Customs must be cleared before the shipment is marked delivered.";
  const demo = DEMO_STATUSES.includes(to);
  append(shipmentId, {
    type: "status-changed",
    by: demo ? "carrier" : "importer",
    demo,
    status: to,
    note: demo ? "Demo status — no carrier or tracking system is connected." : undefined,
  });
  if (to === "customs") {
    append(shipmentId, { type: "customs-updated", by: "customs-broker", demo: true, customs: "under-assessment", note: "Demo status — no customs filing was made." });
  }
}

export function simulateCustomsClearance(shipmentId: string) {
  const sh = find(shipmentId);
  if (!sh || shipmentState(sh).status !== "customs") return;
  append(shipmentId, { type: "customs-updated", by: "customs-broker", demo: true, customs: "cleared" satisfies CustomsStatus, note: "Demo status — no customs system is connected." });
}
