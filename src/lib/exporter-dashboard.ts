/*
 * Exporter dashboard: view types and mock data.
 *
 * These are exporter-side *views*, not the marketplace's domain model. They
 * stay local to the exporter until real RFQ / quotation / order entities exist
 * on a backend; then the mocks below are replaced by API calls returning the
 * same shapes.
 */

import { BUYER_OPPORTUNITIES, isOpen, opportunitySummary } from "./exporter-opportunities";
import { buildPipeline, pipelineSummary } from "./exporter-quotation-pipeline";

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

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/** Order stages, in sequence. */
export const ORDER_STAGES = [
  "Order Confirmed",
  "Production",
  "Documentation",
  "Customs Clearance",
  "Shipment",
  "In Transit",
  "Delivered",
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];

export interface ActiveOrder {
  orderId: string;
  product: string;
  destinationCountry: string;
  stage: OrderStage;
  /** 0–100 overall completion. */
  progress: number;
}

export const ACTIVE_ORDERS: readonly ActiveOrder[] = [
  { orderId: "ORD-XM-3021", product: "Basmati Rice", destinationCountry: "UAE", stage: "Documentation", progress: 65 },
  { orderId: "ORD-XM-3018", product: "Rice", destinationCountry: "Saudi Arabia", stage: "Customs Clearance", progress: 82 },
  { orderId: "ORD-XM-3012", product: "Coconut", destinationCountry: "Germany", stage: "Production", progress: 35 },
];

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
  { key: "deals", label: "Active Deals", value: "5", detail: "₹28.4L potential value", slug: "deals" },
  { key: "orders", label: "Active Orders", value: "3", detail: "2 require action", emphasis: true, slug: "orders" },
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
