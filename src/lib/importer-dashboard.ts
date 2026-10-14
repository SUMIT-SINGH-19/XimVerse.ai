/**
 * The importer overview dashboard, derived on every read from the canonical
 * records (via the Feature 13 report bundle). Nothing here is stored or
 * mocked: each section reuses its owning feature's definitions —
 * Tracking (schedule, delay, exceptions, attention order), Compliance
 * (readiness), Customs (case status, clarifications), Landed Cost
 * (completeness), Payments (due logic) and Reports (document health).
 */

import { isActive, MOCK_NOW, type ImportRequirement } from "./import-requirements";
import { assessShipment, READINESS_LABEL, type Readiness } from "./importer-compliance";
import { CUSTOMS_CASE_STATUS_LABEL, customsActivity, customsCaseForShipment } from "./importer-customs";
import { describeDocumentEvent } from "./importer-documents";
import { COST_STATUS_LABEL } from "./importer-landed-cost";
import { formatDate } from "./format";
import { importerHref } from "./importer-nav";
import { isActiveNegotiation } from "./importer-negotiations";
import { isActiveOrder, ORDER_EVENT_LABEL } from "./importer-orders";
import { formatMoney, WORKSPACE_STATUS_LABEL, type PaymentObligation } from "./importer-payments";
import { buildImporterReport, type ReportData } from "./importer-reports";
import { shipmentState, type ShipmentEvent, type ShipmentStatus } from "./importer-shipments";
import { compareAttention, EXCEPTION_SEVERITY_LABEL, SCHEDULE_STATUS_LABEL, type TrackingView } from "./importer-tracking";

const DAY = 86_400_000;
const dayOf = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const daysBetween = (from: string, to: string) => Math.round((dayOf(to) - dayOf(from)) / DAY);

/** Upcoming arrivals and upcoming payments look this many days ahead of the demo date. */
export const UPCOMING_WINDOW_DAYS = 14;

/* ------------------------------------------------------------------------ */
/* Summary                                                                   */
/* ------------------------------------------------------------------------ */

export interface DashboardSummary {
  openRequirements: number;
  activeNegotiations: number;
  openOrders: number;
  activeShipments: number;
  /** Distinct attention items (see ATTENTION_DEFINITION). */
  needsAttention: number;
  upcomingPayments: number;
  arrivingSoon: number;
}

export const ATTENTION_DEFINITION =
  "Counts Action Required items: critical or action-required tracking exceptions, payments due or overdue, open CHA clarifications and blocked compliance — each underlying issue once.";
export const UPCOMING_PAYMENTS_DEFINITION = `Supplier payment obligations that are due today, ready for payment, or have a due date within ${UPCOMING_WINDOW_DAYS} days. Overdue payments count under Needs Attention.`;

/* ------------------------------------------------------------------------ */
/* Actions                                                                   */
/* ------------------------------------------------------------------------ */

export type ActionSource = "Tracking" | "Payments" | "Customs" | "Compliance" | "Documents" | "Landed Cost";

export interface DashboardAction {
  /** Stable: source + underlying issue ID. */
  id: string;
  /** Fixed priority (1 = most pressing), see ACTION_PRIORITY. */
  priority: number;
  title: string;
  reason: string;
  source: ActionSource;
  entityId: string;
  /** Status text from the owning feature (e.g. "Critical", "Overdue"). */
  status: string;
  /** Counts toward Needs Attention. */
  attention: boolean;
  cta: { label: string; href: string };
}

/** Fixed priority order — deterministic, not AI. */
export const ACTION_PRIORITY = [
  "Critical tracking exception",
  "Payment overdue / due today",
  "Open CHA clarification",
  "Blocked compliance",
  "Action-required tracking exception",
  "Required document issue",
  "Stale customs handoff",
  "Landed cost input needed",
  "Watch item",
] as const;

/* ------------------------------------------------------------------------ */
/* Other sections                                                            */
/* ------------------------------------------------------------------------ */

export interface ActiveImportRow {
  view: TrackingView;
  shipmentId: string;
  orderId: string;
  supplier: string;
  product: string;
  route: { origin: string; destination: string };
  stage: ShipmentStatus;
  eta: string;
  scheduleStatus: TrackingView["schedule"]["status"];
  scheduleLabel: string;
  openExceptions: number;
  highest?: string;
  href: string;
}

export interface DashboardArrival {
  shipmentId: string;
  supplier: string;
  /** Port of loading → port of discharge. */
  origin: string;
  port: string;
  eta: string;
  daysRemaining: number;
  scheduleLabel: string;
  delayDays: number;
  href: string;
}

export type JourneyState = "complete" | "current" | "attention" | "upcoming";

export interface JourneyStage {
  id: "sourcing" | "order" | "shipment" | "documents" | "customs" | "delivery" | "payment";
  label: string;
  state: JourneyState;
  detail: string;
  href: string;
}

export interface DashboardJourney {
  shipmentId?: string;
  orderId: string;
  supplier: string;
  product: string;
  /** Why this import was chosen. */
  basis: string;
  stages: JourneyStage[];
}

export interface DashboardHealth {
  required: number;
  approved: number;
  needsReview: number;
  missing: number;
  expired: number;
  readiness: Record<Readiness, number>;
}

export interface DashboardActivity {
  id: string;
  at: string;
  title: string;
  entity: string;
  source: "Requirement" | "Negotiation" | "Order" | "Shipment" | "Document" | "Customs" | "Payment" | "Landed Cost";
  href: string;
  demo?: boolean;
}

export interface ImporterDashboard {
  asOf: string;
  summary: DashboardSummary;
  actions: DashboardAction[];
  activeImports: ActiveImportRow[];
  arrivals: DashboardArrival[];
  journey?: DashboardJourney;
  health: DashboardHealth;
  activity: DashboardActivity[];
}

export interface DashboardOptions {
  today?: string;
  /** Shipment event wording, from the Shipments feature (UI layer). */
  describeShipmentEvent?: (e: ShipmentEvent) => string;
  activityLimit?: number;
}

/* ------------------------------------------------------------------------ */
/* Builder                                                                   */
/* ------------------------------------------------------------------------ */

const PAYABLE_NOW: readonly PaymentObligation["status"][] = ["due", "ready"];

export function buildImporterDashboard(data: ReportData, opts: DashboardOptions = {}): ImporterDashboard {
  const today = opts.today ?? data.today ?? MOCK_NOW;
  const report = buildImporterReport(data);
  const tracking = data.tracking;
  const active = tracking.filter((t) => t.state.status !== "delivered").slice().sort(compareAttention);

  /* ---- Actions (deduplicated by underlying issue) ---- */
  const actions: DashboardAction[] = [];
  const push = (a: DashboardAction) => {
    if (!actions.some((x) => x.id === a.id)) actions.push(a);
  };
  const trackingHref = (id: string) => importerHref(`tracking/${id}`);

  // Compliance blocked, once per shipment (its blocking issues are listed in the reason).
  const blockedShipments = new Set<string>();
  for (const t of active) {
    const order = data.orders.find((o) => o.id === t.shipment.orderId);
    const caseView = customsCaseForShipment(t.shipment.id, data.customsCases);
    const a = assessShipment({ shipment: t.shipment, state: t.state, documents: data.documents, order, supplierConfirmed: !!order?.events.some((e) => e.type === "supplier-confirmed"), customs: caseView?.override });
    if (a.readiness !== "blocked") continue;
    blockedShipments.add(t.shipment.id);
    const blocking = a.issues.filter((i) => i.severity === "blocking");
    push({ id: `compliance:${t.shipment.id}`, priority: 4, title: `Compliance blocked on ${t.shipment.id}`, reason: blocking.map((i) => i.title).join(" · "), source: "Compliance", entityId: t.shipment.id, status: "Blocked", attention: true, cta: { label: "View Compliance", href: importerHref(`compliance/${t.shipment.id}`) } });
  }

  // Tracking exceptions, mapped to the fixed priority order. Issues already
  // summarised by a blocked-compliance action are not repeated.
  const COMPLIANCE_TYPES = ["document-missing", "document-expired", "freight-booking-missing", "supplier-confirmation-missing"];
  for (const t of active) {
    for (const e of t.open) {
      if (blockedShipments.has(t.shipment.id) && COMPLIANCE_TYPES.includes(e.type)) continue;
      let priority: number;
      // The exception's owning feature labels the action at any severity.
      let source: ActionSource = e.source === "customs" ? "Customs" : e.source === "documents" ? "Documents" : e.source === "compliance" ? "Compliance" : "Tracking";
      if (e.severity === "critical") priority = 1;
      else if (e.type === "customs-clarification-open") [priority, source] = [3, "Customs"];
      else if (e.type === "customs-handoff-stale") [priority, source] = [7, "Customs"];
      else if (e.severity === "action-required" && e.source === "documents") [priority, source] = [6, "Documents"];
      else if (e.severity === "action-required") priority = 5;
      else priority = 9;
      push({
        id: `tracking:${e.id}`,
        priority,
        title: e.title,
        reason: `${t.shipment.id} · ${e.detail}`,
        source,
        entityId: t.shipment.id,
        status: EXCEPTION_SEVERITY_LABEL[e.severity],
        attention: e.severity === "critical" || e.severity === "action-required",
        cta: e.cta.href.includes("#") && e.cta.label === "Review Schedule" ? { label: "View Tracking", href: trackingHref(t.shipment.id) } : e.cta,
      });
    }
  }

  // Payments due today / overdue.
  for (const w of data.payments) {
    for (const o of w.obligations.filter((x) => x.status === "overdue" || x.status === "due")) {
      push({
        id: `payments:${o.id}`,
        priority: 2,
        title: `${o.label} ${o.status === "overdue" ? "overdue" : "due today"} on ${w.order.id}`,
        reason: `${formatMoney(o.remaining, w.currency)} · due ${o.dueDate}`,
        source: "Payments",
        entityId: w.order.id,
        status: o.status === "overdue" ? "Overdue" : "Due",
        attention: true,
        cta: { label: "View Payments", href: importerHref(`payments/${w.order.id}`) },
      });
    }
  }

  // Landed cost input needed — only for orders already shipping.
  for (const l of data.landedCost) {
    const hasActiveShipment = active.some((t) => t.shipment.orderId === l.orderId);
    if (!hasActiveShipment || l.result.status === "complete") continue;
    push({ id: `landed-cost:${l.orderId}`, priority: 8, title: `Landed cost estimate ${l.result.status === "needs-input" ? "not started" : "incomplete"} for ${l.orderId}`, reason: COST_STATUS_LABEL[l.result.status], source: "Landed Cost", entityId: l.orderId, status: COST_STATUS_LABEL[l.result.status], attention: false, cta: { label: "View Landed Cost", href: importerHref(`landed-cost/${l.orderId}`) } });
  }

  actions.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  // Watch items appear only when there are few stronger actions.
  const strong = actions.filter((a) => a.priority < 9);
  const shownActions = strong.length >= 5 ? strong : actions;

  /* ---- Summary ---- */
  const obligations = data.payments.flatMap((w) => w.obligations);
  const upcomingPayments = obligations.filter(
    (o) => PAYABLE_NOW.includes(o.status) || (o.status === "upcoming" && !!o.dueDate && daysBetween(today, o.dueDate) <= UPCOMING_WINDOW_DAYS),
  ).length;

  /* ---- Active imports (Tracking-ordered) ---- */
  const activeImports: ActiveImportRow[] = active.map((t) => ({
    view: t,
    shipmentId: t.shipment.id,
    orderId: t.shipment.orderId,
    supplier: t.supplierName,
    product: t.shipment.cargo.product,
    route: { origin: t.shipment.route.portOfLoading, destination: t.shipment.route.portOfDischarge },
    stage: t.state.status,
    eta: t.schedule.current.eta,
    scheduleStatus: t.schedule.status,
    scheduleLabel: SCHEDULE_STATUS_LABEL[t.schedule.status],
    openExceptions: t.open.length,
    highest: t.highest ? EXCEPTION_SEVERITY_LABEL[t.highest] : undefined,
    href: trackingHref(t.shipment.id),
  }));

  /* ---- Upcoming arrivals: not yet arrived, ETA within the window, not overdue ---- */
  const arrivals: DashboardArrival[] = active
    .filter((t) => !["arrived", "customs", "delivered"].includes(t.state.status) && !t.schedule.overdue)
    .map((t) => ({ t, days: daysBetween(today, t.schedule.current.eta) }))
    .filter(({ days }) => days >= 0 && days <= UPCOMING_WINDOW_DAYS)
    .sort((a, b) => a.days - b.days || a.t.shipment.id.localeCompare(b.t.shipment.id))
    .map(({ t, days }) => ({
      shipmentId: t.shipment.id,
      supplier: t.supplierName,
      origin: t.shipment.route.portOfLoading,
      port: t.shipment.route.portOfDischarge,
      eta: t.schedule.current.eta,
      daysRemaining: days,
      scheduleLabel: SCHEDULE_STATUS_LABEL[t.schedule.status],
      delayDays: t.schedule.status === "delayed" ? t.schedule.etaDelayDays : 0,
      href: trackingHref(t.shipment.id),
    }));

  /* ---- Journey: the most pressing active import (Tracking attention order) ---- */
  let journey: DashboardJourney | undefined;
  const rep = active[0];
  const repOrder = rep ? data.orders.find((o) => o.id === rep.shipment.orderId) : data.orders.filter(isActiveOrder).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (repOrder) {
    const shipment = rep?.shipment;
    const st = shipment ? shipmentState(shipment) : undefined;
    const caseView = shipment ? customsCaseForShipment(shipment.id, data.customsCases) : undefined;
    const pay = data.payments.find((w) => w.order.id === repOrder.id);
    const confirmed = repOrder.events.some((e) => e.type === "supplier-confirmed");
    const readiness = shipment && st ? assessShipment({ shipment, state: st, documents: data.documents, order: repOrder, supplierConfirmed: confirmed, customs: caseView?.override }).readiness : undefined;
    const after = (s: string[]) => !!st && s.includes(st.status);
    const stages: JourneyStage[] = [
      { id: "sourcing", label: "Sourcing", state: "complete", detail: "Supplier selected", href: importerHref(`rfqs/${repOrder.requirementId}`) },
      { id: "order", label: "Order", state: confirmed ? "complete" : "current", detail: confirmed ? "Supplier confirmed" : "Awaiting supplier confirmation", href: importerHref(`orders/${repOrder.id}`) },
      {
        id: "shipment",
        label: "Shipment",
        state: !shipment ? "upcoming" : after(["at-origin", "in-transit", "arrived", "customs", "delivered"]) ? "complete" : "current",
        detail: !shipment ? "Not created yet" : SCHEDULE_STATUS_LABEL[rep!.schedule.status],
        href: shipment ? importerHref(`shipments/${shipment.id}`) : importerHref(`orders/${repOrder.id}`),
      },
      {
        id: "documents",
        label: "Documents",
        state: !readiness ? "upcoming" : readiness === "ready" ? "complete" : "attention",
        detail: !readiness ? "After shipment is created" : READINESS_LABEL[readiness],
        href: shipment ? importerHref(`compliance/${shipment.id}`) : importerHref("documents"),
      },
      {
        id: "customs",
        label: "Customs",
        state: !caseView ? "upcoming" : caseView.status === "cleared" ? "complete" : caseView.status === "clarification-required" ? "attention" : "current",
        detail: caseView ? CUSTOMS_CASE_STATUS_LABEL[caseView.status] : "Not started",
        href: caseView ? importerHref(`customs/${caseView.id}`) : shipment ? `${importerHref("customs/new")}?shipment=${shipment.id}` : importerHref("customs"),
      },
      {
        id: "delivery",
        label: "Delivery",
        state: after(["delivered"]) ? "complete" : after(["arrived", "customs"]) ? "current" : "upcoming",
        detail: st ? (st.status === "delivered" ? "Delivered" : `ETA ${formatDate(rep!.schedule.current.eta)}`) : "—",
        href: shipment ? trackingHref(shipment.id) : importerHref("tracking"),
      },
      {
        id: "payment",
        label: "Payment",
        state: !pay ? "upcoming" : pay.status === "recorded" ? "complete" : pay.status === "overdue" || pay.status === "due" || pay.status === "manual-setup" ? "attention" : "current",
        detail: pay ? WORKSPACE_STATUS_LABEL[pay.status] : "—",
        href: importerHref(`payments/${repOrder.id}`),
      },
    ];
    journey = {
      shipmentId: shipment?.id,
      orderId: repOrder.id,
      supplier: rep?.supplierName ?? repOrder.supplierId,
      product: repOrder.terms.productName,
      basis: rep ? "Most pressing active import: highest exception severity, then most open exceptions, then soonest ETA." : "Newest active order (no active shipment yet).",
      stages,
    };
  }

  /* ---- Health (Reports metrics; Compliance owns readiness) ---- */
  const health: DashboardHealth = {
    required: report.documents.required,
    approved: report.documents.approved,
    needsReview: report.documents.needsReview,
    missing: report.documents.missing,
    expired: report.documents.expired,
    readiness: report.documents.compliance,
  };

  /* ---- Activity: canonical event streams merged on read ---- */
  const activity: DashboardActivity[] = [];
  const reqCreated = (r: ImportRequirement) => activity.push({ id: `req:${r.id}`, at: r.createdAt, title: `Requirement created: ${r.product.name}`, entity: r.id, source: "Requirement", href: importerHref(`rfqs/${r.id}`) });
  data.requirements.forEach(reqCreated);
  for (const n of data.negotiations) {
    const ag = n.events.find((e) => e.type === "agreement");
    if (ag) activity.push({ id: `neg:${n.id}`, at: ag.at, title: "Agreement reached", entity: n.id, source: "Negotiation", href: importerHref(`negotiations/${n.id}`), demo: ag.demo });
  }
  for (const o of data.orders) {
    for (const e of o.events.filter((x) => x.type !== "po-prepared")) activity.push({ id: `ord:${o.id}:${e.id}`, at: e.at, title: ORDER_EVENT_LABEL[e.type], entity: o.id, source: "Order", href: importerHref(`orders/${o.id}`), demo: e.demo });
  }
  for (const s of data.shipments) {
    for (const e of s.events) activity.push({ id: `shp:${s.id}:${e.id}`, at: e.at, title: opts.describeShipmentEvent ? opts.describeShipmentEvent(e) : e.type, entity: s.id, source: "Shipment", href: importerHref(`shipments/${s.id}`), demo: e.demo });
  }
  for (const d of data.documents) {
    for (const e of d.events) activity.push({ id: `doc:${e.id}`, at: e.at, title: describeDocumentEvent(e, d.label), entity: d.shipmentId, source: "Document", href: importerHref(`documents/${d.id}`), demo: e.demo });
  }
  for (const c of data.customsCases) {
    for (const a of customsActivity(c).filter((x) => !x.id.startsWith("shp-") && !x.id.startsWith("doc-"))) activity.push({ id: `cus:${c.id}:${a.id}`, at: a.at, title: a.text, entity: c.id, source: "Customs", href: importerHref(`customs/${c.id}`), demo: a.demo });
  }
  for (const w of data.payments) {
    for (const h of w.history.filter((x) => !x.derived)) activity.push({ id: `pay:${w.order.id}:${h.id}`, at: h.at, title: h.text, entity: w.order.id, source: "Payment", href: importerHref(`payments/${w.order.id}`), demo: h.demo });
  }
  for (const l of data.landedCost) {
    for (const s of l.snapshots) activity.push({ id: `lc:${s.id}`, at: s.at, title: `Landed cost snapshot saved${s.label ? `: ${s.label}` : ""}`, entity: l.orderId, source: "Landed Cost", href: importerHref(`landed-cost/${l.orderId}`) });
  }
  activity.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  const latest = activity[0]?.at;

  return {
    asOf: latest && latest > today ? latest : today,
    summary: {
      openRequirements: data.requirements.filter(isActive).length,
      activeNegotiations: data.negotiations.filter(isActiveNegotiation).length,
      openOrders: data.orders.filter(isActiveOrder).length,
      activeShipments: active.length,
      needsAttention: actions.filter((a) => a.attention).length,
      upcomingPayments,
      arrivingSoon: arrivals.length,
    },
    actions: shownActions,
    activeImports,
    arrivals,
    journey,
    health,
    activity: activity.slice(0, opts.activityLimit ?? 8),
  };
}
