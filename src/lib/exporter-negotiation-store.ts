"use client";

/*
 * Negotiation changes made in this browser, layered over the seeded
 * negotiations — the same approach as the importer's negotiation store.
 *
 *   ximverse:exporter:negotiations  { v: 1, appended: { [id]: NegotiationEvent[] }, drafts: { [id]: CounterDraft | null } }
 *
 * Seeded events are never rewritten: new events are appended, so history is
 * append-only. Nothing is sent to the buyer or a server. localStorage (not
 * session) to match the other exporter demo stores.
 */

import { useMemo, useSyncExternalStore } from "react";
import {
  buyerLatestOffer,
  negotiationNow,
  SEEDED_NEGOTIATIONS,
  yourCurrentOffer,
  type CounterDraft,
  type ExporterNegotiation,
  type NegotiationEvent,
} from "./exporter-negotiations";

export const NEGOTIATIONS_KEY = "ximverse:exporter:negotiations";
const CHANGE_EVENT = "ximverse:exporter:negotiations-change";

interface StoredState {
  v: 1;
  appended: Record<string, NegotiationEvent[]>;
  drafts: Record<string, CounterDraft | null>;
}

const EMPTY: StoredState = { v: 1, appended: {}, drafts: {} };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(NEGOTIATIONS_KEY);
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
    window.localStorage.setItem(NEGOTIATIONS_KEY, JSON.stringify(next));
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

/** Seeded negotiations plus this browser's appended events and drafts. */
export function combine(s: StoredState): ExporterNegotiation[] {
  return SEEDED_NEGOTIATIONS.map((n) => {
    const draft = s.drafts[n.id] === undefined ? n.draft : (s.drafts[n.id] ?? undefined);
    return { ...n, events: [...n.events, ...(s.appended[n.id] ?? [])], draft };
  });
}

/** All negotiations, live. Server render and hydration see the seeds only. */
export function useExporterNegotiations(): ExporterNegotiation[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => combine(parse(raw)), [raw]);
}

export function useNegotiation(id: string): ExporterNegotiation | undefined {
  const all = useExporterNegotiations();
  return useMemo(() => all.find((n) => n.id === id), [all, id]);
}

// ---------------------------------------------------------------------------
// Actions — each appends one event; nothing earlier is touched.
// ---------------------------------------------------------------------------

function append(id: string, event: Omit<NegotiationEvent, "id" | "at">, clearDraft = true): boolean {
  const s = parse(readRaw());
  const negotiation = combine(s).find((n) => n.id === id);
  if (!negotiation) return false;
  // Deterministic, never reused: position in this negotiation's history.
  const next: NegotiationEvent = { ...event, id: `${id}-e${negotiation.events.length}`, at: negotiationNow() };
  return commit({
    ...s,
    appended: { ...s.appended, [id]: [...(s.appended[id] ?? []), next] },
    drafts: clearDraft ? { ...s.drafts, [id]: null } : s.drafts,
  });
}

export function submitCounter(id: string, draft: CounterDraft): boolean {
  return append(id, { type: "supplier-revision", by: "supplier", offer: draft.offer, note: draft.note });
}

export function keepExistingOffer(id: string, note: string): boolean {
  const n = combine(parse(readRaw())).find((x) => x.id === id);
  if (!n) return false;
  return append(id, { type: "supplier-kept-offer", by: "supplier", offer: yourCurrentOffer(n), note });
}

/** Accepts the buyer's latest terms; the agreement event's offer is the agreed terms. */
export function acceptBuyerOffer(id: string): boolean {
  const n = combine(parse(readRaw())).find((x) => x.id === id);
  const offer = n && buyerLatestOffer(n);
  if (!offer) return false;
  return append(id, { type: "agreement", by: "supplier", offer });
}

export function saveCounterDraft(id: string, draft: CounterDraft | null): boolean {
  const s = parse(readRaw());
  return commit({ ...s, drafts: { ...s.drafts, [id]: draft } });
}

/**
 * Demo only: records a buyer counter halfway between the buyer's last price
 * and yours (rounded to a whole unit), so the flow can continue without a
 * real buyer. Marked `demo` in the history.
 */
export function simulateBuyerCounter(id: string): boolean {
  const n = combine(parse(readRaw())).find((x) => x.id === id);
  if (!n) return false;
  const yours = yourCurrentOffer(n);
  const lastBuyer = buyerLatestOffer(n) ?? { ...yours, unitPrice: Math.round(yours.unitPrice * 0.98) };
  const price = Math.round((yours.unitPrice + lastBuyer.unitPrice) / 2);
  return append(
    id,
    { type: "importer-counter", by: "importer", offer: { ...yours, unitPrice: price }, note: "Meeting you halfway on price.", demo: true },
    false,
  );
}
