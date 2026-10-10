/**
 * Compliance readiness: whether XimVerse currently has enough information and
 * documents for a shipment's next workflow step.
 *
 * Built only from recorded structured data (shipment, canonical documents,
 * order, requirement). It is NOT a legal or regulatory determination and never
 * calls anything "compliant" or "approved by" an authority. Pre-shipment and
 * customs readiness reuse the exact shipment functions.
 */

import { PLACEHOLDER_IMPORTER } from "./importer-nav";
import {
  DOCUMENT_STATUS_LABEL,
  daysUntilExpiry,
  isMissing,
  TRANSPORT_DOCUMENT_LABEL,
  type TradeDocument,
} from "./importer-documents";
import type { Order } from "./importer-orders";
import {
  blockingItems,
  customsStatus,
  preShipmentChecklist,
  type CustomsOverride,
  type CustomsStatus,
  type ReadinessItem,
  type Shipment,
  type ShipmentState,
} from "./importer-shipments";

export type Readiness = "ready" | "needs-review" | "blocked";

export const READINESS_LABEL: Record<Readiness, string> = {
  ready: "Ready for Current Stage",
  "needs-review": "Needs Review",
  blocked: "Blocked",
};

export const COMPLIANCE_DISCLAIMER =
  "Readiness is based on information currently recorded in XimVerse. It is not a legal or regulatory determination.";

export type IssueSeverity = "blocking" | "review" | "information";

export const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  blocking: "Blocking",
  review: "Review",
  information: "Information",
};

export interface ComplianceIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  documentId?: string;
}

export interface ConsistencyCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface CustomsPrepItem {
  id: string;
  label: string;
  value: string;
  ok: boolean;
}

export interface ComplianceAssessment {
  readiness: Readiness;
  /** One-line result, e.g. "Blocked — 2 required documents missing". */
  summary: string;
  /** What the current stage is preparing for. */
  stageGoal: string;
  issues: ComplianceIssue[];
  missingRequired: TradeDocument[];
  documents: TradeDocument[];
  consistency: ConsistencyCheck[];
  checklist: ReadinessItem[];
  customs: { status: CustomsStatus; items: CustomsPrepItem[] };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function assessShipment(input: {
  shipment: Shipment;
  state: ShipmentState;
  documents: readonly TradeDocument[];
  order?: Order;
  supplierConfirmed: boolean;
  /** From the shipment's customs case, when one exists. */
  customs?: CustomsOverride;
}): ComplianceAssessment {
  const { shipment: s, state: st, order, supplierConfirmed, customs } = input;
  const docs = input.documents.filter((d) => d.shipmentId === s.id);
  const checklist = preShipmentChecklist(s, st, supplierConfirmed, docs, customs);
  const broker = customs ? customs.broker : s.parties.customsBroker;
  const status = st.status;
  const customsStage = ["in-transit", "arrived", "customs"].includes(status);
  const delivered = status === "delivered";
  const preparing = status === "preparing";

  const stageGoal = preparing
    ? "Next step: Ready to Ship"
    : status === "ready-to-ship" || status === "at-origin"
      ? "Next step: departure"
      : customsStage
        ? "Next step: customs preparation"
        : "Shipment delivered";

  /** Is this document a gate for the current stage? */
  const gates = (d: TradeDocument) => {
    if (d.requirement.level !== "required" || delivered) return false;
    if (preparing) return d.requiredForReady;
    if (customsStage) return true;
    return d.type !== "transport-document"; // ready-to-ship / at-origin
  };

  const issues: ComplianceIssue[] = [];
  const add = (i: ComplianceIssue) => issues.push(i);

  for (const d of docs) {
    if (d.requirement.level === "not-required") continue;
    const gate = gates(d);
    if (isMissing(d)) {
      if (d.type === "transport-document" && !customsStage && !delivered) {
        add({ id: `pending-${d.id}`, severity: "information", title: `${d.label} not yet available`, detail: `${d.label} will become available after cargo handover to the carrier.`, documentId: d.id });
      } else if (d.requirement.level === "required") {
        add({
          id: `missing-${d.id}`,
          severity: gate ? "blocking" : delivered ? "information" : preparing ? "information" : "review",
          title: `${d.label} missing`,
          detail: `${d.requirement.reason}. Current status: ${DOCUMENT_STATUS_LABEL[d.status]}.`,
          documentId: d.id,
        });
      }
    }
    if (d.validity === "expired" && (d.status === "available" || d.status === "approved") && d.requirement.level === "required") {
      add({ id: `expired-${d.id}`, severity: gate ? "blocking" : delivered ? "information" : "review", title: `Expired required document: ${d.label}`, detail: `Expired on ${d.metadata.expiryDate}. An expired document does not count as complete.`, documentId: d.id });
    }
    if (d.status === "needs-review") {
      add({ id: `review-${d.id}`, severity: delivered ? "information" : "review", title: `${d.label} needs review`, detail: d.events.at(-1)?.note ?? "Marked as needing review.", documentId: d.id });
    }
    if (d.validity === "expiring-soon" && d.complete && d.requirement.level === "required" && !delivered) {
      const days = daysUntilExpiry(d.metadata.expiryDate!);
      add({ id: `expiring-${d.id}`, severity: "review", title: `${d.label} expires in ${plural(days, "day")}`, detail: `Valid until ${d.metadata.expiryDate}.`, documentId: d.id });
    }
    if (d.complete && (!d.metadata.number || !d.metadata.issueDate)) {
      add({ id: `metadata-${d.id}`, severity: "information", title: `${d.label}: metadata incomplete`, detail: `Missing ${[!d.metadata.number && "document number", !d.metadata.issueDate && "issue date"].filter(Boolean).join(" and ")}.`, documentId: d.id });
    }
  }

  // Non-document pre-shipment blockers, from the same checklist the shipment uses.
  if (preparing) {
    for (const item of blockingItems(checklist)) {
      if (item.id === "freight") add({ id: "freight", severity: "blocking", title: "Freight booking not arranged", detail: "Freight must be booked before the shipment can be marked Ready to Ship." });
      if (item.id === "confirmation") add({ id: "confirmation", severity: "blocking", title: "Supplier confirmation not recorded", detail: "The supplier must confirm the order first." });
    }
  }
  if (!broker && !delivered) {
    add({
      id: "broker",
      severity: customsStage ? "review" : "information",
      title: "Customs broker not assigned",
      detail: customsStage ? "Assign a customs broker before customs preparation." : "A customs broker will be needed before arrival.",
    });
  }

  const consistency = consistencyChecks(s, st, docs, order, supplierConfirmed);
  for (const c of consistency.filter((x) => !x.ok)) {
    add({ id: `consistency-${c.id}`, severity: "review", title: `Shipment information: ${c.label.toLowerCase()}`, detail: c.detail });
  }

  const missingRequired = docs.filter((d) => gates(d) && isMissing(d));
  const blocking = issues.filter((i) => i.severity === "blocking");
  const review = issues.filter((i) => i.severity === "review");
  const readiness: Readiness = blocking.length ? "blocked" : review.length ? "needs-review" : "ready";
  const summary =
    readiness === "blocked"
      ? missingRequired.length
        ? `Blocked — ${plural(missingRequired.length, "required document")} missing`
        : `Blocked — ${plural(blocking.length, "blocking issue")}`
      : readiness === "needs-review"
        ? `Needs review — ${plural(review.length, "item")} ${review.length === 1 ? "needs" : "need"} attention`
        : "Ready for current stage";

  const severityOrder: Record<IssueSeverity, number> = { blocking: 0, review: 1, information: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return { readiness, summary, stageGoal, issues, missingRequired, documents: docs, consistency, checklist, customs: customsPrep(s, st, docs, customs) };
}

function consistencyChecks(s: Shipment, st: ShipmentState, docs: readonly TradeDocument[], order: Order | undefined, supplierConfirmed: boolean): ConsistencyCheck[] {
  const td = docs.find((d) => d.type === "transport-document");
  const expectedTd = TRANSPORT_DOCUMENT_LABEL[s.route.mode];
  const routeOk = [s.route.origin, s.route.portOfLoading, s.route.portOfDischarge, s.route.finalDelivery].every((x) => x.trim() !== "");
  const datesOk = st.schedule.readyDate <= st.schedule.etd && st.schedule.etd <= st.schedule.eta;
  const qtyOk = !!order && order.terms.quantity.amount === s.cargo.quantity.amount && order.terms.quantity.unit === s.cargo.quantity.unit;
  return [
    { id: "order", label: "Shipment references a valid order", ok: !!order, detail: order ? order.id : `Order ${s.orderId} not found` },
    { id: "supplier", label: "Supplier matches the order supplier", ok: !!order && order.supplierId === s.supplierId, detail: order ? `${s.supplierId} / ${order.supplierId}` : "No order to compare" },
    { id: "requirement", label: "Requirement matches the order requirement", ok: !!order && order.requirementId === s.requirementId, detail: order ? `${s.requirementId} / ${order.requirementId}` : "No order to compare" },
    { id: "quantity", label: "Shipment quantity matches the order quantity", ok: qtyOk, detail: order ? `${s.cargo.quantity.amount} ${s.cargo.quantity.unit} shipped / ${order.terms.quantity.amount} ${order.terms.quantity.unit} ordered` : "No order to compare" },
    { id: "transport-doc", label: "Transport document matches the shipment mode", ok: td?.label === expectedTd, detail: `${td?.label ?? "None"} for ${s.route.mode} (expected ${expectedTd})` },
    { id: "po", label: "Purchase order exists", ok: !!order?.purchaseOrder.number, detail: order?.purchaseOrder.number ?? "No purchase order" },
    { id: "confirmation", label: "Supplier confirmation recorded", ok: supplierConfirmed, detail: supplierConfirmed ? "Recorded on the order" : "Not recorded" },
    { id: "route", label: "Route has all required fields", ok: routeOk, detail: routeOk ? `${s.route.origin} → ${s.route.finalDelivery}` : "Origin, ports or final delivery missing" },
    { id: "dates", label: "Planned dates are in order (ready ≤ ETD ≤ ETA)", ok: datesOk, detail: `${st.schedule.readyDate} ≤ ${st.schedule.etd} ≤ ${st.schedule.eta}` },
  ];
}

/** Customs preparation items; the customs workspace shows the same items. */
export function customsPrep(s: Shipment, st: ShipmentState, docs: readonly TradeDocument[], customs?: CustomsOverride): ComplianceAssessment["customs"] {
  const broker = customs ? customs.broker : s.parties.customsBroker;
  const hsCode = customs?.hsCode ?? s.hsCode;
  const doc = (type: TradeDocument["type"]) => docs.find((d) => d.type === type);
  const docItem = (id: string, d: TradeDocument | undefined, label?: string): CustomsPrepItem => ({
    id,
    label: label ?? d?.label ?? id,
    value: !d ? "—" : d.status === "not-required" ? "Not Required" : d.validity === "expired" && !d.complete && (d.status === "available" || d.status === "approved") ? "Expired" : DOCUMENT_STATUS_LABEL[d.status],
    ok: !d || d.status === "not-required" || d.complete,
  });
  const certs = docs.filter((d) => d.type === "product-certificate");
  const certsOk = certs.every((d) => d.complete);
  return {
    status: customsStatus(s, st, docs, customs),
    items: [
      { id: "importer", label: "Importer information", value: `Available (${PLACEHOLDER_IMPORTER.company})`, ok: true },
      { id: "hs", label: "HS code", value: hsCode ?? "Not provided", ok: !!hsCode },
      docItem("ci", doc("commercial-invoice")),
      docItem("pl", doc("packing-list")),
      docItem("coo", doc("certificate-of-origin")),
      {
        id: "certs",
        label: "Product certificates",
        value: certs.length === 0 ? "None requested" : `${certs.filter((d) => d.complete).length} of ${certs.length} complete`,
        ok: certsOk,
      },
      docItem("td", doc("transport-document"), "Transport document"),
      { id: "broker", label: "Customs broker", value: broker ?? "Not assigned", ok: !!broker },
    ],
  };
}
