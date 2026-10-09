/*
 * Exporter dashboard: view types and mock data.
 *
 * These are exporter-side *views*, not the marketplace's domain model. They
 * stay local to the exporter until real RFQ / quotation / order entities exist
 * on a backend; then the mocks below are replaced by API calls returning the
 * same shapes.
 */

import { BUYER_OPPORTUNITIES, isOpen, opportunitySummary, shortCountry } from "./exporter-opportunities";
import { actionsRequired, isActiveOrder, orderState, readinessScore, SEEDED_ORDERS } from "./exporter-orders";
import { buildPipeline, formatCompactMoney, pipelineSummary } from "./exporter-quotation-pipeline";
import { dealStatus, dealValueMinor, isActiveDeal, SEEDED_DEALS } from "./exporter-deals";

// ---------------------------------------------------------------------------
// Buyer opportunities (dataset lives in exporter-opportunities.ts)
// ---------------------------------------------------------------------------

/** The dashboard's shortlist: open opportunities, best match first. */
export const TOP_OPPORTUNITIES = BUYER_OPPORTUNITIES.filter(isOpen)
  .sort((a, b) => b.match.score - a.match.score)
  .slice(0, 5);

/** Exporter capacity figures. MT only for now — see OpportunityQuantity for buyer-side units. */
export interface Quantity {
  value: number;
  unit: "MT";
}

// ---------------------------------------------------------------------------
// Quotations (seeded history lives in exporter-quotation-history.ts)
// ---------------------------------------------------------------------------

const SEEDED_ROWS = buildPipeline([], {});

/**
 * Latest seeded quotations for the dashboard. Prerendered, so quotations
 * created in this browser appear on My Quotations rather than here.
 */
export const RECENT_QUOTATION_ROWS = SEEDED_ROWS.toSorted((a, b) => b.activityAt.localeCompare(a.activityAt)).slice(0, 3);

const QUOTE_SUMMARY = pipelineSummary(SEEDED_ROWS);

// Seeded deals only: the dashboard is prerendered, so deals created in this
// browser show on the Deals page but not here.
const ACTIVE_DEALS = SEEDED_DEALS.filter((d) => isActiveDeal(dealStatus(d)));
const DEAL_VALUE_BY_CURRENCY = ACTIVE_DEALS.reduce<Record<string, number>>((acc, d) => {
  acc[d.terms.currency] = (acc[d.terms.currency] ?? 0) + dealValueMinor(d.terms);
  return acc;
}, {});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface ActiveOrder {
  orderId: string;
  product: string;
  destinationCountry: string;
  /** Execution stage label. */
  stage: string;
  /** 0–100 pre-shipment readiness. */
  progress: number;
}

// Seeded orders only: the dashboard is prerendered, so orders created in this
// browser show on the Orders page but not here.
const SEEDED_ORDER_ROWS = SEEDED_ORDERS.map((o) => ({ o, s: orderState(o) })).filter((x) => isActiveOrder(x.s.status));

export const ACTIVE_ORDERS: readonly ActiveOrder[] = SEEDED_ORDER_ROWS.map(({ o, s }) => {
  const opp = BUYER_OPPORTUNITIES.find((x) => x.rfqId === o.requirementId);
  return {
    orderId: o.id,
    product: o.terms.productName,
    destinationCountry: opp ? shortCountry(opp.delivery.destinationCountry) : "—",
    stage: s.stage,
    progress: readinessScore(o, s),
  };
});

const ORDERS_NEEDING_ACTION = SEEDED_ORDER_ROWS.filter(({ o, s }) => actionsRequired(o, s).length > 0).length;

// ---------------------------------------------------------------------------
// KPIs, actions and assistant prompts
// ---------------------------------------------------------------------------

export interface ExporterKpi {
  key: string;
  label: string;
  /** Pre-formatted headline figure. */
  value: string;
  detail: string;
  /** Highlights the detail line when it calls for attention. */
  emphasis?: boolean;
  /** Nav slug the card links to. */
  slug: string;
}

const OPEN_SUMMARY = opportunitySummary(BUYER_OPPORTUNITIES);

export const EXPORTER_KPIS: readonly ExporterKpi[] = [
  {
    key: "opportunities",
    label: "Buyer Opportunities",
    value: String(OPEN_SUMMARY.open),
    detail: `${OPEN_SUMMARY.newCount} new`,
    emphasis: true,
    slug: "opportunities",
  },
  {
    key: "quotations",
    label: "Active Quotations",
    value: String(QUOTE_SUMMARY.active),
    detail: `${QUOTE_SUMMARY.byStatus.submitted + QUOTE_SUMMARY.byStatus["under-review"]} awaiting response`,
    slug: "quotations",
  },
  {
    key: "deals",
    label: "Active Deals",
    value: String(ACTIVE_DEALS.length),
    detail: Object.entries(DEAL_VALUE_BY_CURRENCY)
      .map(([c, minor]) => formatCompactMoney(minor, c as "USD"))
      .join(" · ") + " contract value",
    slug: "deals",
  },
  {
    key: "orders",
    label: "Active Orders",
    value: String(SEEDED_ORDER_ROWS.length),
    detail: `${ORDERS_NEEDING_ACTION} require action`,
    emphasis: ORDERS_NEEDING_ACTION > 0,
    slug: "orders",
  },
  { key: "revenue", label: "Revenue", value: "₹42.6L", detail: "This month", slug: "analytics" },
];

export interface ActionItem {
  key: string;
  count: number;
  /** Completes the sentence after the count, e.g. "opportunities closing within 24 hours". */
  label: string;
  urgent?: boolean;
  slug: string;
}

export const ACTION_ITEMS: readonly ActionItem[] = [
  { key: "closing", count: 3, label: "opportunities closing within 24 hours", urgent: true, slug: "opportunities" },
  { key: "revisions", count: 2, label: "quotations awaiting revision", slug: "quotations" },
  { key: "missing-doc", count: 1, label: "shipment document missing", urgent: true, slug: "documents" },
  { key: "repricing", count: 1, label: "buyer requested updated pricing", slug: "quotations" },
];

export const SUMIT_PROMPTS: readonly string[] = [
  "Which opportunities should I prioritise?",
  "Compare my active quotations.",
  "What documents are missing?",
  "Which markets have the highest demand for my products?",
];

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10-20" → "20 Oct 2026". */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`));
}

export function formatQuantity({ value, unit }: Quantity): string {
  return `${value.toLocaleString("en-IN")} ${unit}`;
}
