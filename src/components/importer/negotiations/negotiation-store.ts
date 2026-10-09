"use client";

import { useSyncExternalStore } from "react";
import { MOCK_NOW } from "@/lib/import-requirements";
import {
  CLOSED_ANOTHER_SELECTED,
  currentOffer,
  isActiveNegotiation,
  MOCK_NEGOTIATIONS,
  nextNegotiationId,
  type CounterDraft,
  type Negotiation,
  type NegotiationEvent,
} from "@/lib/importer-negotiations";
import type { Quotation } from "@/lib/importer-quotations";

/*
 * Negotiation changes made in this browser tab: negotiations started here,
 * events appended to any negotiation (counter offers, demo supplier
 * revisions, agreements, closures) and saved draft counters. Persisted in
 * sessionStorage; nothing is sent to suppliers or a server.
 */

const KEY = "ximverse.importer.negotiations";

interface StoredState {
  created: Negotiation[];
  appended: Record<string, NegotiationEvent[]>;
  drafts: Record<string, CounterDraft | null>;
}

const EMPTY: StoredState = { created: [], appended: {}, drafts: {} };

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

/** Mock negotiations plus this tab's changes. */
function combine(s: StoredState): Negotiation[] {
  return [...MOCK_NEGOTIATIONS, ...s.created].map((n) => {
    const draft = s.drafts[n.id] === undefined ? n.draft : (s.drafts[n.id] ?? undefined);
    return { ...n, events: [...n.events, ...(s.appended[n.id] ?? [])], draft };
  });
}

const SERVER_NEGOTIATIONS = combine(EMPTY);
let cachedFor: StoredState | null = null;
let cached: Negotiation[] = SERVER_NEGOTIATIONS;

function negotiationsSnapshot(): Negotiation[] {
  const s = snapshot();
  if (s !== cachedFor) {
    cachedFor = s;
    cached = combine(s);
  }
  return cached;
}

/** All negotiations. Server render and hydration see the mock data only. */
export function useNegotiations(): Negotiation[] {
  return useSyncExternalStore(subscribe, negotiationsSnapshot, () => SERVER_NEGOTIATIONS);
}

/** False during server render and hydration, before session state is read. */
export function useNegotiationsLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

function now(): string {
  // Local events must sort after the demo data, whose clock stops at MOCK_NOW.
  const t = new Date().toISOString();
  return t > MOCK_NOW ? t : MOCK_NOW;
}

function eventId(): string {
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function append(s: StoredState, negotiationId: string, event: Omit<NegotiationEvent, "id" | "at">): StoredState {
  return {
    ...s,
    appended: { ...s.appended, [negotiationId]: [...(s.appended[negotiationId] ?? []), { ...event, id: eventId(), at: now() }] },
  };
}

/** Starts a negotiation from a quotation; the original quotation is the first event. */
export function startNegotiation(q: Quotation): string {
  const s = snapshot();
  const id = nextNegotiationId(combine(s), new Date().getFullYear());
  const negotiation: Negotiation = {
    id,
    requirementId: q.requirementId,
    quotationId: q.id,
    supplierId: q.supplierId,
    startedAt: now(),
    events: [{ id: "e0", type: "original-quotation", by: "supplier", at: q.receivedAt }],
    local: true,
  };
  commit({ ...s, created: [...s.created, negotiation] });
  return id;
}

export function addCounterOffer(negotiationId: string, draft: CounterDraft) {
  const s = append(snapshot(), negotiationId, { type: "importer-counter", by: "importer", offer: draft.offer, note: draft.note });
  commit({ ...s, drafts: { ...s.drafts, [negotiationId]: null } });
}

/** Demo only: records terms as if the supplier had revised them. */
export function addDemoSupplierRevision(negotiationId: string, draft: CounterDraft) {
  commit(append(snapshot(), negotiationId, { type: "supplier-revision", by: "supplier", offer: draft.offer, note: draft.note, demo: true }));
}

export function saveCounterDraft(negotiationId: string, draft: CounterDraft | null) {
  const s = snapshot();
  commit({ ...s, drafts: { ...s.drafts, [negotiationId]: draft } });
}

export function withdrawNegotiation(negotiationId: string, note?: string) {
  const s = append(snapshot(), negotiationId, { type: "withdrawn", by: "importer", note });
  commit({ ...s, drafts: { ...s.drafts, [negotiationId]: null } });
}

/**
 * Accepts the current offer: records the agreement with an immutable copy of
 * the terms, and closes the requirement's other active negotiations.
 */
export function acceptCurrentOffer(negotiationId: string) {
  let s = snapshot();
  const all = combine(s);
  const target = all.find((n) => n.id === negotiationId);
  if (!target) return;
  s = append(s, negotiationId, { type: "agreement", by: "importer", offer: currentOffer(target) });
  for (const other of all) {
    if (other.id !== negotiationId && other.requirementId === target.requirementId && isActiveNegotiation(other)) {
      s = append(s, other.id, { type: "closed", by: "system", note: CLOSED_ANOTHER_SELECTED });
    }
  }
  commit({ ...s, drafts: { ...s.drafts, [negotiationId]: null } });
}
