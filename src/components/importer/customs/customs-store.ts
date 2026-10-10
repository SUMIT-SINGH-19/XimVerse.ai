"use client";

import { useMemo, useSyncExternalStore } from "react";
import { MOCK_NOW } from "@/lib/import-requirements";
import {
  canEditCase,
  canRecordClarification,
  canRecordHandoff,
  customsCaseForShipment,
  customsCaseView,
  MANUAL_FIELDS,
  MOCK_CUSTOMS_CASES,
  nextCustomsCaseId,
  nextDemoStep,
  validateCha,
  validateManualFields,
  type ChaAssignment,
  type CustomsCase,
  type CustomsCaseView,
  type CustomsDemoStep,
  type CustomsEvent,
  type ManualDeclarationFields,
} from "@/lib/importer-customs";
import type { CustomsOverride, Shipment } from "@/lib/importer-shipments";
import { useDocuments } from "../documents/document-store";
import { useOrders } from "../orders/order-store";
import { recordCustomsProgress, useShipments } from "../shipments/shipment-store";

/*
 * Customs cases created in this browser tab and events added to any case
 * (declaration edits, broker assignment, handoffs, demo clarifications),
 * persisted in sessionStorage. Cases are derived on read from the live
 * shipment, document and order stores. Nothing is sent to a broker or to
 * Customs.
 */

const KEY = "ximverse.importer.customs";

interface StoredState {
  created: CustomsCase[];
  appended: Record<string, CustomsEvent[]>;
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

function combine(s: StoredState): CustomsCase[] {
  return [...MOCK_CUSTOMS_CASES, ...s.created].map((c) => ({ ...c, events: [...c.events, ...(s.appended[c.id] ?? [])] }));
}

const SERVER_CASES = combine(EMPTY);
let cachedFor: StoredState | null = null;
let cached: CustomsCase[] = SERVER_CASES;

function casesSnapshot(): CustomsCase[] {
  const s = snapshot();
  if (s !== cachedFor) {
    cachedFor = s;
    cached = combine(s);
  }
  return cached;
}

/** Stored case records (references and events only). */
export function useCustomsCaseRecords(): CustomsCase[] {
  return useSyncExternalStore(subscribe, casesSnapshot, () => SERVER_CASES);
}

/** Cases derived from the current shipment, document and order state. */
export function useCustomsCases(): CustomsCaseView[] {
  const records = useCustomsCaseRecords();
  const shipments = useShipments();
  const documents = useDocuments();
  const orders = useOrders();
  return useMemo(
    () => records.map((c) => customsCaseView(c, shipments, documents, orders)).filter((v): v is CustomsCaseView => !!v),
    [records, shipments, documents, orders],
  );
}

export function useCustomsLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/** The customs override for one shipment, from the shared lookup. */
export function overrideFor(shipment: Shipment, cases: readonly CustomsCaseView[]): CustomsOverride | undefined {
  return customsCaseForShipment(shipment.id, cases)?.override;
}

function now(): string {
  const t = new Date().toISOString();
  return t > MOCK_NOW ? t : MOCK_NOW;
}

function eventId(): string {
  return `ce-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function append(caseId: string, event: Omit<CustomsEvent, "id" | "at">) {
  const s = snapshot();
  const full: CustomsEvent = { ...event, id: eventId(), at: now() };
  commit({ ...s, appended: { ...s.appended, [caseId]: [...(s.appended[caseId] ?? []), full] } });
}

/** Creates the shipment's customs case. Returns its ID, or the existing case's ID if one exists. */
export function createCustomsCase(shipment: Shipment): { id: string; created: boolean } {
  const s = snapshot();
  const all = combine(s);
  const existing = customsCaseForShipment(shipment.id, all);
  if (existing) return { id: existing.id, created: false };
  const at = now();
  const record: CustomsCase = {
    id: nextCustomsCaseId(all, new Date().getFullYear()),
    shipmentId: shipment.id,
    orderId: shipment.orderId,
    requirementId: shipment.requirementId,
    supplierId: shipment.supplierId,
    createdAt: at,
    events: [{ id: "c1", type: "created", by: "importer", at, note: `From shipment ${shipment.id}` }],
    local: true,
  };
  commit({ ...s, created: [...s.created, record] });
  return { id: record.id, created: true };
}

const LOCKED = "This customs case can no longer be changed.";

function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])) as T;
}

/** Saves customs-specific declaration fields. Upstream fields are never changed here. */
export function updateDeclaration(v: CustomsCaseView, input: ManualDeclarationFields): string | undefined {
  if (!canEditCase(v)) return LOCKED;
  const fields = clean(input);
  const editable = new Set(v.fields.filter((f) => f.manual).map((f) => f.manual!));
  const changed: ManualDeclarationFields = {};
  for (const k of MANUAL_FIELDS) {
    if (!(k in fields)) continue;
    if (!editable.has(k)) return "That field comes from a source record and can't be edited here.";
    if ((fields[k] ?? "") !== (v.manual[k] ?? "")) changed[k] = fields[k] ?? "";
  }
  if (Object.keys(validateManualFields(fields)).length) return "Fix the highlighted fields.";
  if (Object.keys(changed).length === 0) return "No changes to save.";
  append(v.id, { type: "declaration-updated", by: "importer", fields: changed });
}

export function assignCha(v: CustomsCaseView, cha: ChaAssignment): string | undefined {
  if (!canEditCase(v)) return LOCKED;
  const c = clean(cha);
  if (Object.keys(validateCha(c)).length) return "Fix the highlighted fields.";
  const compact = Object.fromEntries(Object.entries(c).filter(([, x]) => x)) as unknown as ChaAssignment;
  append(v.id, { type: "cha-assigned", by: "importer", cha: compact, note: "Recorded by you. No invitation was sent." });
}

export function recordHandoff(v: CustomsCaseView, note: string): string | undefined {
  if (!canRecordHandoff(v) || !v.cha) return "Handoff isn't available until every blocker is resolved.";
  if (note.length > 500) return "Keep the note under 500 characters.";
  append(v.id, {
    type: "handoff-recorded",
    by: "importer",
    handoff: {
      cha: v.cha,
      declarationVersion: v.declarationVersion,
      declaration: Object.fromEntries(v.fields.filter((f) => f.value).map((f) => [f.id, f.value!])),
      documentIds: v.documents.filter((d) => d.complete).map((d) => d.id),
      note: note.trim() || undefined,
    },
    note: "Handed over outside XimVerse. No message or filing was sent.",
  });
}

/** Demo only — no real broker message was received. */
export function recordClarification(v: CustomsCaseView, question: string): string | undefined {
  if (!canRecordClarification(v)) return "Clarifications can be recorded once the case has been handed to the broker.";
  const q = question.trim();
  if (!q) return "Enter the broker's question.";
  if (q.length > 300) return "Keep the question under 300 characters.";
  append(v.id, { type: "clarification-recorded", by: "customs-broker", demo: true, clarificationId: `CLR-${v.clarifications.length + 1}`, question: q });
}

/** Recorded locally — no message is sent. */
export function respondToClarification(v: CustomsCaseView, clarificationId: string, response: string): string | undefined {
  const c = v.clarifications.find((x) => x.id === clarificationId);
  if (!c || c.status !== "open" || !canEditCase(v)) return "That clarification can't be answered now.";
  const r = response.trim();
  if (!r) return "Enter a short response.";
  if (r.length > 500) return "Keep the response under 500 characters.";
  append(v.id, { type: "clarification-responded", by: "importer", clarificationId, response: r });
}

export function resolveClarification(v: CustomsCaseView, clarificationId: string): string | undefined {
  const c = v.clarifications.find((x) => x.id === clarificationId);
  if (!c || c.status !== "responded" || !canEditCase(v)) return "Only answered clarifications can be marked resolved.";
  append(v.id, { type: "clarification-resolved", by: "importer", clarificationId, note: "Marked resolved by you." });
}

/** Demo progression. No Customs system is connected. */
export function simulateCustomsStep(v: CustomsCaseView, step: CustomsDemoStep): string | undefined {
  const next = nextDemoStep(v);
  if (!next || next.step !== step) return "That step isn't available for this case right now.";
  if (next.blockedReason) return next.blockedReason;
  recordCustomsProgress(v.shipment.id, step);
}
