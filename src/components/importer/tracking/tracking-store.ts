"use client";

import { useMemo, useSyncExternalStore } from "react";
import { MOCK_NOW } from "@/lib/import-requirements";
import { trackingView, type Acknowledgement, type TrackingException, type TrackingView } from "@/lib/importer-tracking";
import { useCustomsCases } from "../customs/customs-store";
import { useDocuments } from "../documents/document-store";
import { useOrders } from "../orders/order-store";
import { useShipments } from "../shipments/shipment-store";

/*
 * Tracking-specific state only: exception acknowledgements, keyed by the
 * deterministic exception ID and persisted in sessionStorage. Exceptions
 * themselves are derived on every read from the shipment, document, order
 * and customs stores; an acknowledgement never resolves one. Schedule
 * changes live in the shipment store.
 */

const KEY = "ximverse.importer.tracking";
type Acks = Readonly<Record<string, Acknowledgement>>;
const EMPTY: Acks = {};

function load(): Acks {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Acks) : EMPTY;
  } catch {
    return EMPTY;
  }
}

let state: Acks | null = null;
const listeners = new Set<() => void>();

function snapshot(): Acks {
  state ??= load();
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: Acks) {
  state = next;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: keep the in-memory state for this page.
  }
  listeners.forEach((l) => l());
}

export function useAcknowledgements(): Acks {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function useTrackingLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/** Tracking views for every shipment, from the live canonical stores. */
export function useTrackingViews(): TrackingView[] {
  const shipments = useShipments();
  const documents = useDocuments();
  const orders = useOrders();
  const customsCases = useCustomsCases();
  const acknowledgements = useAcknowledgements();
  return useMemo(
    () => shipments.map((shipment) => trackingView({ shipment, documents, orders, customsCases, acknowledgements })),
    [shipments, documents, orders, customsCases, acknowledgements],
  );
}

function now(): string {
  const t = new Date().toISOString();
  return t > MOCK_NOW ? t : MOCK_NOW;
}

/** Marks an exception as seen. It stays open until its source is resolved. */
export function acknowledgeException(e: TrackingException, note?: string): string | undefined {
  const text = note?.trim() ?? "";
  if (text.length > 300) return "Keep the note under 300 characters.";
  commit({ ...snapshot(), [e.id]: { at: now(), by: "You", note: text || undefined } });
}

export function clearAcknowledgement(e: TrackingException) {
  const next = { ...snapshot() };
  delete next[e.id];
  commit(next);
}
