"use client";

/*
 * Deals created in this browser, and events appended to any deal.
 *
 *   ximverse:exporter:deals  { v: 1, created: ExporterDeal[], appended: { [dealId]: DealEvent[] } }
 *
 * Seeded deals are never copied in; they're combined at read time. Creation
 * re-checks for an existing deal against the stored data at write time, so
 * double clicks or two tabs can't produce a second deal for one agreement.
 */

import { useMemo, useSyncExternalStore } from "react";
import { EXPORTER_COMPANY_ID } from "./exporter-company";
import {
  dealEligibility,
  nextDealId,
  SEEDED_DEALS,
  type DealEvent,
  type ExporterDeal,
} from "./exporter-deals";
import { negotiationNow, type ExporterNegotiation } from "./exporter-negotiations";
import type { ExporterQuotation } from "./exporter-quotations";

export const DEALS_KEY = "ximverse:exporter:deals";
const CHANGE_EVENT = "ximverse:exporter:deals-change";

interface StoredState {
  v: 1;
  created: ExporterDeal[];
  appended: Record<string, DealEvent[]>;
}

const EMPTY: StoredState = { v: 1, created: [], appended: {} };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(DEALS_KEY);
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
    window.localStorage.setItem(DEALS_KEY, JSON.stringify(next));
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

function combine(s: StoredState): ExporterDeal[] {
  const seededIds = new Set(SEEDED_DEALS.map((d) => d.id));
  return [...SEEDED_DEALS, ...s.created.filter((d) => !seededIds.has(d.id))].map((d) => ({
    ...d,
    events: [...d.events, ...(s.appended[d.id] ?? [])],
  }));
}

/** All deals, live. Server render and hydration see the seeds only. */
export function useExporterDeals(): ExporterDeal[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => combine(parse(raw)), [raw]);
}

export type CreateDealResult = { ok: true; id: string; created: boolean } | { ok: false; reason: string };

/**
 * Creates the deal for a quotation (and its agreed negotiation, if any), or
 * returns the existing one. Terms are copied once, here.
 */
export function createDeal(q: ExporterQuotation, negotiation: ExporterNegotiation | undefined): CreateDealResult {
  const s = parse(readRaw());
  const all = combine(s);
  const eligibility = dealEligibility(q, negotiation, all);
  if (!eligibility.ok) {
    return eligibility.reason === "deal-exists" && eligibility.deal
      ? { ok: true, id: eligibility.deal.id, created: false }
      : { ok: false, reason: eligibility.reason };
  }
  const now = negotiationNow();
  const id = nextDealId(s.created, Number(now.slice(0, 4)));
  const deal: ExporterDeal = {
    id,
    requirementId: q.requirementId,
    opportunityId: q.opportunityId,
    quotationId: q.id,
    negotiationId: negotiation?.id,
    exporterCompanyId: EXPORTER_COMPANY_ID,
    source: eligibility.source,
    // Deep copy so nothing shares references with the source objects.
    terms: structuredClone(eligibility.terms),
    counterpartyAccess: "protected",
    createdAt: now,
    events: [{ id: `${id}-e0`, type: "created", by: "supplier", at: now }],
  };
  return commit({ ...s, created: [...s.created, deal] }) ? { ok: true, id, created: true } : { ok: false, reason: "storage" };
}

/** Exporter confirms the deal terms: pending setup → confirmed. */
export function confirmDeal(id: string): boolean {
  const s = parse(readRaw());
  const deal = combine(s).find((d) => d.id === id);
  if (!deal || deal.events.some((e) => e.type === "exporter-confirmed")) return false;
  const event: DealEvent = { id: `${id}-e${deal.events.length}`, type: "exporter-confirmed", by: "supplier", at: negotiationNow() };
  return commit({ ...s, appended: { ...s.appended, [id]: [...(s.appended[id] ?? []), event] } });
}
