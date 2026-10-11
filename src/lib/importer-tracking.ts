/**
 * Tracking: shipment visibility and operational exceptions, derived from the
 * information recorded in XimVerse.
 *
 * Tracking is an observability layer. It reads the canonical shipment
 * (status, schedule events, milestones), documents, compliance assessment and
 * customs case; it never owns a status of its own. Exceptions are recomputed
 * on every read and disappear when their source is fixed. The only
 * tracking-specific state is an acknowledgement, which never resolves an
 * exception.
 *
 * No carrier, vessel, GPS or port feed is connected. Schedule changes are
 * recorded by the user (or demo actions) as shipment events.
 */

import { MOCK_NOW } from "./import-requirements";
import { assessShipment, type ComplianceIssue } from "./importer-compliance";
import { customsCaseForShipment, type CustomsCaseView } from "./importer-customs";
import type { TradeDocument } from "./importer-documents";
import { importerHref } from "./importer-nav";
import type { Order } from "./importer-orders";
import {
  nextAction as shipmentNextAction,
  preShipmentChecklist,
  shipmentState,
  type ScheduleChangeReason,
  type Shipment,
  type ShipmentSchedule,
  type ShipmentState,
} from "./importer-shipments";
import { findSupplier } from "./importer-suppliers";

export const TRACKING_NOTICE =
  "Tracking reflects milestones and schedule information recorded in XimVerse. No live carrier, vessel or GPS feed is connected.";

/* ------------------------------------------------------------------------ */
/* Schedule                                                                  */
/* ------------------------------------------------------------------------ */

export type ScheduleStatus = "on-schedule" | "changed" | "delayed" | "arrived" | "delivered";

export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  "on-schedule": "On Schedule",
  changed: "Schedule Changed",
  delayed: "Delayed",
  arrived: "Arrived",
  delivered: "Delivered",
};

export interface ScheduleChange {
  eventId: string;
  at: string;
  field: "readyDate" | "etd" | "eta";
  from: string;
  to: string;
  /** Signed whole days (to − from). */
  days: number;
  reason?: ScheduleChangeReason;
  note?: string;
  demo?: boolean;
}

export interface ScheduleHistoryEntry {
  value: string;
  at?: string;
  label: string;
}

export interface TrackingSchedule {
  baseline: ShipmentSchedule;
  current: ShipmentSchedule;
  changes: ScheduleChange[];
  etaHistory: ScheduleHistoryEntry[];
  etdHistory: ScheduleHistoryEntry[];
  /** Current ETA − planned ETA, in days (positive = later). */
  etaDelayDays: number;
  etdDelayDays: number;
  /** Current ETA is before the demo "today" and the shipment hasn't arrived. */
  overdue: boolean;
  overdueDays: number;
  status: ScheduleStatus;
}

const DAY = 86_400_000;
const dayOf = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
export const daysBetween = (from: string, to: string) => Math.round((dayOf(to) - dayOf(from)) / DAY);

/** "+2 days", "−1 day", "0 days". */
export function formatDayShift(days: number): string {
  const n = Math.abs(days);
  return `${days > 0 ? "+" : days < 0 ? "−" : ""}${n} ${n === 1 ? "day" : "days"}`;
}

const ARRIVED: readonly ShipmentState["status"][] = ["arrived", "customs", "delivered"];

/**
 * The shared schedule helper. Delayed = the current ETA is later than the
 * planned (baseline) ETA, or the ETA has passed (demo today) without an
 * arrival. Changed = any planned date differs without a later ETA.
 */
export function trackingSchedule(s: Shipment, st: ShipmentState = shipmentState(s), today: string = MOCK_NOW): TrackingSchedule {
  const baseline = { ...s.schedule };
  const running = { ...s.schedule };
  const changes: ScheduleChange[] = [];
  const etaHistory: ScheduleHistoryEntry[] = [{ value: baseline.eta, label: "Planned ETA" }];
  const etdHistory: ScheduleHistoryEntry[] = [{ value: baseline.etd, label: "Planned ETD" }];
  for (const e of s.events) {
    if (e.type !== "schedule-updated" || !e.schedule) continue;
    for (const field of ["readyDate", "etd", "eta"] as const) {
      const to = e.schedule[field];
      if (!to || to === running[field]) continue;
      changes.push({ eventId: e.id, at: e.at, field, from: running[field], to, days: daysBetween(running[field], to), reason: e.reason, note: e.note, demo: e.demo });
      running[field] = to;
      if (field === "eta") etaHistory.push({ value: to, at: e.at, label: "Updated ETA" });
      if (field === "etd") etdHistory.push({ value: to, at: e.at, label: "Updated ETD" });
    }
  }
  if (etaHistory.length > 1) etaHistory[etaHistory.length - 1].label = "Latest ETA";
  if (etdHistory.length > 1) etdHistory[etdHistory.length - 1].label = "Latest ETD";
  // Shipment state applies the same events; it is the current schedule.
  const current = { ...st.schedule };
  const etaDelayDays = daysBetween(baseline.eta, current.eta);
  const etdDelayDays = daysBetween(baseline.etd, current.etd);
  const arrived = ARRIVED.includes(st.status);
  const overdueDays = daysBetween(current.eta, today);
  const overdue = !arrived && overdueDays > 0;
  const status: ScheduleStatus =
    st.status === "delivered"
      ? "delivered"
      : arrived
        ? "arrived"
        : overdue || etaDelayDays > 0
          ? "delayed"
          : changes.length
            ? "changed"
            : "on-schedule";
  return { baseline, current, changes, etaHistory, etdHistory, etaDelayDays, etdDelayDays, overdue, overdueDays: overdue ? overdueDays : 0, status };
}

/* ------------------------------------------------------------------------ */
/* Exceptions                                                                */
/* ------------------------------------------------------------------------ */

export type ExceptionSeverity = "critical" | "action-required" | "watch" | "information";

export const SEVERITY_ORDER: readonly ExceptionSeverity[] = ["critical", "action-required", "watch", "information"];

export const EXCEPTION_SEVERITY_LABEL: Record<ExceptionSeverity, string> = {
  critical: "Critical",
  "action-required": "Action Required",
  watch: "Watch",
  information: "Information",
};

export type ExceptionSource = "shipment" | "schedule" | "documents" | "compliance" | "customs";

export const EXCEPTION_SOURCE_LABEL: Record<ExceptionSource, string> = {
  shipment: "Shipment",
  schedule: "Schedule",
  documents: "Documents",
  compliance: "Compliance",
  customs: "Customs",
};

export type TrackingExceptionType =
  | "arrival-overdue"
  | "customs-clarification-open"
  | "customs-handoff-stale"
  | "document-expired"
  | "document-missing"
  | "document-needs-review"
  | "freight-booking-missing"
  | "supplier-confirmation-missing"
  | "customs-broker-missing"
  | "customs-preparation-blocked"
  | "schedule-delay"
  | "schedule-changed"
  | "document-expiring"
  | "shipment-data-check"
  | "document-metadata-incomplete"
  | "transport-document-pending";

/** Label + order within a severity. Earlier = more pressing. */
export const EXCEPTION_TYPE_LABEL: Record<TrackingExceptionType, string> = {
  "arrival-overdue": "Arrival Overdue",
  "customs-clarification-open": "Customs Clarification Open",
  "customs-handoff-stale": "Customs Handoff Stale",
  "document-expired": "Required Document Expired",
  "document-missing": "Required Document Missing",
  "document-needs-review": "Document Needs Review",
  "freight-booking-missing": "Freight Booking Missing",
  "supplier-confirmation-missing": "Shipment Readiness Blocked",
  "customs-broker-missing": "Customs Broker Missing",
  "customs-preparation-blocked": "Customs Preparation Blocked",
  "schedule-delay": "Schedule Delay",
  "schedule-changed": "Schedule Changed",
  "document-expiring": "Document Expiring Soon",
  "shipment-data-check": "Other Structured Issue",
  "document-metadata-incomplete": "Document Metadata Incomplete",
  "transport-document-pending": "Transport Document Pending",
};

const TYPE_ORDER = Object.keys(EXCEPTION_TYPE_LABEL) as TrackingExceptionType[];

export interface Acknowledgement {
  at: string;
  by: string;
  note?: string;
}

export interface TrackingException {
  /** Deterministic: shipment + source + type + reference, so acknowledgements survive recomputation. */
  id: string;
  shipmentId: string;
  type: TrackingExceptionType;
  source: ExceptionSource;
  severity: ExceptionSeverity;
  title: string;
  detail: string;
  /** The step that resolves it, e.g. "Respond to CHA clarification". */
  action: string;
  cta: { label: string; href: string };
  /** What makes it disappear (resolution always comes from the source). */
  resolvesWhen: string;
  acknowledged?: Acknowledgement;
}

export function exceptionId(shipmentId: string, source: ExceptionSource, type: TrackingExceptionType, ref = ""): string {
  return [shipmentId, source, type, ref].filter(Boolean).join(":");
}

/**
 * Central severity rules. Compliance severities are stage-aware already
 * (a document only blocks when the current stage needs it).
 */
export function severityFor(type: TrackingExceptionType, ctx: { complianceSeverity?: ComplianceIssue["severity"]; customsStage?: boolean } = {}): ExceptionSeverity {
  switch (type) {
    case "arrival-overdue":
      return "critical";
    case "customs-clarification-open":
    case "customs-handoff-stale":
    case "document-expired":
    case "document-needs-review":
    case "freight-booking-missing":
    case "supplier-confirmation-missing":
      return "action-required";
    case "document-missing":
      return ctx.complianceSeverity === "blocking" ? "action-required" : ctx.complianceSeverity === "review" ? "watch" : "information";
    case "customs-broker-missing":
      return ctx.complianceSeverity === "review" ? "action-required" : "watch";
    case "customs-preparation-blocked":
      return ctx.customsStage ? "action-required" : "watch";
    case "schedule-delay":
    case "schedule-changed":
    case "document-expiring":
    case "shipment-data-check":
      return "watch";
    case "document-metadata-incomplete":
    case "transport-document-pending":
      return "information";
  }
}

export const isOpenException = (e: TrackingException) => e.severity !== "information";

export function compareExceptions(a: TrackingException, b: TrackingException): number {
  return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.id.localeCompare(b.id);
}

export function highestSeverity(list: readonly TrackingException[]): ExceptionSeverity | undefined {
  return list.map((e) => e.severity).sort((a, b) => SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b))[0];
}

/* ------------------------------------------------------------------------ */
/* View                                                                      */
/* ------------------------------------------------------------------------ */

export interface DocumentSummary {
  required: number;
  complete: number;
  missing: number;
  needsReview: number;
  expired: number;
}

export interface TrackingNextAction {
  label: string;
  /** Where to do it; omitted when it is a wait. */
  cta?: { label: string; href: string };
  basis: "critical" | "action-required" | "shipment" | "watch" | "await";
  exceptionId?: string;
}

export interface TrackingView {
  shipment: Shipment;
  state: ShipmentState;
  order?: Order;
  supplierName: string;
  schedule: TrackingSchedule;
  /** All derived items, most pressing first (information included). */
  exceptions: TrackingException[];
  /** Critical / Action Required / Watch only. */
  open: TrackingException[];
  highest?: ExceptionSeverity;
  attention: boolean;
  nextAction: TrackingNextAction;
  customsCase?: CustomsCaseView;
  documents: TradeDocument[];
  documentSummary: DocumentSummary;
  updatedAt: string;
}

export interface TrackingInput {
  shipment: Shipment;
  documents: readonly TradeDocument[];
  orders: readonly Order[];
  customsCases: readonly CustomsCaseView[];
  acknowledgements?: Readonly<Record<string, Acknowledgement>>;
  today?: string;
}

const COMPLIANCE_TYPE: Record<string, TrackingExceptionType> = {
  missing: "document-missing",
  expired: "document-expired",
  review: "document-needs-review",
  expiring: "document-expiring",
  metadata: "document-metadata-incomplete",
  pending: "transport-document-pending",
  freight: "freight-booking-missing",
  confirmation: "supplier-confirmation-missing",
  broker: "customs-broker-missing",
  consistency: "shipment-data-check",
};

export function trackingView(input: TrackingInput): TrackingView {
  const { shipment: s, documents, orders, customsCases, acknowledgements = {}, today = MOCK_NOW } = input;
  const st = shipmentState(s);
  const order = orders.find((o) => o.id === s.orderId);
  const docs = documents.filter((d) => d.shipmentId === s.id);
  const customsCase = customsCaseForShipment(s.id, customsCases);
  const override = customsCase?.override;
  const supplierConfirmed = !!order?.events.some((e) => e.type === "supplier-confirmed");
  const schedule = trackingSchedule(s, st, today);
  const delivered = st.status === "delivered";
  const customsStage = ["in-transit", "arrived", "customs"].includes(st.status);

  const hrefs = {
    shipment: importerHref(`shipments/${s.id}`),
    order: importerHref(`orders/${s.orderId}`),
    compliance: importerHref(`compliance/${s.id}`),
    schedule: `${importerHref(`tracking/${s.id}`)}#schedule`,
    customs: customsCase ? importerHref(`customs/${customsCase.id}`) : `${importerHref("customs/new")}?shipment=${s.id}`,
    doc: (id: string) => importerHref(`documents/${id}`),
  };
  const customsCta = { label: customsCase ? "View Customs Case" : "Prepare Customs", href: hrefs.customs };

  const list: Omit<TrackingException, "acknowledged">[] = [];
  const add = (e: Omit<TrackingException, "id" | "shipmentId" | "severity"> & { ref?: string; severity?: ExceptionSeverity; ctx?: Parameters<typeof severityFor>[1] }) => {
    const { ref, ctx, severity, ...rest } = e;
    list.push({ ...rest, id: exceptionId(s.id, e.source, e.type, ref), shipmentId: s.id, severity: severity ?? severityFor(e.type, ctx) });
  };

  if (!delivered) {
    // Schedule.
    if (schedule.overdue) {
      add({
        type: "arrival-overdue",
        source: "schedule",
        title: `Arrival overdue by ${formatDayShift(schedule.overdueDays).replace("+", "")}`,
        detail: `Latest ETA was ${schedule.current.eta}; no arrival has been recorded.`,
        action: "Confirm arrival or record a revised ETA",
        cta: { label: "Review Schedule", href: hrefs.schedule },
        resolvesWhen: "An arrival is recorded on the shipment, or a later ETA is recorded.",
      });
    } else if (schedule.status === "delayed") {
      add({
        type: "schedule-delay",
        source: "schedule",
        title: `ETA ${formatDayShift(schedule.etaDelayDays)} later than planned`,
        detail: `Planned ETA ${schedule.baseline.eta}, latest ETA ${schedule.current.eta}.`,
        action: "Review updated ETA",
        cta: { label: "Review Schedule", href: hrefs.schedule },
        resolvesWhen: "The shipment arrives, or the ETA returns to the planned date.",
      });
    } else if (schedule.status === "changed") {
      const last = schedule.changes.at(-1)!;
      add({
        type: "schedule-changed",
        source: "schedule",
        title: `${last.field === "readyDate" ? "Cargo ready date" : last.field.toUpperCase()} changed ${formatDayShift(last.days)}`,
        detail: `${last.from} → ${last.to}${last.reason ? ` · ${last.reason}` : ""}.`,
        action: "Review updated schedule",
        cta: { label: "Review Schedule", href: hrefs.schedule },
        resolvesWhen: "The shipment arrives.",
      });
    }

    // Documents, shipment readiness and broker — from the compliance assessment (stage-aware).
    const assessment = assessShipment({ shipment: s, state: st, documents: docs, order, supplierConfirmed, customs: override });
    for (const issue of assessment.issues) {
      const key = issue.id.split("-")[0];
      const type = COMPLIANCE_TYPE[key];
      if (!type) continue;
      const doc = issue.documentId ? docs.find((d) => d.id === issue.documentId) : undefined;
      const ctx = { complianceSeverity: issue.severity, customsStage };
      if (doc) {
        const verb: Partial<Record<TrackingExceptionType, [string, string, string]>> = {
          "document-missing": [`Complete ${doc.label}`, "Manage Document", `${doc.label} is available or approved and not expired.`],
          "document-expired": [`Replace expired ${doc.label}`, "View Document", `A valid ${doc.label} is recorded.`],
          "document-needs-review": [`Review ${doc.label}`, "View Document", `${doc.label} is approved or replaced.`],
          "document-expiring": [`Check ${doc.label} validity`, "View Document", `${doc.label} is renewed or no longer needed.`],
          "document-metadata-incomplete": [`Complete ${doc.label} metadata`, "View Document", "Document number and issue date are recorded."],
          "transport-document-pending": [`Expect ${doc.label} after departure`, "View Document", `${doc.label} is recorded.`],
        };
        const [action, cta, resolves] = verb[type] ?? [`Review ${doc.label}`, "View Document", "The document is complete."];
        add({ type, source: "documents", ref: doc.id, title: issue.title, detail: issue.detail, action, cta: { label: cta, href: hrefs.doc(doc.id) }, resolvesWhen: resolves, ctx });
      } else if (type === "freight-booking-missing") {
        add({ type, source: "shipment", title: issue.title, detail: issue.detail, action: st.booking.arrangedBy === "importer" ? "Complete freight booking" : "Follow up on the supplier's freight booking", cta: { label: "View Shipment", href: `${hrefs.shipment}#freight` }, resolvesWhen: "Freight is booked on the shipment.", ctx });
      } else if (type === "supplier-confirmation-missing") {
        add({ type, source: "shipment", title: issue.title, detail: issue.detail, action: "Obtain supplier confirmation", cta: { label: "View Order", href: hrefs.order }, resolvesWhen: "Supplier confirmation is recorded on the order.", ctx });
      } else if (type === "customs-broker-missing") {
        add({ type, source: "customs", title: issue.title, detail: issue.detail, action: "Assign a customs broker", cta: customsCta, resolvesWhen: "A customs broker is assigned.", ctx });
      } else if (type === "shipment-data-check") {
        add({ type, source: "compliance", ref: issue.id, title: issue.title, detail: issue.detail, action: "Review shipment information", cta: { label: "View Compliance", href: hrefs.compliance }, resolvesWhen: "The data check passes on the compliance page.", ctx });
      }
    }

    // Customs case: clarifications, handoff, declaration blockers.
    if (customsCase && ["preparing", "ready-for-handoff", "with-cha", "clarification-required", "ready-for-filing"].includes(customsCase.status)) {
      for (const c of customsCase.clarifications.filter((x) => x.status === "open")) {
        add({
          type: "customs-clarification-open",
          source: "customs",
          ref: `${customsCase.id}:${c.id}`,
          title: `CHA clarification waiting for your response`,
          detail: c.question,
          action: "Respond to CHA clarification",
          cta: customsCta,
          resolvesWhen: "The clarification is resolved in the customs case.",
        });
      }
      if (customsCase.handoffStale || (customsCase.handoff && customsCase.changedSinceHandoff.length > 0)) {
        add({
          type: "customs-handoff-stale",
          source: "customs",
          ref: customsCase.id,
          title: customsCase.handoffStale ? "Broker changed after the last handoff" : "Customs package changed since handoff",
          detail: customsCase.handoffStale ? `The last handoff was to ${customsCase.handoffs.at(-1)?.cha.company}.` : customsCase.changedSinceHandoff.join(", "),
          action: "Record updated CHA handoff",
          cta: customsCta,
          resolvesWhen: "An updated handoff is recorded in the customs case.",
        });
      }
      const declaration = customsCase.blockers.filter((b) => b.kind === "hs-code" || b.kind === "declaration-field");
      if (declaration.length) {
        add({
          type: "customs-preparation-blocked",
          source: "customs",
          ref: customsCase.id,
          title: `Customs declaration: ${declaration.length} ${declaration.length === 1 ? "item" : "items"} missing`,
          detail: declaration.map((b) => b.title).join(", "),
          action: "Complete customs declaration fields",
          cta: customsCta,
          resolvesWhen: "The declaration fields have values in the customs case.",
          ctx: { customsStage },
        });
      }
    }
  }

  const exceptions = list.map((e) => ({ ...e, acknowledged: acknowledgements[e.id] })).sort(compareExceptions);
  const open = exceptions.filter(isOpenException);
  const highest = highestSeverity(open);

  // Next action: critical → action required → shipment's own next action → watch → await.
  const canonical = shipmentNextAction(s, st, preShipmentChecklist(s, st, supplierConfirmed, docs, override), docs, override);
  const first = (sev: ExceptionSeverity) => open.find((e) => e.severity === sev);
  const fromException = (e: TrackingException, basis: TrackingNextAction["basis"]): TrackingNextAction => ({ label: e.action, cta: e.cta, basis, exceptionId: e.id });
  const awaiting = /^(Await|No further action)/.test(canonical);
  const critical = first("critical");
  const action = first("action-required");
  const watch = first("watch");
  const nextAction: TrackingNextAction = critical
    ? fromException(critical, "critical")
    : action
      ? fromException(action, "action-required")
      : !awaiting
        ? { label: canonical, cta: { label: "View Shipment", href: hrefs.shipment }, basis: "shipment" }
        : watch
          ? fromException(watch, "watch")
          : { label: canonical, basis: "await" };

  const required = docs.filter((d) => d.requirement.level === "required");
  const documentSummary: DocumentSummary = {
    required: required.length,
    complete: required.filter((d) => d.complete).length,
    missing: required.filter((d) => ["not-started", "requested", "draft"].includes(d.status)).length,
    needsReview: required.filter((d) => d.status === "needs-review").length,
    expired: required.filter((d) => d.validity === "expired" && (d.status === "available" || d.status === "approved")).length,
  };

  const updatedAt = [st.updatedAt, ...docs.map((d) => d.updatedAt), customsCase?.updatedAt ?? ""].reduce((a, b) => (b > a ? b : a));

  return {
    shipment: s,
    state: st,
    order,
    supplierName: findSupplier(s.supplierId)?.name ?? s.supplierId,
    schedule,
    exceptions,
    open,
    highest,
    attention: !delivered && open.some((e) => e.severity === "critical" || e.severity === "action-required"),
    nextAction,
    customsCase,
    documents: docs,
    documentSummary,
    updatedAt,
  };
}

/** Deterministic "Attention First": highest severity, then number of open exceptions, then soonest ETA. */
export function compareAttention(a: TrackingView, b: TrackingView): number {
  const rank = (v: TrackingView) => (v.state.status === "delivered" ? 5 : v.highest ? SEVERITY_ORDER.indexOf(v.highest) : 4);
  return rank(a) - rank(b) || b.open.length - a.open.length || a.schedule.current.eta.localeCompare(b.schedule.current.eta) || a.shipment.id.localeCompare(b.shipment.id);
}

export const ATTENTION_SORT_EXPLANATION = "Highest severity first, then most open exceptions, then soonest ETA. Delivered shipments last.";
