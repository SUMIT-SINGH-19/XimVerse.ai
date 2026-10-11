/*
 * Documents & Compliance Center: one derived index over the documents'
 * canonical owners. There is no document store.
 *
 *   Company Profile  → credentials      (exporter-company.ts)
 *   Order            → order documents  (exporter-orders.ts, orderState)
 *   Shipment         → shipment records (exporter-shipments.ts, shipmentState)
 *
 * Every item here is a projection: its status is read from the owner on each
 * call, and every action routes back to the owner. Blockers reuse the
 * shipment's own prerequisite functions, so the index can't disagree with the
 * page that enforces them.
 *
 * IDs are deterministic and map back to the owner:
 *   DOC-COMP-<KEY>               e.g. DOC-COMP-APEDA
 *   DOC-<ORDER ID>-<CODE>        e.g. DOC-ORD-2026-8101-INVOICE
 *   DOC-<SHIPMENT ID>-<CODE>     e.g. DOC-SHP-2026-8104-SB
 */

import { CERTIFICATIONS, REGISTRATIONS, VERIFICATION_STATUS_LABEL, type VerificationStatus } from "./exporter-company";
import { COMMITMENT_LABEL, SEEDED_DEALS, type CounterpartyAccess, type ExporterDeal } from "./exporter-deals";
import { findOpportunity, shortCountry } from "./exporter-opportunities";
import { complianceStatusText, DOCUMENT_STATUS_LABEL, isActiveOrder, SEEDED_ORDERS, type ExporterOrder, type OrderDocument, type OrderDocumentStatus, type OrderDocumentType, type OrderState } from "./exporter-orders";
import { DEMO_TODAY, daysBetween } from "./exporter-quotations";
import {
  containerComplete,
  counterpartyLine,
  customsReadiness,
  formatShortDate,
  INSTRUCTIONS_STATUS_LABEL,
  instructionsPrerequisites,
  isActiveShipment,
  isPreDeparture,
  orderStateWithShipments,
  score,
  SEEDED_SHIPMENTS,
  SHIPPING_BILL_STEPS,
  shippingBillIndex,
  shippingBillPrerequisites,
  shipmentState,
  TRANSPORT_DOCUMENT_STEPS,
  transportDocumentIndex,
  transportDocumentName,
  transportDocumentPrerequisites,
  usesContainers,
  type ExporterShipment,
  type ShipmentState,
} from "./exporter-shipments";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export type DocumentOwnerType = "company" | "order" | "shipment";
export type DocumentCategory = "registration" | "certification" | "order" | "shipment";
export type DocumentStage = "Company" | "Pre-Shipment" | "Customs" | "Transport";

/** Display vocabulary only — every source keeps its own canonical status. */
export type DocumentStatus =
  | "not-started"
  | "requested"
  | "preparing"
  | "ready"
  | "needs-review"
  | "approved"
  | "filed"
  | "acknowledged"
  | "issued"
  | "blocked"
  | "expired"
  | "not-required";

export const DOCUMENT_STATUS_DISPLAY: Record<DocumentStatus, string> = {
  "not-started": "Not Started",
  requested: "Requested",
  preparing: "Preparing",
  ready: "Ready",
  "needs-review": "Needs Review",
  approved: "Approved",
  filed: "Filed",
  acknowledged: "Acknowledged",
  issued: "Issued",
  blocked: "Blocked",
  expired: "Expired",
  "not-required": "Not Required",
};

export const OWNER_TYPE_LABEL: Record<DocumentOwnerType, string> = { company: "Company", order: "Order", shipment: "Shipment" };

const FROM_VERIFICATION: Record<VerificationStatus, DocumentStatus> = { verified: "approved", pending: "needs-review", "not-added": "not-started", expired: "expired" };
const FROM_ORDER: Record<OrderDocumentStatus, DocumentStatus> = { "not-started": "not-started", preparing: "preparing", ready: "ready", verified: "approved", blocked: "blocked", "not-required": "not-required" };
const FROM_SHIPPING_BILL: Record<string, DocumentStatus> = {
  "not-started": "not-started",
  "data-preparing": "preparing",
  "cha-review": "needs-review",
  "ready-for-filing": "ready",
  filed: "filed",
  acknowledged: "acknowledged",
  "leo-received": "approved",
};
const FROM_TRANSPORT: Record<string, DocumentStatus> = { "not-available": "not-started", "draft-received": "needs-review", "under-review": "needs-review", approved: "approved", "final-issued": "issued" };

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export interface ExpiryState {
  /** Days from the demo date; negative once past. */
  days: number;
  band: "expired" | "7" | "30" | "90" | "valid";
  label: string;
}

export interface Blocker {
  key: string;
  label: string;
  done: boolean;
  detail?: string;
}

export interface TimelineStep {
  label: string;
  state: "done" | "current" | "todo";
  /** Only when the source recorded when it happened. */
  at?: string;
}

export interface DocumentItem {
  id: string;
  ownerType: DocumentOwnerType;
  /** "Company", ORD-… or SHP-… */
  ownerId: string;
  code: string;
  title: string;
  category: DocumentCategory;
  stage: DocumentStage;
  status: DocumentStatus;
  /** The owner's own status wording. */
  sourceStatus: string;
  /** Counts toward readiness (Not Required items never do). */
  required: boolean;
  complete: boolean;
  /** Due now — its owner is at the point where this document matters. */
  due: boolean;
  attention: boolean;
  /** Incomplete and holding up the owner's next step. */
  blocking: boolean;
  /** Feeds Shipping Bill filing or the shipment's customs readiness. */
  customsCritical: boolean;
  /** The step the blockers stand in front of, e.g. "Ready for Filing". */
  blockedStep?: string;
  blockers: Blocker[];
  orderId?: string;
  shipmentId?: string;
  dealId?: string;
  product?: string;
  destination?: string;
  expiresOn?: string;
  expiry?: ExpiryState;
  issuer?: string;
  reference?: string;
  /** Shipments that read this order document. */
  usedBy: string[];
  requirement: string;
  responsibility: { party: string; role: string }[];
  timeline: TimelineStep[];
  next: { text: string; href: string };
  source: { label: string; href: string };
  demo: boolean;
  /** Extra read-only facts shown on the detail page. */
  facts: [string, string][];
  /** Latest source activity, for sorting. */
  activityAt?: string;
}

const href = (slug: string) => `/exporter/${slug}`;

export function expiryOf(expiresOn: string, today = DEMO_TODAY): ExpiryState {
  const days = daysBetween(today, expiresOn);
  const band: ExpiryState["band"] = days < 0 ? "expired" : days <= 7 ? "7" : days <= 30 ? "30" : days <= 90 ? "90" : "valid";
  const date = formatLongDate(expiresOn);
  const label = band === "expired" ? `Expired ${date}` : band === "valid" ? `Valid until ${date}` : `Expires in ${days} day${days === 1 ? "" : "s"}`;
  return { days, band, label };
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formatLongDate = (iso: string) => dateFormat.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

export const isExpiringSoon = (d: DocumentItem) => Boolean(d.expiry && d.expiry.band !== "valid");

// ---------------------------------------------------------------------------
// Company credentials
// ---------------------------------------------------------------------------

function companyItems(): DocumentItem[] {
  const base = { ownerType: "company" as const, ownerId: "Company", stage: "Company" as const, blocking: false, customsCritical: false, usedBy: [], demo: false, blockers: [], due: true };
  const registrations = REGISTRATIONS.map((r): DocumentItem => {
    const status = FROM_VERIFICATION[r.status];
    return {
      ...base,
      id: `DOC-COMP-${r.key.toUpperCase()}`,
      code: r.key.toUpperCase(),
      title: r.label,
      category: "registration",
      status,
      sourceStatus: VERIFICATION_STATUS_LABEL[r.status],
      required: r.status !== "not-added",
      complete: r.status === "verified",
      attention: r.status === "pending" || r.status === "expired",
      reference: r.value,
      requirement: "Company registration held on your Company Profile and used across quotations, orders and shipments.",
      responsibility: [{ party: "Exporter", role: "Maintains the registration on the Company Profile" }],
      timeline: [],
      next:
        r.status === "verified"
          ? { text: "No action — verified", href: href("company#registration") }
          : { text: r.status === "pending" ? "Complete verification on the Company Profile" : "Add it on the Company Profile", href: href("company#registration") },
      source: { label: "Company Profile", href: href("company#registration") },
      facts: [],
    };
  });
  // No canonical LUT record exists: shown as "Not added", with nothing invented.
  if (!REGISTRATIONS.some((r) => r.key === "lut")) {
    registrations.push({
      ...base,
      id: "DOC-COMP-LUT",
      code: "LUT",
      title: "LUT (Letter of Undertaking)",
      category: "registration",
      status: "not-started",
      sourceStatus: "Not added",
      required: false,
      complete: false,
      attention: false,
      requirement: "There is no LUT record on the Company Profile yet. Nothing is assumed about its number, validity or need.",
      responsibility: [{ party: "Exporter", role: "Would add it on the Company Profile" }],
      timeline: [],
      next: { text: "Add on the Company Profile when available", href: href("company#registration") },
      source: { label: "Company Profile (no record)", href: href("company#registration") },
      facts: [],
    });
  }
  const certifications = CERTIFICATIONS.map((c): DocumentItem => {
    const perShipment = c.status === "per-shipment";
    const status: DocumentStatus = c.status === "per-shipment" ? "not-required" : FROM_VERIFICATION[c.status];
    const expiry = c.expiresOn ? expiryOf(c.expiresOn) : undefined;
    const shownStatus: DocumentStatus = expiry?.band === "expired" ? "expired" : status;
    return {
      ...base,
      id: `DOC-COMP-${c.key.toUpperCase()}`,
      code: c.key.toUpperCase(),
      title: c.name,
      category: "certification",
      status: shownStatus,
      sourceStatus: c.status === "per-shipment" ? "Per shipment" : VERIFICATION_STATUS_LABEL[c.status],
      required: !perShipment,
      complete: c.status === "verified" && expiry?.band !== "expired",
      attention: c.status === "pending" || c.status === "expired" || Boolean(expiry && expiry.band !== "valid"),
      expiresOn: c.expiresOn,
      expiry,
      issuer: c.issuer,
      requirement: perShipment
        ? "Not held as a standing certificate — issued per consignment and tracked as an order document on each order that needs it."
        : "Company certification held on your Company Profile and offered in quotations.",
      responsibility: [
        { party: "Exporter", role: "Maintains the certification on the Company Profile" },
        { party: "Issuing body", role: c.issuer },
      ],
      timeline: [],
      next: perShipment
        ? { text: "Tracked per order — see order documents", href: href("orders") }
        : c.status === "pending"
          ? { text: "Complete verification on the Company Profile", href: href("company#certifications") }
          : expiry && expiry.band !== "valid"
            ? { text: "Plan renewal on the Company Profile", href: href("company#certifications") }
            : { text: "No action — verified", href: href("company#certifications") },
      source: { label: "Company Profile", href: href("company#certifications") },
      facts: [],
    };
  });
  return [...registrations, ...certifications];
}

// ---------------------------------------------------------------------------
// Order documents
// ---------------------------------------------------------------------------

const ORDER_CODE: Record<OrderDocumentType, string> = {
  "commercial-invoice": "INVOICE",
  "packing-list": "PACKING",
  "certificate-of-origin": "COO",
  "phytosanitary-certificate": "PHYTO",
  "fumigation-certificate": "FUMIGATION",
  "health-certificate": "HEALTH",
  "inspection-certificate": "INSPECTION",
  "insurance-certificate": "INSURANCE",
  "shipping-instructions": "SI",
  "shipping-bill": "SB",
  "transport-document": "TD",
};

const CERTIFICATE_TYPES: readonly OrderDocumentType[] = ["certificate-of-origin", "phytosanitary-certificate", "fumigation-certificate", "health-certificate", "inspection-certificate"];

const ORDER_RESPONSIBILITY: Record<string, { party: string; role: string }[]> = {
  "commercial-invoice": [{ party: "Exporter", role: "Prepares" }, { party: "CHA", role: "Uses for Shipping Bill filing" }],
  "packing-list": [{ party: "Exporter", role: "Prepares" }, { party: "CHA", role: "Uses for Shipping Bill filing" }],
  "certificate-of-origin": [{ party: "Exporter", role: "Applies" }, { party: "Issuing authority", role: "Issues" }],
  "phytosanitary-certificate": [{ party: "Exporter", role: "Requests inspection" }, { party: "Plant quarantine authority", role: "Inspects and issues" }],
  "fumigation-certificate": [{ party: "Exporter", role: "Books the agency" }, { party: "Fumigation agency", role: "Treats the cargo and issues" }],
  "health-certificate": [{ party: "Exporter", role: "Applies" }, { party: "Issuing authority", role: "Issues" }],
  "inspection-certificate": [{ party: "Exporter", role: "Arranges" }, { party: "Inspection agency", role: "Inspects and issues" }],
  "insurance-certificate": [{ party: "Exporter", role: "Arranges cover" }, { party: "Insurer", role: "Issues" }],
};

const ORDER_STEPS: { id: OrderDocumentStatus; label: string }[] = [
  { id: "not-started", label: "Not Started" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "verified", label: "Verified" },
];

function orderDocTimeline(order: ExporterOrder, d: OrderDocument): TimelineStep[] {
  if (d.status === "not-required" || d.status === "blocked") return [];
  const reached: Partial<Record<OrderDocumentStatus, string>> = {};
  for (const e of order.events) if (e.type === "document-updated" && e.document?.id === d.id) reached[e.document.status] ??= e.at;
  const current = ORDER_STEPS.findIndex((s) => s.id === d.status);
  return ORDER_STEPS.map((s, i) => ({ label: s.label, state: i < current ? "done" : i === current ? "current" : "todo", at: i === 0 ? undefined : reached[s.id] }));
}

function orderItems(order: ExporterOrder, os: OrderState, shipments: readonly ExporterShipment[]): DocumentItem[] {
  const opp = findOpportunity(order.requirementId);
  const destination = opp ? shortCountry(opp.delivery.destinationCountry) : order.terms.namedPlace;
  const active = isActiveOrder(os.status);
  const users = shipments.filter((s) => s.orderId === order.id && shipmentState(s).status !== "cancelled");
  const departing = users.filter((s) => isPreDeparture(shipmentState(s).status));
  return os.documents.map((d): DocumentItem => {
    const required = d.status !== "not-required";
    const complete = d.status === "ready" || d.status === "verified";
    const filingDoc = d.type === "commercial-invoice" || d.type === "packing-list";
    const customsCritical = filingDoc || CERTIFICATE_TYPES.includes(d.type);
    const due = active && os.confirmed;
    const blockers: Blocker[] = [];
    if (d.status === "blocked") blockers.push({ key: "blocked", label: "Marked blocked on the order", done: false, detail: "Resolve on the order" });
    const blocksFiling = filingDoc && !complete && departing.length > 0;
    const commitment = d.commitment ? COMMITMENT_LABEL[d.commitment] : undefined;
    const statusText = complianceStatusText(d);
    return {
      id: `DOC-${order.id}-${ORDER_CODE[d.type]}`,
      ownerType: "order",
      ownerId: order.id,
      code: ORDER_CODE[d.type],
      title: d.label,
      category: "order",
      stage: "Pre-Shipment",
      status: FROM_ORDER[d.status],
      sourceStatus: statusText,
      required,
      complete,
      due,
      attention: due && required && !complete && (d.status === "not-started" || d.status === "blocked"),
      blocking: due && required && !complete,
      customsCritical,
      blockedStep: blocksFiling ? "Shipping Bill filing" : due && required && !complete ? "Order pre-shipment readiness" : undefined,
      blockers,
      orderId: order.id,
      dealId: order.dealId,
      product: order.terms.productName,
      destination,
      usedBy: users.map((s) => s.id),
      requirement: filingDoc
        ? `Required for this order's shipments — it is part of export-clearance readiness and Shipping Bill filing${users.length ? ` for ${users.map((s) => s.id).join(", ")}` : ""}.`
        : d.type === "insurance-certificate"
          ? "Insurance is included in this order's agreed cost coverage."
          : commitment
            ? `Required for this order: ${commitment.toLowerCase()} in deal ${order.dealId}.`
            : "Required for this order.",
      responsibility: ORDER_RESPONSIBILITY[d.type] ?? [{ party: "Exporter", role: "Prepares" }],
      timeline: orderDocTimeline(order, d),
      next: !due
        ? { text: os.confirmed ? "No action — order closed" : "Confirm the order first", href: href(`orders/${order.id}`) }
        : complete
          ? { text: "No action — ready", href: href(`orders/${order.id}`) }
          : d.commitment === "arrangement-required" && d.status === "not-started"
            ? { text: `Book the ${d.type === "fumigation-certificate" ? "fumigation agency" : d.type === "inspection-certificate" ? "inspector" : "provider"} on the order`, href: href(`orders/${order.id}`) }
            : { text: d.status === "not-started" ? "Start preparation on the order" : d.status === "blocked" ? "Resolve on the order" : "Continue preparation on the order", href: href(`orders/${order.id}`) },
      source: { label: `Order ${order.id}`, href: href(`orders/${order.id}`) },
      demo: false,
      facts: [
        ...(commitment ? ([["Deal commitment", commitment]] as [string, string][]) : []),
        ["Order status", DOCUMENT_STATUS_LABEL[d.status]],
        ...(users.length ? ([["Read by shipments", users.map((s) => s.id).join(", ")]] as [string, string][]) : []),
      ],
      activityAt: order.events.filter((e) => e.type === "document-updated" && e.document?.id === d.id).at(-1)?.at ?? order.createdAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Shipment records
// ---------------------------------------------------------------------------

const TD_CODE = { sea: "BL", air: "AWB", road: "CMR", rail: "RWB", multimodal: "MTD" } as const;

function ladder(steps: readonly { id: string; label: string }[], current: string, at: Partial<Record<string, string>> = {}): TimelineStep[] {
  const i = steps.findIndex((s) => s.id === current);
  return steps.map((s, j) => ({ label: s.label, state: j < i ? "done" : j === i ? "current" : "todo", at: at[s.id] }));
}

function shipmentItems(sh: ExporterShipment, st: ShipmentState, order: ExporterOrder, os: OrderState, access: CounterpartyAccess | undefined): DocumentItem[] {
  const opp = findOpportunity(order.requirementId);
  const destination = opp ? shortCountry(opp.delivery.destinationCountry) : sh.route.finalDelivery;
  const live = isActiveShipment(st.status);
  const pre = isPreDeparture(st.status) && live;
  const sb = shippingBillIndex(st.shippingBill);
  const leo = st.shippingBill === "leo-received";
  const filed = sb >= shippingBillIndex("filed");
  const shipmentHref = (anchor: string) => href(`shipments/${sh.id}#${anchor}`);
  const base = {
    ownerType: "shipment" as const,
    ownerId: sh.id,
    category: "shipment" as const,
    orderId: order.id,
    shipmentId: sh.id,
    dealId: sh.dealId,
    product: order.terms.productName,
    destination,
    usedBy: [],
    demo: true,
    activityAt: st.updatedAt,
  };
  const items: DocumentItem[] = [];
  const firstAt = (type: string) => sh.events.find((e) => e.type === type)?.at;

  // Shipping Instructions
  const siPrereqs = instructionsPrerequisites(st).filter((p) => !p.done);
  const siDone = st.instructionsStatus === "ready";
  items.push({
    ...base,
    id: `DOC-${sh.id}-SI`,
    code: "SI",
    title: "Shipping Instructions",
    stage: "Customs",
    status: siDone ? "ready" : st.instructionsStatus === "draft" ? "preparing" : "not-started",
    sourceStatus: INSTRUCTIONS_STATUS_LABEL[st.instructionsStatus],
    required: true,
    complete: siDone,
    due: pre,
    attention: pre && !siDone && (st.instructionsStatus === "not-started" || siPrereqs.length > 0),
    blocking: pre && !siDone,
    customsCritical: true,
    blockedStep: siDone ? undefined : "Ready",
    blockers: siDone ? [] : instructionsPrerequisites(st).map((p) => ({ key: p.key, label: p.label, done: p.done, detail: p.detail })),
    requirement: "Required for this shipment — Shipping Bill filing needs it ready.",
    responsibility: [
      { party: "Exporter", role: "Prepares" },
      { party: "Freight forwarder", role: "Uses for booking and the BL draft" },
      { party: "Ximverse", role: "Provides consignee and notify details" },
    ],
    timeline: [
      { label: "Not Started", state: st.instructionsStatus === "not-started" ? "current" : "done" },
      { label: "Draft", state: st.instructionsStatus === "draft" ? "current" : siDone ? "done" : "todo", at: firstAt("instructions-updated") },
      { label: "Ready", state: siDone ? "current" : "todo", at: siDone ? sh.events.filter((e) => e.type === "instructions-ready").at(-1)?.at : undefined },
    ],
    next: !pre ? { text: "No action", href: shipmentHref("instructions") } : siDone ? { text: "No action — ready", href: shipmentHref("instructions") } : { text: siPrereqs.length ? "Resolve blockers on the shipment" : "Mark ready on the shipment", href: shipmentHref("instructions") },
    source: { label: `Shipment ${sh.id}`, href: shipmentHref("instructions") },
    demo: false,
    // Consignee / notify are placeholders — buyer identity is never part of this record.
    facts: [
      ["Consignee", counterpartyLine(access)],
      ["Notify party", counterpartyLine(access)],
      ["Port of loading", sh.route.portOfLoading],
      ["Port of discharge", sh.route.portOfDischarge],
    ],
  });

  // Shipping Bill
  const nextStep = SHIPPING_BILL_STEPS[sb + 1];
  // Before filing, explain everything filing needs; after it, what LEO needs.
  const target = sb < shippingBillIndex("ready-for-filing") ? "ready-for-filing" : leo ? undefined : "leo-received";
  const sbBlockers = target ? shippingBillPrerequisites(sh, st, os, target) : [];
  const sbFailing = sbBlockers.some((b) => !b.done);
  items.push({
    ...base,
    id: `DOC-${sh.id}-SB`,
    code: "SB",
    title: "Shipping Bill",
    stage: "Customs",
    status: FROM_SHIPPING_BILL[st.shippingBill],
    sourceStatus: `${SHIPPING_BILL_STEPS[sb].label} (demo)`,
    required: true,
    complete: leo,
    due: pre,
    attention: pre && !leo && (sbFailing || st.shippingBill === "not-started"),
    blocking: pre && sbFailing,
    customsCritical: true,
    blockedStep: target ? SHIPPING_BILL_STEPS[shippingBillIndex(target)].label : undefined,
    blockers: sbBlockers.map((p) => ({ key: p.key, label: p.label, done: p.done, detail: p.detail })),
    requirement: "Required for this shipment's export customs clearance.",
    responsibility: [
      { party: "Exporter", role: "Prepares the data" },
      { party: "CHA", role: "Reviews and files" },
      { party: "Customs", role: "Acknowledges and grants LEO" },
    ],
    timeline: ladder(SHIPPING_BILL_STEPS, st.shippingBill, st.shippingBillAt),
    next: !pre || leo ? { text: leo ? "No action — LEO received (demo)" : "No action", href: shipmentHref("customs") } : sbFailing ? { text: "Resolve blockers on the shipment", href: shipmentHref("customs") } : { text: `Mark “${nextStep?.label}” on the shipment`, href: shipmentHref("customs") },
    source: { label: `Shipment ${sh.id}`, href: shipmentHref("customs") },
    facts: [
      ["CHA", st.cha ?? "Not assigned"],
      ["Dossier", st.dossierShared ? "Shared" : "Not shared"],
      ["Shipment customs readiness", `${score(customsReadiness(sh, st, os))}% (from the shipment's rules)`],
    ],
  });

  // Customs acknowledgement and LEO
  const ackDone = sb >= shippingBillIndex("acknowledged");
  items.push({
    ...base,
    id: `DOC-${sh.id}-ACK`,
    code: "ACK",
    title: "Customs Acknowledgement",
    stage: "Customs",
    status: ackDone ? "acknowledged" : filed ? "requested" : "not-started",
    sourceStatus: ackDone ? "Received (demo)" : filed ? "Awaiting (demo)" : "After filing",
    required: true,
    complete: ackDone,
    due: pre && filed,
    attention: false,
    blocking: false,
    customsCritical: true,
    blockedStep: ackDone ? undefined : "Acknowledged",
    blockers: ackDone ? [] : [{ key: "filed", label: "Shipping Bill filed (demo)", done: filed }],
    requirement: "Recorded for this shipment once its Shipping Bill is filed.",
    responsibility: [{ party: "Customs", role: "Acknowledges" }, { party: "CHA", role: "Reports it" }],
    timeline: [],
    next: { text: ackDone ? "No action" : "Follow up with the CHA on the shipment", href: shipmentHref("customs") },
    source: { label: `Shipment ${sh.id}`, href: shipmentHref("customs") },
    facts: ackDone && st.shippingBillAt.acknowledged ? [["Recorded", st.shippingBillAt.acknowledged.slice(0, 10)]] : [],
  });
  const leoBlockers = leo ? [] : [{ key: "ack", label: "Customs acknowledgement recorded (demo)", done: ackDone }, ...shippingBillPrerequisites(sh, st, os, "leo-received").map((p) => ({ key: p.key, label: p.label, done: p.done, detail: p.detail }))];
  items.push({
    ...base,
    id: `DOC-${sh.id}-LEO`,
    code: "LEO",
    title: "Let Export Order (LEO)",
    stage: "Customs",
    status: leo ? "issued" : ackDone ? "requested" : "not-started",
    sourceStatus: leo ? "Received (demo)" : "Pending",
    required: true,
    complete: leo,
    due: pre && filed,
    attention: pre && filed && !leo && leoBlockers.some((b) => !b.done),
    blocking: pre && filed && !leo,
    customsCritical: true,
    blockedStep: leo ? undefined : "LEO",
    blockers: leoBlockers,
    requirement: "Required for this shipment before loading and departure.",
    responsibility: [{ party: "Customs", role: "Grants" }, { party: "CHA", role: "Reports it" }],
    timeline: [],
    next: { text: leo ? "No action" : "Follow up with the CHA on the shipment", href: shipmentHref("customs") },
    source: { label: `Shipment ${sh.id}`, href: shipmentHref("customs") },
    facts: leo && st.shippingBillAt["leo-received"] ? [["Recorded", st.shippingBillAt["leo-received"].slice(0, 10)]] : [],
  });

  // BL / AWB
  const td = transportDocumentIndex(st.transportDocument);
  const tdName = transportDocumentName(sh.route.mode);
  const finalIssued = st.transportDocument === "final-issued";
  const tdDue = live && (td > 0 || Boolean(st.milestones["gate-in"] || st.milestones.loaded || st.milestones.departed));
  const tdBlockers = finalIssued ? [] : transportDocumentPrerequisites(st).map((p) => ({ key: p.key, label: p.label, done: p.done, detail: p.detail }));
  items.push({
    ...base,
    id: `DOC-${sh.id}-${TD_CODE[sh.route.mode]}`,
    code: TD_CODE[sh.route.mode],
    title: tdName,
    stage: "Transport",
    status: FROM_TRANSPORT[st.transportDocument],
    sourceStatus: `${TRANSPORT_DOCUMENT_STEPS[td].label} (demo)`,
    required: true,
    complete: finalIssued,
    due: tdDue,
    attention: tdDue && !finalIssued && (st.transportDocument === "draft-received" || Boolean(st.milestones.departed)),
    blocking: false,
    customsCritical: false,
    blockedStep: finalIssued ? undefined : "Final Issued",
    blockers: tdBlockers,
    requirement: `Required for this shipment — the ${tdName} is the transport document for the ${sh.route.mode} leg.`,
    responsibility: [{ party: sh.route.mode === "air" ? "Airline" : "Carrier", role: "Issues" }, { party: "Exporter", role: "Reviews the draft" }],
    timeline: ladder(TRANSPORT_DOCUMENT_STEPS, st.transportDocument),
    next: { text: finalIssued ? "No action — final issued (demo)" : st.transportDocument === "draft-received" ? "Review the draft on the shipment" : "Track on the shipment", href: shipmentHref("transport-document") },
    source: { label: `Shipment ${sh.id}`, href: shipmentHref("transport-document") },
    // Consignee on the BL is never stored here — the same protected placeholder as the instructions.
    facts: [["Consignee", counterpartyLine(access)], ...(st.vessel.name ? ([["Vessel / flight", [st.vessel.name, st.vessel.voyage].filter(Boolean).join(" ")]] as [string, string][]) : [])],
  });

  // Container records (FCL only)
  if (usesContainers(sh.route)) {
    const done = containerComplete(st);
    const started = Boolean(st.container.type || st.container.count || st.container.numbers);
    items.push({
      ...base,
      id: `DOC-${sh.id}-CONTAINERS`,
      code: "CONTAINERS",
      title: "Container & Seal Records",
      stage: "Transport",
      status: done ? "ready" : started ? "preparing" : "not-started",
      sourceStatus: done ? "Complete" : started ? "Incomplete" : "Not recorded",
      required: true,
      complete: done,
      due: pre,
      attention: pre && !done && !started,
      blocking: pre && !done,
      customsCritical: true,
      blockedStep: done ? undefined : "Complete",
      blockers: done ? [] : [
        { key: "type", label: "Container type", done: Boolean(st.container.type) },
        { key: "count", label: "Container count", done: Boolean(st.container.count) },
        { key: "numbers", label: "Container numbers", done: Boolean(st.container.numbers) },
        { key: "seals", label: "Seal numbers", done: Boolean(st.container.seals) },
      ],
      requirement: "Required for this FCL shipment — Shipping Bill filing needs complete container details.",
      responsibility: [{ party: "Freight forwarder / carrier", role: "Assigns containers" }, { party: "Exporter", role: "Records numbers and seals" }],
      timeline: [],
      next: { text: done ? "No action" : "Record on the shipment", href: shipmentHref("containers") },
      source: { label: `Shipment ${sh.id}`, href: shipmentHref("containers") },
      demo: false,
      facts: [["Containers", st.container.numbers ?? "—"], ["Seals", st.container.seals ?? "—"]],
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// The index
// ---------------------------------------------------------------------------

export interface DocumentSources {
  orders: readonly ExporterOrder[];
  shipments: readonly ExporterShipment[];
  deals: readonly ExporterDeal[];
}

export function buildDocumentIndex({ orders, shipments, deals }: DocumentSources): DocumentItem[] {
  const items = companyItems();
  for (const order of orders) {
    items.push(...orderItems(order, orderStateWithShipments(order, shipments), shipments));
  }
  for (const sh of shipments) {
    const order = orders.find((o) => o.id === sh.orderId);
    if (!order) continue;
    items.push(...shipmentItems(sh, shipmentState(sh), order, orderStateWithShipments(order, shipments), deals.find((d) => d.id === sh.dealId)?.counterpartyAccess));
  }
  return items;
}

export const LOCAL_DOCUMENT_ID = /^DOC-(ORD|SHP)-\d{4}-9\d{3,}-[A-Z]+$/;

// ---------------------------------------------------------------------------
// Readiness — only required items count; Not Required never lowers a score.
// ---------------------------------------------------------------------------

export interface Readiness {
  done: number;
  required: number;
  percent: number;
}

export function readinessOf(items: readonly DocumentItem[]): Readiness {
  const req = items.filter((d) => d.required);
  const done = req.filter((d) => d.complete).length;
  return { done, required: req.length, percent: req.length ? Math.round((done / req.length) * 100) : 100 };
}

/** Document keys of the shipment's customs readiness (CHA assignment is not a document). */
const CUSTOMS_DOC_KEYS = new Set(["invoice", "packing", "certificates", "instructions", "container", "sb-data", "sb-filed", "leo"]);

/** Customs documentation readiness, from the shipment's own readiness rules. */
export function customsDocumentReadiness(sh: ExporterShipment, orders: readonly ExporterOrder[], shipments: readonly ExporterShipment[]): Readiness | undefined {
  const order = orders.find((o) => o.id === sh.orderId);
  if (!order) return undefined;
  const items = customsReadiness(sh, shipmentState(sh), orderStateWithShipments(order, shipments)).filter((i) => CUSTOMS_DOC_KEYS.has(i.key));
  const done = items.filter((i) => i.done).length;
  return { done, required: items.length, percent: score(items) };
}

export interface WorkspaceReadiness {
  orders: Readiness;
  shipments: Readiness;
  customs: Readiness;
}

/** Totals across active orders and pre-departure shipments. */
export function workspaceReadiness(index: readonly DocumentItem[], src: DocumentSources): WorkspaceReadiness {
  const orderDocs = index.filter((d) => d.ownerType === "order" && d.due);
  const departing = src.shipments.filter((s) => isPreDeparture(shipmentState(s).status) && shipmentState(s).status !== "cancelled");
  const shipmentDocs = index.filter((d) => d.ownerType === "shipment" && departing.some((s) => s.id === d.ownerId));
  const customs = departing.map((s) => customsDocumentReadiness(s, src.orders, src.shipments)).filter((x): x is Readiness => Boolean(x));
  const done = customs.reduce((t, r) => t + r.done, 0);
  const required = customs.reduce((t, r) => t + r.required, 0);
  return { orders: readinessOf(orderDocs), shipments: readinessOf(shipmentDocs), customs: { done, required, percent: required ? Math.round((done / required) * 100) : 100 } };
}

// ---------------------------------------------------------------------------
// Action Required and SUMIT — statements the index supports, nothing more.
// ---------------------------------------------------------------------------

export interface DocumentAction {
  id: string;
  owner: string;
  text: string;
  href: string;
  blocking: boolean;
}

function reasonFor(d: DocumentItem): string {
  const failing = d.blockers.filter((b) => !b.done);
  if (d.expiry && d.expiry.band !== "valid") return d.expiry.label.toLowerCase();
  if (d.ownerType === "company") return d.status === "needs-review" ? "pending verification" : d.sourceStatus.toLowerCase();
  if (failing.length) return `${failing[0].detail ?? failing[0].label}${failing.length > 1 ? ` (+${failing.length - 1} more)` : ""}`;
  if (d.ownerType === "order" && d.sourceStatus !== DOCUMENT_STATUS_DISPLAY[d.status]) return d.sourceStatus.toLowerCase();
  return DOCUMENT_STATUS_DISPLAY[d.status].toLowerCase();
}

export function documentActions(index: readonly DocumentItem[]): DocumentAction[] {
  return index
    .filter((d) => d.attention)
    .map((d) => ({ id: d.id, owner: d.ownerId, text: `${d.title} — ${reasonFor(d)}`, href: d.next.href, blocking: d.blocking }))
    .sort((a, b) => Number(b.blocking) - Number(a.blocking));
}

const joinAnd = (xs: readonly string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? ""));
/** Lower-cases a leading common word; keeps acronyms (CHA, LEO) and document names as written. */
const DOCUMENT_NAMES = /^(Shipping|Commercial|Packing|Certificate|Phytosanitary|Fumigation|Insurance|Inspection|Health|Bill|Air|Container &)/;
const lower = (s: string) => (/^[A-Z]{2}/.test(s) || DOCUMENT_NAMES.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
/** First three, then "and N more". */
const someOf = (xs: readonly string[]) => joinAnd(xs.length > 3 ? [...xs.slice(0, 3), `${xs.length - 3} more`] : xs);

export function documentInsights(index: readonly DocumentItem[]): string[] {
  const out: string[] = [];
  for (const sb of index.filter((d) => d.code === "SB" && d.blocking && d.blockedStep === "Ready for Filing").slice(0, 2)) {
    const failing = sb.blockers.filter((b) => !b.done).map((b) => lower(b.detail ?? b.label));
    out.push(`${sb.ownerId} cannot move to Shipping Bill filing yet because ${someOf(failing)}.`);
  }
  const attention = index.filter((d) => d.attention);
  if (attention.length) {
    const shipments = new Set(attention.filter((d) => d.ownerType === "shipment").map((d) => d.ownerId)).size;
    const orders = new Set(attention.filter((d) => d.ownerType === "order").map((d) => d.ownerId)).size;
    const company = attention.filter((d) => d.ownerType === "company").length;
    const where = [shipments && `${shipments} shipment${shipments === 1 ? "" : "s"}`, orders && `${orders} order${orders === 1 ? "" : "s"}`, company && "the Company Profile"].filter(Boolean) as string[];
    out.push(`${attention.length} document${attention.length === 1 ? " needs" : "s need"} attention across ${joinAnd(where)}.`);
  } else {
    out.push("No document needs attention right now.");
  }
  const byOrder = new Map<string, DocumentItem[]>();
  for (const d of index.filter((x) => x.ownerType === "order" && x.due)) byOrder.set(d.ownerId, [...(byOrder.get(d.ownerId) ?? []), d]);
  for (const [orderId, docs] of [...byOrder].slice(0, 3)) {
    const r = readinessOf(docs);
    const open = docs.filter((d) => d.required && !d.complete).map((d) => d.title.replace(/ Certificate$/, ""));
    if (open.length) out.push(`${orderId} is ${r.percent}% document-ready; ${someOf(open)} remain${open.length === 1 ? "s" : ""} outstanding.`);
  }
  for (const c of index.filter((d) => d.category === "certification" && d.status === "needs-review")) out.push(`${c.title} is still pending on the Company Profile.`);
  const dated = index.filter((d) => d.expiry).sort((a, b) => a.expiry!.days - b.expiry!.days);
  const soonest = dated[0];
  if (soonest?.expiry) {
    out.push(
      soonest.expiry.band === "valid"
        ? `${soonest.title} is the next credential to expire and remains valid until ${formatLongDate(soonest.expiresOn!)}.`
        : soonest.expiry.band === "expired"
          ? `${soonest.title} has expired (${formatLongDate(soonest.expiresOn!)}).`
          : `Your ${soonest.title} expires in ${soonest.expiry.days} days.`,
    );
  }
  return out;
}

/** Short date for tables. */
export const documentDate = (iso: string) => formatShortDate(iso);

// ---------------------------------------------------------------------------
// Server-visible seeds (prerendered routes, dashboard)
// ---------------------------------------------------------------------------


export const SEEDED_DOCUMENT_INDEX = buildDocumentIndex({ orders: SEEDED_ORDERS, shipments: SEEDED_SHIPMENTS, deals: SEEDED_DEALS });
export const SEEDED_DOCUMENT_IDS = SEEDED_DOCUMENT_INDEX.map((d) => d.id);
