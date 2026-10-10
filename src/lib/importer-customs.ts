/**
 * Customs cases: importer-side customs preparation and handoff to a customs
 * broker (CHA).
 *
 * A case references its shipment, order, requirement and supplier by ID and
 * stores only what is customs-specific: manual declaration fields, the
 * assigned broker, handoff snapshots and clarifications, all as append-only
 * events. Everything else (documents, route, cargo, commercial terms) is read
 * live from the canonical records, so a document change is reflected at once.
 *
 * Filed / Under Assessment / Cleared are shipment `customs-updated` events —
 * historical records or demo actions. No Customs system, ICEGATE or broker
 * system is connected; nothing is filed, sent or validated. No duties are
 * calculated and no HS code is suggested.
 */

import type { Currency } from "./import-requirements";
import { customsPrep, type CustomsPrepItem } from "./importer-compliance";
import { describeDocumentEvent, isMissing, type TradeDocument } from "./importer-documents";
import { importerHref, PLACEHOLDER_IMPORTER } from "./importer-nav";
import { orderStatus, orderValue, type Order } from "./importer-orders";
import {
  CUSTOMS_STATUS_LABEL,
  modeLabel,
  shipmentState,
  type CustomsOverride,
  type CustomsStatus,
  type Shipment,
  type ShipmentEvent,
  type ShipmentState,
} from "./importer-shipments";
import { findSupplier } from "./importer-suppliers";

/* ------------------------------------------------------------------------ */
/* Vocabulary                                                                */
/* ------------------------------------------------------------------------ */

export const CUSTOMS_CASE_STATUSES = [
  { id: "preparing", label: "Preparing" },
  { id: "ready-for-handoff", label: "Ready for Handoff" },
  { id: "with-cha", label: "With CHA" },
  { id: "clarification-required", label: "Clarification Required" },
  { id: "ready-for-filing", label: "Ready for Filing" },
  { id: "filed", label: "Filed" },
  { id: "under-assessment", label: "Under Assessment" },
  { id: "cleared", label: "Cleared" },
] as const;
export type CustomsCaseStatus = (typeof CUSTOMS_CASE_STATUSES)[number]["id"];

export const CUSTOMS_CASE_STATUS_LABEL = Object.fromEntries(CUSTOMS_CASE_STATUSES.map((s) => [s.id, s.label])) as Record<CustomsCaseStatus, string>;

/** Statuses reachable in XimVerse itself; later ones are demo or historical only. */
const PRE_FILING: readonly CustomsCaseStatus[] = ["preparing", "ready-for-handoff", "with-cha", "clarification-required", "ready-for-filing"];

export const isPreFiling = (s: CustomsCaseStatus) => PRE_FILING.includes(s);

export type CustomsReadiness = "blocked" | "preparing" | "ready-for-handoff" | "ready-for-filing";

export const CUSTOMS_READINESS_LABEL: Record<CustomsReadiness, string> = {
  blocked: "Blocked",
  preparing: "Preparing",
  "ready-for-handoff": "Ready for Handoff",
  "ready-for-filing": "Ready for Filing",
};

export const CUSTOMS_NOTICE =
  "Customs readiness is based on information recorded in XimVerse. No Customs filing or government validation has occurred.";
export const PREPARATION_ONLY = "Preparation only — nothing has been filed with Customs.";
export const NO_CUSTOMS_SYSTEM = "No Customs system is connected.";
export const NO_DUTIES = "Duties and taxes have not been calculated.";
export const HANDOFF_CONFIRMATION =
  "This records that the customs case was handed to the assigned broker outside XimVerse. No message or filing will be sent.";
export const READY_FOR_FILING_TEXT = "The preparation package is complete for the current XimVerse workflow.";

export const EXAMPLE_CLARIFICATIONS = [
  "Please confirm the HS Code.",
  "Please confirm Country of Origin.",
  "Invoice number is missing.",
  "Please confirm package count.",
  "Please provide supporting certificate.",
] as const;

/* ------------------------------------------------------------------------ */
/* Records                                                                   */
/* ------------------------------------------------------------------------ */

/** Importer-side record of the broker handling customs. Not verified by XimVerse. */
export interface ChaAssignment {
  company: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  licenseRef?: string;
  notes?: string;
}

/** Fields that may be entered in the customs workspace. */
export const MANUAL_FIELDS = ["countryOfOrigin", "countryOfConsignment", "hsCode", "freightAmount", "insuranceAmount", "declarationReference"] as const;
export type ManualFieldId = (typeof MANUAL_FIELDS)[number];
export type ManualDeclarationFields = Partial<Record<ManualFieldId, string>>;

export type DeclarationFieldSource = "order" | "shipment" | "requirement" | "document" | "supplier" | "importer-profile" | "manual";

export const FIELD_SOURCE_LABEL: Record<DeclarationFieldSource, string> = {
  order: "Order",
  shipment: "Shipment",
  requirement: "Requirement",
  document: "Document Metadata",
  supplier: "Supplier",
  "importer-profile": "Importer Profile",
  manual: "Manual Entry",
};

export type DeclarationFieldId =
  | "importerName"
  | "importerAddress"
  | "supplierName"
  | "countryOfOrigin"
  | "countryOfConsignment"
  | "portOfImport"
  | "transportMode"
  | "hsCode"
  | "productDescription"
  | "quantity"
  | "unit"
  | "invoiceNumber"
  | "invoiceDate"
  | "invoiceValue"
  | "currency"
  | "incoterm"
  | "packageCount"
  | "grossWeight"
  | "netWeight"
  | "freightAmount"
  | "insuranceAmount"
  | "declarationReference";

export interface DeclarationField {
  id: DeclarationFieldId;
  label: string;
  value?: string;
  source?: DeclarationFieldSource;
  /** The record the value comes from, e.g. "Commercial Invoice". */
  sourceDetail?: string;
  required: boolean;
  /** Set when the value may be entered here (customs-specific, or no upstream value). */
  manual?: ManualFieldId;
  /** Where an upstream value is corrected ("Update source record"). */
  sourceHref?: string;
  /** Show only when a value is known (freight, insurance). */
  onlyIfKnown?: boolean;
}

/** One declaration line. Orders are single-product today; the model allows more. */
export interface CustomsLineItem {
  line: number;
  description?: string;
  hsCode?: string;
  quantity?: number;
  unit?: string;
  invoiceValue?: number;
  currency?: Currency;
  countryOfOrigin?: string;
}

export type ClarificationStatus = "open" | "responded" | "resolved";

export const CLARIFICATION_STATUS_LABEL: Record<ClarificationStatus, string> = { open: "Open", responded: "Responded", resolved: "Resolved" };

export interface CustomsClarification {
  id: string;
  question: string;
  requestedAt: string;
  status: ClarificationStatus;
  response?: string;
  respondedAt?: string;
  resolvedAt?: string;
  /** Demo only — no real broker message was received. */
  demo?: boolean;
}

/** What was handed over at the time: broker identity, declaration version and values, document references. */
export interface HandoffSnapshot {
  cha: ChaAssignment;
  declarationVersion: number;
  declaration: Partial<Record<DeclarationFieldId, string>>;
  documentIds: string[];
  note?: string;
}

export interface HandoffRecord extends HandoffSnapshot {
  eventId: string;
  at: string;
  /** Part of the demo history rather than recorded in this tab. */
  historical: boolean;
}

export type CustomsEventType =
  | "created"
  | "declaration-updated"
  | "cha-assigned"
  | "handoff-recorded"
  | "clarification-recorded"
  | "clarification-responded"
  | "clarification-resolved";

export interface CustomsEvent {
  id: string;
  type: CustomsEventType;
  by: "importer" | "customs-broker" | "system";
  /** ISO timestamp. */
  at: string;
  /** Demo only — nothing was received from or sent to a broker. */
  demo?: boolean;
  note?: string;
  fields?: ManualDeclarationFields;
  cha?: ChaAssignment;
  handoff?: HandoffSnapshot;
  clarificationId?: string;
  question?: string;
  response?: string;
}

export interface CustomsCase {
  id: string;
  shipmentId: string;
  orderId: string;
  requirementId: string;
  supplierId: string;
  /** ISO timestamp. */
  createdAt: string;
  events: CustomsEvent[];
  /** Created in this browser tab rather than part of the demo data. */
  local?: boolean;
}

export const CUSTOMS_CASE_ID_PATTERN = /^CUS-\d{4}-\d{4,}$/;

export type BlockerKind = "document-missing" | "document-expired" | "document-review" | "hs-code" | "declaration-field" | "cha";

export interface CustomsBlocker {
  id: string;
  kind: BlockerKind;
  title: string;
  documentId?: string;
  fieldId?: DeclarationFieldId;
}

/* ------------------------------------------------------------------------ */
/* Lookup & creation                                                         */
/* ------------------------------------------------------------------------ */

/** The single lookup every entry point uses: one shipment → at most one case. */
export function customsCaseForShipment<T extends { shipmentId: string }>(shipmentId: string, cases: readonly T[]): T | undefined {
  return cases.find((c) => c.shipmentId === shipmentId);
}

export type CustomsEligibility =
  | { ok: true }
  | { ok: false; reason: "not-found" | "case-exists" | "cancelled" | "missing-records"; caseId?: string };

export function customsEligibility(
  shipment: Shipment | undefined,
  cases: readonly CustomsCase[],
  order: Order | undefined,
  requirementExists: boolean,
): CustomsEligibility {
  if (!shipment) return { ok: false, reason: "not-found" };
  const existing = customsCaseForShipment(shipment.id, cases);
  if (existing) return { ok: false, reason: "case-exists", caseId: existing.id };
  if (!order || !findSupplier(shipment.supplierId) || !requirementExists) return { ok: false, reason: "missing-records" };
  if (orderStatus(order) === "cancelled") return { ok: false, reason: "cancelled" };
  return { ok: true };
}

export function nextCustomsCaseId(existing: readonly CustomsCase[], year: number): string {
  const max = existing.reduce((m, c) => Math.max(m, Number(c.id.split("-")[2]) || 0), 0);
  return `CUS-${year}-${String(max + 1).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------------ */
/* Derivation                                                                */
/* ------------------------------------------------------------------------ */

export interface CustomsMilestone {
  id: string;
  label: string;
  at?: string;
  tag?: "demo" | "historical";
}

export interface CustomsActivity {
  id: string;
  at: string;
  text: string;
  party: string;
  byYou: boolean;
  demo?: boolean;
  historical?: boolean;
  note?: string;
}

export interface CustomsCaseView {
  record: CustomsCase;
  id: string;
  shipmentId: string;
  shipment: Shipment;
  state: ShipmentState;
  order?: Order;
  supplierName: string;
  /** Customs-relevant canonical documents (everything except shipping instructions). */
  documents: TradeDocument[];
  /** The same items the shipment and compliance pages show. */
  prep: CustomsPrepItem[];
  cha?: ChaAssignment;
  chaSource?: "case" | "shipment";
  manual: ManualDeclarationFields;
  fields: DeclarationField[];
  missingFields: DeclarationField[];
  lineItems: CustomsLineItem[];
  declarationVersion: number;
  /** Destination is India, so the declaration is a Bill of Entry. */
  billOfEntry: boolean;
  blockers: CustomsBlocker[];
  readiness: CustomsReadiness;
  handoffs: HandoffRecord[];
  /** Latest handoff to the currently assigned broker. */
  handoff?: HandoffRecord;
  /** A handoff exists, but to a broker who is no longer assigned. */
  handoffStale: boolean;
  changedSinceHandoff: string[];
  clarifications: CustomsClarification[];
  status: CustomsCaseStatus;
  /** For Filed / Under Assessment / Cleared. */
  statusRecord?: "demo" | "historical";
  eta: string;
  updatedAt: string;
  /** What the shipment, compliance and customs pages share. */
  override: CustomsOverride;
}

const has = (v?: string | number) => v !== undefined && v !== "";
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** "Odesa, Ukraine" → "Ukraine". Undefined when the place has no country part. */
function countryOf(place: string): string | undefined {
  const parts = place.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) : undefined;
}

const CUSTOMS_STATUS_FROM_CASE: Record<CustomsCaseStatus, CustomsStatus> = {
  preparing: "preparing",
  "ready-for-handoff": "preparing",
  "with-cha": "preparing",
  "clarification-required": "preparing",
  "ready-for-filing": "ready-for-filing",
  filed: "filed",
  "under-assessment": "under-assessment",
  cleared: "cleared",
};

export function manualFields(c: CustomsCase): ManualDeclarationFields {
  return c.events.reduce<ManualDeclarationFields>((acc, e) => (e.type === "declaration-updated" && e.fields ? { ...acc, ...e.fields } : acc), {});
}

function declarationFields(s: Shipment, order: Order | undefined, docs: readonly TradeDocument[], manual: ManualDeclarationFields): DeclarationField[] {
  const supplier = findSupplier(s.supplierId);
  const ci = docs.find((d) => d.type === "commercial-invoice");
  const coo = docs.find((d) => d.type === "certificate-of-origin" && d.status !== "not-required");
  const t = order?.terms;
  const orderHref = importerHref(`orders/${s.orderId}`);
  const shipmentHref = importerHref(`shipments/${s.id}`);
  const fromOrder = (v?: string): Pick<DeclarationField, "value" | "source" | "sourceHref" | "sourceDetail"> =>
    has(v) ? { value: v, source: "order", sourceHref: orderHref, sourceDetail: s.orderId } : {};
  const fromShipment = (v?: string): Pick<DeclarationField, "value" | "source" | "sourceHref" | "sourceDetail"> =>
    has(v) ? { value: v, source: "shipment", sourceHref: shipmentHref, sourceDetail: s.id } : {};
  const fromDoc = (d: TradeDocument | undefined, v?: string): Pick<DeclarationField, "value" | "source" | "sourceHref" | "sourceDetail"> =>
    d ? { value: has(v) ? v : undefined, source: has(v) ? "document" : undefined, sourceHref: importerHref(`documents/${d.id}`), sourceDetail: d.label } : {};
  /** Upstream value if any, else a manual entry (which is then editable). */
  const orManual = (id: ManualFieldId, upstream: Pick<DeclarationField, "value" | "source" | "sourceHref" | "sourceDetail">): Partial<DeclarationField> =>
    has(upstream.value) ? upstream : { ...upstream, value: manual[id] || undefined, source: manual[id] ? "manual" : undefined, manual: id };

  const hsUpstream = has(s.hsCode) ? fromShipment(s.hsCode) : has(t?.hsCode) ? fromOrder(t?.hsCode) : {};

  const fields: (Partial<DeclarationField> & Pick<DeclarationField, "id" | "label">)[] = [
    { id: "importerName", label: "Importer Name", value: PLACEHOLDER_IMPORTER.company, source: "importer-profile" },
    { id: "importerAddress", label: "Importer Address", value: PLACEHOLDER_IMPORTER.address.replace(/\n/g, ", "), source: "importer-profile" },
    { id: "supplierName", label: "Supplier Name", value: supplier?.name, source: supplier ? "supplier" : undefined, sourceHref: importerHref(`suppliers/${s.supplierId}`), sourceDetail: supplier?.name },
    { id: "countryOfOrigin", label: "Country of Origin", ...orManual("countryOfOrigin", fromDoc(coo, coo?.metadata.country)) },
    { id: "countryOfConsignment", label: "Country of Consignment", ...orManual("countryOfConsignment", fromShipment(countryOf(s.route.origin))) },
    { id: "portOfImport", label: "Port of Import", ...fromShipment(s.route.portOfDischarge) },
    { id: "transportMode", label: "Transport Mode", ...fromShipment(modeLabel(s.route.mode)) },
    { id: "hsCode", label: "HS Code", ...orManual("hsCode", hsUpstream) },
    { id: "productDescription", label: "Product Description", ...(t ? fromOrder([t.productName, t.specification].filter(Boolean).join(" — ")) : fromShipment(s.cargo.product)) },
    { id: "quantity", label: "Quantity", ...fromOrder(t ? num(t.quantity.amount) : undefined) },
    { id: "unit", label: "Unit", ...fromOrder(t?.quantity.unit) },
    { id: "invoiceNumber", label: "Invoice Number", ...fromDoc(ci, ci?.metadata.number) },
    { id: "invoiceDate", label: "Invoice Date", ...fromDoc(ci, ci?.metadata.issueDate) },
    { id: "invoiceValue", label: "Invoice Value", ...fromOrder(t ? num(orderValue(t)) : undefined) },
    { id: "currency", label: "Currency", ...fromOrder(t?.currency) },
    { id: "incoterm", label: "Incoterm", ...fromOrder(t ? `${t.incoterm} ${t.namedPlace}`.trim() : undefined) },
    { id: "packageCount", label: "Package Count", ...fromShipment(`${num(s.cargo.packages)} ${s.cargo.packageType.toLowerCase()}`) },
    { id: "grossWeight", label: "Gross Weight", ...fromShipment(`${num(s.cargo.grossWeight)} ${s.cargo.weightUnit}`) },
    { id: "netWeight", label: "Net Weight", ...fromShipment(`${num(s.cargo.netWeight)} ${s.cargo.weightUnit}`) },
    { id: "freightAmount", label: "Freight Amount", value: manual.freightAmount || undefined, source: manual.freightAmount ? "manual" : undefined, manual: "freightAmount", onlyIfKnown: true, required: false },
    { id: "insuranceAmount", label: "Insurance Amount", value: manual.insuranceAmount || undefined, source: manual.insuranceAmount ? "manual" : undefined, manual: "insuranceAmount", onlyIfKnown: true, required: false },
    { id: "declarationReference", label: "Declaration / Job Reference", value: manual.declarationReference || undefined, source: manual.declarationReference ? "manual" : undefined, manual: "declarationReference", required: false },
  ];
  return fields.map((f) => ({ required: true, ...f }) as DeclarationField);
}

function clarificationsOf(c: CustomsCase): CustomsClarification[] {
  const list: CustomsClarification[] = [];
  for (const e of c.events) {
    if (e.type === "clarification-recorded" && e.clarificationId && e.question) {
      list.push({ id: e.clarificationId, question: e.question, requestedAt: e.at, status: "open", demo: e.demo });
    }
    const target = list.find((x) => x.id === e.clarificationId);
    if (!target) continue;
    if (e.type === "clarification-responded") Object.assign(target, { status: "responded", response: e.response, respondedAt: e.at });
    if (e.type === "clarification-resolved") Object.assign(target, { status: "resolved", resolvedAt: e.at });
  }
  return list;
}

function chaOf(c: CustomsCase, s: Shipment): { cha?: ChaAssignment; source?: "case" | "shipment" } {
  const assigned = c.events.filter((e) => e.type === "cha-assigned" && e.cha).at(-1)?.cha;
  if (assigned) return { cha: assigned, source: "case" };
  if (s.parties.customsBroker) return { cha: { company: s.parties.customsBroker }, source: "shipment" };
  return {};
}

const customsEvents = (s: Shipment) => s.events.filter((e): e is ShipmentEvent & { customs: CustomsStatus } => e.type === "customs-updated" && !!e.customs);

export function customsCaseView(c: CustomsCase, shipments: readonly Shipment[], documents: readonly TradeDocument[], orders: readonly Order[]): CustomsCaseView | undefined {
  const s = shipments.find((x) => x.id === c.shipmentId);
  if (!s) return undefined;
  const state = shipmentState(s);
  const order = orders.find((o) => o.id === c.orderId);
  const allDocs = documents.filter((d) => d.shipmentId === s.id);
  const docs = allDocs.filter((d) => d.type !== "shipping-instructions");
  const manual = manualFields(c);
  const { cha, source: chaSource } = chaOf(c, s);
  const fields = declarationFields(s, order, docs, manual);
  const value = (id: DeclarationFieldId) => fields.find((f) => f.id === id)?.value;
  const hsCode = value("hsCode");
  const prep = customsPrep(s, state, allDocs, { broker: cha?.company, hsCode, status: "preparing" }).items;
  const cargoWithCarrier = !["preparing", "ready-to-ship"].includes(state.status);

  // Blockers before handoff (and before Ready for Filing).
  const blockers: CustomsBlocker[] = [];
  const ci = docs.find((d) => d.type === "commercial-invoice");
  for (const d of docs) {
    if (d.requirement.level !== "required") continue;
    if (isMissing(d)) {
      const pending = d.type === "transport-document" && !cargoWithCarrier;
      blockers.push({ id: `doc-${d.id}`, kind: "document-missing", title: pending ? `${d.label} not yet available` : `${d.label} missing`, documentId: d.id });
    } else if (d.validity === "expired" && (d.status === "available" || d.status === "approved")) {
      blockers.push({ id: `expired-${d.id}`, kind: "document-expired", title: `Expired required document: ${d.label}`, documentId: d.id });
    } else if (d.status === "needs-review") {
      blockers.push({ id: `review-${d.id}`, kind: "document-review", title: `${d.label} needs review`, documentId: d.id });
    }
  }
  const missingFields = fields.filter((f) => f.required && !has(f.value));
  for (const f of missingFields) {
    if (f.id === "hsCode") {
      blockers.push({ id: "hs", kind: "hs-code", title: "HS Code missing", fieldId: f.id });
      continue;
    }
    // Invoice details come from the invoice; a missing invoice is already listed.
    if ((f.id === "invoiceNumber" || f.id === "invoiceDate") && ci && isMissing(ci)) continue;
    blockers.push({ id: `field-${f.id}`, kind: "declaration-field", title: `${f.label} missing`, fieldId: f.id });
  }
  if (!cha) blockers.push({ id: "cha", kind: "cha", title: "Customs Broker not assigned" });

  // Handoffs: the latest one to the currently assigned broker counts.
  const handoffs: HandoffRecord[] = c.events
    .filter((e) => e.type === "handoff-recorded" && e.handoff)
    .map((e) => ({ ...e.handoff!, eventId: e.id, at: e.at, historical: !c.local && !e.id.startsWith("ce-") }));
  const latest = handoffs.at(-1);
  const handoff = latest && cha && latest.cha.company === cha.company ? latest : undefined;
  const handoffStale = !!latest && !handoff;

  const declarationVersion = 1 + c.events.filter((e) => e.type === "declaration-updated").length;
  const current = Object.fromEntries(fields.map((f) => [f.id, f.value ?? ""])) as Record<DeclarationFieldId, string>;
  const changedSinceHandoff: string[] = [];
  if (handoff) {
    for (const [id, was] of Object.entries(handoff.declaration) as [DeclarationFieldId, string][]) {
      if ((current[id] ?? "") !== was) changedSinceHandoff.push(`${fields.find((f) => f.id === id)?.label ?? id} changed`);
    }
    for (const d of docs.filter((x) => x.complete && !handoff.documentIds.includes(x.id))) changedSinceHandoff.push(`${d.label} added`);
  }

  const clarifications = clarificationsOf(c);
  const unresolved = clarifications.some((x) => x.status !== "resolved");
  const hard = blockers.some((b) => b.kind === "document-missing" || b.kind === "document-expired" || b.kind === "hs-code");
  const readiness: CustomsReadiness = hard
    ? "blocked"
    : blockers.length
      ? "preparing"
      : !handoff
        ? "ready-for-handoff"
        : unresolved
          ? "preparing"
          : "ready-for-filing";

  const progress = customsEvents(s).filter((e) => e.customs === "filed" || e.customs === "under-assessment" || e.customs === "cleared").at(-1);
  let status: CustomsCaseStatus;
  if (progress) status = progress.customs as CustomsCaseStatus;
  else if (!handoff) status = blockers.length ? "preparing" : "ready-for-handoff";
  else if (clarifications.some((x) => x.status === "open")) status = "clarification-required";
  else if (blockers.length || unresolved) status = "with-cha";
  else status = "ready-for-filing";

  const updatedAt = [c.createdAt, ...c.events.map((e) => e.at), ...customsEvents(s).map((e) => e.at), ...docs.map((d) => d.updatedAt)].reduce((a, b) => (b > a ? b : a));

  return {
    record: c,
    id: c.id,
    shipmentId: c.shipmentId,
    shipment: s,
    state,
    order,
    supplierName: findSupplier(s.supplierId)?.name ?? s.supplierId,
    documents: docs,
    prep,
    cha,
    chaSource,
    manual,
    fields,
    missingFields,
    lineItems: [
      {
        line: 1,
        description: value("productDescription"),
        hsCode,
        quantity: order?.terms.quantity.amount,
        unit: order?.terms.quantity.unit,
        invoiceValue: order ? orderValue(order.terms) : undefined,
        currency: order?.terms.currency,
        countryOfOrigin: value("countryOfOrigin"),
      },
    ],
    declarationVersion,
    billOfEntry: /india$/i.test(s.route.finalDelivery.trim()),
    blockers,
    readiness,
    handoffs,
    handoff,
    handoffStale,
    changedSinceHandoff,
    clarifications,
    status,
    statusRecord: progress ? (progress.demo ? "demo" : "historical") : undefined,
    eta: state.schedule.eta,
    updatedAt,
    override: { broker: cha?.company, hsCode, status: CUSTOMS_STATUS_FROM_CASE[status] },
  };
}

/* ------------------------------------------------------------------------ */
/* Allowed actions                                                           */
/* ------------------------------------------------------------------------ */

export function canEditCase(v: CustomsCaseView): boolean {
  return isPreFiling(v.status) && v.state.status !== "delivered";
}

/** Handoff needs no blockers; a new handoff is allowed when something changed since the last one. */
export function canRecordHandoff(v: CustomsCaseView): boolean {
  return canEditCase(v) && v.blockers.length === 0 && (!v.handoff || v.changedSinceHandoff.length > 0);
}

export function canRecordClarification(v: CustomsCaseView): boolean {
  return canEditCase(v) && !!v.handoff;
}

export type CustomsDemoStep = "filed" | "under-assessment" | "cleared";

export const DEMO_STEP_LABEL: Record<CustomsDemoStep, string> = {
  filed: "Simulate Filing",
  "under-assessment": "Simulate Assessment",
  cleared: "Simulate Clearance",
};

/** The next demo progression step, if any, and why it may be unavailable. */
export function nextDemoStep(v: CustomsCaseView): { step: CustomsDemoStep; blockedReason?: string } | undefined {
  if (v.status === "ready-for-filing") return { step: "filed" };
  if (v.status === "filed") return { step: "under-assessment" };
  if (v.status === "under-assessment") {
    const arrived = v.state.status === "arrived" || v.state.status === "customs";
    return { step: "cleared", blockedReason: arrived ? undefined : "Clearance can be simulated once the shipment has arrived." };
  }
  return undefined;
}

/* ------------------------------------------------------------------------ */
/* Milestones & activity                                                     */
/* ------------------------------------------------------------------------ */

export function customsMilestones(v: CustomsCaseView): CustomsMilestone[] {
  const ev = v.record.events;
  const first = (type: CustomsEvent["type"]) => ev.find((e) => e.type === type);
  const required = v.documents.filter((d) => d.requirement.level === "required");
  const docsAt = required.length && required.every((d) => d.complete) ? required.map((d) => d.updatedAt).reduce((a, b) => (b > a ? b : a)) : undefined;
  const chaEvent = first("cha-assigned");
  const chaAt = chaEvent?.at ?? (v.chaSource === "shipment" ? v.record.createdAt : undefined);
  const clar = first("clarification-recorded");
  const resp = first("clarification-responded");
  const progressed = !isPreFiling(v.status) || v.status === "ready-for-filing";
  const lastResolved = ev.filter((e) => e.type === "clarification-resolved").at(-1)?.at;
  const lastDeclaration = ev.filter((e) => e.type === "declaration-updated").at(-1)?.at;
  const readyAt = progressed && v.handoff ? [v.handoff.at, docsAt, chaAt, lastResolved, lastDeclaration].filter((x): x is string => !!x).reduce((a, b) => (b > a ? b : a)) : undefined;
  const step = (status: CustomsStatus) => {
    const e = customsEvents(v.shipment).find((x) => x.customs === status);
    return e ? { at: e.at, tag: e.demo ? ("demo" as const) : ("historical" as const) } : {};
  };
  return [
    { id: "created", label: "Customs Case Created", at: v.record.createdAt },
    { id: "documents", label: "Documents Prepared", at: docsAt },
    { id: "cha", label: "CHA Assigned", at: chaAt },
    { id: "handoff", label: "Handoff Recorded", at: v.handoff?.at },
    { id: "clarification", label: "Clarification Received", at: clar?.at, tag: clar?.demo ? "demo" : undefined },
    { id: "responded", label: "Importer Responded", at: resp?.at },
    { id: "ready", label: "Ready for Filing", at: readyAt },
    { id: "filed", label: "Filed", ...step("filed") },
    { id: "assessment", label: "Under Assessment", ...step("under-assessment") },
    { id: "cleared", label: "Cleared", ...step("cleared") },
  ];
}

const PARTY: Record<CustomsEvent["by"], string> = { importer: "You", "customs-broker": "Customs broker", system: "XimVerse" };

function describeCustomsEvent(e: CustomsEvent): string {
  switch (e.type) {
    case "created":
      return "Customs case created";
    case "declaration-updated":
      return "Declaration draft updated";
    case "cha-assigned":
      return `CHA assigned: ${e.cha?.company ?? ""}`;
    case "handoff-recorded":
      return `Handoff recorded to ${e.handoff?.cha.company ?? "broker"}`;
    case "clarification-recorded":
      return `Clarification recorded: ${e.question ?? ""}`;
    case "clarification-responded":
      return "Response recorded";
    case "clarification-resolved":
      return "Clarification resolved";
  }
}

/** Case events, customs status records and customs document events, newest first. */
export function customsActivity(v: CustomsCaseView): CustomsActivity[] {
  const caseItems = v.record.events.map<CustomsActivity>((e) => ({
    id: e.id,
    at: e.at,
    text: describeCustomsEvent(e),
    party: PARTY[e.by],
    byYou: e.by === "importer",
    demo: e.demo,
    note:
      e.type === "declaration-updated" && e.fields
        ? `Fields: ${Object.keys(e.fields).map((k) => FIELD_LABEL[k as ManualFieldId]).join(", ")}`
        : e.type === "clarification-responded"
          ? e.response
          : e.note,
  }));
  const statusItems = customsEvents(v.shipment)
    .filter((e) => e.customs !== "preparing" && e.customs !== "not-started")
    .map<CustomsActivity>((e) => ({
      id: `shp-${e.id}`,
      at: e.at,
      text: `Status changed: ${CUSTOMS_STATUS_LABEL[e.customs]}`,
      party: e.by === "importer" ? "You" : "Customs broker",
      byYou: e.by === "importer",
      demo: e.demo,
      historical: !e.demo,
      note: e.note,
    }));
  const docItems = v.documents.flatMap((d) =>
    d.events.map<CustomsActivity>((e) => ({
      id: `doc-${e.id}`,
      at: e.at,
      text: describeDocumentEvent(e, d.label),
      party: e.by === "importer" ? "You" : e.by === "system" ? "XimVerse" : e.by.replace("-", " ").replace(/^./, (x) => x.toUpperCase()),
      byYou: e.by === "importer",
      demo: e.demo,
      note: e.note,
    })),
  );
  return [...caseItems, ...statusItems, ...docItems].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

export const FIELD_LABEL: Record<ManualFieldId, string> = {
  countryOfOrigin: "Country of Origin",
  countryOfConsignment: "Country of Consignment",
  hsCode: "HS Code",
  freightAmount: "Freight Amount",
  insuranceAmount: "Insurance Amount",
  declarationReference: "Declaration / Job Reference",
};

/** Validates manual declaration fields. Returns errors by field. */
export function validateManualFields(f: ManualDeclarationFields): Partial<Record<ManualFieldId, string>> {
  const e: Partial<Record<ManualFieldId, string>> = {};
  for (const k of MANUAL_FIELDS) if ((f[k] ?? "").length > 80) e[k] = "Keep this under 80 characters.";
  if (f.hsCode && !/^\d{4}(\.?\d{2}){0,3}$/.test(f.hsCode)) e.hsCode = "Enter the HS code as digits, e.g. 1006.30 or 10063020.";
  for (const k of ["freightAmount", "insuranceAmount"] as const) {
    if (f[k] && !(Number(f[k]) >= 0 && /^\d+(\.\d{1,2})?$/.test(f[k]!))) e[k] = "Enter an amount, e.g. 1250.00.";
  }
  return e;
}

export function validateCha(c: ChaAssignment): Partial<Record<keyof ChaAssignment, string>> {
  const e: Partial<Record<keyof ChaAssignment, string>> = {};
  if (!c.company.trim()) e.company = "Enter the broker's company name.";
  if (c.company.length > 120) e.company = "Keep this under 120 characters.";
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) e.email = "Enter a valid email address.";
  if (c.phone && !/^[+\d][\d\s()-]{5,}$/.test(c.phone)) e.phone = "Enter a valid phone number.";
  if ((c.notes ?? "").length > 500) e.notes = "Keep notes under 500 characters.";
  return e;
}

/* ------------------------------------------------------------------------ */
/* Mock data                                                                 */
/* ------------------------------------------------------------------------ */

const HARBOURLINE: ChaAssignment = {
  company: "Harbourline Customs Services (demo)",
  contactPerson: "R. Menon",
  email: "jobs@harbourline.example",
  phone: "+91 22 5555 0190",
  licenseRef: "Demo licence ref. HCS-0412",
};

const AL_MARSA: ChaAssignment = {
  company: "Al Marsa Clearing (demo)",
  contactPerson: "S. Haddad",
  email: "ops@almarsa.example",
  phone: "+971 4 555 0177",
  licenseRef: "Demo ref. AMC-2207",
};

export const MOCK_CUSTOMS_CASES: readonly CustomsCase[] = [
  // Historical: delivered shipment, cleared (Filed / Cleared are historical shipment records).
  {
    id: "CUS-2026-0001",
    shipmentId: "SHP-2026-0001",
    orderId: "ORD-2026-0001",
    requirementId: "RFQ-2026-0038",
    supplierId: "sup-blacksea",
    createdAt: "2026-08-01T06:00:00Z",
    events: [
      { id: "c1", type: "created", by: "importer", at: "2026-08-01T06:00:00Z" },
      { id: "c2", type: "cha-assigned", by: "importer", at: "2026-08-01T06:10:00Z", cha: HARBOURLINE },
      { id: "c3", type: "declaration-updated", by: "importer", at: "2026-08-05T07:00:00Z", fields: { declarationReference: "HCS/JOB/2026/0812 (demo)" } },
      {
        id: "c4",
        type: "handoff-recorded",
        by: "importer",
        at: "2026-08-10T09:00:00Z",
        handoff: {
          cha: HARBOURLINE,
          declarationVersion: 2,
          declaration: { hsCode: "1512.19", invoiceNumber: "BSA/INV/2026/0412", quantity: "100", countryOfOrigin: "Ukraine", portOfImport: "Nhava Sheva" },
          documentIds: ["DOC-2026-0001-CI", "DOC-2026-0001-PL", "DOC-2026-0001-COO", "DOC-2026-0001-CERT1", "DOC-2026-0001-TD"],
          note: "Originals couriered to the broker.",
        },
      },
    ],
  },
  // In transit: handed to the broker; one clarification answered and resolved.
  {
    id: "CUS-2026-0002",
    shipmentId: "SHP-2026-0002",
    orderId: "ORD-2026-0002",
    requirementId: "RFQ-2026-0039",
    supplierId: "sup-punjab",
    createdAt: "2026-09-24T07:00:00Z",
    events: [
      { id: "c1", type: "created", by: "importer", at: "2026-09-24T07:00:00Z" },
      { id: "c2", type: "cha-assigned", by: "importer", at: "2026-09-24T07:05:00Z", cha: AL_MARSA },
      { id: "c3", type: "declaration-updated", by: "importer", at: "2026-10-02T06:00:00Z", fields: { declarationReference: "AMC-JOB-26-1044 (demo)" } },
      {
        id: "c4",
        type: "handoff-recorded",
        by: "importer",
        at: "2026-10-04T06:00:00Z",
        handoff: {
          cha: AL_MARSA,
          declarationVersion: 2,
          declaration: { hsCode: "1006.30", invoiceNumber: "PGI/EXP/2026/0931", quantity: "250", countryOfOrigin: "India", portOfImport: "Jebel Ali" },
          documentIds: ["DOC-2026-0002-CI", "DOC-2026-0002-PL", "DOC-2026-0002-COO", "DOC-2026-0002-CERT1", "DOC-2026-0002-CERT2", "DOC-2026-0002-TD"],
          note: "Pre-arrival handoff; originals follow by courier.",
        },
      },
      { id: "c5", type: "clarification-recorded", by: "customs-broker", at: "2026-10-06T08:00:00Z", demo: true, clarificationId: "CLR-1", question: "Please confirm package count." },
      { id: "c6", type: "clarification-responded", by: "importer", at: "2026-10-06T10:30:00Z", clarificationId: "CLR-1", response: "10,000 bags of 25 kg, as per packing list PGI/PL/2026/0931." },
      { id: "c7", type: "clarification-resolved", by: "customs-broker", at: "2026-10-07T06:00:00Z", demo: true, clarificationId: "CLR-1" },
    ],
  },
  // Preparing: documents outstanding and no broker yet.
  {
    id: "CUS-2026-0003",
    shipmentId: "SHP-2026-0003",
    orderId: "ORD-2026-0003",
    requirementId: "RFQ-2026-0040",
    supplierId: "sup-coimbatore",
    createdAt: "2026-10-06T05:00:00Z",
    events: [{ id: "c1", type: "created", by: "importer", at: "2026-10-06T05:00:00Z" }],
  },
];
