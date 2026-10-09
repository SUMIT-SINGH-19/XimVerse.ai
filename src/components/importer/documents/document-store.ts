"use client";

import { useMemo, useSyncExternalStore } from "react";
import { MOCK_NOW } from "@/lib/import-requirements";
import {
  allowedDocumentActions,
  buildDocuments,
  MOCK_EVENTS_BY_DOCUMENT,
  nextDocumentEventId,
  type DocumentAction,
  type DocumentEvent,
  type DocumentMetadata,
  type TradeDocument,
} from "@/lib/importer-documents";
import { useShipments } from "../shipments/shipment-store";

/*
 * The canonical document store. Documents are built from every shipment's
 * seed plus demo and session document events; this tab's events persist in
 * sessionStorage. Shipment readiness, customs readiness and compliance all
 * read the documents returned by useDocuments(). No file is ever stored.
 */

const KEY = "ximverse.importer.documents";
type Events = Readonly<Record<string, DocumentEvent[]>>;
const EMPTY: Events = {};

function load(): Events {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Events) : EMPTY;
  } catch {
    return EMPTY;
  }
}

let state: Events | null = null;
const listeners = new Set<() => void>();

function snapshot(): Events {
  state ??= load();
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function append(event: DocumentEvent) {
  const current = snapshot();
  state = { ...current, [event.documentId]: [...(current[event.documentId] ?? []), event] };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: keep the in-memory state for this page.
  }
  listeners.forEach((l) => l());
}

/** All canonical documents. Server render and hydration see demo data only. */
export function useDocuments(): TradeDocument[] {
  const shipments = useShipments();
  const local = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return useMemo(() => {
    const merged: Record<string, DocumentEvent[]> = { ...MOCK_EVENTS_BY_DOCUMENT };
    for (const [id, events] of Object.entries(local)) merged[id] = [...(merged[id] ?? []), ...events];
    return buildDocuments(shipments, merged);
  }, [shipments, local]);
}

export function useDocumentsLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

function now(): string {
  const t = new Date().toISOString();
  return t > MOCK_NOW ? t : MOCK_NOW;
}

function guard(doc: TradeDocument, action: DocumentAction, cargoWithCarrier: boolean): string | undefined {
  if (!allowedDocumentActions(doc, cargoWithCarrier).includes(action)) return "That action isn't available for this document right now.";
}

function record(doc: TradeDocument, e: Omit<DocumentEvent, "id" | "documentId" | "at">) {
  append({ ...e, id: nextDocumentEventId(), documentId: doc.id, at: now() });
}

export function requestDocument(doc: TradeDocument, cargoWithCarrier = false) {
  const err = guard(doc, "request", cargoWithCarrier);
  if (err) return err;
  record(doc, { type: "requested", by: "importer", status: "requested", note: `Requested from ${doc.source.replace("-", " ")}. Recorded only — nothing was sent.` });
}

/** Demo only: records that the document is available, with optional metadata. No file is stored. */
export function markDocumentAvailable(doc: TradeDocument, metadata: DocumentMetadata, cargoWithCarrier: boolean) {
  const err = guard(doc, "mark-available", cargoWithCarrier);
  if (err) return err;
  record(doc, { type: "marked-available", by: doc.source, status: "available", metadata, demo: true, note: "Demo only — no document file is uploaded or stored." });
}

/** For documents you provide yourself (e.g. shipping instructions). */
export function issueDocument(doc: TradeDocument, metadata: DocumentMetadata = {}) {
  const err = guard(doc, "issue", false);
  if (err) return err;
  record(doc, { type: "issued", by: "importer", status: "available", metadata });
}

export function sendForReview(doc: TradeDocument) {
  const err = guard(doc, "send-for-review", false);
  if (err) return err;
  record(doc, { type: "sent-for-review", by: "importer", status: "needs-review" });
}

export function approveForWorkflow(doc: TradeDocument) {
  const err = guard(doc, "approve", false);
  if (err) return err;
  record(doc, { type: "approved", by: "importer", status: "approved", note: "Approved for workflow." });
}

export function markNeedsReview(doc: TradeDocument, note?: string) {
  const err = guard(doc, "mark-needs-review", false);
  if (err) return err;
  record(doc, { type: "marked-needs-review", by: "importer", status: "needs-review", note: note || undefined });
}

export function updateDocumentMetadata(doc: TradeDocument, metadata: DocumentMetadata) {
  const err = guard(doc, "update-metadata", false);
  if (err) return err;
  record(doc, { type: "metadata-updated", by: "importer", metadata });
}
