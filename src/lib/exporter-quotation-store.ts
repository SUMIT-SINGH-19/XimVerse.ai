"use client";

/*
 * Demo persistence for exporter quotations, in this browser only.
 *
 *   ximverse:exporter:quotation-drafts  { v: 1, drafts: { [rfqId]: { values, savedAt } } }
 *   ximverse:exporter:quotations        { v: 1, quotations: ExporterQuotation[] }
 *
 * Nothing here reaches Ximverse or the buyer. Reads go through
 * useSyncExternalStore so server and first client render agree (empty), and
 * every tab sees writes. My Quotations will read the second key.
 */

import { useMemo, useSyncExternalStore } from "react";
import { normalizeQuotation, type ExporterQuotation, type QuoteFormValues } from "./exporter-quotations";

export const DRAFTS_KEY = "ximverse:exporter:quotation-drafts";
export const QUOTATIONS_KEY = "ximverse:exporter:quotations";
const CHANGE_EVENT = "ximverse:exporter:storage";

export interface StoredDraft {
  values: QuoteFormValues;
  /** ISO timestamp. */
  savedAt: string;
}

interface DraftsFile {
  v: 1;
  drafts: Record<string, StoredDraft>;
}

interface QuotationsFile {
  v: 1;
  quotations: ExporterQuotation[];
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw);
    return data && data.v === 1 ? (data as T) : fallback;
  } catch {
    return fallback;
  }
}

const EMPTY_DRAFTS: DraftsFile = { v: 1, drafts: {} };
const EMPTY_QUOTATIONS: QuotationsFile = { v: 1, quotations: [] };

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Raw stored string; null on the server and before hydration. */
function useStoredRaw(key: string): string | null {
  return useSyncExternalStore(subscribe, () => read(key), () => null);
}

// ---------------------------------------------------------------------------

export function loadDraft(rfqId: string): StoredDraft | undefined {
  return parse(read(DRAFTS_KEY), EMPTY_DRAFTS).drafts[rfqId];
}

export function saveDraft(rfqId: string, values: QuoteFormValues, savedAt: string): boolean {
  const file = parse(read(DRAFTS_KEY), EMPTY_DRAFTS);
  return write(DRAFTS_KEY, { ...file, drafts: { ...file.drafts, [rfqId]: { values, savedAt } } });
}

export function clearDraft(rfqId: string): void {
  const file = parse(read(DRAFTS_KEY), EMPTY_DRAFTS);
  const { [rfqId]: _removed, ...rest } = file.drafts;
  void _removed;
  write(DRAFTS_KEY, { ...file, drafts: rest });
}

export function loadQuotations(): ExporterQuotation[] {
  return parse(read(QUOTATIONS_KEY), EMPTY_QUOTATIONS).quotations.map(normalizeQuotation);
}

export function storeQuotation(q: ExporterQuotation): boolean {
  const file = parse(read(QUOTATIONS_KEY), EMPTY_QUOTATIONS);
  return write(QUOTATIONS_KEY, { ...file, quotations: [...file.quotations.filter((x) => x.id !== q.id), q] });
}

/** Locally submitted quotations, live. */
export function useStoredQuotations(): ExporterQuotation[] {
  const raw = useStoredRaw(QUOTATIONS_KEY);
  return useMemo(() => parse(raw, EMPTY_QUOTATIONS).quotations.map(normalizeQuotation), [raw]);
}

/** Locally saved drafts keyed by RFQ, live. */
export function useStoredDrafts(): Record<string, StoredDraft> {
  const raw = useStoredRaw(DRAFTS_KEY);
  return useMemo(() => parse(raw, EMPTY_DRAFTS).drafts, [raw]);
}

/** The locally submitted quotation for an RFQ, if any. */
export function useSubmittedQuotation(rfqId: string): ExporterQuotation | undefined {
  const all = useStoredQuotations();
  return useMemo(() => all.find((q) => q.requirementId === rfqId && q.status !== "draft"), [all, rfqId]);
}

/** True once running in the browser (false during SSR and hydration). */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
