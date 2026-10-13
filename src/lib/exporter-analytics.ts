/*
 * Analytics: a projection over canonical exporter records. Nothing here is
 * stored — every figure is rebuilt from opportunities, quotations (pipeline),
 * negotiations, deals, orders, shipments and the document index, using their
 * own status helpers.
 *
 * Honesty rules:
 *   - money is grouped by currency, never converted or summed across currencies;
 *   - quantities are grouped by unit, never added across units;
 *   - a rate or duration without enough comparable records is `undefined`
 *     ("Insufficient data"), never 0;
 *   - lifecycle stages are not added together (one transaction moves through many).
 */

import type { Currency, QuantityUnit } from "./import-requirements";
import type { DocumentItem } from "./exporter-documents";
import { workspaceReadiness, type DocumentSources } from "./exporter-documents";
import { dealStatus, dealValueMinor, type DealStatus, type ExporterDeal } from "./exporter-deals";
import { negotiationStatus, offerValueMinor, yourCurrentOffer, type ExporterNegotiation, type ExporterNegotiationStatus } from "./exporter-negotiations";
import { BUYER_OPPORTUNITIES, shortCountry, type BuyerOpportunity } from "./exporter-opportunities";
import { actionsRequired, orderState, type ExporterOrder, type OrderStatus } from "./exporter-orders";
import { EXPORTER_PRODUCTS } from "./exporter-products";
import type { PipelineRow } from "./exporter-quotation-pipeline";
import type { ExporterQuotationStatus } from "./exporter-quotations";
import { DEMO_TODAY } from "./exporter-quotations";
import {
  customsReadiness,
  freightReadiness,
  isPreDeparture,
  orderStateWithShipments,
  score,
  shipmentState,
  type ExporterShipment,
  type ShipmentStatus,
} from "./exporter-shipments";

// ---------------------------------------------------------------------------
// Inputs and range
// ---------------------------------------------------------------------------

export interface AnalyticsSources {
  opportunities?: readonly BuyerOpportunity[];
  pipeline: readonly PipelineRow[];
  negotiations: readonly ExporterNegotiation[];
  deals: readonly ExporterDeal[];
  orders: readonly ExporterOrder[];
  shipments: readonly ExporterShipment[];
  documents: readonly DocumentItem[];
}

export type RangeKey = "all" | "30d" | "90d" | "year";
export const RANGE_LABEL: Record<RangeKey, string> = { all: "All Time", "30d": "Last 30 Days", "90d": "Last 90 Days", year: "This Year" };

/** Lower bound only, against the demo date; records after it (browser-created) are always in range. */
export function rangeStart(r: RangeKey, today = DEMO_TODAY): string | undefined {
  if (r === "all") return undefined;
  if (r === "year") return `${today.slice(0, 4)}-01-01`;
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (r === "30d" ? 30 : 90));
  return d.toISOString().slice(0, 10);
}
const inRange = (at: string | undefined, start: string | undefined) => !start || (at !== undefined && at.slice(0, 10) >= start);

// ---------------------------------------------------------------------------
// Small value types
// ---------------------------------------------------------------------------

/** A rate with its basis; percent is undefined when the basis is empty. */
export interface Rate {
  num: number;
  den: number;
  percent?: number;
}
const rate = (num: number, den: number, min = 1): Rate => ({ num, den, percent: den >= min ? Math.round((num / den) * 1000) / 10 : undefined });

/** Durations in hours, with the records that qualified. */
export interface Duration {
  sample: number;
  avgHours?: number;
  medianHours?: number;
  minHours?: number;
  maxHours?: number;
}
const hoursBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 3_600_000;
function duration(values: number[]): Duration {
  const v = values.filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  if (!v.length) return { sample: 0 };
  const avg = v.reduce((t, x) => t + x, 0) / v.length;
  const mid = v.length >= 3 ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : undefined;
  return { sample: v.length, avgHours: avg, medianHours: mid, minHours: v[0], maxHours: v.at(-1) };
}

/** Money grouped by currency, in minor units. */
export type ByCurrency = Partial<Record<Currency, number>>;
function addMoney(acc: ByCurrency, currency: Currency, minor: number) {
  acc[currency] = (acc[currency] ?? 0) + minor;
}
/** Quantities grouped by unit. */
export type ByUnit = Partial<Record<QuantityUnit, number>>;
function addQty(acc: ByUnit, unit: QuantityUnit, amount: number) {
  acc[unit] = (acc[unit] ?? 0) + amount;
}

const countBy = <T extends string>(keys: readonly T[]) => {
  const out = {} as Record<T, number>;
  for (const k of keys) out[k] = (out[k] ?? 0) + 1;
  return out;
};

const productName = (id: string | undefined, fallback: string) => EXPORTER_PRODUCTS.find((p) => p.id === id)?.name ?? fallback;

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

const ACTIVE_QUOTE: readonly ExporterQuotationStatus[] = ["submitted", "under-review", "shortlisted", "revision-requested", "negotiation"];
const SHORTLISTED_OR_LATER: readonly ExporterQuotationStatus[] = ["shortlisted", "negotiation", "accepted"];
/** Offer exchanges only — not notes, not the original quotation, not closure. */
const ROUND_EVENTS = new Set(["importer-counter", "revision-request", "supplier-revision", "supplier-kept-offer"]);

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  definition: string;
  href: string;
}

export interface PriceMove {
  negotiationId: string;
  quotationId: string;
  currency: Currency;
  unit: QuantityUnit;
  original: number;
  agreed: number;
  diff: number;
  percent: number;
}

export interface GroupRow {
  key: string;
  label: string;
  opportunities: number;
  quoted: number;
  negotiated: number;
  won: number;
  finalised: number;
  winRate: Rate;
  deals: number;
  dealValue: ByCurrency;
  activeOrders: number;
  orders: number;
  delivered: number;
}

export function buildAnalytics(src: AnalyticsSources, range: RangeKey = "all") {
  const start = rangeStart(range);
  const opportunities = (src.opportunities ?? BUYER_OPPORTUNITIES).filter((o) => inRange(o.sharedAt, start));
  const oppIds = new Set(opportunities.map((o) => o.rfqId));
  const quotes = src.pipeline.filter((r) => r.kind === "quotation" && r.quotation && r.quotation.status !== "draft" && inRange(r.quotation.submittedAt ?? r.quotation.createdAt, start));
  const negotiations = src.negotiations.filter((n) => inRange(n.events[0]?.at, start));
  const deals = src.deals.filter((d) => inRange(d.createdAt, start));
  const orders = src.orders.filter((o) => inRange(o.createdAt, start));
  const shipments = src.shipments.filter((s) => inRange(s.createdAt, start));
  const negStatus = new Map(negotiations.map((n) => [n.id, negotiationStatus(n)]));
  const shipStates = new Map(src.shipments.map((s) => [s.id, shipmentState(s)]));

  // ---- Funnel: unique RFQs at each stage ------------------------------------------------
  const quotedRfqs = new Set(quotes.map((r) => r.rfqId));
  const shortlistedRfqs = new Set(quotes.filter((r) => SHORTLISTED_OR_LATER.includes(r.status)).map((r) => r.rfqId));
  const negotiatedRfqs = new Set(negotiations.map((n) => n.requirementId));
  const agreedRfqs = new Set([...quotes.filter((r) => r.status === "accepted").map((r) => r.rfqId), ...negotiations.filter((n) => negStatus.get(n.id) === "agreed").map((n) => n.requirementId)]);
  const dealRfqs = new Set(deals.map((d) => d.requirementId));
  const orderRfqs = new Set(orders.map((o) => o.requirementId));
  const deliveredRfqs = new Set(shipments.filter((s) => shipStates.get(s.id)?.status === "delivered").map((s) => s.requirementId));
  const funnel: FunnelStage[] = [
    { key: "opportunities", label: "Opportunities", count: opportunities.length, definition: "Buyer opportunities shared with you", href: "/exporter/opportunities" },
    { key: "quoted", label: "Quoted", count: quotedRfqs.size, definition: "Opportunities with at least one submitted quotation (drafts excluded)", href: "/exporter/quotations" },
    { key: "shortlisted", label: "Shortlisted", count: shortlistedRfqs.size, definition: "Quotation now shortlisted, in negotiation or accepted", href: "/exporter/quotations" },
    { key: "negotiated", label: "Negotiated", count: negotiatedRfqs.size, definition: "Opportunities with a negotiation", href: "/exporter/negotiations" },
    { key: "agreed", label: "Accepted / Agreed", count: agreedRfqs.size, definition: "Quotation accepted or negotiation agreement reached", href: "/exporter/quotations" },
    { key: "deals", label: "Deals", count: dealRfqs.size, definition: "Opportunities that became a deal", href: "/exporter/deals" },
    { key: "orders", label: "Orders", count: orderRfqs.size, definition: "Deals that became an order", href: "/exporter/orders" },
    { key: "delivered", label: "Delivered", count: deliveredRfqs.size, definition: "Orders with at least one delivered shipment", href: "/exporter/shipments" },
  ];

  // ---- Quotations -------------------------------------------------------------------------
  const quoteStatus = countBy(quotes.map((r) => r.status));
  const accepted = quoteStatus.accepted ?? 0;
  const rejected = quoteStatus.rejected ?? 0;
  const quotedValue: ByCurrency = {};
  const activePipeline: ByCurrency = {};
  for (const r of quotes) {
    if (r.totalMinor === undefined || !r.currency) continue;
    addMoney(quotedValue, r.currency, r.totalMinor);
    if (ACTIVE_QUOTE.includes(r.status) && !r.negotiationId) addMoney(activePipeline, r.currency, r.totalMinor);
  }
  const oppById = new Map(opportunities.map((o) => [o.rfqId, o]));
  const timeToQuote = duration(quotes.flatMap((r) => {
    const o = oppById.get(r.rfqId);
    return o && r.quotation?.submittedAt ? [hoursBetween(o.sharedAt, r.quotation.submittedAt)] : [];
  }));

  // ---- Negotiations -----------------------------------------------------------------------
  const negCounts = countBy([...negStatus.values()]) as Partial<Record<ExporterNegotiationStatus, number>>;
  const agreedN = negCounts.agreed ?? 0;
  const finalisedN = agreedN + (negCounts.closed ?? 0) + (negCounts.withdrawn ?? 0);
  const rounds = negotiations.map((n) => n.events.filter((e) => ROUND_EVENTS.has(e.type)).length);
  const roundBuckets = { one: rounds.filter((r) => r === 1).length, two: rounds.filter((r) => r === 2).length, threePlus: rounds.filter((r) => r >= 3).length };
  const priceMoves: PriceMove[] = [];
  let incomparable = 0;
  const negotiationPipeline: ByCurrency = {};
  for (const n of negotiations) {
    const st = negStatus.get(n.id)!;
    if (st === "awaiting-exporter" || st === "awaiting-buyer" || st === "revision-requested" || st === "draft-counter") {
      const o = yourCurrentOffer(n);
      addMoney(negotiationPipeline, o.currency, offerValueMinor(o));
    }
    if (st !== "agreed") continue;
    const agreedOffer = n.events.findLast((e) => e.type === "agreement")?.offer;
    const orig = n.originalQuotationSnapshot;
    if (!agreedOffer || agreedOffer.currency !== orig.currency || agreedOffer.quantity.unit !== orig.quantity.unit) {
      incomparable += 1;
      continue;
    }
    const diff = agreedOffer.unitPrice - orig.unitPrice;
    priceMoves.push({ negotiationId: n.id, quotationId: n.quotationId, currency: orig.currency, unit: orig.quantity.unit, original: orig.unitPrice, agreed: agreedOffer.unitPrice, diff, percent: Math.round((diff / orig.unitPrice) * 10000) / 100 });
  }

  // ---- Deals --------------------------------------------------------------------------------
  const dealStates = deals.map((d) => ({ d, s: dealStatus(d) }));
  const dealCounts = countBy(dealStates.map((x) => x.s)) as Partial<Record<DealStatus, number>>;
  const dealValue: ByCurrency = {};
  const bySource = { direct: { count: 0, value: {} as ByCurrency }, negotiated: { count: 0, value: {} as ByCurrency } };
  for (const { d } of dealStates) {
    const v = dealValueMinor(d.terms);
    addMoney(dealValue, d.terms.currency, v);
    const bucket = d.source === "negotiated-agreement" ? bySource.negotiated : bySource.direct;
    bucket.count += 1;
    addMoney(bucket.value, d.terms.currency, v);
  }

  // ---- Orders -------------------------------------------------------------------------------
  const orderRows = orders.map((o) => ({ o, s: orderStateWithShipments(o, src.shipments) }));
  const orderCounts = countBy(orderRows.map((x) => x.s.status)) as Partial<Record<OrderStatus, number>>;
  const activeOrders = orderRows.filter((x) => x.s.status !== "completed" && x.s.status !== "cancelled");
  const orderValue: ByCurrency = {};
  for (const { o } of activeOrders) addMoney(orderValue, o.terms.currency, dealValueMinor(o.terms));
  const firstAt = (o: ExporterOrder, type: string) => o.events.find((e) => e.type === type)?.at;
  const orderCycles = {
    confirm: duration(orders.flatMap((o) => (firstAt(o, "supplier-confirmed") ? [hoursBetween(o.createdAt, firstAt(o, "supplier-confirmed")!)] : []))),
    production: duration(orders.flatMap((o) => (firstAt(o, "production-started") && firstAt(o, "production-completed") ? [hoursBetween(firstAt(o, "production-started")!, firstAt(o, "production-completed")!)] : []))),
    firstShipment: duration(orders.flatMap((o) => {
      const first = src.shipments.filter((s) => s.orderId === o.id).map((s) => s.createdAt).sort()[0];
      return first ? [hoursBetween(o.createdAt, first)] : [];
    })),
    completed: duration(orderRows.flatMap(({ o, s }) => {
      if (s.status !== "completed") return [];
      const last = src.shipments.filter((x) => x.orderId === o.id).map((x) => shipStates.get(x.id)?.milestones.delivered).filter((x): x is string => Boolean(x)).sort().at(-1);
      return last ? [hoursBetween(o.createdAt, last)] : [];
    })),
  };

  // ---- Documents / customs (reusing the document index) --------------------------------------
  const docSrc: DocumentSources = { orders: src.orders, shipments: src.shipments, deals: src.deals };
  const docReadiness = workspaceReadiness(src.documents, docSrc);
  const bottlenecks = new Map<string, { label: string; count: number; href: string }>();
  for (const d of src.documents) {
    if (d.ownerType === "company" || !d.due || d.complete) continue;
    const failing = d.blockers.filter((b) => !b.done);
    const labels = failing.length ? failing.map((b) => b.detail ?? `${b.label} not met`) : d.attention ? [`${d.title.replace(/ Certificate$/, "")} ${d.sourceStatus.toLowerCase()}`] : [];
    for (const label of labels) {
      const key = label.replace(/\d+/g, "#");
      const cur = bottlenecks.get(key) ?? { label, count: 0, href: d.ownerType === "order" ? `/exporter/orders/${d.ownerId}` : `/exporter/documents/${d.id}` };
      cur.count += 1;
      bottlenecks.set(key, cur);
    }
  }
  const sbToLeo = duration(src.shipments.flatMap((s) => {
    const st = shipStates.get(s.id)!;
    return st.shippingBillAt.filed && st.shippingBillAt["leo-received"] ? [hoursBetween(st.shippingBillAt.filed, st.shippingBillAt["leo-received"])] : [];
  }));

  // ---- Shipments ----------------------------------------------------------------------------
  const shipRows = shipments.map((s) => ({ s, st: shipStates.get(s.id)!, order: src.orders.find((o) => o.id === s.orderId) }));
  const shipCounts = countBy(shipRows.map((x) => x.st.status)) as Partial<Record<ShipmentStatus, number>>;
  const m = (x: (typeof shipRows)[number]) => x.st.milestones;
  const shipCycles = {
    toDeparture: duration(shipRows.flatMap((x) => (m(x).departed ? [hoursBetween(x.s.createdAt, m(x).departed!)] : []))),
    transit: duration(shipRows.flatMap((x) => (m(x).departed && m(x).arrived ? [hoursBetween(m(x).departed!, m(x).arrived!)] : []))),
    toDelivery: duration(shipRows.flatMap((x) => (m(x).arrived && m(x).delivered ? [hoursBetween(m(x).arrived!, m(x).delivered!)] : []))),
    total: duration(shipRows.flatMap((x) => (m(x).delivered ? [hoursBetween(x.s.createdAt, m(x).delivered!)] : []))),
  };
  const departed = shipRows.filter((x) => m(x).departed && x.st.schedule.etd);
  const onTimeDeparture = rate(departed.filter((x) => x.st.schedule.atd! <= x.st.schedule.etd!).length, departed.length);
  const deliveredRows = shipRows.filter((x) => m(x).delivered && x.order?.terms.estimatedDelivery);
  const onTimeDelivery = rate(deliveredRows.filter((x) => m(x).delivered!.slice(0, 10) <= x.order!.terms.estimatedDelivery!).length, deliveredRows.length);
  const activeShips = shipRows.filter((x) => x.st.status !== "delivered" && x.st.status !== "cancelled");
  const comparableRisk = activeShips.filter((x) => x.st.schedule.eta && x.order?.terms.estimatedDelivery);
  const atRisk = comparableRisk.filter((x) => x.st.schedule.eta! > x.order!.terms.estimatedDelivery!);
  const preDep = activeShips.filter((x) => isPreDeparture(x.st.status) && x.order);
  const readinessOf = (x: (typeof preDep)[number]) => {
    const os = orderStateWithShipments(x.order!, src.shipments);
    return { customs: score(customsReadiness(x.s, x.st, os)), freight: score(freightReadiness(x.s, x.st, os)) };
  };
  const readiness = preDep.map((x) => ({ id: x.s.id, ...readinessOf(x) }));
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((t, v) => t + v, 0) / xs.length) : undefined);
  const deliveredVolume: ByUnit = {};
  const deliveredValue: ByCurrency = {};
  for (const x of shipRows.filter((r) => r.st.status === "delivered" && r.order)) {
    addQty(deliveredVolume, x.s.allocation.unit, x.s.allocation.quantity);
    addMoney(deliveredValue, x.order!.terms.currency, Math.round(x.order!.terms.unitPrice * 100) * x.s.allocation.quantity);
  }

  // ---- Product and market performance ------------------------------------------------------------
  const quoteByRfq = new Map(quotes.map((r) => [r.rfqId, r]));
  const group = (keyOf: (o: BuyerOpportunity) => { key: string; label: string }): GroupRow[] => {
    const rows = new Map<string, GroupRow>();
    const get = (k: { key: string; label: string }) => {
      let r = rows.get(k.key);
      if (!r) {
        r = { ...k, opportunities: 0, quoted: 0, negotiated: 0, won: 0, finalised: 0, winRate: rate(0, 0), deals: 0, dealValue: {}, activeOrders: 0, orders: 0, delivered: 0 };
        rows.set(k.key, r);
      }
      return r;
    };
    for (const o of opportunities) {
      const r = get(keyOf(o));
      r.opportunities += 1;
      const q = quoteByRfq.get(o.rfqId);
      if (q) {
        r.quoted += 1;
        if (q.status === "accepted") r.won += 1;
        if (q.status === "accepted" || q.status === "rejected") r.finalised += 1;
      }
      if (negotiatedRfqs.has(o.rfqId)) r.negotiated += 1;
      for (const d of deals.filter((x) => x.requirementId === o.rfqId)) {
        r.deals += 1;
        addMoney(r.dealValue, d.terms.currency, dealValueMinor(d.terms));
      }
      for (const x of orderRows.filter((y) => y.o.requirementId === o.rfqId)) {
        r.orders += 1;
        if (x.s.status !== "completed" && x.s.status !== "cancelled") r.activeOrders += 1;
      }
      r.delivered += shipRows.filter((x) => x.s.requirementId === o.rfqId && x.st.status === "delivered").length;
    }
    return [...rows.values()].map((r) => ({ ...r, winRate: rate(r.won, r.finalised, 2) })).sort((a, b) => b.opportunities - a.opportunities);
  };
  const products = group((o) => ({ key: o.match.matchedProductId, label: productName(o.match.matchedProductId, o.product.name) }));
  const markets = group((o) => ({ key: o.delivery.destinationCountry, label: shortCountry(o.delivery.destinationCountry) }));
  const destinations = [...countBy(opportunities.map((o) => `${shortCountry(o.delivery.destinationCountry)} → ${o.delivery.destinationLocation}`)) as unknown as Record<string, number> ? Object.entries(countBy(opportunities.map((o) => `${shortCountry(o.delivery.destinationCountry)} → ${o.delivery.destinationLocation}`))) : []].sort((a, b) => b[1] - a[1]);

  // ---- Match score ----------------------------------------------------------------------------------
  const bands = [
    { key: "90", label: "90–100", min: 90, max: 100 },
    { key: "80", label: "80–89", min: 80, max: 89 },
    { key: "lt80", label: "Below 80", min: 0, max: 79 },
  ].map((b) => {
    const os = opportunities.filter((o) => o.match.score >= b.min && o.match.score <= b.max);
    const qs = os.map((o) => quoteByRfq.get(o.rfqId)).filter((q): q is PipelineRow => Boolean(q));
    const fin = qs.filter((q) => q.status === "accepted" || q.status === "rejected");
    return { ...b, opportunities: os.length, quoted: qs.length, won: qs.filter((q) => q.status === "accepted").length, finalised: fin.length, winRate: rate(qs.filter((q) => q.status === "accepted").length, fin.length, 3) };
  });
  const matchAvg = avg(opportunities.map((o) => o.match.score));

  // ---- Trend --------------------------------------------------------------------------------------------
  const month = (iso?: string) => iso?.slice(0, 7);
  const months = [...new Set([...opportunities.map((o) => month(o.sharedAt)), ...quotes.map((r) => month(r.quotation?.submittedAt)), ...deals.map((d) => month(d.createdAt))].filter((x): x is string => Boolean(x)))].sort();
  const trend = months.length >= 3
    ? months.map((mo) => ({
        month: mo,
        opportunities: opportunities.filter((o) => month(o.sharedAt) === mo).length,
        quotations: quotes.filter((r) => month(r.quotation?.submittedAt) === mo).length,
        deals: deals.filter((d) => month(d.createdAt) === mo).length,
        delivered: shipRows.filter((x) => month(m(x).delivered) === mo).length,
      }))
    : undefined;

  // ---- KPIs -----------------------------------------------------------------------------------------------
  const winRate = rate(accepted, accepted + rejected);
  const quoteRate = rate(quotedRfqs.size, opportunities.length);

  const report = {
    range,
    start,
    funnel,
    quoteRate,
    winRate,
    quotations: { total: quotes.length, byStatus: quoteStatus, value: quotedValue, active: quotes.filter((r) => ACTIVE_QUOTE.includes(r.status)).length, timeToQuote, withTimestamps: timeToQuote.sample },
    negotiations: { total: negotiations.length, byStatus: negCounts, agreementRate: rate(agreedN, finalisedN), finalised: finalisedN, rounds: roundBuckets, avgRounds: rounds.length ? Math.round((rounds.reduce((t, v) => t + v, 0) / rounds.length) * 10) / 10 : undefined, priceMoves, incomparable },
    deals: { total: deals.length, byStatus: dealCounts, value: dealValue, bySource },
    orders: { total: orders.length, byStatus: orderCounts, active: activeOrders.length, needsAttention: orderRows.filter(({ o, s }) => actionsRequired(o, s).length > 0).length, value: orderValue, cycles: orderCycles },
    documents: {
      readiness: docReadiness,
      attention: src.documents.filter((d) => d.attention).length,
      blockedShippingBills: src.documents.filter((d) => d.code === "SB" && d.blocking).length,
      pendingCredentials: src.documents.filter((d) => d.ownerType === "company" && d.attention).length,
      bottlenecks: [...bottlenecks.values()].sort((a, b) => b.count - a.count),
      sbToLeo,
    },
    shipments: {
      total: shipments.length,
      byStatus: shipCounts,
      active: activeShips.length,
      delivered: shipCounts.delivered ?? 0,
      cycles: shipCycles,
      onTimeDeparture,
      onTimeDelivery,
      risk: { comparable: comparableRisk.length, atRisk: atRisk.map((x) => x.s.id), onTrack: comparableRisk.length - atRisk.length },
      readiness: { rows: readiness, avgCustoms: avg(readiness.map((r) => r.customs)), avgFreight: avg(readiness.map((r) => r.freight)), customsBelow50: readiness.filter((r) => r.customs < 50).map((r) => r.id), freightBelow50: readiness.filter((r) => r.freight < 50).map((r) => r.id) },
      deliveredVolume,
    },
    pipeline: { quoted: activePipeline, negotiation: negotiationPipeline, deals: dealValue, orders: orderValue, delivered: deliveredValue },
    products,
    markets,
    destinations,
    match: { average: matchAvg, bands },
    trend,
    months,
  };
  return report;
}

export type AnalyticsReport = ReturnType<typeof buildAnalytics>;

// ---------------------------------------------------------------------------
// SUMIT — statements the report proves, nothing more.
// ---------------------------------------------------------------------------

const fmtH = (h: number) => (h >= 48 ? `${Math.round((h / 24) * 10) / 10} days` : `${Math.round(h)} hours`);

export function analyticsInsights(r: AnalyticsReport): string[] {
  const out: string[] = [];
  const q = r.quoteRate;
  if (q.percent !== undefined) out.push(`${q.num} of ${q.den} opportunities received quotations, giving a ${q.percent}% quote rate.`);
  const w = r.winRate;
  out.push(w.percent !== undefined ? `Your finalised quotation win rate is ${w.percent}%: ${w.num} accepted of ${w.den} finalised quotations.` : "There are no finalised quotations yet, so a win rate can't be calculated.");
  const topMarket = [...r.markets].filter((m) => m.deals > 0).sort((a, b) => b.deals - a.deals)[0];
  const tie = topMarket && r.markets.filter((m) => m.deals === topMarket.deals).length > 1;
  if (topMarket && !tie) out.push(`${topMarket.label} currently has the most deals (${topMarket.deals}).`);
  if (r.documents.sbToLeo.sample >= 1) out.push(`Shipping Bill filing to LEO averages ${fmtH(r.documents.sbToLeo.avgHours!)} across ${r.documents.sbToLeo.sample} comparable shipment${r.documents.sbToLeo.sample === 1 ? "" : "s"} (demo records).`);
  if (r.shipments.risk.atRisk.length) out.push(`${r.shipments.risk.atRisk.length} active shipment${r.shipments.risk.atRisk.length === 1 ? " has an" : "s have"} ETA later than the agreed delivery date: ${r.shipments.risk.atRisk.join(", ")}.`);
  else if (r.shipments.risk.comparable) out.push(`All ${r.shipments.risk.comparable} active shipments with an ETA are on track for their agreed delivery dates.`);
  const top = r.documents.bottlenecks[0];
  if (top) out.push(`The most common current document / customs blocker is “${top.label}” (${top.count}).`);
  const waiting = (r.negotiations.byStatus["awaiting-exporter"] ?? 0) + (r.negotiations.byStatus["revision-requested"] ?? 0);
  if (waiting) out.push(`${waiting} negotiation${waiting === 1 ? " is" : "s are"} waiting for your response.`);
  return out;
}

export function formatHours(h: number | undefined): string {
  if (h === undefined) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
  return `${Math.round((h / 24) * 10) / 10} days`;
}
