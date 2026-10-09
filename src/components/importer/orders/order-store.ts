"use client";

import { useSyncExternalStore } from "react";
import { MOCK_NOW, type ImportRequirement } from "@/lib/import-requirements";
import type { Negotiation } from "@/lib/importer-negotiations";
import {
  MOCK_ORDERS,
  nextOrderId,
  orderEligibility,
  termsFromAgreement,
  type Order,
  type OrderEvent,
  type OrderEventType,
  type PurchaseOrder,
} from "@/lib/importer-orders";

/*
 * Orders created in this browser tab and lifecycle events added to any order,
 * persisted in sessionStorage. Nothing is sent to suppliers or a server.
 */

const KEY = "ximverse.importer.orders";

interface StoredState {
  created: Order[];
  appended: Record<string, OrderEvent[]>;
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

function combine(s: StoredState): Order[] {
  return [...MOCK_ORDERS, ...s.created].map((o) => ({ ...o, events: [...o.events, ...(s.appended[o.id] ?? [])] }));
}

const SERVER_ORDERS = combine(EMPTY);
let cachedFor: StoredState | null = null;
let cached: Order[] = SERVER_ORDERS;

function ordersSnapshot(): Order[] {
  const s = snapshot();
  if (s !== cachedFor) {
    cachedFor = s;
    cached = combine(s);
  }
  return cached;
}

/** All orders. Server render and hydration see the demo data only. */
export function useOrders(): Order[] {
  return useSyncExternalStore(subscribe, ordersSnapshot, () => SERVER_ORDERS);
}

/** False during server render and hydration, before session state is read. */
export function useOrdersLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

function now(): string {
  const t = new Date().toISOString();
  return t > MOCK_NOW ? t : MOCK_NOW;
}

function eventId(): string {
  return `oe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Creates an order from an agreed negotiation, snapshotting the agreed terms.
 * Returns the new order ID, or undefined if the agreement isn't eligible
 * (including when an order already exists for it).
 */
export function createOrder(n: Negotiation, requirement: ImportRequirement, purchaseOrder: PurchaseOrder): string | undefined {
  const s = snapshot();
  const all = combine(s);
  if (!orderEligibility(n, requirement, all).ok) return undefined;
  const terms = termsFromAgreement(n, requirement);
  if (!terms) return undefined;
  const at = now();
  const order: Order = {
    id: nextOrderId(all, new Date().getFullYear()),
    requirementId: n.requirementId,
    quotationId: n.quotationId,
    negotiationId: n.id,
    supplierId: n.supplierId,
    createdAt: at,
    terms,
    purchaseOrder,
    events: [
      { id: "e1", type: "created", by: "importer", at, note: `From agreement in ${n.id}` },
      { id: "e2", type: "po-prepared", by: "system", at, note: purchaseOrder.number },
    ],
    local: true,
  };
  commit({ ...s, created: [...s.created, order] });
  return order.id;
}

function addEvent(orderId: string, type: OrderEventType, extra: Partial<OrderEvent> = {}) {
  const s = snapshot();
  const event: OrderEvent = { id: eventId(), type, by: "importer", at: now(), ...extra };
  commit({ ...s, appended: { ...s.appended, [orderId]: [...(s.appended[orderId] ?? []), event] } });
}

export const markPoIssued = (orderId: string) =>
  addEvent(orderId, "po-issued", { note: "Recorded by you. XimVerse did not send anything." });

/** Demo only: records a supplier confirmation without any real supplier. */
export const simulateSupplierConfirmation = (orderId: string) =>
  addEvent(orderId, "supplier-confirmed", { by: "supplier", demo: true, note: "Simulated confirmation (demo)." });

export const moveToPreShipment = (orderId: string) => addEvent(orderId, "pre-shipment");

export const cancelOrder = (orderId: string, reason?: string) => addEvent(orderId, "cancelled", { note: reason || undefined });
