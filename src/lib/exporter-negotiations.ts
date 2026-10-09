/*
 * Commercial negotiations, seen from the exporter's side.
 *
 * Aligned with the importer model (src/lib/importer-negotiations.ts):
 *   - the same CommercialOffer shape and party ids ("importer" = the buyer,
 *     "supplier" = this exporter, "system" = Ximverse), imported as types only;
 *   - the same event names where the concept exists (original-quotation,
 *     importer-counter, supplier-revision, agreement, withdrawn, closed);
 *   - NG-YYYY-NNNN ids; seeded demo negotiations use the reserved 8100+ range,
 *     clear of the importer's mocks (NG-2026-00xx);
 *   - an append-only event list; status is derived from the latest event,
 *     never stored.
 *
 * Exporter additions: `revision-request` (buyer asks for changes),
 * `supplier-kept-offer` (exporter stands by its offer) and `note` (Ximverse),
 * plus an optional `estimatedDelivery` on offers.
 *
 * Immutability: a negotiation never edits its quotation. It holds a reference
 * (quotationId) and an `originalQuotationSnapshot` taken from the quotation
 * when the negotiation started; every later position is a new event with its
 * own offer snapshot. Agreed terms are the offer on the agreement event.
 *
 * Privacy: events carry commercial terms and notes only — no buyer identity,
 * no other suppliers' names or prices, no buyer budget.
 */

import type { CommercialOffer as ImporterCommercialOffer, NegotiationParty } from "./importer-negotiations";
import type { QuantityUnit } from "./import-requirements";
import { EXPORTER_COMPANY_ID } from "./exporter-company";
import { OPPORTUNITIES_NOW, PAYMENT_TERM_LABEL, UNIT_SHORT, type BuyerOpportunity } from "./exporter-opportunities";
import { SEEDED_QUOTATIONS } from "./exporter-quotation-history";
import { daysBetween, formatMoney, type ExporterQuotation, type ExporterQuotationStatus } from "./exporter-quotations";

export type { NegotiationParty };

// Local formatter (importing exporter-dashboard here would create an import cycle).
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formatDate = (iso: string) => dateFormat.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));


/** The importer's CommercialOffer, plus the delivery date the exporter commits to. */
export type CommercialOffer = ImporterCommercialOffer & {
  /** YYYY-MM-DD */
  estimatedDelivery?: string;
};

export type NegotiationEventType =
  | "original-quotation"
  | "revision-request"
  | "importer-counter"
  | "supplier-revision"
  | "supplier-kept-offer"
  | "agreement"
  | "withdrawn"
  | "closed"
  | "note";

export interface NegotiationEvent {
  id: string;
  type: NegotiationEventType;
  by: NegotiationParty;
  /** ISO timestamp. */
  at: string;
  /** Immutable snapshot of the terms proposed, requested or agreed. */
  offer?: CommercialOffer;
  note?: string;
  /** Created with a demo action, not by a real buyer. */
  demo?: boolean;
}

export interface CounterDraft {
  offer: CommercialOffer;
  note?: string;
}

export interface ExporterNegotiation {
  /** NG-YYYY-NNNN */
  id: string;
  /** The canonical RFQ id. */
  requirementId: string;
  quotationId: string;
  opportunityId: string;
  /** This exporter (the importer side's supplierId). */
  exporterCompanyId: string;
  /** ISO timestamp. */
  startedAt: string;
  /** The quotation's terms when the negotiation began. Never changes. */
  originalQuotationSnapshot: CommercialOffer;
  events: readonly NegotiationEvent[];
  /** A counter the exporter saved but hasn't sent. */
  draft?: CounterDraft;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type ExporterNegotiationStatus =
  | "revision-requested"
  | "awaiting-exporter"
  | "draft-counter"
  | "awaiting-buyer"
  | "agreed"
  | "closed"
  | "withdrawn";

export const NEGOTIATION_STATUS_LABEL: Record<ExporterNegotiationStatus, string> = {
  "revision-requested": "Revision Requested",
  "awaiting-exporter": "Your Response Needed",
  "draft-counter": "Draft Counter Offer",
  "awaiting-buyer": "Awaiting Buyer",
  agreed: "Agreement Reached",
  closed: "Closed",
  withdrawn: "Withdrawn",
};

/**
 * The same moment as the importer side sees it (NegotiationStatus in
 * importer-negotiations.ts). Documentation for the future shared lifecycle.
 */
export const IMPORTER_NEGOTIATION_STATUS_EQUIVALENT: Record<ExporterNegotiationStatus, string> = {
  "revision-requested": "awaiting-supplier",
  "awaiting-exporter": "awaiting-supplier",
  "draft-counter": "awaiting-supplier",
  "awaiting-buyer": "supplier-responded",
  agreed: "agreed",
  closed: "closed",
  withdrawn: "withdrawn",
};

const MEANINGFUL = (e: NegotiationEvent) => e.type !== "note";

export function lastMeaningfulEvent(n: ExporterNegotiation): NegotiationEvent {
  return n.events.findLast(MEANINGFUL) ?? n.events[n.events.length - 1];
}

export function negotiationStatus(n: ExporterNegotiation): ExporterNegotiationStatus {
  const last = lastMeaningfulEvent(n);
  switch (last.type) {
    case "agreement":
      return "agreed";
    case "closed":
      return "closed";
    case "withdrawn":
      return "withdrawn";
    case "revision-request":
      return n.draft ? "draft-counter" : "revision-requested";
    case "importer-counter":
      return n.draft ? "draft-counter" : "awaiting-exporter";
    default:
      return "awaiting-buyer";
  }
}

export function needsExporterResponse(status: ExporterNegotiationStatus): boolean {
  return status === "revision-requested" || status === "awaiting-exporter" || status === "draft-counter";
}

export function isActiveNegotiation(status: ExporterNegotiationStatus): boolean {
  return needsExporterResponse(status) || status === "awaiting-buyer";
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

/** A quotation's terms as a commercial offer (importer offerFromQuotation, exporter side). */
export function offerFromQuotation(q: ExporterQuotation): CommercialOffer {
  return {
    unitPrice: q.price.unitPrice,
    currency: q.price.currency,
    quantity: q.product.quantity,
    incoterm: q.price.incoterm,
    namedPlace: q.price.namedPlace,
    paymentTerm: q.commercial.paymentTerm,
    advancePercent: q.commercial.advancePercent,
    paymentSummary: q.commercial.paymentSummary,
    leadTimeDays: q.delivery.leadTimeDays,
    validUntil: q.commercial.validUntil,
    packaging: q.product.packaging,
    inspection: q.compliance.inspection,
    estimatedDelivery: q.delivery.estimatedDelivery,
  };
}

/** Your latest position: your last revision, kept offer, or the original quotation. */
export function yourCurrentOffer(n: ExporterNegotiation): CommercialOffer {
  for (let i = n.events.length - 1; i >= 0; i--) {
    const e = n.events[i];
    if (e.by === "supplier" && e.offer) return e.offer;
  }
  return n.originalQuotationSnapshot;
}

/** The buyer's latest counter or requested terms, if any. */
export function buyerLatestOffer(n: ExporterNegotiation): CommercialOffer | undefined {
  for (let i = n.events.length - 1; i >= 0; i--) {
    const e = n.events[i];
    if (e.by === "importer" && e.offer && (e.type === "importer-counter" || e.type === "revision-request")) return e.offer;
  }
  return undefined;
}

export function buyerLatestEvent(n: ExporterNegotiation): NegotiationEvent | undefined {
  return n.events.findLast((e) => e.by === "importer" && (e.type === "importer-counter" || e.type === "revision-request"));
}

/** The terms both sides agreed, from the agreement event. */
export function agreedTerms(n: ExporterNegotiation): CommercialOffer | undefined {
  return n.events.findLast((e) => e.type === "agreement")?.offer;
}

export function lastActivity(n: ExporterNegotiation): string {
  return n.events[n.events.length - 1]?.at ?? n.startedAt;
}

/** Price × quantity in minor units, without float drift. */
export function offerValueMinor(o: CommercialOffer): number {
  return Math.round(Math.round(o.unitPrice * 100) * o.quantity.amount);
}

export function formatOfferPrice(o: CommercialOffer): string {
  return `${formatMoney(Math.round(o.unitPrice * 100), o.currency)} / ${UNIT_SHORT[o.quantity.unit]}`;
}

export function formatOfferValue(o: CommercialOffer): string {
  return formatMoney(offerValueMinor(o), o.currency);
}

/** Values can be compared only in the same currency and unit — never converted. */
export function comparable(a: CommercialOffer, b: CommercialOffer): boolean {
  return a.currency === b.currency && a.quantity.unit === b.quantity.unit;
}

export function paymentText(o: CommercialOffer): string {
  return o.paymentSummary || PAYMENT_TERM_LABEL[o.paymentTerm];
}

// ---------------------------------------------------------------------------
// Changes between two offers
// ---------------------------------------------------------------------------

export type OfferField = "quantity" | "unitPrice" | "currency" | "incoterm" | "delivery" | "payment" | "packaging" | "leadTime" | "validity";

export interface OfferChange {
  field: OfferField;
  label: string;
  from: string;
  to: string;
}

const qtyText = (q: { amount: number; unit: QuantityUnit }) => `${q.amount.toLocaleString("en-US")} ${UNIT_SHORT[q.unit]}`;

export const OFFER_ROWS: readonly { field: OfferField; label: string; text: (o: CommercialOffer) => string }[] = [
  { field: "quantity", label: "Quantity", text: (o) => qtyText(o.quantity) },
  { field: "unitPrice", label: "Unit Price", text: formatOfferPrice },
  { field: "incoterm", label: "Incoterm", text: (o) => `${o.incoterm} ${o.namedPlace}` },
  { field: "payment", label: "Payment", text: paymentText },
  { field: "delivery", label: "Delivery", text: (o) => (o.estimatedDelivery ? formatDate(o.estimatedDelivery) : `${o.leadTimeDays}-day lead time`) },
  { field: "packaging", label: "Packaging", text: (o) => o.packaging ?? "—" },
  { field: "validity", label: "Valid Until", text: (o) => formatDate(o.validUntil) },
];

/** Fields that differ between two offers, in display order. */
export function offerChanges(from: CommercialOffer, to: CommercialOffer): OfferChange[] {
  return OFFER_ROWS.filter((r) => r.text(from) !== r.text(to)).map((r) => ({
    field: r.field,
    label: r.label,
    from: r.text(from),
    to: r.text(to),
  }));
}

export interface PriceImpact {
  /** Per pricing unit, minor units (negative = cheaper). */
  unitDeltaMinor: number;
  /** Percentage change of the unit price, e.g. -0.47. */
  percent: number;
  /** Change in order value, minor units. */
  totalDeltaMinor: number;
}

/** Undefined when the offers aren't directly comparable (currency or unit differ). */
export function priceImpact(from: CommercialOffer, to: CommercialOffer): PriceImpact | undefined {
  if (!comparable(from, to)) return undefined;
  const a = Math.round(from.unitPrice * 100);
  const b = Math.round(to.unitPrice * 100);
  return {
    unitDeltaMinor: b - a,
    percent: a ? Math.round(((b - a) / a) * 10_000) / 100 : 0,
    totalDeltaMinor: offerValueMinor(to) - offerValueMinor(from),
  };
}

// ---------------------------------------------------------------------------
// Quotation status, as negotiation changes it (derived, never written back)
// ---------------------------------------------------------------------------

/**
 * How a quotation should read given its negotiation. Seeded and stored
 * quotations are never mutated; this is applied when presenting them.
 */
export function quotationStatusWithNegotiation(
  base: ExporterQuotationStatus,
  status: ExporterNegotiationStatus | undefined,
): ExporterQuotationStatus {
  switch (status) {
    case "agreed":
      return "accepted";
    case "revision-requested":
      return "revision-requested";
    case "awaiting-exporter":
    case "draft-counter":
    case "awaiting-buyer":
      return "negotiation";
    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// Seeded negotiations (demo)
// ---------------------------------------------------------------------------

function snapshot(quotationId: string): CommercialOffer {
  const q = SEEDED_QUOTATIONS.find((x) => x.id === quotationId);
  if (!q) throw new Error(`Unknown seeded quotation ${quotationId}`);
  return offerFromQuotation(q);
}

function seeded(
  id: string,
  quotationId: string,
  startedAt: string,
  build: (original: CommercialOffer) => Omit<NegotiationEvent, "id">[],
): ExporterNegotiation {
  const q = SEEDED_QUOTATIONS.find((x) => x.id === quotationId)!;
  const original = snapshot(quotationId);
  const events: Omit<NegotiationEvent, "id">[] = [
    { type: "original-quotation", by: "supplier", at: q.submittedAt ?? q.createdAt },
    ...build(original),
  ];
  return {
    id,
    requirementId: q.requirementId,
    quotationId,
    opportunityId: q.opportunityId,
    exporterCompanyId: EXPORTER_COMPANY_ID,
    startedAt,
    originalQuotationSnapshot: original,
    events: events.map((e, i) => ({ ...e, id: `${id}-e${i}` })),
  };
}

export const SEEDED_NEGOTIATIONS: readonly ExporterNegotiation[] = [
  // Golden Sella to UAE — buyer has countered on price only.
  seeded("NG-2026-8101", "QT-2026-8174", "2026-10-07T06:30:00Z", (o) => [
    {
      type: "importer-counter",
      by: "importer",
      at: "2026-10-07T06:30:00Z",
      offer: { ...o, unitPrice: 1040 },
      note: "Please review the pricing. Other commercial conditions are acceptable.",
    },
  ]),
  // PR11 to the UK — buyer asked for revised delivery and packaging.
  seeded("NG-2026-8102", "QT-2026-8187", "2026-10-06T16:45:00Z", (o) => [
    {
      type: "revision-request",
      by: "importer",
      at: "2026-10-06T16:45:00Z",
      offer: { ...o, estimatedDelivery: "2026-11-05", packaging: "20 kg paper bags." },
      note: "Please revise the delivery date to meet 5 Nov and confirm 20 kg paper bag packaging.",
    },
  ]),
  // 1121 Steam to UAE (historical) — two rounds, then the buyer accepted.
  seeded("NG-2026-8103", "QT-2026-8162", "2026-09-07T09:00:00Z", (o) => [
    { type: "importer-counter", by: "importer", at: "2026-09-07T09:00:00Z", offer: { ...o, unitPrice: 1075 }, note: "Can you match $1,075 / MT?" },
    { type: "supplier-revision", by: "supplier", at: "2026-09-08T05:30:00Z", offer: { ...o, unitPrice: 1085 }, note: "Best we can do is $1,085 with current delivery." },
    { type: "note", by: "system", at: "2026-09-10T08:00:00Z", note: "Ximverse confirmed the LC terms with the buyer." },
    { type: "agreement", by: "importer", at: "2026-09-12T12:00:00Z", offer: { ...o, unitPrice: 1085 } },
  ]),
  // PR11 to Oman (historical) — exporter kept its offer; buyer chose another.
  seeded("NG-2026-8104", "QT-2026-8151", "2026-08-30T07:00:00Z", (o) => [
    { type: "importer-counter", by: "importer", at: "2026-08-30T07:00:00Z", offer: { ...o, unitPrice: 510 }, note: "Please review pricing — your offer is above the shortlisted range." },
    { type: "supplier-kept-offer", by: "supplier", at: "2026-08-31T06:00:00Z", offer: o, note: "Our current quotation remains our best commercial offer." },
    { type: "closed", by: "system", at: "2026-09-03T10:00:00Z", note: "Closed — the buyer selected another offer." },
  ]),
];

export const SEEDED_NEGOTIATION_IDS = SEEDED_NEGOTIATIONS.map((n) => n.id);

export function findSeededNegotiation(id: string): ExporterNegotiation | undefined {
  return SEEDED_NEGOTIATIONS.find((n) => n.id === id);
}

/** The negotiation for a quotation, from a given list. */
export function negotiationForQuotation(
  quotationId: string,
  list: readonly ExporterNegotiation[],
): ExporterNegotiation | undefined {
  return list.find((n) => n.quotationId === quotationId);
}

// ---------------------------------------------------------------------------
// SUMIT (rule-based, no AI)
// ---------------------------------------------------------------------------

export function negotiationInsights(
  n: ExporterNegotiation,
  o: BuyerOpportunity | undefined,
  availableTonnes?: number,
): string[] {
  const status = negotiationStatus(n);
  const yours = yourCurrentOffer(n);
  const buyer = buyerLatestOffer(n);
  const out: string[] = [];

  if (status === "agreed") {
    const t = agreedTerms(n);
    if (t) out.push(`Terms agreed at ${formatOfferPrice(t)} for ${qtyText(t.quantity)} — ${formatOfferValue(t)} in total. Next step is deal setup.`);
    return out;
  }
  if (status === "closed" || status === "withdrawn") {
    out.push("This negotiation is closed. Its history stays here for reference.");
    return out;
  }

  if (buyer) {
    const changed = offerChanges(yours, buyer).map((c) => c.field);
    const impact = priceImpact(yours, buyer);
    const kept = (["delivery", "payment", "packaging", "incoterm"] as OfferField[]).filter((f) => !changed.includes(f));
    if (impact && changed.includes("unitPrice")) {
      const keptText = kept.length
        ? ` while accepting your ${kept.map((f) => ({ delivery: "delivery", payment: "payment", packaging: "packaging", incoterm: "Incoterm" })[f as "delivery"]).join(", ")} terms`
        : "";
      out.push(`The buyer is requesting a ${Math.abs(impact.percent).toFixed(2)}% price ${impact.percent < 0 ? "reduction" : "increase"}${keptText}.`);
    } else if (changed.length) {
      out.push(`The buyer asks you to change: ${offerChanges(yours, buyer).map((c) => c.label.toLowerCase()).join(", ")}.`);
    }
    const vsOriginal = priceImpact(n.originalQuotationSnapshot, buyer);
    if (vsOriginal && vsOriginal.totalDeltaMinor !== 0) {
      out.push(
        `At ${formatOfferPrice(buyer)}, this order would be ${formatMoney(Math.abs(vsOriginal.totalDeltaMinor), buyer.currency)} ${vsOriginal.totalDeltaMinor < 0 ? "below" : "above"} your original offer.`,
      );
    }
  } else if (status === "awaiting-buyer") {
    out.push("Your latest position is with the buyer. Nothing to do until they respond.");
  }

  const checks: string[] = [];
  const tonnesNeeded = yours.quantity.unit === "MT" ? yours.quantity.amount : yours.quantity.unit === "KG" ? yours.quantity.amount / 1000 : undefined;
  if (availableTonnes !== undefined && tonnesNeeded !== undefined) {
    checks.push(tonnesNeeded <= availableTonnes ? `your available capacity (${availableTonnes.toLocaleString("en-US")} MT) covers it` : `it exceeds your available capacity (${availableTonnes.toLocaleString("en-US")} MT)`);
  }
  const delivery = (buyer ?? yours).estimatedDelivery;
  if (o && delivery) {
    const slack = daysBetween(delivery, o.delivery.requiredBy);
    checks.push(slack >= 0 ? "the delivery schedule still satisfies the RFQ" : `delivery is ${-slack} days after the RFQ's required date`);
  }
  if (checks.length) out.push(`Before responding: ${checks.join(", and ")}.`);
  return out;
}

/** The demo clock never runs backwards: local events sort after the seeded ones. */
export function negotiationNow(): string {
  const t = new Date().toISOString();
  return t > OPPORTUNITIES_NOW ? t : OPPORTUNITIES_NOW;
}
