"use client";

import { useMemo, useSyncExternalStore } from "react";
import { MOCK_NOW } from "@/lib/import-requirements";
import { orderStatus } from "@/lib/importer-orders";
import {
  EMPTY_PAYMENT_STATE,
  FINANCE_STATUS_LABEL,
  formatMoney,
  LC_STATUS_LABEL,
  MOCK_PAYMENT_STATES,
  nextPaymentId,
  paymentWorkspace,
  validatePayment,
  validateScheduleChange,
  type FinancePlan,
  type FinanceStatus,
  type LcPlan,
  type LcStatus,
  type ObligationInput,
  type ObligationOverride,
  type PaymentEvent,
  type PaymentInput,
  type PaymentRecord,
  type PaymentState,
  type PaymentWorkspace,
} from "@/lib/importer-payments";
import { shipmentForOrder } from "@/lib/importer-shipments";
import { useDocuments } from "../documents/document-store";
import { useLandedCostSheets } from "../landed-cost/landed-cost-store";
import { useOrders } from "../orders/order-store";
import { useShipments } from "../shipments/shipment-store";

/*
 * Payment workflow state per order (manual schedules, due-date overrides,
 * external payment records with evidence metadata, LC and finance planning,
 * and external-event history), persisted in sessionStorage. Commercial terms
 * stay on the order; documents and shipments are read live. Nothing here
 * moves money or contacts a bank.
 */

const KEY = "ximverse.importer.payments";
type Stored = Readonly<Record<string, PaymentState>>;
const EMPTY: Stored = {};

function load(): Stored {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : EMPTY;
  } catch {
    return EMPTY;
  }
}

let state: Stored | null = null;
const listeners = new Set<() => void>();

function snapshot(): Stored {
  state ??= load();
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: Stored) {
  state = next;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: keep the in-memory state for this page.
  }
  listeners.forEach((l) => l());
}

export function usePaymentsLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

function stateFor(s: Stored, orderId: string): PaymentState {
  return s[orderId] ?? MOCK_PAYMENT_STATES[orderId] ?? EMPTY_PAYMENT_STATE;
}

/** One workspace per non-cancelled order, from the live order, shipment, document and landed-cost stores. */
export function usePaymentWorkspaces(): PaymentWorkspace[] {
  const orders = useOrders();
  const shipments = useShipments();
  const documents = useDocuments();
  const sheets = useLandedCostSheets();
  const s = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return useMemo(
    () =>
      orders
        .filter((o) => orderStatus(o) !== "cancelled")
        .map((order) =>
          paymentWorkspace({
            order,
            shipment: shipmentForOrder(order.id, shipments),
            documents,
            state: stateFor(s, order.id),
            landedCostStatus: sheets.find((x) => x.order.id === order.id)?.result.status,
          }),
        ),
    [orders, shipments, documents, sheets, s],
  );
}

function now(): string {
  const t = new Date().toISOString();
  return t > MOCK_NOW ? t : MOCK_NOW;
}

const eventId = () => `pe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function update(orderId: string, fn: (p: PaymentState) => PaymentState, event?: Omit<PaymentEvent, "id" | "at">) {
  const s = snapshot();
  const current = structuredClone(stateFor(s, orderId));
  const next = fn(current);
  const events = event ? [...next.events, { ...event, id: eventId(), at: now() }] : next.events;
  commit({ ...s, [orderId]: { ...next, events } });
}

const trim = (v?: string) => v?.trim() || undefined;

/** Records an external payment against one obligation. Nothing is transferred. Returns the new ID, or an error. */
export function recordPayment(w: PaymentWorkspace, p: PaymentInput): { id?: string; error?: string } {
  const error = validatePayment(w, p);
  if (error) return { error };
  const all = Object.values({ ...MOCK_PAYMENT_STATES, ...snapshot() }).flatMap((x) => x.records);
  const id = nextPaymentId(all, new Date().getFullYear());
  const o = w.obligations.find((x) => x.id === p.obligationId)!;
  const record: PaymentRecord = {
    id,
    obligationId: p.obligationId,
    orderId: w.order.id,
    recordedAt: now(),
    paymentDate: p.paymentDate,
    amount: Math.round(p.amount * 100) / 100,
    currency: w.currency,
    method: p.method,
    reference: trim(p.reference),
    provider: trim(p.provider),
    payerAccountLabel: trim(p.payerAccountLabel),
    payeeAccountLabel: trim(p.payeeAccountLabel),
    notes: trim(p.notes),
    evidence: { bankAdviceNumber: trim(p.evidence?.bankAdviceNumber), utr: trim(p.evidence?.utr), declaredFilename: trim(p.evidence?.declaredFilename), notes: trim(p.evidence?.notes) },
  };
  const partial = record.amount < o.remaining;
  update(w.order.id, (st) => ({ ...st, records: [...st.records, record] }), {
    type: "payment-recorded",
    text: `${partial ? "Partial payment recorded" : "Payment recorded"}: ${id} · ${formatMoney(record.amount, w.currency)} for ${o.label}`,
  });
  return { id };
}

export function updateReference(w: PaymentWorkspace, recordId: string, reference: string): string | undefined {
  const ref = reference.trim();
  if (!ref) return "Enter a reference.";
  if (ref.length > 120) return "Keep the reference under 120 characters.";
  update(w.order.id, (st) => ({ ...st, records: st.records.map((r) => (r.id === recordId ? { ...r, reference: ref } : r)) }), { type: "reference-updated", text: `Reference updated on ${recordId}: ${ref}` });
}

export function setObligationOverride(w: PaymentWorkspace, obligationId: string, ov: ObligationOverride): string | undefined {
  if (ov.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(ov.dueDate)) return "Enter a valid date.";
  const o = w.obligations.find((x) => x.id === obligationId);
  if (!o) return "Obligation not found.";
  update(w.order.id, (st) => ({ ...st, overrides: { ...st.overrides, [obligationId]: { ...st.overrides[obligationId], ...ov } } }), {
    type: "due-date-set",
    text: ov.dueDate ? `Due date set for ${o.label}: ${ov.dueDate}` : `Settings updated for ${o.label}`,
  });
}

export function setManualSchedule(w: PaymentWorkspace, list: ObligationInput[]): string | undefined {
  const err = validateScheduleChange(w, list);
  if (err) return err;
  update(w.order.id, (st) => ({ ...st, manualSchedule: list.map((o) => ({ ...o, label: o.label.trim(), notes: trim(o.notes) })) }), {
    type: "schedule-set",
    text: `Manual payment schedule set (${list.length} ${list.length === 1 ? "obligation" : "obligations"}, 100%)`,
  });
}

export function saveLcDetails(w: PaymentWorkspace, plan: LcPlan): string | undefined {
  if (plan.amount !== undefined && !(plan.amount > 0)) return "Enter an LC amount greater than zero.";
  if (plan.presentationDays !== undefined && !(Number.isInteger(plan.presentationDays) && plan.presentationDays > 0 && plan.presentationDays <= 365)) return "Enter the presentation period in days.";
  if (plan.latestShipmentDate && plan.expiryDate && plan.latestShipmentDate > plan.expiryDate) return "The latest shipment date must be on or before the expiry date.";
  if (plan.documents && plan.documents.length === 0) return "Keep at least one document on the LC checklist.";
  update(w.order.id, (st) => ({ ...st, lc: { ...st.lc, ...plan } }), { type: "lc-details-saved", text: "LC details saved" });
}

const LC_ALLOWED: Record<LcStatus, LcStatus[]> = {
  "not-started": [],
  "details-required": [],
  "draft-prepared": ["application-recorded"],
  "application-recorded": ["issued-recorded", "amendment-required"],
  "issued-recorded": ["amendment-required", "closed"],
  "amendment-required": ["issued-recorded", "closed"],
  expired: ["closed"],
  closed: [],
};

/** Records an external LC event. XimVerse never applies for or issues an LC. */
export function recordLcEvent(w: PaymentWorkspace, to: LcStatus, reference?: string): string | undefined {
  if (!w.lc) return "No LC plan for this order.";
  if (!LC_ALLOWED[w.lc.status].includes(to)) return w.lc.status === "details-required" || w.lc.status === "not-started" ? `Complete the LC details first (${w.lc.missingFields.join(", ") || "save the plan"}).` : "That LC step isn't available now.";
  if (to === "issued-recorded" && !(reference ?? w.lc.plan.reference)?.trim()) return "Enter the LC reference number from the bank.";
  update(
    w.order.id,
    (st) => ({ ...st, lc: { ...st.lc, reference: reference?.trim() || st.lc?.reference } }),
    { type: "lc-status", lcStatus: to, text: `${to === "application-recorded" ? "LC application recorded (external)" : to === "issued-recorded" ? `LC issuance recorded (external): ${reference?.trim() || w.lc.plan.reference}` : `LC status recorded: ${LC_STATUS_LABEL[to]}`}` },
  );
}

export function saveFinancePlan(w: PaymentWorkspace, plan: FinancePlan): string | undefined {
  if (plan.requestedAmount !== undefined && !(plan.requestedAmount > 0)) return "Enter a requested amount greater than zero.";
  if ((plan.purpose ?? "").length > 200) return "Keep the purpose under 200 characters.";
  update(w.order.id, (st) => ({ ...st, finance: { ...plan, purpose: trim(plan.purpose), provider: trim(plan.provider) } }), { type: "finance-saved", text: "Trade-finance plan saved" });
}

const EXTERNAL_FINANCE: FinanceStatus[] = ["application-recorded", "approved-recorded", "rejected-recorded", "closed"];

/** Records an external finance outcome, entered manually. */
export function recordFinanceEvent(w: PaymentWorkspace, to: FinanceStatus): string | undefined {
  if (!EXTERNAL_FINANCE.includes(to)) return "That status can't be recorded.";
  if (w.finance.instrument === "none" || w.finance.plan.needed === false) return "Set a finance instrument first.";
  if (to !== "application-recorded" && w.finance.status !== "application-recorded") return "Record the application first.";
  update(w.order.id, (st) => st, { type: "finance-status", financeStatus: to, text: `Finance status recorded manually: ${FINANCE_STATUS_LABEL[to]}` });
}
