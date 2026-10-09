/*
 * My Quotations: one presentation list from three sources, without copying
 * any of them.
 *
 *   seeded history     exporter-quotation-history.ts (demo, QT-2026-8xxx)
 *   local submissions  exporter-quotation-store.ts   (canonical objects, QT-2026-9xxx)
 *   local drafts       exporter-quotation-store.ts   (form values keyed by RFQ, no ID yet)
 *
 * Rows reference the original quotation object; product, destination and
 * buyer market come from the opportunity dataset. Deliberately doesn't import
 * the product catalogue, so its private price band can't reach this client
 * bundle.
 */

import type { Currency, QuantityUnit } from "./import-requirements";
import { findOpportunity, shortCountry, tonnes, type BuyerOpportunity } from "./exporter-opportunities";
import { SEEDED_QUOTATIONS } from "./exporter-quotation-history";
import {
  negotiationForQuotation,
  negotiationStatus,
  quotationStatusWithNegotiation,
  SEEDED_NEGOTIATIONS,
  type ExporterNegotiation,
} from "./exporter-negotiations";
import {
  ACTIVE_STATUSES,
  DECIDED_STATUSES,
  effectiveStatus,
  QUOTATION_STATUS_ORDER,
  quoteTotals,
  validUntil,
  type ExporterQuotation,
  type ExporterQuotationStatus,
  type QuoteFormValues,
} from "./exporter-quotations";

export interface PipelineRow {
  key: string;
  kind: "quotation" | "draft";
  source: "seeded" | "local" | "draft";
  /** The original object, untouched. Absent for drafts. */
  quotation?: ExporterQuotation;
  rfqId: string;
  opportunity?: BuyerOpportunity;
  productName: string;
  destinationCountry?: string;
  destinationLocation?: string;
  quantity?: { amount: number; unit: QuantityUnit };
  unitMinor?: number;
  totalMinor?: number;
  currency?: Currency;
  incoterm?: string;
  validUntil?: string;
  /**
   * Presentation status: the stored status, expired once validity passes,
   * and overridden by the quotation's negotiation (derived — the quotation
   * object itself is never changed).
   */
  status: ExporterQuotationStatus;
  /** The negotiation on this quotation, if any. */
  negotiationId?: string;
  /** ISO timestamp of the latest activity, for "most recent". */
  activityAt: string;
}

const toMinor = (major: number) => Math.round(major * 100);

/** A quotation's status once its negotiation (if any) is taken into account. */
export function presentedStatus(q: ExporterQuotation, negotiation?: ExporterNegotiation): ExporterQuotationStatus {
  return quotationStatusWithNegotiation(effectiveStatus(q), negotiation && negotiationStatus(negotiation));
}

export function quotationRow(
  q: ExporterQuotation,
  source: "seeded" | "local",
  negotiations: readonly ExporterNegotiation[] = SEEDED_NEGOTIATIONS,
): PipelineRow {
  const o = findOpportunity(q.requirementId);
  const negotiation = negotiationForQuotation(q.id, negotiations);
  return {
    key: q.id,
    kind: "quotation",
    source,
    quotation: q,
    rfqId: q.requirementId,
    opportunity: o,
    productName: o?.product.name ?? q.product.description,
    destinationCountry: o ? shortCountry(o.delivery.destinationCountry) : undefined,
    destinationLocation: o?.delivery.destinationLocation,
    quantity: q.product.quantity,
    unitMinor: toMinor(q.price.unitPrice),
    totalMinor: toMinor(q.price.total),
    currency: q.price.currency,
    incoterm: `${q.price.incoterm} ${q.price.namedPlace}`,
    validUntil: q.commercial.validUntil,
    status: presentedStatus(q, negotiation),
    negotiationId: negotiation?.id,
    activityAt: negotiation && negotiation.events.at(-1)!.at > q.updatedAt ? negotiation.events.at(-1)!.at : q.updatedAt,
  };
}

/** Display projection of a draft. No quotation ID — one is issued on submit. */
export function draftRow(rfqId: string, draft: { values: QuoteFormValues; savedAt: string }): PipelineRow | undefined {
  const o = findOpportunity(rfqId);
  if (!o) return undefined;
  const v = draft.values;
  const t = quoteTotals(v);
  return {
    key: `draft:${rfqId}`,
    kind: "draft",
    source: "draft",
    rfqId,
    opportunity: o,
    productName: o.product.name,
    destinationCountry: shortCountry(o.delivery.destinationCountry),
    destinationLocation: o.delivery.destinationLocation,
    quantity: t.quantity !== undefined ? { amount: t.quantity, unit: o.quantity.unit } : undefined,
    unitMinor: t.unitMinor,
    totalMinor: t.totalMinor,
    currency: v.currency,
    incoterm: `${v.incoterm} ${v.namedPlace}`.trim(),
    validUntil: validUntil(v),
    status: "draft",
    activityAt: draft.savedAt,
  };
}

/**
 * All rows. Local submissions win over a seed with the same ID (shouldn't
 * happen given the ranges); a draft is hidden once its RFQ has a submission.
 */
export function buildPipeline(
  local: readonly ExporterQuotation[],
  drafts: Readonly<Record<string, { values: QuoteFormValues; savedAt: string }>>,
  negotiations: readonly ExporterNegotiation[] = SEEDED_NEGOTIATIONS,
): PipelineRow[] {
  const localIds = new Set(local.map((q) => q.id));
  const quotedRfqs = new Set([...local, ...SEEDED_QUOTATIONS].map((q) => q.requirementId));
  const rows = [
    ...SEEDED_QUOTATIONS.filter((q) => !localIds.has(q.id)).map((q) => quotationRow(q, "seeded", negotiations)),
    ...local.map((q) => quotationRow(q, "local", negotiations)),
    ...Object.entries(drafts)
      .filter(([rfqId]) => !quotedRfqs.has(rfqId))
      .map(([rfqId, d]) => draftRow(rfqId, d))
      .filter((r): r is PipelineRow => Boolean(r)),
  ];
  return rows;
}

export function findSeededQuotation(id: string): ExporterQuotation | undefined {
  return SEEDED_QUOTATIONS.find((q) => q.id === id);
}

export const SEEDED_QUOTATION_IDS = SEEDED_QUOTATIONS.map((q) => q.id);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface PipelineSummary {
  /** Submitted quotations of any status (drafts excluded). */
  total: number;
  drafts: number;
  active: number;
  shortlisted: number;
  revisionRequested: number;
  /** Active quoted value per currency, in minor units. Never summed across currencies. */
  activeValueByCurrency: Partial<Record<Currency, number>>;
  accepted: number;
  decided: number;
  /** accepted / decided, undefined until at least one decision. */
  winRate?: number;
  byStatus: Record<ExporterQuotationStatus, number>;
}

export function pipelineSummary(rows: readonly PipelineRow[]): PipelineSummary {
  const byStatus = Object.fromEntries(QUOTATION_STATUS_ORDER.map((s) => [s, 0])) as Record<ExporterQuotationStatus, number>;
  const activeValueByCurrency: Partial<Record<Currency, number>> = {};
  for (const r of rows) {
    byStatus[r.status] += 1;
    if (ACTIVE_STATUSES.includes(r.status) && r.currency && r.totalMinor !== undefined) {
      activeValueByCurrency[r.currency] = (activeValueByCurrency[r.currency] ?? 0) + r.totalMinor;
    }
  }
  const accepted = byStatus.accepted;
  const decided = DECIDED_STATUSES.reduce((n, s) => n + byStatus[s], 0);
  return {
    total: rows.filter((r) => r.kind === "quotation").length,
    drafts: byStatus.draft,
    active: ACTIVE_STATUSES.reduce((n, s) => n + byStatus[s], 0),
    shortlisted: byStatus.shortlisted,
    revisionRequested: byStatus["revision-requested"],
    activeValueByCurrency,
    accepted,
    decided,
    winRate: decided > 0 ? accepted / decided : undefined,
    byStatus,
  };
}

/** Compact money, e.g. $1.04M, €46K. Per currency only — no FX. */
export function formatCompactMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** Tonnes for "largest quantity" sorting; undefined units sort last. */
export function rowTonnes(r: PipelineRow): number {
  return r.quantity ? (tonnes(r.quantity) ?? -1) : -1;
}

/** Mock SUMIT note built from the rows. Static rules, no AI. */
export function quotationsInsight(rows: readonly PipelineRow[]): string {
  const revision = rows.filter((r) => r.status === "revision-requested").map((r) => r.key);
  const shortlisted = rows.filter((r) => r.status === "shortlisted").map((r) => r.key);
  const strongest = rows
    .filter((r) => ACTIVE_STATUSES.includes(r.status) && r.totalMinor !== undefined && r.currency === "USD")
    .sort((a, b) => (b.totalMinor ?? 0) - (a.totalMinor ?? 0))[0];
  const parts: string[] = [];
  if (revision.length || shortlisted.length) {
    const n = revision.length + shortlisted.length;
    const bits = [
      revision.length ? `${revision.join(", ")} ${revision.length === 1 ? "requires" : "require"} revision` : "",
      shortlisted.length ? `${shortlisted.join(", ")} ${shortlisted.length === 1 ? "has" : "have"} been shortlisted` : "",
    ].filter(Boolean);
    parts.push(`${n === 1 ? "One quotation needs" : `${n === 2 ? "Two" : n} quotations need`} attention: ${bits.join(", and ")}.`);
  }
  if (strongest?.totalMinor !== undefined) {
    parts.push(
      `Your largest live offer is ${strongest.key} — ${strongest.productName} to ${strongest.destinationCountry} at ${formatCompactMoney(strongest.totalMinor, "USD")}.`,
    );
  }
  return parts.join(" ") || "No live quotations yet. Start from a buyer opportunity.";
}
