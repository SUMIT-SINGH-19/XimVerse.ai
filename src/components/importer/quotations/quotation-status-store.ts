"use client";

import { useSyncExternalStore } from "react";
import type { Quotation, QuotationStatus } from "@/lib/importer-quotations";
import { negotiationStatus } from "@/lib/importer-negotiations";
import { useNegotiations } from "../negotiations/negotiation-store";

/*
 * Status changes the importer makes (shortlist, clarification, not
 * interested), kept in sessionStorage so they survive navigation and reloads
 * within this browser tab. Nothing is sent to a server. Replace with API calls
 * once a backend exists.
 */

const KEY = "ximverse.importer.quotation-status";
type Overrides = Readonly<Record<string, QuotationStatus>>;
const EMPTY: Overrides = {};

function load(): Overrides {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Overrides) : EMPTY;
  } catch {
    return EMPTY;
  }
}

let overrides: Overrides | null = null;
const listeners = new Set<() => void>();

function snapshot(): Overrides {
  overrides ??= load();
  return overrides;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setQuotationStatus(id: string, status: QuotationStatus) {
  overrides = { ...snapshot(), [id]: status };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(overrides));
  } catch {
    // Storage unavailable (private mode, blocked): keep the in-memory value.
  }
  listeners.forEach((l) => l());
}

/**
 * Current status of each quotation, including the importer's changes. A
 * quotation whose negotiation reached agreement is "selected".
 */
export function useQuotationStatus(): (q: Quotation) => QuotationStatus {
  const current = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const negotiations = useNegotiations();
  const agreed = new Set(negotiations.filter((n) => negotiationStatus(n) === "agreed").map((n) => n.quotationId));
  return (q) => (agreed.has(q.id) ? "selected" : (current[q.id] ?? q.status));
}

/** Shortlisting toggles between shortlisted and under review. */
export function toggleShortlist(q: Quotation, status: QuotationStatus) {
  setQuotationStatus(q.id, status === "shortlisted" ? "under-review" : "shortlisted");
}
