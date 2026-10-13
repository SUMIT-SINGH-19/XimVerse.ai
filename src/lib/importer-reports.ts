/**
 * Reports: an analytics layer rebuilt on every read from the importer's own
 * canonical records (requirements, quotations, negotiations, orders,
 * shipments, documents, customs, tracking, landed cost, payments).
 *
 * Nothing is copied or stored. Each feature's own definitions are reused:
 * Tracking owns "delayed", Compliance owns readiness, Customs owns case
 * status, Landed Cost owns estimate completeness and Payments owns due logic.
 * Money is always grouped by currency — never summed across currencies.
 */

import { MOCK_NOW, type Currency, type ImportRequirement, type ProductCategory } from "./import-requirements";
import { assessShipment, type Readiness } from "./importer-compliance";
import { CUSTOMS_CASE_STATUSES, type CustomsCaseStatus, type CustomsCaseView } from "./importer-customs";
import { isMissing, type DocumentType, type TradeDocument } from "./importer-documents";
import type { CostSnapshot, CostStatus, LandedCostResult } from "./importer-landed-cost";
import { negotiationStatus, originalOffer, type Negotiation } from "./importer-negotiations";
import { orderStatus, orderValue, ORDER_STATUSES, type Order, type OrderStatus } from "./importer-orders";
import type { PaymentWorkspace } from "./importer-payments";
import type { Quotation, QuotationStatus } from "./importer-quotations";
import { milestones, modeLabel, shipmentState, SHIPMENT_STAGES, type Shipment, type ShipmentStage } from "./importer-shipments";
import { findSupplier } from "./importer-suppliers";
import type { TrackingView } from "./importer-tracking";

/* ------------------------------------------------------------------------ */
/* Inputs                                                                    */
/* ------------------------------------------------------------------------ */

export interface ReportQuotation extends Quotation {
  /** Current status (demo status plus this tab's changes). */
  currentStatus: QuotationStatus;
}

export interface ReportLandedCost {
  orderId: string;
  result: LandedCostResult;
  snapshots: CostSnapshot[];
}

/** Everything the analytics layer reads, from the live stores. */
export interface ReportData {
  requirements: readonly ImportRequirement[];
  quotations: readonly ReportQuotation[];
  negotiations: readonly Negotiation[];
  orders: readonly Order[];
  shipments: readonly Shipment[];
  documents: readonly TradeDocument[];
  customsCases: readonly CustomsCaseView[];
  tracking: readonly TrackingView[];
  landedCost: readonly ReportLandedCost[];
  payments: readonly PaymentWorkspace[];
  today?: string;
}

/* ------------------------------------------------------------------------ */
/* Filters                                                                   */
/* ------------------------------------------------------------------------ */

export type DatePreset = "all" | "30d" | "90d" | "year" | "custom";

export const DATE_PRESET_LABEL: Record<DatePreset, string> = {
  all: "All Time",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
  year: "This Year",
  custom: "Custom",
};

export interface ReportFilters {
  date: DatePreset;
  /** YYYY-MM-DD, for custom ranges. */
  from?: string;
  to?: string;
  supplierId?: string;
  product?: string;
  category?: ProductCategory | "";
  country?: string;
  requirementId?: string;
  orderStatus?: OrderStatus | "";
  shipmentStage?: ShipmentStage | "";
  currency?: Currency | "";
}

export const NO_FILTERS: ReportFilters = { date: "all" };

const DAY = 86_400_000;
const dayOf = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
export const daysBetween = (from: string, to: string) => Math.round((dayOf(to) - dayOf(from)) / DAY);

/** Inclusive [from, to] days for a preset, relative to the demo "today". */
export function dateRange(f: ReportFilters, today = MOCK_NOW): { from?: string; to?: string } {
  const t = today.slice(0, 10);
  const minus = (n: number) => new Date(dayOf(t) - n * DAY).toISOString().slice(0, 10);
  switch (f.date) {
    case "30d":
      return { from: minus(30), to: t };
    case "90d":
      return { from: minus(90), to: t };
    case "year":
      return { from: `${t.slice(0, 4)}-01-01`, to: t };
    case "custom":
      return { from: f.from || undefined, to: f.to || undefined };
    default:
      return {};
  }
}

const inRange = (at: string, r: { from?: string; to?: string }) => (!r.from || at.slice(0, 10) >= r.from) && (!r.to || at.slice(0, 10) <= r.to);
const countryOf = (supplierId: string) => findSupplier(supplierId)?.country ?? "";

/** Applies the shared filters once; every report reads the filtered bundle. */
export function filterReportData(data: ReportData, f: ReportFilters): ReportData {
  const today = data.today ?? MOCK_NOW;
  const range = dateRange(f, today);
  const reqById = new Map(data.requirements.map((r) => [r.id, r]));
  const productOf = (requirementId: string, fallback?: string) => reqById.get(requirementId)?.product.name ?? fallback ?? "";
  const categoryOf = (requirementId: string) => reqById.get(requirementId)?.product.category;
  const common = (e: { at: string; supplierId?: string; requirementId: string; product: string }) =>
    inRange(e.at, range) &&
    (!f.supplierId || e.supplierId === f.supplierId) &&
    (!f.country || (e.supplierId ? countryOf(e.supplierId) === f.country : false)) &&
    (!f.requirementId || e.requirementId === f.requirementId) &&
    (!f.product || e.product === f.product) &&
    (!f.category || categoryOf(e.requirementId) === f.category);

  const orders = data.orders.filter(
    (o) =>
      common({ at: o.createdAt, supplierId: o.supplierId, requirementId: o.requirementId, product: productOf(o.requirementId, o.terms.productName) }) &&
      (!f.orderStatus || orderStatus(o) === f.orderStatus) &&
      (!f.currency || o.terms.currency === f.currency),
  );
  const orderIds = new Set(orders.map((o) => o.id));
  const orderFilterActive = !!(f.orderStatus || f.currency);
  const shipments = data.shipments.filter(
    (s) =>
      common({ at: s.createdAt, supplierId: s.supplierId, requirementId: s.requirementId, product: productOf(s.requirementId, s.cargo.product) }) &&
      (!f.shipmentStage || shipmentState(s).stage === f.shipmentStage) &&
      (!orderFilterActive || orderIds.has(s.orderId)),
  );
  const shipmentIds = new Set(shipments.map((s) => s.id));
  const quotations = data.quotations.filter(
    (q) => common({ at: q.receivedAt, supplierId: q.supplierId, requirementId: q.requirementId, product: productOf(q.requirementId) }) && (!f.currency || q.price.currency === f.currency),
  );
  const negotiations = data.negotiations.filter((n) => common({ at: n.startedAt, supplierId: n.supplierId, requirementId: n.requirementId, product: productOf(n.requirementId) }));
  const supplierScoped = !!(f.supplierId || f.country);
  const requirements = data.requirements.filter(
    (r) =>
      inRange(r.createdAt, range) &&
      (!f.requirementId || r.id === f.requirementId) &&
      (!f.product || r.product.name === f.product) &&
      (!f.category || r.product.category === f.category) &&
      // With a supplier/country filter, keep requirements that supplier took part in.
      (!supplierScoped || quotations.some((q) => q.requirementId === r.id) || orders.some((o) => o.requirementId === r.id)),
  );
  const orderScoped = (orderId: string) => orderIds.has(orderId);
  return {
    ...data,
    requirements,
    quotations,
    negotiations,
    orders,
    shipments,
    documents: data.documents.filter((d) => shipmentIds.has(d.shipmentId)),
    customsCases: data.customsCases.filter((c) => shipmentIds.has(c.shipmentId)),
    tracking: data.tracking.filter((t) => shipmentIds.has(t.shipment.id)),
    landedCost: data.landedCost.filter((l) => orderScoped(l.orderId)),
    payments: data.payments.filter((p) => orderScoped(p.order.id)),
  };
}

/* ------------------------------------------------------------------------ */
/* Shared helpers                                                            */
/* ------------------------------------------------------------------------ */

export type MoneyByCurrency = Partial<Record<Currency, number>>;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Adds an amount into a per-currency map; currencies are never mixed. */
export function addMoney(m: MoneyByCurrency, currency: Currency, amount: number): MoneyByCurrency {
  return { ...m, [currency]: round2((m[currency] ?? 0) + amount) };
}

export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

/** "$420,000.00 · ₹8,200,000.00" — one figure per currency. */
export function formatByCurrency(m: MoneyByCurrency): string {
  const entries = Object.entries(m) as [Currency, number][];
  return entries.length ? entries.sort(([a], [b]) => a.localeCompare(b)).map(([c, v]) => formatMoney(v, c)).join(" · ") : "—";
}

export interface Average {
  value?: number;
  n: number;
}

const average = (xs: number[]): Average => ({ value: xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined, n: xs.length });

export const formatAverageDays = (a: Average) => (a.value === undefined ? "Not enough data" : `${a.value} ${a.value === 1 ? "day" : "days"} (n = ${a.n})`);

/** Compared only when currency, unit and Incoterm match. */
export interface PriceChange {
  negotiationId: string;
  requirementId: string;
  supplierId: string;
  comparable: boolean;
  reason?: string;
  quoted?: number;
  agreed?: number;
  difference?: number;
  percent?: number;
  currency?: Currency;
  unit?: string;
}

export function negotiatedPriceChange(n: Negotiation): PriceChange | undefined {
  const agreement = n.events.find((e) => e.type === "agreement");
  if (!agreement?.offer) return undefined;
  const o = originalOffer(n);
  const a = agreement.offer;
  const base = { negotiationId: n.id, requirementId: n.requirementId, supplierId: n.supplierId };
  if (o.currency !== a.currency) return { ...base, comparable: false, reason: "Different currency" };
  if (o.quantity.unit !== a.quantity.unit) return { ...base, comparable: false, reason: "Different quantity unit" };
  if (o.incoterm !== a.incoterm) return { ...base, comparable: false, reason: "Different Incoterm" };
  const difference = round2(a.unitPrice - o.unitPrice);
  return { ...base, comparable: true, quoted: o.unitPrice, agreed: a.unitPrice, difference, percent: o.unitPrice ? round2((difference / o.unitPrice) * 100) : 0, currency: a.currency, unit: a.quantity.unit };
}

const ts = (s: string) => Date.parse(s);
const daysFrom = (a: string, b: string) => round2((ts(b) - ts(a)) / DAY);

/* ------------------------------------------------------------------------ */
/* Report                                                                    */
/* ------------------------------------------------------------------------ */

export interface SupplierRow {
  supplierId: string;
  name: string;
  country: string;
  quotations: number;
  selectedQuotations: number;
  /** Selected ÷ received, as a percentage; undefined when none received. */
  selectionRate?: number;
  negotiations: number;
  agreements: number;
  orders: number;
  orderValue: MoneyByCurrency;
  activeShipments: number;
  deliveredShipments: number;
  delayedShipments: number;
  onScheduleShipments: number;
  avgLeadTimeDays?: number;
}

export interface DelayRow {
  shipmentId: string;
  supplier: string;
  route: string;
  plannedEta: string;
  currentEta: string;
  delayDays: number;
  overdue: boolean;
  stage: string;
  openExceptions: number;
}

export interface OperationalRow {
  orderId: string;
  supplier: string;
  shipmentId?: string;
  stage: string;
  documents: string;
  compliance?: Readiness;
  customs: string;
  trackingExceptions: number;
  landedCost: CostStatus;
  paymentStatus: string;
  nextAction: string;
}

export interface ImporterReport {
  overview: {
    requirements: number;
    quotations: number;
    suppliersEngaged: number;
    orders: number;
    activeShipments: number;
    deliveredShipments: number;
    openExceptions: number;
    customsCases: number;
    outstandingPayments: MoneyByCurrency;
  };
  sourcing: {
    requirements: number;
    withQuotations: number;
    totalQuotations: number;
    avgQuotations?: number;
    quotationDistribution: { none: number; one: number; twoPlus: number };
    shortlisted: number;
    selected: number;
    inNegotiation: number;
    supplierSelected: number;
    readyForOrder: number;
    ordersCreated: number;
    funnel: { key: string; label: string; count: number }[];
    cycle: { label: string; avg: Average }[];
    negotiations: { started: number; agreed: number; withdrawn: number; closedAnotherSelected: number; avgRevisions?: number };
    priceChanges: PriceChange[];
  };
  suppliers: SupplierRow[];
  orders: {
    total: number;
    byStatus: { status: OrderStatus; label: string; count: number }[];
    valueByCurrency: { currency: Currency; total: number; count: number; average: number }[];
    bySupplier: { key: string; label: string; count: number; value: MoneyByCurrency }[];
    byProduct: { key: string; label: string; count: number; value: MoneyByCurrency }[];
    byIncoterm: { key: string; label: string; count: number; value: MoneyByCurrency }[];
    byCountry: { key: string; label: string; count: number; value: MoneyByCurrency }[];
  };
  shipments: {
    total: number;
    active: number;
    inTransit: number;
    atCustoms: number;
    delivered: number;
    delayed: number;
    onSchedule: number;
    avgEtaShiftDays: Average;
    delays: DelayRow[];
    byDestination: { key: string; count: number }[];
    byPort: { key: string; count: number }[];
    byMode: { key: string; count: number }[];
    byStage: { key: string; label: string; count: number }[];
    cycle: { label: string; avg: Average }[];
  };
  documents: {
    required: number;
    approved: number;
    complete: number;
    missing: number;
    needsReview: number;
    expired: number;
    expiringSoon: number;
    byType: { group: string; required: number; complete: number; missing: number; needsReview: number }[];
    compliance: Record<Readiness, number>;
  };
  customs: {
    cases: number;
    byStatus: { status: CustomsCaseStatus; label: string; count: number }[];
    historicalCleared: number;
    blockers: { key: string; label: string; count: number }[];
    cha: { assigned: number; withClarifications: number; readyForFiling: number; historicalCleared: number };
  };
  landedCost: {
    sheets: number;
    byStatus: Record<CostStatus, number>;
    estimates: { orderId: string; currency: Currency; status: CostStatus; commercial: number; logistics: number; duties: number; other: number; total?: number; perUnit?: number; unit: string }[];
    drivers: { currency: Currency; parts: { key: string; label: string; amount: number }[]; total: number }[];
    variance: { orderId: string; currency: Currency; baseline: number; baselineLabel: string; latest: number; change: number }[];
  };
  payments: {
    byCurrency: { currency: Currency; orderValue: number; scheduled: number; recorded: number; remaining: number }[];
    obligations: { upcoming: number; due: number; overdue: number; awaitingDocuments: number; recorded: number };
    exposure: { orderId: string; supplier: string; currency: Currency; orderValue: number; recorded: number; remaining: number; nextDue?: string; status: string }[];
    finance: { lcRequired: number; lcNotStarted: number; lcIssued: number; lcExpiringSoon: number; financePlanning: number; readyToApproach: number };
  };
  operational: OperationalRow[];
}

const group = <T,>(items: readonly T[], key: (t: T) => string, label: (k: string) => string = (k) => k) => {
  const m = new Map<string, T[]>();
  for (const it of items) m.set(key(it), [...(m.get(key(it)) ?? []), it]);
  return [...m.entries()].map(([k, v]) => ({ key: k, label: label(k), items: v }));
};

const DOC_GROUP: Record<DocumentType, string> = {
  "commercial-invoice": "Commercial Invoice",
  "packing-list": "Packing List",
  "certificate-of-origin": "Certificate of Origin",
  "transport-document": "Transport Document",
  "product-certificate": "Product Certificates",
  "insurance-certificate": "Insurance",
  "inspection-certificate": "Other",
  "import-permit": "Other",
  "shipping-instructions": "Other",
};
const DOC_GROUP_ORDER = ["Commercial Invoice", "Packing List", "Certificate of Origin", "Transport Document", "Product Certificates", "Insurance", "Other"];

const BLOCKER_LABEL: Record<string, string> = {
  "document-missing": "Missing Document",
  "document-review": "Document Needs Review",
  "document-expired": "Document Expired",
  "hs-code": "HS Code Missing",
  cha: "CHA Not Assigned",
  "declaration-field": "Declaration Field Missing",
  clarification: "Clarification Open",
  "stale-handoff": "Stale Handoff",
};

export function buildImporterReport(input: ReportData, filters: ReportFilters = NO_FILTERS): ImporterReport {
  const d = filterReportData(input, filters);
  const supplierName = (id: string) => findSupplier(id)?.name ?? id;
  const negStatus = new Map(d.negotiations.map((n) => [n.id, negotiationStatus(n)]));

  /* ---- Sourcing ---- */
  const qByReq = new Map<string, ReportQuotation[]>();
  for (const q of d.quotations) qByReq.set(q.requirementId, [...(qByReq.get(q.requirementId) ?? []), q]);
  const counts = d.requirements.map((r) => qByReq.get(r.id)?.length ?? 0);
  const withQuotations = counts.filter((c) => c > 0).length;
  const totalQuotations = d.quotations.filter((q) => d.requirements.some((r) => r.id === q.requirementId)).length;
  const reqIds = new Set(d.requirements.map((r) => r.id));
  const negReqs = new Set(d.negotiations.filter((n) => reqIds.has(n.requirementId)).map((n) => n.requirementId));
  const activeNegReqs = new Set(d.negotiations.filter((n) => reqIds.has(n.requirementId) && !["agreed", "closed", "withdrawn"].includes(negStatus.get(n.id)!)).map((n) => n.requirementId));
  const selectedReqs = d.requirements.filter((r) => r.selection);
  const orderReqs = new Set(d.orders.map((o) => o.requirementId));
  const ordersForReqs = d.requirements.filter((r) => orderReqs.has(r.id)).length;

  const firstQuote = (rid: string) => qByReq.get(rid)?.map((q) => q.receivedAt).sort()[0];
  const firstNegotiation = (rid: string) => d.negotiations.filter((n) => n.requirementId === rid).map((n) => n.startedAt).sort()[0];
  const agreementAt = (n: Negotiation) => n.events.find((e) => e.type === "agreement")?.at;
  const cycle = [
    { label: "Requirement → First Quotation", avg: average(d.requirements.filter((r) => firstQuote(r.id)).map((r) => daysFrom(r.createdAt, firstQuote(r.id)!))) },
    { label: "First Quotation → Negotiation", avg: average(d.requirements.filter((r) => firstQuote(r.id) && firstNegotiation(r.id)).map((r) => daysFrom(firstQuote(r.id)!, firstNegotiation(r.id)!))) },
    { label: "Negotiation → Agreement", avg: average(d.negotiations.filter((n) => agreementAt(n)).map((n) => daysFrom(n.startedAt, agreementAt(n)!))) },
    {
      label: "Agreement → Order",
      avg: average(
        d.orders
          .map((o) => ({ o, n: d.negotiations.find((n) => n.id === o.negotiationId) }))
          .filter((x) => x.n && agreementAt(x.n))
          .map((x) => daysFrom(agreementAt(x.n!)!, x.o.createdAt)),
      ),
    },
  ];
  const revisions = d.negotiations.map((n) => n.events.filter((e) => e.type === "importer-counter" || e.type === "supplier-revision").length);

  const sourcing: ImporterReport["sourcing"] = {
    requirements: d.requirements.length,
    withQuotations,
    totalQuotations,
    avgQuotations: d.requirements.length ? round2(totalQuotations / d.requirements.length) : undefined,
    quotationDistribution: { none: counts.filter((c) => c === 0).length, one: counts.filter((c) => c === 1).length, twoPlus: counts.filter((c) => c >= 2).length },
    shortlisted: d.quotations.filter((q) => q.currentStatus === "shortlisted").length,
    selected: d.quotations.filter((q) => q.currentStatus === "selected").length,
    inNegotiation: activeNegReqs.size,
    supplierSelected: selectedReqs.length,
    readyForOrder: selectedReqs.filter((r) => !orderReqs.has(r.id)).length,
    ordersCreated: d.orders.length,
    funnel: [
      { key: "requirements", label: "Requirements", count: d.requirements.length },
      { key: "quotations", label: "With Quotations", count: withQuotations },
      { key: "negotiation", label: "Negotiation Started", count: negReqs.size },
      { key: "selected", label: "Supplier Selected", count: selectedReqs.length },
      { key: "order", label: "Order Created", count: ordersForReqs },
    ],
    cycle,
    negotiations: {
      started: d.negotiations.length,
      agreed: d.negotiations.filter((n) => negStatus.get(n.id) === "agreed").length,
      withdrawn: d.negotiations.filter((n) => negStatus.get(n.id) === "withdrawn").length,
      closedAnotherSelected: d.negotiations.filter((n) => negStatus.get(n.id) === "closed").length,
      avgRevisions: revisions.length ? round2(revisions.reduce((a, b) => a + b, 0) / revisions.length) : undefined,
    },
    priceChanges: d.negotiations.map(negotiatedPriceChange).filter((x): x is PriceChange => !!x),
  };

  /* ---- Tracking lookups ---- */
  const trackingByShipment = new Map(d.tracking.map((t) => [t.shipment.id, t]));
  const isDelivered = (s: Shipment) => shipmentState(s).status === "delivered";

  /* ---- Suppliers ---- */
  const supplierIds = [...new Set([...d.quotations.map((q) => q.supplierId), ...d.negotiations.map((n) => n.supplierId), ...d.orders.map((o) => o.supplierId), ...d.shipments.map((s) => s.supplierId)])];
  const suppliers: SupplierRow[] = supplierIds
    .map((id) => {
      const qs = d.quotations.filter((q) => q.supplierId === id);
      const sel = qs.filter((q) => q.currentStatus === "selected").length;
      const ships = d.shipments.filter((s) => s.supplierId === id);
      const orders = d.orders.filter((o) => o.supplierId === id);
      const lead = qs.map((q) => q.delivery.leadTimeDays);
      return {
        supplierId: id,
        name: supplierName(id),
        country: countryOf(id),
        quotations: qs.length,
        selectedQuotations: sel,
        selectionRate: qs.length ? round2((sel / qs.length) * 100) : undefined,
        negotiations: d.negotiations.filter((n) => n.supplierId === id).length,
        agreements: d.negotiations.filter((n) => n.supplierId === id && negStatus.get(n.id) === "agreed").length,
        orders: orders.length,
        orderValue: orders.reduce<MoneyByCurrency>((m, o) => addMoney(m, o.terms.currency, orderValue(o.terms)), {}),
        activeShipments: ships.filter((s) => !isDelivered(s)).length,
        deliveredShipments: ships.filter(isDelivered).length,
        delayedShipments: ships.filter((s) => trackingByShipment.get(s.id)?.schedule.status === "delayed").length,
        onScheduleShipments: ships.filter((s) => trackingByShipment.get(s.id)?.schedule.status === "on-schedule").length,
        avgLeadTimeDays: average(lead).value,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  /* ---- Orders ---- */
  const byDim = (key: (o: Order) => string, label?: (k: string) => string) =>
    group(d.orders, key, label)
      .map((g) => ({ key: g.key, label: g.label, count: g.items.length, value: g.items.reduce<MoneyByCurrency>((m, o) => addMoney(m, o.terms.currency, orderValue(o.terms)), {}) }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const valueGroups = group(d.orders, (o) => o.terms.currency);
  const orders: ImporterReport["orders"] = {
    total: d.orders.length,
    byStatus: ORDER_STATUSES.map((s) => ({ status: s.id, label: s.label, count: d.orders.filter((o) => orderStatus(o) === s.id).length })),
    valueByCurrency: valueGroups
      .map((g) => {
        const total = round2(g.items.reduce((a, o) => a + orderValue(o.terms), 0));
        return { currency: g.key as Currency, total, count: g.items.length, average: round2(total / g.items.length) };
      })
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    bySupplier: byDim((o) => o.supplierId, supplierName),
    byProduct: byDim((o) => o.terms.productName),
    byIncoterm: byDim((o) => o.terms.incoterm),
    byCountry: byDim((o) => countryOf(o.supplierId)),
  };

  /* ---- Shipments (Tracking owns "delayed") ---- */
  const states = d.shipments.map((s) => ({ s, st: shipmentState(s), t: trackingByShipment.get(s.id) }));
  const delays: DelayRow[] = states
    .filter((x) => x.t?.schedule.status === "delayed")
    .map((x) => ({
      shipmentId: x.s.id,
      supplier: supplierName(x.s.supplierId),
      route: `${x.s.route.portOfLoading} → ${x.s.route.portOfDischarge}`,
      plannedEta: x.t!.schedule.baseline.eta,
      currentEta: x.t!.schedule.current.eta,
      delayDays: x.t!.schedule.overdue ? x.t!.schedule.overdueDays : x.t!.schedule.etaDelayDays,
      overdue: x.t!.schedule.overdue,
      stage: SHIPMENT_STAGES.find((st) => st.id === x.st.stage)!.label,
      openExceptions: x.t!.open.length,
    }));
  const counter = (keys: string[]) => [...new Set(keys)].map((k) => ({ key: k, count: keys.filter((x) => x === k).length })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  const milestoneAt = (s: Shipment, id: string) => milestones(s, d.documents).find((m) => m.id === id)?.at;
  const span = (from: string, to: string) => average(d.shipments.map((s) => [milestoneAt(s, from), milestoneAt(s, to)] as const).filter(([a, b]) => a && b).map(([a, b]) => daysFrom(a!, b!)));
  const shipments: ImporterReport["shipments"] = {
    total: d.shipments.length,
    active: states.filter((x) => x.st.status !== "delivered").length,
    inTransit: states.filter((x) => x.st.status === "in-transit").length,
    atCustoms: states.filter((x) => x.st.status === "customs").length,
    delivered: states.filter((x) => x.st.status === "delivered").length,
    delayed: delays.length,
    onSchedule: states.filter((x) => x.t?.schedule.status === "on-schedule").length,
    avgEtaShiftDays: average(states.filter((x) => x.t).map((x) => x.t!.schedule.etaDelayDays)),
    delays,
    byDestination: counter(d.shipments.map((s) => s.route.finalDelivery.split(",").map((p) => p.trim()).filter(Boolean).at(-1) ?? s.route.finalDelivery)),
    byPort: counter(d.shipments.map((s) => s.route.portOfDischarge)),
    byMode: counter(d.shipments.map((s) => modeLabel(s.route.mode))),
    byStage: SHIPMENT_STAGES.map((st) => ({ key: st.id, label: st.label, count: states.filter((x) => x.st.stage === st.id).length })).filter((x) => x.count > 0),
    cycle: [
      { label: "Shipment Created → Departure", avg: span("created", "departed") },
      { label: "Departure → Arrival", avg: span("departed", "arrived") },
      { label: "Arrival → Customs Cleared", avg: span("arrived", "customs-cleared") },
      { label: "Customs Cleared → Delivered", avg: span("customs-cleared", "delivered") },
    ],
  };

  /* ---- Documents & compliance (canonical logic) ---- */
  const required = d.documents.filter((x) => x.requirement.level === "required");
  const provided = (x: TradeDocument) => x.status === "available" || x.status === "approved";
  const compliance: Record<Readiness, number> = { ready: 0, "needs-review": 0, blocked: 0 };
  for (const { s, st } of states) {
    const order = d.orders.find((o) => o.id === s.orderId) ?? input.orders.find((o) => o.id === s.orderId);
    const caseView = d.customsCases.find((c) => c.shipmentId === s.id);
    const a = assessShipment({ shipment: s, state: st, documents: d.documents, order, supplierConfirmed: !!order?.events.some((e) => e.type === "supplier-confirmed"), customs: caseView?.override });
    compliance[a.readiness] += 1;
  }
  const documents: ImporterReport["documents"] = {
    required: required.length,
    approved: required.filter((x) => x.status === "approved").length,
    complete: required.filter((x) => x.complete).length,
    missing: required.filter(isMissing).length,
    needsReview: required.filter((x) => x.status === "needs-review").length,
    expired: required.filter((x) => x.validity === "expired" && provided(x)).length,
    expiringSoon: required.filter((x) => x.validity === "expiring-soon" && provided(x)).length,
    byType: DOC_GROUP_ORDER.map((g) => {
      const docs = required.filter((x) => DOC_GROUP[x.type] === g);
      return { group: g, required: docs.length, complete: docs.filter((x) => x.complete).length, missing: docs.filter(isMissing).length, needsReview: docs.filter((x) => x.status === "needs-review").length };
    }),
    compliance,
  };

  /* ---- Customs ---- */
  const blockerKeys: string[] = [];
  for (const c of d.customsCases) {
    if (!["preparing", "ready-for-handoff", "with-cha", "clarification-required", "ready-for-filing"].includes(c.status)) continue;
    for (const b of c.blockers) blockerKeys.push(b.kind === "document-expired" ? "document-expired" : b.kind);
    for (const cl of c.clarifications.filter((x) => x.status === "open")) blockerKeys.push(`clarification:${cl.id}`);
    if (c.handoffStale || (c.handoff && c.changedSinceHandoff.length)) blockerKeys.push("stale-handoff");
  }
  const blockerCounts = Object.keys(BLOCKER_LABEL).map((k) => ({ key: k, label: BLOCKER_LABEL[k], count: blockerKeys.filter((x) => (k === "clarification" ? x.startsWith("clarification:") : x === k)).length }));
  const customs: ImporterReport["customs"] = {
    cases: d.customsCases.length,
    byStatus: CUSTOMS_CASE_STATUSES.map((s) => ({ status: s.id, label: s.label, count: d.customsCases.filter((c) => c.status === s.id).length })),
    historicalCleared: d.customsCases.filter((c) => c.status === "cleared" && c.statusRecord === "historical").length,
    blockers: blockerCounts,
    cha: {
      assigned: d.customsCases.filter((c) => c.cha).length,
      withClarifications: d.customsCases.filter((c) => c.clarifications.length > 0).length,
      readyForFiling: d.customsCases.filter((c) => c.status === "ready-for-filing").length,
      historicalCleared: d.customsCases.filter((c) => c.status === "cleared" && c.statusRecord === "historical").length,
    },
  };

  /* ---- Landed cost (Landed Cost owns completeness) ---- */
  const lc = d.landedCost;
  const step = (r: LandedCostResult, k: string) => r.waterfall.find((w) => w.key === k)?.amount ?? 0;
  const estimates = lc
    .filter((l) => l.result.status !== "needs-input")
    .map((l) => ({
      orderId: l.orderId,
      currency: l.result.currency,
      status: l.result.status,
      commercial: step(l.result, "commercial"),
      logistics: round2(["freight", "insurance", "port", "cha", "inland"].reduce((a, k) => a + step(l.result, k), 0)),
      duties: step(l.result, "duties"),
      other: step(l.result, "other"),
      total: l.result.total,
      perUnit: l.result.perUnit?.value,
      unit: l.result.quantity.unit,
    }));
  const DRIVER_KEYS: [string, string][] = [["commercial", "Commercial"], ["freight", "Freight"], ["insurance", "Insurance"], ["duties", "Duties & Taxes"], ["port", "Port / Handling"], ["cha", "CHA"], ["inland", "Inland"], ["other", "Other"]];
  const complete = lc.filter((l) => l.result.status === "complete" && l.result.total !== undefined);
  const drivers = group(complete, (l) => l.result.currency).map((g) => {
    const parts = DRIVER_KEYS.map(([k, label]) => ({ key: k, label, amount: round2(g.items.reduce((a, l) => a + step(l.result, k), 0)) }));
    return { currency: g.key as Currency, parts, total: round2(parts.reduce((a, p) => a + p.amount, 0)) };
  });
  const variance = lc
    .filter((l) => l.snapshots.length > 0 && l.result.total !== undefined && l.snapshots[0].total !== undefined && l.snapshots[0].currency === l.result.currency)
    .map((l) => ({ orderId: l.orderId, currency: l.result.currency, baseline: l.snapshots[0].total!, baselineLabel: l.snapshots[0].label ?? "First snapshot", latest: l.result.total!, change: round2(l.result.total! - l.snapshots[0].total!) }));
  const landedCost: ImporterReport["landedCost"] = {
    sheets: lc.length,
    byStatus: { "needs-input": lc.filter((l) => l.result.status === "needs-input").length, partial: lc.filter((l) => l.result.status === "partial").length, complete: lc.filter((l) => l.result.status === "complete").length },
    estimates,
    drivers,
    variance,
  };

  /* ---- Payments (Payments owns due logic) ---- */
  const pw = d.payments;
  const obligations = pw.flatMap((w) => w.obligations);
  const payments: ImporterReport["payments"] = {
    byCurrency: group(pw, (w) => w.currency)
      .map((g) => ({
        currency: g.key as Currency,
        orderValue: round2(g.items.reduce((a, w) => a + w.orderValue, 0)),
        scheduled: round2(g.items.reduce((a, w) => a + w.totals.scheduled, 0)),
        recorded: round2(g.items.reduce((a, w) => a + w.totals.recorded, 0)),
        remaining: round2(g.items.reduce((a, w) => a + (w.obligations.length ? w.totals.remaining : w.orderValue), 0)),
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    obligations: {
      upcoming: obligations.filter((o) => o.status === "upcoming" || o.status === "ready").length,
      due: obligations.filter((o) => o.status === "due").length,
      overdue: obligations.filter((o) => o.status === "overdue").length,
      awaitingDocuments: obligations.filter((o) => o.status === "awaiting-trigger" && (o.trigger === "documents" || o.trigger === "lc-presentation")).length,
      recorded: obligations.filter((o) => o.status === "recorded").length,
    },
    exposure: pw.map((w) => ({
      orderId: w.order.id,
      supplier: w.supplierName,
      currency: w.currency,
      orderValue: w.orderValue,
      recorded: w.totals.recorded,
      remaining: w.obligations.length ? w.totals.remaining : w.orderValue,
      nextDue: w.nextObligation?.dueDate,
      status: w.status,
    })),
    finance: {
      lcRequired: pw.filter((w) => w.lc?.required).length,
      lcNotStarted: pw.filter((w) => w.lc?.required && w.lc.status === "not-started").length,
      lcIssued: pw.filter((w) => w.lc?.status === "issued-recorded").length,
      lcExpiringSoon: pw.filter((w) => w.exceptions.some((e) => e.type === "lc-expiring")).length,
      financePlanning: pw.filter((w) => !w.lc && w.finance.status === "planning").length,
      readyToApproach: pw.filter((w) => w.readyToApproach).length,
    },
  };

  /* ---- Operational health: one row per active order ---- */
  const operational: OperationalRow[] = d.orders
    .filter((o) => !["completed", "cancelled"].includes(orderStatus(o)))
    .map((o) => {
      const s = d.shipments.find((x) => x.orderId === o.id);
      const t = s ? trackingByShipment.get(s.id) : undefined;
      const c = s ? d.customsCases.find((x) => x.shipmentId === s.id) : undefined;
      const docs = s ? d.documents.filter((x) => x.shipmentId === s.id && x.requirement.level === "required") : [];
      const pay = pw.find((w) => w.order.id === o.id);
      const st = s ? shipmentState(s) : undefined;
      const a = s && st ? assessShipment({ shipment: s, state: st, documents: d.documents, order: o, supplierConfirmed: o.events.some((e) => e.type === "supplier-confirmed"), customs: c?.override }) : undefined;
      return {
        orderId: o.id,
        supplier: supplierName(o.supplierId),
        shipmentId: s?.id,
        stage: st ? SHIPMENT_STAGES.find((x) => x.id === st.stage)!.label : "No shipment yet",
        documents: s ? `${docs.filter((x) => x.complete).length} of ${docs.length} complete` : "—",
        compliance: a?.readiness,
        customs: c ? CUSTOMS_CASE_STATUSES.find((x) => x.id === c.status)!.label : "No case",
        trackingExceptions: t?.open.length ?? 0,
        landedCost: lc.find((l) => l.orderId === o.id)?.result.status ?? "needs-input",
        paymentStatus: pay?.status ?? "manual-setup",
        nextAction: t ? t.nextAction.label : "Create the shipment when the order is ready",
      };
    });

  const outstanding = pw.reduce<MoneyByCurrency>((m, w) => addMoney(m, w.currency, w.obligations.length ? w.totals.remaining : w.orderValue), {});
  return {
    overview: {
      requirements: d.requirements.length,
      quotations: d.quotations.length,
      suppliersEngaged: new Set([...d.quotations.map((q) => q.supplierId), ...d.negotiations.map((n) => n.supplierId), ...d.orders.map((o) => o.supplierId)]).size,
      orders: d.orders.length,
      activeShipments: shipments.active,
      deliveredShipments: shipments.delivered,
      openExceptions: d.tracking.reduce((a, t) => a + t.open.length, 0),
      customsCases: d.customsCases.length,
      outstandingPayments: outstanding,
    },
    sourcing,
    suppliers,
    orders,
    shipments,
    documents,
    customs,
    landedCost,
    payments,
    operational,
  };
}

/* ------------------------------------------------------------------------ */
/* CSV                                                                       */
/* ------------------------------------------------------------------------ */

/** Escapes per RFC 4180: quotes doubled; fields with comma, quote or newline quoted. */
export function csvEscape(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

export const csvFilename = (report: string, today = new Date().toISOString()) => `ximverse-${report}-report-${today.slice(0, 10)}.csv`;
