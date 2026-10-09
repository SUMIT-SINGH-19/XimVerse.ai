/*
 * Deals: the frozen commercial agreement between an accepted offer and its
 * execution (orders, shipments).
 *
 *   RFQ → Opportunity → Quotation → (Negotiation) → Agreement → Deal → Order
 *
 * The importer side has no separate deal: its agreed negotiation becomes an
 * Order (src/lib/importer-orders.ts) carrying an AgreedOrderTerms snapshot.
 * Exporter deal terms reuse that shape (type-only import) and add the
 * exporter's logistics and compliance commitments, so a deal can seed an
 * order later without renaming anything. Nothing like the importer's
 * PurchaseOrder (buyer addresses and contacts) exists here.
 *
 * Immutability: `terms` is copied once, when the deal is created —
 * from the agreement event's offer for negotiated deals, or from the accepted
 * quotation for direct acceptances — and never recalculated. Status is
 * derived from an append-only event list.
 *
 * IDs: DL-YYYY-NNNN. Seeds use 8100+, deals created in this browser 9001+.
 */

import type { AgreedOrderTerms } from "./importer-orders";
import { EXPORTER_COMPANY_ID } from "./exporter-company";
import { findOpportunity, type BuyerOpportunity } from "./exporter-opportunities";
import { SEEDED_QUOTATIONS } from "./exporter-quotation-history";
import {
  defaultCoverage,
  formatMoney,
  type ComplianceResponse,
  type CostCoverage,
  type ExporterQuotation,
} from "./exporter-quotations";
import {
  agreedTerms,
  negotiationStatus,
  SEEDED_NEGOTIATIONS,
  type ExporterNegotiation,
} from "./exporter-negotiations";

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type ComplianceCommitment = "committed" | "arrangement-required" | "not-committed";

export const COMMITMENT_LABEL: Record<ComplianceCommitment, string> = {
  committed: "Committed",
  "arrangement-required": "Arrangement required",
  "not-committed": "Not committed",
};

const FROM_RESPONSE: Record<ComplianceResponse, ComplianceCommitment> = {
  "can-provide": "committed",
  "needs-arrangement": "arrangement-required",
  "cannot-provide": "not-committed",
};

/** The importer's AgreedOrderTerms plus what the exporter committed to deliver. */
export type DealTerms = AgreedOrderTerms & {
  costCoverage: { freight: CostCoverage; insurance: CostCoverage };
  portOfLoading?: string;
  /** YYYY-MM-DD */
  earliestDispatch?: string;
  /** YYYY-MM-DD, as agreed. */
  estimatedDelivery?: string;
  /** YYYY-MM-DD, the RFQ's required date. */
  requiredBy?: string;
  complianceCommitments: { name: string; commitment: ComplianceCommitment }[];
};

export type DealSource = "accepted-quotation" | "negotiated-agreement";

export const DEAL_SOURCE_LABEL: Record<DealSource, string> = {
  "accepted-quotation": "Direct Acceptance",
  "negotiated-agreement": "Negotiated Agreement",
};

/**
 * Whether the exporter may see the buyer's identity. Agreement alone doesn't
 * unlock it; Ximverse policy and verification do (not built yet).
 */
export type CounterpartyAccess = "protected" | "pending-verification" | "approved" | "shared";

export const COUNTERPARTY_ACCESS_LABEL: Record<CounterpartyAccess, string> = {
  protected: "Protected",
  "pending-verification": "Pending Verification",
  approved: "Approved",
  shared: "Shared",
};

export type DealEventType = "created" | "exporter-confirmed" | "ready-for-execution" | "on-hold" | "resumed" | "cancelled" | "completed";

export interface DealEvent {
  id: string;
  type: DealEventType;
  by: "supplier" | "importer" | "system";
  /** ISO timestamp. */
  at: string;
  note?: string;
}

export interface ExporterDeal {
  /** DL-YYYY-NNNN */
  id: string;
  requirementId: string;
  opportunityId: string;
  quotationId: string;
  negotiationId?: string;
  exporterCompanyId: string;
  source: DealSource;
  /** Frozen at creation. Never recalculated. */
  terms: DealTerms;
  counterpartyAccess: CounterpartyAccess;
  /** ISO timestamp. */
  createdAt: string;
  events: readonly DealEvent[];
}

export type DealStatus = "pending-setup" | "confirmed" | "ready-for-execution" | "on-hold" | "cancelled" | "completed";

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  "pending-setup": "Pending Setup",
  confirmed: "Confirmed",
  "ready-for-execution": "Ready for Execution",
  "on-hold": "On Hold",
  cancelled: "Cancelled",
  completed: "Completed",
};

/** Derived from the latest status-changing event, like importer orders. */
export function dealStatus(d: ExporterDeal): DealStatus {
  let status: DealStatus = "pending-setup";
  let beforeHold: DealStatus = status;
  for (const e of d.events) {
    switch (e.type) {
      case "exporter-confirmed":
        status = "confirmed";
        break;
      case "ready-for-execution":
        status = "ready-for-execution";
        break;
      case "on-hold":
        beforeHold = status;
        status = "on-hold";
        break;
      case "resumed":
        status = beforeHold;
        break;
      case "cancelled":
        status = "cancelled";
        break;
      case "completed":
        status = "completed";
        break;
    }
  }
  return status;
}

export function isActiveDeal(status: DealStatus): boolean {
  return status !== "cancelled" && status !== "completed";
}

export function dealUpdatedAt(d: ExporterDeal): string {
  return d.events.reduce((latest, e) => (e.at > latest ? e.at : latest), d.createdAt);
}

/** unitPrice × quantity in minor units, without float drift. */
export function dealValueMinor(t: Pick<DealTerms, "unitPrice" | "quantity">): number {
  return Math.round(Math.round(t.unitPrice * 100) * t.quantity.amount);
}

// ---------------------------------------------------------------------------
// Building terms (the only place terms are produced)
// ---------------------------------------------------------------------------

function commitments(q: ExporterQuotation): DealTerms["complianceCommitments"] {
  const out = q.compliance.documents.map((d) => ({ name: d.name, commitment: FROM_RESPONSE[d.response] }));
  if (q.compliance.inspection) {
    out.push({ name: `Inspection: ${q.compliance.inspection}`, commitment: q.compliance.inspectionAccepted ? "committed" : "not-committed" });
  }
  return out;
}

/** Terms from a negotiation's agreement event — never from the original quotation's price. */
export function termsFromAgreement(n: ExporterNegotiation, q: ExporterQuotation, o: BuyerOpportunity | undefined): DealTerms | undefined {
  const agreement = n.events.findLast((e) => e.type === "agreement");
  const offer = agreedTerms(n);
  if (!agreement || !offer) return undefined;
  // The last note attached to a commercial position — agreement wording, not private notes.
  const note = n.events.findLast((e) => e.offer && e.note && e.by !== "system")?.note;
  return {
    productName: o?.product.name ?? q.product.description,
    specification: q.product.description,
    hsCode: q.product.hsCode,
    quantity: { ...offer.quantity },
    unitPrice: offer.unitPrice,
    currency: offer.currency,
    incoterm: offer.incoterm,
    namedPlace: offer.namedPlace,
    paymentTerm: offer.paymentTerm,
    advancePercent: offer.advancePercent,
    paymentSummary: offer.paymentSummary,
    leadTimeDays: offer.leadTimeDays,
    packaging: offer.packaging,
    inspection: offer.inspection,
    commercialNote: note,
    agreedAt: agreement.at,
    // Coverage follows the agreed Incoterm if negotiation changed it.
    costCoverage: offer.incoterm === q.price.incoterm ? { ...q.costCoverage } : defaultCoverage(offer.incoterm),
    portOfLoading: q.delivery.portOfLoading,
    earliestDispatch: q.delivery.earliestDispatch,
    estimatedDelivery: offer.estimatedDelivery ?? q.delivery.estimatedDelivery,
    requiredBy: o?.delivery.requiredBy,
    complianceCommitments: commitments(q),
  };
}

/** Terms from a quotation accepted as submitted. */
export function termsFromQuotation(q: ExporterQuotation, o: BuyerOpportunity | undefined, acceptedAt: string): DealTerms {
  return {
    productName: o?.product.name ?? q.product.description,
    specification: q.product.description,
    hsCode: q.product.hsCode,
    quantity: { ...q.product.quantity },
    unitPrice: q.price.unitPrice,
    currency: q.price.currency,
    incoterm: q.price.incoterm,
    namedPlace: q.price.namedPlace,
    paymentTerm: q.commercial.paymentTerm,
    advancePercent: q.commercial.advancePercent,
    paymentSummary: q.commercial.paymentSummary,
    leadTimeDays: q.delivery.leadTimeDays,
    packaging: q.product.packaging,
    inspection: q.compliance.inspection,
    commercialNote: q.commercial.notes,
    agreedAt: acceptedAt,
    costCoverage: { ...q.costCoverage },
    portOfLoading: q.delivery.portOfLoading,
    earliestDispatch: q.delivery.earliestDispatch,
    estimatedDelivery: q.delivery.estimatedDelivery,
    requiredBy: o?.delivery.requiredBy,
    complianceCommitments: commitments(q),
  };
}

// ---------------------------------------------------------------------------
// Eligibility and duplicate prevention
// ---------------------------------------------------------------------------

export function dealForQuotation(quotationId: string, deals: readonly ExporterDeal[]): ExporterDeal | undefined {
  return deals.find((d) => d.quotationId === quotationId);
}

export function dealForNegotiation(negotiationId: string, deals: readonly ExporterDeal[]): ExporterDeal | undefined {
  return deals.find((d) => d.negotiationId === negotiationId);
}

export type DealEligibility =
  | { ok: true; source: DealSource; terms: DealTerms }
  | { ok: false; reason: "deal-exists" | "not-agreed" | "not-accepted" | "invalid-terms"; deal?: ExporterDeal };

/**
 * Whether a deal can be created for this quotation (and its negotiation, if
 * any). One quotation / agreement produces at most one deal.
 */
export function dealEligibility(
  q: ExporterQuotation,
  negotiation: ExporterNegotiation | undefined,
  deals: readonly ExporterDeal[],
): DealEligibility {
  const existing = dealForQuotation(q.id, deals) ?? (negotiation && dealForNegotiation(negotiation.id, deals));
  if (existing) return { ok: false, reason: "deal-exists", deal: existing };
  const o = findOpportunity(q.requirementId);
  if (negotiation) {
    if (negotiationStatus(negotiation) !== "agreed") return { ok: false, reason: "not-agreed" };
    const terms = termsFromAgreement(negotiation, q, o);
    if (!terms || terms.unitPrice <= 0 || terms.quantity.amount <= 0) return { ok: false, reason: "invalid-terms" };
    return { ok: true, source: "negotiated-agreement", terms };
  }
  if (q.status !== "accepted") return { ok: false, reason: "not-accepted" };
  return { ok: true, source: "accepted-quotation", terms: termsFromQuotation(q, o, q.feedback?.at ?? q.updatedAt) };
}

export const LOCAL_DEAL_ID = /^DL-\d{4}-9\d{3,}$/;

/** Next browser-created deal id: deterministic, from the deals already stored. */
export function nextDealId(local: readonly { id: string }[], year: number): string {
  const max = local.reduce((m, d) => Math.max(m, Number(d.id.split("-")[2]) || 0), 9000);
  return `DL-${year}-${max + 1}`;
}

// ---------------------------------------------------------------------------
// Setup milestones and readiness
// ---------------------------------------------------------------------------

export interface DealMilestone {
  key: string;
  label: string;
  done: boolean;
  detail?: string;
}

export function dealMilestones(d: ExporterDeal): DealMilestone[] {
  const types = new Set(d.events.map((e) => e.type));
  const status = dealStatus(d);
  const confirmed = types.has("exporter-confirmed") || status === "ready-for-execution" || status === "completed";
  const arrangements = d.terms.complianceCommitments.filter((c) => c.commitment !== "committed");
  return [
    { key: "agreed", label: "Commercial terms agreed", done: true },
    { key: "confirmed", label: "Exporter confirmed deal terms", done: confirmed },
    {
      key: "compliance",
      label: "Compliance commitments captured",
      done: true,
      detail: arrangements.length ? `${arrangements.map((c) => c.name).join(", ")} still to arrange` : undefined,
    },
    {
      key: "counterparty",
      label: "Counterparty verification",
      done: d.counterpartyAccess === "approved" || d.counterpartyAccess === "shared",
      detail: d.counterpartyAccess === "pending-verification" ? "Ximverse verification in progress" : undefined,
    },
    { key: "payment", label: "Payment instrument confirmed", done: false, detail: "Awaiting buyer instrument" },
    { key: "order", label: "Order created", done: false, detail: "Orders are the next feature" },
  ];
}

/** Share of setup milestones complete — readiness to enter execution. */
export function dealReadiness(d: ExporterDeal): number {
  const m = dealMilestones(d);
  return Math.round((m.filter((x) => x.done).length / m.length) * 100);
}

/** Rule-based SUMIT notes. No AI. */
export function dealInsights(d: ExporterDeal): string[] {
  const t = d.terms;
  const price = formatMoney(Math.round(t.unitPrice * 100), t.currency);
  const out = [
    `The commercial agreement is complete at ${price} / ${t.quantity.unit} for ${t.quantity.amount.toLocaleString("en-US")} ${t.quantity.unit}. Before execution, confirm the payment instrument (${t.paymentSummary}) and create the operational order.`,
  ];
  for (const c of t.complianceCommitments.filter((x) => x.commitment === "arrangement-required")) {
    out.push(`${c.name} remains an execution requirement${/fumigation/i.test(c.name) ? " and should be scheduled before stuffing" : ""}.`);
  }
  if (t.estimatedDelivery && t.requiredBy && t.estimatedDelivery > t.requiredBy) {
    out.push("The agreed delivery date is after the RFQ's required date — confirm the buyer accepted this when setting up the order.");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Seeded deals (demo)
// ---------------------------------------------------------------------------

function seededDeal(
  id: string,
  quotationId: string,
  opts: { negotiationId?: string; createdAt: string; access: CounterpartyAccess; confirmedAt?: string },
): ExporterDeal {
  const q = SEEDED_QUOTATIONS.find((x) => x.id === quotationId)!;
  const o = findOpportunity(q.requirementId);
  const n = opts.negotiationId ? SEEDED_NEGOTIATIONS.find((x) => x.id === opts.negotiationId) : undefined;
  const terms = n ? termsFromAgreement(n, q, o) : termsFromQuotation(q, o, q.feedback?.at ?? q.updatedAt);
  if (!terms) throw new Error(`Seed ${id}: no agreed terms`);
  const events: DealEvent[] = [{ id: `${id}-e0`, type: "created", by: "supplier", at: opts.createdAt }];
  if (opts.confirmedAt) events.push({ id: `${id}-e1`, type: "exporter-confirmed", by: "supplier", at: opts.confirmedAt });
  return {
    id,
    requirementId: q.requirementId,
    opportunityId: q.opportunityId,
    quotationId,
    negotiationId: n?.id,
    exporterCompanyId: EXPORTER_COMPANY_ID,
    source: n ? "negotiated-agreement" : "accepted-quotation",
    terms,
    counterpartyAccess: opts.access,
    createdAt: opts.createdAt,
    events,
  };
}

export const SEEDED_DEALS: readonly ExporterDeal[] = [
  // From NG-2026-8103's agreement ($1,085, down from the $1,090 quotation).
  seededDeal("DL-2026-8101", "QT-2026-8162", {
    negotiationId: "NG-2026-8103",
    createdAt: "2026-09-12T13:00:00Z",
    confirmedAt: "2026-09-13T06:00:00Z",
    access: "pending-verification",
  }),
  // Accepted as submitted, no negotiation.
  seededDeal("DL-2026-8102", "QT-2026-8132", { createdAt: "2026-08-26T12:00:00Z", access: "protected" }),
];

export const SEEDED_DEAL_IDS = SEEDED_DEALS.map((d) => d.id);

export function findSeededDeal(id: string): ExporterDeal | undefined {
  return SEEDED_DEALS.find((d) => d.id === id);
}
