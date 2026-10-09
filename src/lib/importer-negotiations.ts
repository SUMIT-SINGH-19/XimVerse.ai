/**
 * Commercial negotiations between the importer and a supplier, each started
 * from one quotation. A negotiation stores references (requirement, quotation,
 * supplier) and an append-only list of events; the original offer is always
 * derived from the quotation, and the status from the last event.
 *
 * Mock negotiations below are FICTIONAL demo data tied to existing mock
 * requirements, quotations and suppliers.
 */

import {
  formatPrice,
  formatQuantity,
  MOCK_NOW,
  type Currency,
  type Incoterm,
  type PaymentTerm,
  type QuantityUnit,
} from "./import-requirements";
import { formatDate } from "./format";
import { findQuotation, type Quotation } from "./importer-quotations";

/* ------------------------------------------------------------------------ */
/* Types                                                                     */
/* ------------------------------------------------------------------------ */

/** A complete set of commercial terms at one point in a negotiation. */
export interface CommercialOffer {
  unitPrice: number;
  currency: Currency;
  quantity: { amount: number; unit: QuantityUnit };
  incoterm: Incoterm;
  namedPlace: string;
  paymentTerm: PaymentTerm;
  advancePercent: number;
  /** Short wording, e.g. "LC at sight". */
  paymentSummary: string;
  leadTimeDays: number;
  /** YYYY-MM-DD */
  validUntil: string;
  packaging?: string;
  inspection?: string;
}

export type NegotiationParty = "importer" | "supplier" | "system";

export type NegotiationEventType =
  | "original-quotation"
  | "importer-counter"
  | "supplier-revision"
  | "agreement"
  | "withdrawn"
  | "closed";

export interface NegotiationEvent {
  id: string;
  type: NegotiationEventType;
  by: NegotiationParty;
  /** ISO timestamp. */
  at: string;
  /** Immutable snapshot of the terms proposed or agreed. Absent for the original quotation (derived). */
  offer?: CommercialOffer;
  note?: string;
  /** Entered with the demo "Simulate supplier revision" action — not from a real supplier. */
  demo?: boolean;
}

export interface CounterDraft {
  offer: CommercialOffer;
  note?: string;
}

export interface Negotiation {
  id: string;
  requirementId: string;
  quotationId: string;
  supplierId: string;
  /** ISO timestamp the importer started negotiating. */
  startedAt: string;
  events: NegotiationEvent[];
  /** A counter offer the importer saved but hasn't made yet. */
  draft?: CounterDraft;
  /** Started in this browser session rather than part of the demo data. */
  local?: boolean;
}

export type NegotiationStatus =
  | "awaiting-importer"
  | "draft-counter"
  | "awaiting-supplier"
  | "supplier-responded"
  | "agreed"
  | "closed"
  | "withdrawn";

export const NEGOTIATION_STATUSES: readonly { id: NegotiationStatus; label: string }[] = [
  { id: "awaiting-importer", label: "Awaiting Your Response" },
  { id: "draft-counter", label: "Draft Counter Offer" },
  { id: "awaiting-supplier", label: "Awaiting Supplier" },
  { id: "supplier-responded", label: "Supplier Responded" },
  { id: "agreed", label: "Agreement Reached" },
  { id: "closed", label: "Closed" },
  { id: "withdrawn", label: "Withdrawn" },
];

export function negotiationStatusLabel(status: NegotiationStatus): string {
  return NEGOTIATION_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export type WaitingOn = "you" | "supplier" | "agreed" | "closed";

export const WAITING_ON_LABEL: Record<WaitingOn, string> = {
  you: "Waiting on you",
  supplier: "Waiting on supplier",
  agreed: "Agreed",
  closed: "Closed",
};

export const EVENT_LABEL: Record<NegotiationEventType, string> = {
  "original-quotation": "Original Quotation",
  "importer-counter": "Counter Offer",
  "supplier-revision": "Supplier Revision",
  agreement: "Agreement Reached",
  withdrawn: "Negotiation Withdrawn",
  closed: "Negotiation Closed",
};

export const PARTY_LABEL: Record<NegotiationParty, string> = {
  importer: "You",
  supplier: "Supplier",
  system: "XimVerse",
};

export const NEGOTIATION_ID_PATTERN = /^NG-\d{4}-\d{4,}$/;

/* ------------------------------------------------------------------------ */
/* Offers                                                                    */
/* ------------------------------------------------------------------------ */

/** The quotation's terms as a commercial offer — the negotiation baseline. */
export function offerFromQuotation(q: Quotation): CommercialOffer {
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
  };
}

const SINGULAR: Record<QuantityUnit, string> = {
  KG: "kg",
  MT: "MT",
  UNITS: "unit",
  LITRES: "litre",
  CBM: "CBM",
  CONTAINERS: "container",
};

export function formatOfferPrice(o: CommercialOffer): string {
  return `${formatPrice(o.unitPrice, o.currency)} / ${SINGULAR[o.quantity.unit]}`;
}

export function offerValue(o: CommercialOffer): string {
  return formatPrice(o.unitPrice * o.quantity.amount, o.currency);
}

export function formatOfferIncoterm(o: CommercialOffer): string {
  return `${o.incoterm} ${o.namedPlace}`;
}

/** One-line summary used in timelines and cards. */
export function offerSummary(o: CommercialOffer): string {
  return [formatOfferPrice(o), formatOfferIncoterm(o), o.paymentSummary, `${o.leadTimeDays}-day lead time`].join(" · ");
}

export interface TermChange {
  term: string;
  from: string;
  to: string;
}

/** Meaningful differences between two offers, in a stable term order. */
export function offerChanges(from: CommercialOffer, to: CommercialOffer): TermChange[] {
  const out: TermChange[] = [];
  const push = (term: string, a: string, b: string) => {
    if (a !== b) out.push({ term, from: a, to: b });
  };
  push("Unit price", formatOfferPrice(from), formatOfferPrice(to));
  push("Currency", from.currency, to.currency);
  push("Quantity", formatQuantity(from.quantity), formatQuantity(to.quantity));
  push("Incoterm", formatOfferIncoterm(from), formatOfferIncoterm(to));
  push("Payment terms", from.paymentSummary, to.paymentSummary);
  push("Lead time", `${from.leadTimeDays} days`, `${to.leadTimeDays} days`);
  push("Validity", formatDate(from.validUntil), formatDate(to.validUntil));
  push("Packaging", from.packaging ?? "—", to.packaging ?? "—");
  push("Inspection", from.inspection ?? "—", to.inspection ?? "—");
  return out;
}

/* ------------------------------------------------------------------------ */
/* Derivations                                                               */
/* ------------------------------------------------------------------------ */

export function quotationOf(n: Negotiation): Quotation {
  const q = findQuotation(n.quotationId);
  if (!q) throw new Error(`Negotiation ${n.id} references unknown quotation ${n.quotationId}`);
  return q;
}

export function originalOffer(n: Negotiation): CommercialOffer {
  return offerFromQuotation(quotationOf(n));
}

/** The latest proposed (or agreed) terms. */
export function currentOffer(n: Negotiation): CommercialOffer {
  for (let i = n.events.length - 1; i >= 0; i--) {
    const o = n.events[i].offer;
    if (o) return o;
  }
  return originalOffer(n);
}

/** Who made the latest offer: the supplier (original quotation or revision) or you. */
export function lastOfferBy(n: Negotiation): NegotiationParty {
  for (let i = n.events.length - 1; i >= 0; i--) {
    const e = n.events[i];
    if (e.type === "importer-counter") return "importer";
    if (e.type === "supplier-revision" || e.type === "original-quotation") return "supplier";
  }
  return "supplier";
}

export function lastEvent(n: Negotiation): NegotiationEvent {
  return n.events[n.events.length - 1];
}

export function negotiationStatus(n: Negotiation): NegotiationStatus {
  const last = lastEvent(n);
  switch (last.type) {
    case "agreement":
      return "agreed";
    case "closed":
      return "closed";
    case "withdrawn":
      return "withdrawn";
    case "importer-counter":
      return "awaiting-supplier";
    case "supplier-revision":
      return n.draft ? "draft-counter" : "supplier-responded";
    case "original-quotation":
      return n.draft ? "draft-counter" : "awaiting-importer";
  }
}

export function waitingOn(status: NegotiationStatus): WaitingOn {
  if (status === "awaiting-supplier") return "supplier";
  if (status === "agreed") return "agreed";
  if (status === "closed" || status === "withdrawn") return "closed";
  return "you";
}

export function isActiveNegotiation(n: Negotiation): boolean {
  const w = waitingOn(negotiationStatus(n));
  return w === "you" || w === "supplier";
}

export function updatedAt(n: Negotiation): string {
  return lastEvent(n).at > n.startedAt ? lastEvent(n).at : n.startedAt;
}

/** The agreed negotiation for a requirement, if a supplier has been selected through one. */
export function agreementFor(requirementId: string, negotiations: readonly Negotiation[]): Negotiation | undefined {
  return negotiations.find((n) => n.requirementId === requirementId && negotiationStatus(n) === "agreed");
}

/** The negotiation that blocks starting another one for this quotation (active or agreed). */
export function openNegotiationFor(quotationId: string, negotiations: readonly Negotiation[]): Negotiation | undefined {
  return negotiations.find(
    (n) => n.quotationId === quotationId && (isActiveNegotiation(n) || negotiationStatus(n) === "agreed"),
  );
}

export function nextNegotiationId(existing: readonly Negotiation[], year: number): string {
  const max = existing.reduce((m, n) => Math.max(m, Number(n.id.split("-")[2]) || 0), 0);
  return `NG-${year}-${String(max + 1).padStart(4, "0")}`;
}

/** Whether an offer's validity has passed, relative to the demo snapshot date. */
export function isOfferExpired(o: CommercialOffer): boolean {
  return o.validUntil < MOCK_NOW.slice(0, 10);
}

/* ------------------------------------------------------------------------ */
/* Mock data                                                                 */
/* ------------------------------------------------------------------------ */

function revise(q: string, changes: Partial<CommercialOffer>): CommercialOffer {
  const quote = findQuotation(q);
  if (!quote) throw new Error(`Unknown quotation ${q}`);
  return { ...offerFromQuotation(quote), ...changes };
}

const ORIGINAL = (quotationId: string, id = "e0"): NegotiationEvent => {
  const q = findQuotation(quotationId)!;
  return { id, type: "original-quotation", by: "supplier", at: q.receivedAt };
};

const LC_AT_SIGHT = { paymentTerm: "lc", advancePercent: 0, paymentSummary: "LC at sight" } as const;

export const MOCK_NEGOTIATIONS: readonly Negotiation[] = [
  // Basmati · Heritage — several rounds; supplier has just revised.
  {
    id: "NG-2026-0001",
    requirementId: "RFQ-2026-0048",
    quotationId: "QT-2026-0104",
    supplierId: "sup-heritage",
    startedAt: "2026-10-03T11:00:00Z",
    events: [
      ORIGINAL("QT-2026-0104"),
      {
        id: "e1",
        type: "importer-counter",
        by: "importer",
        at: "2026-10-04T06:30:00Z",
        offer: revise("QT-2026-0104", { unitPrice: 1030, leadTimeDays: 40, ...LC_AT_SIGHT }),
        note: "We need arrival before 30 Nov; 50 days does not work for us.",
      },
      {
        id: "e2",
        type: "supplier-revision",
        by: "supplier",
        at: "2026-10-05T09:15:00Z",
        offer: revise("QT-2026-0104", { unitPrice: 1048, leadTimeDays: 42, paymentSummary: "LC at sight", paymentTerm: "lc", validUntil: "2026-10-24" }),
        note: "Can mill from early-November stock; LC at sight accepted.",
      },
      {
        id: "e3",
        type: "importer-counter",
        by: "importer",
        at: "2026-10-06T05:45:00Z",
        offer: revise("QT-2026-0104", { unitPrice: 1040, leadTimeDays: 40, ...LC_AT_SIGHT, validUntil: "2026-10-24" }),
      },
      {
        id: "e4",
        type: "supplier-revision",
        by: "supplier",
        at: "2026-10-06T13:20:00Z",
        offer: revise("QT-2026-0104", { unitPrice: 1042, leadTimeDays: 40, ...LC_AT_SIGHT, validUntil: "2026-10-24" }),
        note: "Final position at 40 days.",
      },
    ],
  },
  // Basmati · Shakti — importer has countered, waiting on the supplier.
  {
    id: "NG-2026-0002",
    requirementId: "RFQ-2026-0048",
    quotationId: "QT-2026-0108",
    supplierId: "sup-shakti",
    startedAt: "2026-10-07T08:30:00Z",
    events: [
      ORIGINAL("QT-2026-0108"),
      {
        id: "e1",
        type: "importer-counter",
        by: "importer",
        at: "2026-10-07T09:05:00Z",
        offer: revise("QT-2026-0108", { unitPrice: 1000, leadTimeDays: 16 }),
        note: "Ready to proceed quickly at this level.",
      },
    ],
  },
  // Basmati · Indus — started; the importer has a saved draft counter.
  {
    id: "NG-2026-0003",
    requirementId: "RFQ-2026-0048",
    quotationId: "QT-2026-0106",
    supplierId: "sup-indus",
    startedAt: "2026-10-06T07:00:00Z",
    events: [ORIGINAL("QT-2026-0106")],
    draft: {
      offer: revise("QT-2026-0106", { unitPrice: 1030, inspection: "SGS pre-shipment inspection; fumigation certificate to be provided with documents." }),
      note: "Fumigation certificate must be included, not on request.",
    },
  },
  // Sunflower oil · Black Sea — supplier responded.
  {
    id: "NG-2026-0004",
    requirementId: "RFQ-2026-0047",
    quotationId: "QT-2026-0098",
    supplierId: "sup-blacksea",
    startedAt: "2026-09-30T12:00:00Z",
    events: [
      ORIGINAL("QT-2026-0098"),
      {
        id: "e1",
        type: "importer-counter",
        by: "importer",
        at: "2026-10-01T06:00:00Z",
        offer: revise("QT-2026-0098", { unitPrice: 1150 }),
      },
      {
        id: "e2",
        type: "supplier-revision",
        by: "supplier",
        at: "2026-10-02T10:30:00Z",
        offer: revise("QT-2026-0098", { unitPrice: 1158, validUntil: "2026-10-25" }),
      },
    ],
  },
  // Cotton yarn · Coimbatore — agreement reached (requirement already shows Supplier Selected).
  {
    id: "NG-2026-0005",
    requirementId: "RFQ-2026-0044",
    quotationId: "QT-2026-0091",
    supplierId: "sup-coimbatore",
    startedAt: "2026-09-06T05:00:00Z",
    events: [
      ORIGINAL("QT-2026-0091"),
      {
        id: "e1",
        type: "importer-counter",
        by: "importer",
        at: "2026-09-08T07:00:00Z",
        offer: revise("QT-2026-0091", { unitPrice: 2.98, leadTimeDays: 18 }),
      },
      {
        id: "e2",
        type: "supplier-revision",
        by: "supplier",
        at: "2026-09-12T09:00:00Z",
        offer: revise("QT-2026-0091", { unitPrice: 3.02, leadTimeDays: 21, validUntil: "2026-10-10" }),
      },
      {
        id: "e3",
        type: "agreement",
        by: "importer",
        at: "2026-09-26T10:00:00Z",
        offer: revise("QT-2026-0091", { unitPrice: 3.02, leadTimeDays: 21, validUntil: "2026-10-10" }),
      },
    ],
  },
  // Cotton yarn · Tiruppur — closed when another supplier was selected.
  {
    id: "NG-2026-0006",
    requirementId: "RFQ-2026-0044",
    quotationId: "QT-2026-0090",
    supplierId: "sup-tiruppur",
    startedAt: "2026-09-06T05:30:00Z",
    events: [
      ORIGINAL("QT-2026-0090"),
      {
        id: "e1",
        type: "importer-counter",
        by: "importer",
        at: "2026-09-08T07:30:00Z",
        offer: revise("QT-2026-0090", { ...LC_AT_SIGHT }),
        note: "We need LC at sight instead of advance.",
      },
      {
        id: "e2",
        type: "closed",
        by: "system",
        at: "2026-09-26T10:00:00Z",
        note: "Closed — another supplier selected.",
      },
    ],
  },

  /* Earlier rounds — agreed, each followed by an order. ---------------- */
  {
    id: "NG-2026-0007",
    requirementId: "RFQ-2026-0038",
    quotationId: "QT-2026-0071",
    supplierId: "sup-blacksea",
    startedAt: "2026-06-10T06:00:00Z",
    events: [
      ORIGINAL("QT-2026-0071"),
      { id: "e1", type: "importer-counter", by: "importer", at: "2026-06-11T07:00:00Z", offer: revise("QT-2026-0071", { unitPrice: 1095 }) },
      { id: "e2", type: "supplier-revision", by: "supplier", at: "2026-06-14T09:00:00Z", offer: revise("QT-2026-0071", { unitPrice: 1105, validUntil: "2026-06-30" }) },
      { id: "e3", type: "agreement", by: "importer", at: "2026-06-18T09:00:00Z", offer: revise("QT-2026-0071", { unitPrice: 1105, validUntil: "2026-06-30" }) },
    ],
  },
  {
    id: "NG-2026-0008",
    requirementId: "RFQ-2026-0039",
    quotationId: "QT-2026-0072",
    supplierId: "sup-punjab",
    startedAt: "2026-07-09T05:00:00Z",
    events: [
      ORIGINAL("QT-2026-0072"),
      {
        id: "e1",
        type: "importer-counter",
        by: "importer",
        at: "2026-07-10T06:00:00Z",
        offer: revise("QT-2026-0072", { unitPrice: 980, advancePercent: 20, paymentSummary: "20% advance / 80% against documents" }),
        note: "We can accept FOB if the advance is reduced to 20%.",
      },
      {
        id: "e2",
        type: "supplier-revision",
        by: "supplier",
        at: "2026-07-15T08:00:00Z",
        offer: revise("QT-2026-0072", { unitPrice: 985, advancePercent: 20, paymentSummary: "20% advance / 80% against documents", validUntil: "2026-07-31" }),
      },
      {
        id: "e3",
        type: "agreement",
        by: "importer",
        at: "2026-07-24T08:30:00Z",
        offer: revise("QT-2026-0072", { unitPrice: 985, advancePercent: 20, paymentSummary: "20% advance / 80% against documents", validUntil: "2026-07-31" }),
      },
    ],
  },
  {
    id: "NG-2026-0009",
    requirementId: "RFQ-2026-0040",
    quotationId: "QT-2026-0073",
    supplierId: "sup-coimbatore",
    startedAt: "2026-07-28T05:00:00Z",
    events: [
      ORIGINAL("QT-2026-0073"),
      { id: "e1", type: "importer-counter", by: "importer", at: "2026-07-30T06:00:00Z", offer: revise("QT-2026-0073", { unitPrice: 3.35, leadTimeDays: 20 }) },
      { id: "e2", type: "supplier-revision", by: "supplier", at: "2026-08-05T07:30:00Z", offer: revise("QT-2026-0073", { unitPrice: 3.39, leadTimeDays: 21, validUntil: "2026-08-25" }) },
      { id: "e3", type: "agreement", by: "importer", at: "2026-08-12T10:00:00Z", offer: revise("QT-2026-0073", { unitPrice: 3.39, leadTimeDays: 21, validUntil: "2026-08-25" }) },
    ],
  },
  {
    id: "NG-2026-0010",
    requirementId: "RFQ-2026-0041",
    quotationId: "QT-2026-0074",
    supplierId: "sup-indus",
    startedAt: "2026-08-18T06:00:00Z",
    events: [
      ORIGINAL("QT-2026-0074"),
      { id: "e1", type: "importer-counter", by: "importer", at: "2026-08-20T06:30:00Z", offer: revise("QT-2026-0074", { unitPrice: 825 }) },
      { id: "e2", type: "supplier-revision", by: "supplier", at: "2026-08-26T09:00:00Z", offer: revise("QT-2026-0074", { unitPrice: 832, validUntil: "2026-09-10" }) },
      { id: "e3", type: "agreement", by: "importer", at: "2026-09-02T09:00:00Z", offer: revise("QT-2026-0074", { unitPrice: 832, validUntil: "2026-09-10" }) },
    ],
  },
  {
    id: "NG-2026-0011",
    requirementId: "RFQ-2026-0042",
    quotationId: "QT-2026-0075",
    supplierId: "sup-pampas",
    startedAt: "2026-09-03T05:00:00Z",
    events: [
      ORIGINAL("QT-2026-0075"),
      { id: "e1", type: "importer-counter", by: "importer", at: "2026-09-05T06:00:00Z", offer: revise("QT-2026-0075", { unitPrice: 1060, leadTimeDays: 25 }), note: "Need loading by early November." },
      { id: "e2", type: "supplier-revision", by: "supplier", at: "2026-09-12T12:00:00Z", offer: revise("QT-2026-0075", { unitPrice: 1070, leadTimeDays: 25, validUntil: "2026-09-30" }) },
      { id: "e3", type: "agreement", by: "importer", at: "2026-09-18T08:00:00Z", offer: revise("QT-2026-0075", { unitPrice: 1070, leadTimeDays: 25, validUntil: "2026-09-30" }) },
    ],
  },
];

export const CLOSED_ANOTHER_SELECTED = "Closed — another supplier selected.";
