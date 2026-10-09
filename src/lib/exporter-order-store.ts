"use client";

/*
 * Orders created in this browser, and execution events appended to any order.
 *
 *   ximverse:exporter:orders  { v: 1, created: ExporterOrder[], appended: { [orderId]: OrderEvent[] } }
 *
 * Seeded orders are combined at read time, never copied in. Every action
 * appends one event; locked terms are never touched. Creation re-checks
 * "one deal → one order" at write time (double clicks, two tabs).
 */

import { useMemo, useSyncExternalStore } from "react";
import { dealStatus, type ExporterDeal } from "./exporter-deals";
import { negotiationNow } from "./exporter-negotiations";
import {
  nextOrderId,
  orderForDeal,
  orderFromDeal,
  orderState,
  PAYMENT_STEPS,
  SEEDED_ORDERS,
  type ExporterOrder,
  type OrderDocumentStatus,
  type OrderEvent,
} from "./exporter-orders";

export const ORDERS_KEY = "ximverse:exporter:orders";
const CHANGE_EVENT = "ximverse:exporter:orders-change";

interface StoredState {
  v: 1;
  created: ExporterOrder[];
  appended: Record<string, OrderEvent[]>;
}

const EMPTY: StoredState = { v: 1, created: [], appended: {} };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(ORDERS_KEY);
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
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
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

function combine(s: StoredState): ExporterOrder[] {
  const seededIds = new Set(SEEDED_ORDERS.map((o) => o.id));
  return [...SEEDED_ORDERS, ...s.created.filter((o) => !seededIds.has(o.id))].map((o) => ({
    ...o,
    events: [...o.events, ...(s.appended[o.id] ?? [])],
  }));
}

/** All orders, live. Server render and hydration see the seeds only. */
export function useExporterOrders(): ExporterOrder[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => combine(parse(raw)), [raw]);
}

export type CreateOrderResult = { ok: true; id: string; created: boolean } | { ok: false; reason: "not-confirmed" | "storage" };

/** Creates the order for a confirmed deal, or returns the existing one. */
export function createOrder(deal: ExporterDeal): CreateOrderResult {
  const s = parse(readRaw());
  const existing = orderForDeal(deal.id, combine(s));
  if (existing) return { ok: true, id: existing.id, created: false };
  const status = dealStatus(deal);
  if (status !== "confirmed" && status !== "ready-for-execution") return { ok: false, reason: "not-confirmed" };
  const now = negotiationNow();
  const order = orderFromDeal(deal, nextOrderId(s.created, Number(now.slice(0, 4))), now);
  return commit({ ...s, created: [...s.created, order] }) ? { ok: true, id: order.id, created: true } : { ok: false, reason: "storage" };
}

// ---------------------------------------------------------------------------
// Execution actions — validated, one appended event each
// ---------------------------------------------------------------------------

function append(id: string, event: Omit<OrderEvent, "id" | "at" | "by">): boolean {
  const s = parse(readRaw());
  const order = combine(s).find((o) => o.id === id);
  if (!order) return false;
  const next: OrderEvent = { ...event, by: "supplier", id: `${id}-e${order.events.length}`, at: negotiationNow() };
  return commit({ ...s, appended: { ...s.appended, [id]: [...(s.appended[id] ?? []), next] } });
}

function current(id: string) {
  const o = combine(parse(readRaw())).find((x) => x.id === id);
  return o ? { o, s: orderState(o) } : undefined;
}

export function confirmOrder(id: string): boolean {
  const c = current(id);
  return Boolean(c && !c.s.confirmed) && append(id, { type: "supplier-confirmed" });
}

export function startProduction(id: string, plannedStart?: string, note?: string): boolean {
  const c = current(id);
  return Boolean(c && c.s.confirmed && c.s.production.status === "not-started") && append(id, { type: "production-started", plannedStart, note });
}

/** Produced quantity can't exceed the ordered quantity or go backwards. */
export function updateProduction(id: string, producedQuantity: number, note?: string): boolean {
  const c = current(id);
  if (!c || c.s.production.status !== "in-progress") return false;
  if (!(producedQuantity >= 0) || producedQuantity > c.s.production.ordered || producedQuantity < c.s.production.produced) return false;
  return append(id, { type: "production-updated", producedQuantity, note });
}

export function setCargoReadyDate(id: string, expectedCargoReady: string): boolean {
  const c = current(id);
  return Boolean(c && c.s.confirmed && expectedCargoReady) && append(id, { type: "cargo-ready-date-set", expectedCargoReady });
}

/** Requires the full ordered quantity produced. */
export function completeProduction(id: string, actualCargoReady: string): boolean {
  const c = current(id);
  if (!c || c.s.production.status !== "in-progress" || c.s.production.produced < c.s.production.ordered) return false;
  return append(id, { type: "production-completed", producedQuantity: c.s.production.produced, actualCargoReady });
}

export function updatePayment(id: string, paymentStep: string): boolean {
  const c = current(id);
  if (!c || !PAYMENT_STEPS[c.o.terms.paymentTerm].some((p) => p.id === paymentStep) || c.s.paymentStep.id === paymentStep) return false;
  return append(id, { type: "payment-updated", paymentStep });
}

export function updateDocument(id: string, documentId: string, status: OrderDocumentStatus): boolean {
  const c = current(id);
  const doc = c?.s.documents.find((d) => d.id === documentId);
  // Shipping bill and BL/AWB come from the shipment workflow; never marked here.
  if (!c || !doc || doc.phase !== "pre-shipment" || doc.status === status) return false;
  return append(id, { type: "document-updated", document: { id: documentId, status } });
}
