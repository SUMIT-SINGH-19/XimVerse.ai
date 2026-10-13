/**
 * Payments + trade finance: what money is expected to move, when, under the
 * agreed order terms, and what readiness or proof exists.
 *
 * The order's frozen terms own the payment agreement (term, advance %,
 * currency, value). Obligations are derived only from that structured data;
 * anything that can't be interpreted safely needs a manual schedule. Document
 * and shipment triggers read the canonical stores. Payment records, LC and
 * finance events are records of activity outside XimVerse: no money moves,
 * no bank or payment network is connected, and nothing is underwritten.
 */

import { MOCK_NOW, paymentTermLabel, type Currency, type PaymentTerm } from "./import-requirements";
import { DOCUMENT_TYPE_LABEL, type DocumentType, type TradeDocument } from "./importer-documents";
import { importerHref, PLACEHOLDER_IMPORTER } from "./importer-nav";
import { orderValue, type Order } from "./importer-orders";
import { shipmentState, type Shipment, type ShipmentStatus } from "./importer-shipments";
import { findSupplier } from "./importer-suppliers";

export const PAYMENTS_NOTICE = "XimVerse records payment workflow information only. No funds are transferred and no bank or payment network is connected.";
export const EXTERNAL_EVENT_NOTE = "No bank is connected. This records an external banking event.";
export const EVIDENCE_NOTE = "Evidence metadata only — no payment file is stored.";
export const LC_CHECKLIST_NOTE = "Planning checklist — confirm against the actual LC.";

/* ------------------------------------------------------------------------ */
/* Money                                                                     */
/* ------------------------------------------------------------------------ */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

const DAY = 86_400_000;
const dayOf = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
export const daysBetween = (from: string, to: string) => Math.round((dayOf(to) - dayOf(from)) / DAY);

/* ------------------------------------------------------------------------ */
/* Vocabulary                                                                */
/* ------------------------------------------------------------------------ */

export type PaymentTrigger = "on-order" | "before-shipment" | "documents" | "lc-presentation" | "on-shipment" | "on-arrival" | "on-delivery" | "manual-date";

export const TRIGGER_LABEL: Record<PaymentTrigger, string> = {
  "on-order": "On Order",
  "before-shipment": "Before Shipment",
  documents: "Against Documents",
  "lc-presentation": "At Sight (LC presentation)",
  "on-shipment": "On Shipment",
  "on-arrival": "On Arrival",
  "on-delivery": "On Delivery",
  "manual-date": "Manual Date",
};

export const MANUAL_TRIGGERS: readonly PaymentTrigger[] = ["on-order", "before-shipment", "documents", "on-shipment", "on-arrival", "on-delivery", "manual-date"];

export type ObligationStatus = "planned" | "awaiting-trigger" | "upcoming" | "ready" | "due" | "overdue" | "recorded";

export const OBLIGATION_STATUS_LABEL: Record<ObligationStatus, string> = {
  planned: "Planned",
  "awaiting-trigger": "Awaiting Trigger",
  upcoming: "Upcoming",
  ready: "Ready for Payment",
  due: "Due",
  overdue: "Overdue",
  recorded: "Payment Recorded",
};

export const PAYMENT_METHODS = [
  { id: "bank-transfer", label: "Bank Transfer" },
  { id: "letter-of-credit", label: "Letter of Credit" },
  { id: "documentary-collection", label: "Documentary Collection" },
  { id: "cheque", label: "Cheque" },
  { id: "other", label: "Other" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];
export const methodLabel = (m: PaymentMethod) => PAYMENT_METHODS.find((x) => x.id === m)!.label;

export type FinanceInstrument = "letter-of-credit" | "documentary-collection" | "bank-guarantee" | "import-finance" | "none";

export const INSTRUMENT_LABEL: Record<FinanceInstrument, string> = {
  "letter-of-credit": "Letter of Credit",
  "documentary-collection": "Documentary Collection",
  "bank-guarantee": "Bank Guarantee",
  "import-finance": "Import Finance / Buyer Credit",
  none: "No Finance Instrument",
};

export type LcStatus = "not-started" | "details-required" | "draft-prepared" | "application-recorded" | "issued-recorded" | "amendment-required" | "expired" | "closed";

export const LC_STATUS_LABEL: Record<LcStatus, string> = {
  "not-started": "Not Started",
  "details-required": "Details Required",
  "draft-prepared": "Draft Prepared",
  "application-recorded": "Application Recorded",
  "issued-recorded": "Issued — Recorded Externally",
  "amendment-required": "Amendment Required",
  expired: "Expired",
  closed: "Closed",
};

export type FinanceStatus = "not-needed" | "planning" | "documents-required" | "ready-to-approach" | "application-recorded" | "approved-recorded" | "rejected-recorded" | "closed";

export const FINANCE_STATUS_LABEL: Record<FinanceStatus, string> = {
  "not-needed": "Not Needed",
  planning: "Planning",
  "documents-required": "Documents Required",
  "ready-to-approach": "Ready to Approach Provider",
  "application-recorded": "Application Recorded Externally",
  "approved-recorded": "Approved — Recorded Externally",
  "rejected-recorded": "Rejected — Recorded Externally",
  closed: "Closed",
};

/* ------------------------------------------------------------------------ */
/* Records                                                                   */
/* ------------------------------------------------------------------------ */

export interface ObligationInput {
  label: string;
  /** Percent of the order value. */
  percentage: number;
  trigger: PaymentTrigger;
  dueDate?: string;
  notes?: string;
  requiredDocuments?: DocumentType[];
}

/** Per-obligation importer settings on a derived schedule. */
export interface ObligationOverride {
  dueDate?: string;
  requiredDocuments?: DocumentType[];
  notes?: string;
}

export interface PaymentEvidence {
  bankAdviceNumber?: string;
  utr?: string;
  declaredFilename?: string;
  notes?: string;
}

export interface PaymentRecord {
  id: string;
  obligationId: string;
  orderId: string;
  recordedAt: string;
  /** YYYY-MM-DD */
  paymentDate: string;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  reference?: string;
  provider?: string;
  payerAccountLabel?: string;
  payeeAccountLabel?: string;
  notes?: string;
  evidence: PaymentEvidence;
  demo?: boolean;
}

export interface LcPlan {
  issuingBank?: string;
  advisingBank?: string;
  applicant?: string;
  beneficiary?: string;
  amount?: number;
  expiryDate?: string;
  latestShipmentDate?: string;
  presentationDays?: number;
  reference?: string;
  /** Documentary conditions the importer recorded for the LC. */
  documents?: DocumentType[];
}

export interface FinancePlan {
  needed?: boolean;
  instrument?: FinanceInstrument;
  requestedAmount?: number;
  neededBy?: string;
  purpose?: string;
  provider?: string;
}

export type PaymentEventType =
  | "schedule-set"
  | "due-date-set"
  | "payment-recorded"
  | "reference-updated"
  | "lc-details-saved"
  | "lc-status"
  | "finance-saved"
  | "finance-status";

export interface PaymentEvent {
  id: string;
  type: PaymentEventType;
  at: string;
  text: string;
  lcStatus?: LcStatus;
  financeStatus?: FinanceStatus;
  demo?: boolean;
}

/** Everything stored for one order's payments. Commercial terms are never stored here. */
export interface PaymentState {
  manualSchedule?: ObligationInput[];
  overrides: Record<string, ObligationOverride>;
  records: PaymentRecord[];
  lc?: LcPlan;
  finance?: FinancePlan;
  events: PaymentEvent[];
}

export const EMPTY_PAYMENT_STATE: PaymentState = { overrides: {}, records: [], events: [] };

export const PAYMENT_ID_PATTERN = /^PAY-\d{4}-\d{4,}$/;

/* ------------------------------------------------------------------------ */
/* Payment-term interpretation (structured data only)                        */
/* ------------------------------------------------------------------------ */

const DEFAULT_DOCUMENTARY: DocumentType[] = ["commercial-invoice", "packing-list", "transport-document"];

export interface TermInterpretation {
  supported: boolean;
  /** Why a manual schedule is needed. */
  reason?: string;
  obligations: ObligationInput[];
  instrument?: { instrument: FinanceInstrument; basis: string };
}

/**
 * Derives obligations from the structured term and advance %. The summary is
 * used only when it exactly matches a known form and agrees with the
 * structured advance %; otherwise a manual schedule is required.
 */
export function interpretTerms(order: Order): TermInterpretation {
  const t = order.terms;
  const manual = (reason: string): TermInterpretation => ({ supported: false, reason, obligations: [] });
  switch (t.paymentTerm as PaymentTerm) {
    case "lc":
      return {
        supported: true,
        obligations: [{ label: "Payment at Sight under LC", percentage: 100, trigger: "lc-presentation" }],
        instrument: { instrument: "letter-of-credit", basis: "Required by agreed payment terms" },
      };
    case "dp":
      return {
        supported: true,
        obligations: [{ label: "Payment Against Documents (D/P)", percentage: 100, trigger: "documents", requiredDocuments: DEFAULT_DOCUMENTARY }],
        instrument: { instrument: "documentary-collection", basis: "Implied by Documents Against Payment terms" },
      };
    case "advance": {
      const a = t.advancePercent;
      if (!(a > 0 && a <= 100)) return manual("The advance percentage on the order isn't usable.");
      if (a === 100) return { supported: true, obligations: [{ label: "Advance Payment", percentage: 100, trigger: "on-order" }] };
      const m = /^(\d{1,3})% advance \/ (\d{1,3})% (against documents|before shipment)$/i.exec(t.paymentSummary.trim());
      if (!m || Number(m[1]) !== a || Number(m[1]) + Number(m[2]) !== 100) return manual("The balance trigger isn't recorded in a structured form.");
      const documents = m[3].toLowerCase() === "against documents";
      return {
        supported: true,
        obligations: [
          { label: "Advance Payment", percentage: a, trigger: "on-order" },
          documents
            ? { label: "Balance Against Documents", percentage: 100 - a, trigger: "documents", requiredDocuments: DEFAULT_DOCUMENTARY }
            : { label: "Balance Before Shipment", percentage: 100 - a, trigger: "before-shipment" },
        ],
      };
    }
    case "da":
      return manual("Documents Against Acceptance needs the acceptance tenor, which isn't recorded.");
    case "open-account":
      return manual("Open Account terms don't record a due date or credit period.");
    default:
      return manual("These payment terms can't be interpreted safely.");
  }
}

/** Manual schedules must total exactly 100% with 1–5 obligations. */
export function validateSchedule(list: readonly ObligationInput[]): string | undefined {
  if (list.length < 1 || list.length > 5) return "Add between 1 and 5 obligations.";
  for (const o of list) {
    if (!o.label.trim()) return "Every obligation needs a label.";
    if (!(Number.isFinite(o.percentage) && o.percentage > 0 && o.percentage <= 100)) return "Each percentage must be above 0 and at most 100.";
    if (o.trigger === "manual-date" && !o.dueDate) return `${o.label}: a manual-date obligation needs a due date.`;
  }
  const total = round2(list.reduce((a, o) => a + o.percentage, 0));
  if (total !== 100) return `The schedule must total exactly 100% (currently ${total}%).`;
}

/* ------------------------------------------------------------------------ */
/* Workspace derivation                                                      */
/* ------------------------------------------------------------------------ */

export interface PaymentObligation {
  /** Stable: orderId + sequence. */
  id: string;
  orderId: string;
  sequence: number;
  label: string;
  percentage: number;
  amount: number;
  currency: Currency;
  /** "$246,250.00 × 20% = $49,250.00" (+ residual note when adjusted). */
  formula: string;
  trigger: PaymentTrigger;
  triggerSatisfied: boolean;
  triggerDetail: string;
  dueDate?: string;
  status: ObligationStatus;
  /** Awaiting documents vs other triggers, for display. */
  statusDetail: string;
  source: "Agreed order terms" | "Manual schedule";
  requiredDocuments: { type: DocumentType; label: string; document?: TradeDocument; complete: boolean }[];
  notes?: string;
  recorded: number;
  remaining: number;
  records: PaymentRecord[];
}

export type ExceptionSeverity = "critical" | "action-required" | "watch" | "information";

export const SEVERITY_LABEL: Record<ExceptionSeverity, string> = {
  critical: "Critical",
  "action-required": "Action Required",
  watch: "Watch",
  information: "Information",
};

export interface PaymentException {
  id: string;
  type: "payment-overdue" | "payment-due-today" | "documents-missing" | "lc-details-missing" | "lc-expiring" | "lc-expired" | "partial-payment" | "reference-missing" | "manual-schedule-required";
  severity: ExceptionSeverity;
  title: string;
  detail: string;
}

export type ReadinessState = "available" | "missing" | "not-yet-applicable";

export const READINESS_LABEL: Record<ReadinessState, string> = { available: "Available", missing: "Missing", "not-yet-applicable": "Not Yet Applicable" };

export interface FinanceReadinessItem {
  id: string;
  label: string;
  state: ReadinessState;
  detail: string;
}

export interface HistoryItem {
  id: string;
  at: string;
  text: string;
  derived: boolean;
  demo?: boolean;
}

export type WorkspaceStatus = "manual-setup" | "overdue" | "due" | "ready" | "partial" | "awaiting" | "upcoming" | "recorded";

export const WORKSPACE_STATUS_LABEL: Record<WorkspaceStatus, string> = {
  "manual-setup": "Manual Setup Required",
  overdue: "Overdue",
  due: "Due",
  ready: "Ready for Payment",
  partial: "Partially Recorded",
  awaiting: "Awaiting Trigger",
  upcoming: "Upcoming",
  recorded: "Payment Recorded",
};

export interface PaymentWorkspace {
  order: Order;
  shipment?: Shipment;
  supplierName: string;
  currency: Currency;
  orderValue: number;
  terms: { label: string; summary: string; advancePercent: number; term: PaymentTerm };
  interpretation: TermInterpretation;
  usingManual: boolean;
  obligations: PaymentObligation[];
  records: PaymentRecord[];
  totals: { scheduled: number; recorded: number; remaining: number; overdue: number };
  integrityOk: boolean;
  nextObligation?: PaymentObligation;
  status: WorkspaceStatus;
  lc?: {
    required: boolean;
    basis: string;
    plan: LcPlan & { applicant: string; beneficiary: string; amount: number };
    status: LcStatus;
    missingFields: string[];
    documents: { type: DocumentType; label: string; document?: TradeDocument; complete: boolean }[];
    daysToExpiry?: number;
  };
  finance: { instrument: FinanceInstrument; basis?: string; plan: FinancePlan; status: FinanceStatus };
  financeStatusLabel: string;
  readiness: FinanceReadinessItem[];
  readyToApproach: boolean;
  exceptions: PaymentException[];
  history: HistoryItem[];
  updatedAt: string;
}

export interface WorkspaceInput {
  order: Order;
  shipment?: Shipment;
  documents: readonly TradeDocument[];
  state?: PaymentState;
  /** From the landed-cost sheet, if any. */
  landedCostStatus?: "needs-input" | "partial" | "complete";
  today?: string;
}

const AT_OR_AFTER: Record<"on-shipment" | "on-arrival" | "on-delivery", ShipmentStatus[]> = {
  "on-shipment": ["at-origin", "in-transit", "arrived", "customs", "delivered"],
  "on-arrival": ["arrived", "customs", "delivered"],
  "on-delivery": ["delivered"],
};

const LC_REQUIRED_FIELDS: [keyof LcPlan, string][] = [
  ["issuingBank", "Issuing bank"],
  ["expiryDate", "Expiry date"],
  ["latestShipmentDate", "Latest shipment date"],
  ["presentationDays", "Presentation period"],
];

export function paymentWorkspace(input: WorkspaceInput): PaymentWorkspace {
  const { order, shipment, documents, state = EMPTY_PAYMENT_STATE, landedCostStatus, today = MOCK_NOW } = input;
  const t = order.terms;
  const currency = t.currency;
  const value = round2(orderValue(t));
  const st = shipment ? shipmentState(shipment) : undefined;
  const docs = shipment ? documents.filter((d) => d.shipmentId === shipment.id) : [];
  const interpretation = interpretTerms(order);
  const usingManual = !!state.manualSchedule?.length;
  const inputs = usingManual ? state.manualSchedule! : interpretation.obligations;

  // LC plan (needed for LC-backed obligations' documents).
  const lcRequired = interpretation.instrument?.instrument === "letter-of-credit";
  const seededLcDocs: DocumentType[] = docs.length
    ? [...new Set(docs.filter((d) => d.requirement.level === "required").map((d) => d.type))]
    : DEFAULT_DOCUMENTARY;
  const lcDocTypes = state.lc?.documents ?? seededLcDocs;

  const docStatus = (types: readonly DocumentType[]) =>
    types.map((type) => {
      const matches = docs.filter((d) => d.type === type);
      return { type, label: matches[0]?.label ?? DOCUMENT_TYPE_LABEL[type], document: matches[0], complete: matches.length > 0 && matches.every((d) => d.complete) };
    });

  // Amounts: percentage of order value; any rounding residual goes on the last obligation.
  let allocated = 0;
  const obligations: PaymentObligation[] = inputs.map((o, i) => {
    const id = `${order.id}:OB-${i + 1}`;
    const ov = state.overrides[id] ?? {};
    const last = i === inputs.length - 1;
    const raw = round2((value * o.percentage) / 100);
    const amount = last && round2(inputs.reduce((a, x) => a + x.percentage, 0)) === 100 ? round2(value - allocated) : raw;
    allocated = round2(allocated + amount);
    const formula = `${formatMoney(value, currency)} × ${o.percentage}% = ${formatMoney(raw, currency)}${amount !== raw ? ` (adjusted to ${formatMoney(amount, currency)} so the schedule adds up to the order value)` : ""}`;
    const required = o.trigger === "lc-presentation" ? lcDocTypes : o.trigger === "documents" ? (ov.requiredDocuments ?? o.requiredDocuments ?? DEFAULT_DOCUMENTARY) : [];
    const reqStatus = docStatus(required);

    let triggerSatisfied: boolean;
    let triggerDetail: string;
    switch (o.trigger) {
      case "on-order":
        triggerSatisfied = true;
        triggerDetail = `Order ${order.id} placed`;
        break;
      case "before-shipment":
        triggerSatisfied = !!shipment;
        triggerDetail = shipment ? `Before shipment ${shipment.id} departs (planned ETD ${st!.schedule.etd})` : "Shipment not created yet";
        break;
      case "documents":
      case "lc-presentation": {
        const missing = reqStatus.filter((d) => !d.complete);
        triggerSatisfied = !!shipment && missing.length === 0;
        triggerDetail = !shipment ? "Shipment not created yet — documents can't be prepared" : missing.length ? `Waiting for ${missing.map((d) => d.label).join(", ")}` : "Required documents complete in the Document Center";
        break;
      }
      case "on-shipment":
      case "on-arrival":
      case "on-delivery":
        triggerSatisfied = !!st && AT_OR_AFTER[o.trigger].includes(st.status);
        triggerDetail = st ? `Shipment status: ${st.status}` : "Shipment not created yet";
        break;
      default:
        triggerSatisfied = !!(ov.dueDate ?? o.dueDate);
        triggerDetail = ov.dueDate ?? o.dueDate ? "Manual due date" : "Due date not set";
    }

    // Due date: explicit (override/manual), else derived for before-shipment.
    const dueDate = ov.dueDate ?? o.dueDate ?? (o.trigger === "before-shipment" && st ? st.schedule.etd : undefined);
    const records = state.records.filter((r) => r.obligationId === id);
    const recorded = round2(records.reduce((a, r) => a + r.amount, 0));
    const remaining = round2(Math.max(0, amount - recorded));

    let status: ObligationStatus;
    if (remaining === 0) status = "recorded";
    else if (dueDate && daysBetween(dueDate, today) > 0) status = "overdue";
    else if (dueDate && daysBetween(dueDate, today) === 0) status = "due";
    else if (!triggerSatisfied) status = o.trigger === "manual-date" ? "planned" : "awaiting-trigger";
    else if (dueDate && (o.trigger === "manual-date" || o.trigger === "on-order" || o.trigger === "before-shipment")) status = "upcoming";
    else status = "ready";

    const statusDetail =
      status === "awaiting-trigger"
        ? o.trigger === "documents" || o.trigger === "lc-presentation"
          ? "Awaiting Documents"
          : `Awaiting ${TRIGGER_LABEL[o.trigger]}`
        : status === "recorded"
          ? "Payment Recorded"
          : recorded > 0
            ? `${OBLIGATION_STATUS_LABEL[status]} · Partially Recorded`
            : OBLIGATION_STATUS_LABEL[status];

    return {
      id,
      orderId: order.id,
      sequence: i + 1,
      label: o.label,
      percentage: o.percentage,
      amount,
      currency,
      formula,
      trigger: o.trigger,
      triggerSatisfied,
      triggerDetail,
      dueDate,
      status,
      statusDetail,
      source: usingManual ? "Manual schedule" : "Agreed order terms",
      requiredDocuments: reqStatus,
      notes: ov.notes ?? o.notes,
      recorded,
      remaining,
      records,
    };
  });

  const scheduled = round2(obligations.reduce((a, o) => a + o.amount, 0));
  const recordedTotal = round2(obligations.reduce((a, o) => a + o.recorded, 0));
  const overdueAmount = round2(obligations.filter((o) => o.status === "overdue").reduce((a, o) => a + o.remaining, 0));
  const open = obligations.filter((o) => o.status !== "recorded");
  const nextObligation = open.slice().sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.sequence - b.sequence)[0];

  const status: WorkspaceStatus = !obligations.length
    ? "manual-setup"
    : open.length === 0
      ? "recorded"
      : open.some((o) => o.status === "overdue")
        ? "overdue"
        : open.some((o) => o.status === "due")
          ? "due"
          : open.some((o) => o.status === "ready")
            ? "ready"
            : recordedTotal > 0
              ? "partial"
              : open.some((o) => o.status === "awaiting-trigger")
                ? "awaiting"
                : "upcoming";

  // LC readiness.
  const supplierName = findSupplier(order.supplierId)?.name ?? order.supplierId;
  let lc: PaymentWorkspace["lc"];
  const lcEvents = state.events.filter((e) => e.type === "lc-status" && e.lcStatus);
  if (lcRequired || state.lc) {
    const plan = { ...state.lc, applicant: state.lc?.applicant ?? PLACEHOLDER_IMPORTER.company, beneficiary: state.lc?.beneficiary ?? supplierName, amount: state.lc?.amount ?? value };
    const missingFields = LC_REQUIRED_FIELDS.filter(([k]) => plan[k] === undefined || plan[k] === "").map(([, l]) => l);
    let lcStatus: LcStatus = lcEvents.at(-1)?.lcStatus ?? (state.lc ? (missingFields.length ? "details-required" : "draft-prepared") : "not-started");
    const daysToExpiry = plan.expiryDate ? daysBetween(today, plan.expiryDate) : undefined;
    if (lcStatus === "issued-recorded" && daysToExpiry !== undefined && daysToExpiry < 0) lcStatus = "expired";
    lc = { required: lcRequired, basis: lcRequired ? "Required by agreed payment terms" : "Recorded by you", plan, status: lcStatus, missingFields, documents: docStatus(lcDocTypes), daysToExpiry };
  }

  // Trade-finance plan.
  const financeEvents = state.events.filter((e) => e.type === "finance-status" && e.financeStatus);
  const instrument: FinanceInstrument = lcRequired ? "letter-of-credit" : (state.finance?.instrument ?? interpretation.instrument?.instrument ?? "none");
  const financeBasis = lcRequired || (!state.finance?.instrument && interpretation.instrument) ? interpretation.instrument?.basis : state.finance?.instrument ? "Selected by you" : undefined;

  // Finance readiness checklist (from information already in XimVerse).
  const ci = docs.find((d) => d.type === "commercial-invoice");
  const requiredDocs = docs.filter((d) => d.requirement.level === "required");
  const readiness: FinanceReadinessItem[] = [
    { id: "po", label: "Purchase Order", state: order.purchaseOrder.number ? "available" : "missing", detail: order.purchaseOrder.number || "No PO" },
    { id: "supplier", label: "Supplier", state: "available", detail: supplierName },
    { id: "value", label: "Order Value", state: value > 0 ? "available" : "missing", detail: formatMoney(value, currency) },
    { id: "terms", label: "Payment Terms", state: "available", detail: `${paymentTermLabel(t.paymentTerm)} — ${t.paymentSummary}` },
    { id: "invoice", label: "Commercial Invoice", state: !shipment ? "not-yet-applicable" : ci?.complete ? "available" : "missing", detail: !shipment ? "Shipment not created yet" : ci ? (ci.complete ? "Complete" : "Not complete") : "Not recorded" },
    { id: "shipment", label: "Shipment Details", state: shipment ? "available" : "not-yet-applicable", detail: shipment ? `${shipment.id} · ${shipment.route.portOfLoading} → ${shipment.route.portOfDischarge}` : "Shipment not created yet" },
    { id: "documents", label: "Required Trade Documents", state: !shipment ? "not-yet-applicable" : requiredDocs.every((d) => d.complete) ? "available" : "missing", detail: !shipment ? "Shipment not created yet" : `${requiredDocs.filter((d) => d.complete).length} of ${requiredDocs.length} complete` },
    { id: "landed-cost", label: "Landed Cost Estimate", state: landedCostStatus && landedCostStatus !== "needs-input" ? "available" : "missing", detail: landedCostStatus === "complete" ? "Estimate complete" : landedCostStatus === "partial" ? "Partial estimate" : "No estimate yet" },
  ];
  const readyToApproach = readiness.every((r) => r.state === "available");
  const financePlan = state.finance ?? {};
  const financeStatus: FinanceStatus =
    financeEvents.at(-1)?.financeStatus ??
    (financePlan.needed === false ? "not-needed" : !state.finance || instrument === "none" ? "planning" : readyToApproach ? "ready-to-approach" : "documents-required");
  const financeStatusLabel = lc ? LC_STATUS_LABEL[lc.status] : FINANCE_STATUS_LABEL[financeStatus];

  // Exceptions, most pressing first.
  const exceptions: PaymentException[] = [];
  if (!obligations.length) exceptions.push({ id: "manual", type: "manual-schedule-required", severity: "action-required", title: "Payment schedule requires manual setup", detail: interpretation.reason ?? "" });
  for (const o of obligations) {
    if (o.status === "overdue") exceptions.push({ id: `overdue-${o.id}`, type: "payment-overdue", severity: "critical", title: `${o.label} overdue`, detail: `${formatMoney(o.remaining, currency)} was due on ${o.dueDate}.` });
    if (o.status === "due") exceptions.push({ id: `due-${o.id}`, type: "payment-due-today", severity: "action-required", title: `${o.label} due today`, detail: `${formatMoney(o.remaining, currency)} remaining.` });
    if (o.status !== "recorded" && o.requiredDocuments.some((d) => !d.complete) && shipment)
      exceptions.push({ id: `docs-${o.id}`, type: "documents-missing", severity: o.status === "overdue" || o.status === "due" ? "action-required" : "watch", title: `Required documents missing for ${o.label}`, detail: o.requiredDocuments.filter((d) => !d.complete).map((d) => d.label).join(", ") });
    if (o.recorded > 0 && o.remaining > 0) exceptions.push({ id: `partial-${o.id}`, type: "partial-payment", severity: "watch", title: `Recorded payment less than obligation: ${o.label}`, detail: `${formatMoney(o.recorded, currency)} recorded; ${formatMoney(o.remaining, currency)} remaining.` });
    for (const r of o.records.filter((x) => !x.reference)) exceptions.push({ id: `ref-${r.id}`, type: "reference-missing", severity: "information", title: `Payment reference missing (${r.id})`, detail: "Add the bank or transaction reference for this record." });
  }
  if (lc && lc.required && (lc.status === "not-started" || lc.status === "details-required"))
    exceptions.push({ id: "lc-details", type: "lc-details-missing", severity: "action-required", title: "LC details missing", detail: lc.missingFields.length ? `Missing: ${lc.missingFields.join(", ")}.` : "LC planning not started." });
  if (lc?.status === "expired") exceptions.push({ id: "lc-expired", type: "lc-expired", severity: "critical", title: "LC expired", detail: `Expiry date ${lc.plan.expiryDate} has passed.` });
  else if (lc && lc.daysToExpiry !== undefined && lc.daysToExpiry >= 0 && lc.daysToExpiry <= 30 && obligations.some((o) => o.trigger === "lc-presentation" && o.status !== "recorded"))
    exceptions.push({ id: "lc-expiring", type: "lc-expiring", severity: "watch", title: `LC expires in ${lc.daysToExpiry} ${lc.daysToExpiry === 1 ? "day" : "days"}`, detail: `Expiry ${lc.plan.expiryDate}; payment under the LC is not yet recorded.` });
  const order_ = ["critical", "action-required", "watch", "information"];
  exceptions.sort((a, b) => order_.indexOf(a.severity) - order_.indexOf(b.severity));

  // History: derived milestones + stored events (append-only), oldest first.
  const history: HistoryItem[] = [
    { id: "created", at: order.createdAt, text: `Payment obligations derived from ${usingManual ? "the manual schedule" : "the agreed order terms"}`, derived: true },
    ...obligations.flatMap((o) => {
      const items: HistoryItem[] = [];
      if (o.triggerSatisfied && (o.trigger === "documents" || o.trigger === "lc-presentation")) {
        const at = o.requiredDocuments.map((d) => d.document?.updatedAt ?? "").reduce((a, b) => (b > a ? b : a), "");
        if (at) items.push({ id: `trigger-${o.id}`, at, text: `Trigger satisfied: ${o.label} — documents complete`, derived: true });
      }
      if (o.dueDate && daysBetween(o.dueDate, today) >= 0) items.push({ id: `due-${o.id}`, at: `${o.dueDate}T00:00:00Z`, text: `Payment became due: ${o.label}`, derived: true });
      return items;
    }),
    ...state.events.map<HistoryItem>((e) => ({ id: e.id, at: e.at, text: e.text, derived: false, demo: e.demo })),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));

  const updatedAt = [order.createdAt, ...state.events.map((e) => e.at), ...state.records.map((r) => r.recordedAt)].reduce((a, b) => (b > a ? b : a));

  return {
    order,
    shipment,
    supplierName,
    currency,
    orderValue: value,
    terms: { label: paymentTermLabel(t.paymentTerm), summary: t.paymentSummary, advancePercent: t.advancePercent, term: t.paymentTerm },
    interpretation,
    usingManual,
    obligations,
    records: state.records,
    totals: { scheduled, recorded: recordedTotal, remaining: round2(scheduled - recordedTotal), overdue: overdueAmount },
    integrityOk: !obligations.length || scheduled === value,
    nextObligation,
    status,
    lc,
    finance: { instrument, basis: financeBasis, plan: financePlan, status: financeStatus },
    financeStatusLabel,
    readiness,
    readyToApproach,
    exceptions,
    history,
    updatedAt,
  };
}

/* ------------------------------------------------------------------------ */
/* Validation of actions                                                     */
/* ------------------------------------------------------------------------ */

export interface PaymentInput {
  obligationId: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  provider?: string;
  payerAccountLabel?: string;
  payeeAccountLabel?: string;
  notes?: string;
  evidence?: PaymentEvidence;
}

/** Records only up to the remaining amount, in the order currency. */
export function validatePayment(w: PaymentWorkspace, p: PaymentInput): string | undefined {
  const o = w.obligations.find((x) => x.id === p.obligationId);
  if (!o) return "Choose an obligation.";
  if (o.remaining === 0) return "This obligation is already fully recorded.";
  if (!(Number.isFinite(p.amount) && p.amount > 0)) return "Enter an amount greater than zero.";
  if (round2(p.amount) > o.remaining) return `The amount exceeds the remaining ${formatMoney(o.remaining, w.currency)} for this obligation.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.paymentDate)) return "Enter the payment date.";
  for (const v of [p.reference, p.provider, p.payerAccountLabel, p.payeeAccountLabel, p.evidence?.bankAdviceNumber, p.evidence?.utr, p.evidence?.declaredFilename]) if ((v ?? "").length > 120) return "Keep each field under 120 characters.";
  if (p.evidence?.declaredFilename && /[\\/:*?"<>|]/.test(p.evidence.declaredFilename)) return "Use a plain filename without path characters.";
}

/** A manual schedule can't drop below what is already recorded on any obligation. */
export function validateScheduleChange(w: PaymentWorkspace, next: readonly ObligationInput[]): string | undefined {
  const err = validateSchedule(next);
  if (err) return err;
  for (const o of w.obligations.filter((x) => x.recorded > 0)) {
    const replacement = next[o.sequence - 1];
    if (!replacement) return `${o.label} has recorded payments and can't be removed.`;
    const amount = round2((w.orderValue * replacement.percentage) / 100);
    if (amount < o.recorded) return `${o.label} can't be reduced below the ${formatMoney(o.recorded, w.currency)} already recorded.`;
  }
}

export function nextPaymentId(existing: readonly PaymentRecord[], year: number): string {
  const max = existing.reduce((m, r) => Math.max(m, Number(r.id.split("-")[2]) || 0), 0);
  return `PAY-${year}-${String(max + 1).padStart(4, "0")}`;
}

export const paymentsHref = (orderId: string) => importerHref(`payments/${orderId}`);

/* ------------------------------------------------------------------------ */
/* Demo data — historical records tied to existing orders                    */
/* ------------------------------------------------------------------------ */

export const MOCK_PAYMENT_STATES: Readonly<Record<string, PaymentState>> = {
  // D/P at sight, delivered: payment against documents recorded historically.
  "ORD-2026-0001": {
    overrides: {},
    records: [
      {
        id: "PAY-2026-0001",
        obligationId: "ORD-2026-0001:OB-1",
        orderId: "ORD-2026-0001",
        recordedAt: "2026-07-08T09:00:00Z",
        paymentDate: "2026-07-08",
        amount: 110_500,
        currency: "USD",
        method: "documentary-collection",
        reference: "DC-BSA-0412 (demo)",
        provider: "Demo collecting bank",
        evidence: { bankAdviceNumber: "ADV-0412 (demo)" },
        demo: true,
      },
    ],
    events: [{ id: "pe-1", type: "payment-recorded", at: "2026-07-08T09:00:00Z", text: "Payment recorded: PAY-2026-0001 · $110,500.00 against documents", demo: true }],
  },
  // 20% advance / 80% against documents: advance recorded; balance awaits documents.
  "ORD-2026-0002": {
    overrides: {},
    records: [
      {
        id: "PAY-2026-0002",
        obligationId: "ORD-2026-0002:OB-1",
        orderId: "ORD-2026-0002",
        recordedAt: "2026-07-28T06:00:00Z",
        paymentDate: "2026-07-28",
        amount: 49_250,
        currency: "USD",
        method: "bank-transfer",
        reference: "UTR-DEMO-778812",
        provider: "Demo importer bank",
        evidence: { utr: "UTR-DEMO-778812" },
        demo: true,
      },
    ],
    events: [{ id: "pe-1", type: "payment-recorded", at: "2026-07-28T06:00:00Z", text: "Payment recorded: PAY-2026-0002 · $49,250.00 advance", demo: true }],
  },
  // LC at sight: LC issuance recorded externally; expiry within 30 days of the demo date.
  "ORD-2026-0003": {
    overrides: {},
    records: [],
    lc: {
      issuingBank: "Demo Importer Bank",
      advisingBank: "Demo Advising Bank, Coimbatore",
      expiryDate: "2026-10-31",
      latestShipmentDate: "2026-10-20",
      presentationDays: 21,
      reference: "LC-DEMO-0003",
    },
    events: [
      { id: "pe-1", type: "lc-details-saved", at: "2026-08-14T06:00:00Z", text: "LC details saved", demo: true },
      { id: "pe-2", type: "lc-status", at: "2026-08-15T06:00:00Z", text: "LC application recorded (external)", lcStatus: "application-recorded", demo: true },
      { id: "pe-3", type: "lc-status", at: "2026-08-20T06:00:00Z", text: "LC issuance recorded (external): LC-DEMO-0003", lcStatus: "issued-recorded", demo: true },
    ],
  },
};
