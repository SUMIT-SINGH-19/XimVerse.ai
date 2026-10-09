/**
 * Orders: confirmed procurement transactions created from an agreed
 * negotiation, each with one Purchase Order.
 *
 * An order references its requirement, quotation, negotiation and supplier by
 * ID, but keeps a FIXED snapshot of the agreed commercial terms, so later
 * changes elsewhere never alter it. Status is derived from its events.
 *
 * Mock orders are fictional demo data tied to existing mock records.
 */

import { formatPrice, formatQuantity, MOCK_NOW, type Currency, type ImportRequirement, type Incoterm, type PaymentTerm, type QuantityUnit } from "./import-requirements";
import { negotiationStatus, quotationOf, type Negotiation } from "./importer-negotiations";

/* ------------------------------------------------------------------------ */
/* Types                                                                     */
/* ------------------------------------------------------------------------ */

/** The commercial terms an order was placed on, copied from the agreement. */
export interface AgreedOrderTerms {
  productName: string;
  specification: string;
  hsCode?: string;
  quantity: { amount: number; unit: QuantityUnit };
  unitPrice: number;
  currency: Currency;
  incoterm: Incoterm;
  namedPlace: string;
  paymentTerm: PaymentTerm;
  advancePercent: number;
  paymentSummary: string;
  leadTimeDays: number;
  packaging?: string;
  inspection?: string;
  /** Last commercial note on the agreed terms, if any. */
  commercialNote?: string;
  /** ISO timestamp of the agreement the terms come from. */
  agreedAt: string;
}

export interface OrderContact {
  name: string;
  email: string;
  phone?: string;
}

export interface PurchaseOrder {
  number: string;
  /** YYYY-MM-DD */
  issueDate: string;
  /** YYYY-MM-DD */
  requiredBy: string;
  buyerReference?: string;
  internalReference?: string;
  billingAddress: string;
  deliveryAddress: string;
  contact: OrderContact;
  buyerInstructions?: string;
  supplierInstructions?: string;
  additionalTerms?: string;
}

export type OrderStatus = "po-ready" | "awaiting-confirmation" | "confirmed" | "pre-shipment" | "completed" | "cancelled";

export const ORDER_STATUSES: readonly { id: OrderStatus; label: string }[] = [
  { id: "po-ready", label: "PO Ready" },
  { id: "awaiting-confirmation", label: "Awaiting Supplier Confirmation" },
  { id: "confirmed", label: "Confirmed" },
  { id: "pre-shipment", label: "Pre-Shipment" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export type OrderEventType =
  | "created"
  | "po-prepared"
  | "po-issued"
  | "supplier-confirmed"
  | "pre-shipment"
  | "completed"
  | "cancelled";

export interface OrderEvent {
  id: string;
  type: OrderEventType;
  by: "importer" | "supplier" | "system";
  /** ISO timestamp. */
  at: string;
  note?: string;
  /** Recorded with a demo action — no real supplier involved. */
  demo?: boolean;
}

export const ORDER_EVENT_LABEL: Record<OrderEventType, string> = {
  created: "Order created",
  "po-prepared": "Purchase Order prepared",
  "po-issued": "Purchase Order marked as issued",
  "supplier-confirmed": "Supplier confirmation recorded",
  "pre-shipment": "Order moved to Pre-Shipment",
  completed: "Order completed",
  cancelled: "Order cancelled",
};

export interface Order {
  id: string;
  requirementId: string;
  quotationId: string;
  negotiationId: string;
  supplierId: string;
  /** ISO timestamp. */
  createdAt: string;
  terms: AgreedOrderTerms;
  purchaseOrder: PurchaseOrder;
  events: OrderEvent[];
  /** Created in this browser session rather than part of the demo data. */
  local?: boolean;
}

export const ORDER_ID_PATTERN = /^ORD-\d{4}-\d{4,}$/;

/* ------------------------------------------------------------------------ */
/* Derivations                                                               */
/* ------------------------------------------------------------------------ */

export function orderStatus(o: Order): OrderStatus {
  const types = new Set(o.events.map((e) => e.type));
  if (types.has("cancelled")) return "cancelled";
  if (types.has("completed")) return "completed";
  if (types.has("pre-shipment")) return "pre-shipment";
  if (types.has("supplier-confirmed")) return "confirmed";
  if (types.has("po-issued")) return "awaiting-confirmation";
  return "po-ready";
}

export function isActiveOrder(o: Order): boolean {
  const s = orderStatus(o);
  return s !== "completed" && s !== "cancelled";
}

export function orderUpdatedAt(o: Order): string {
  return o.events.reduce((latest, e) => (e.at > latest ? e.at : latest), o.createdAt);
}

export function orderValue(t: AgreedOrderTerms): number {
  return t.unitPrice * t.quantity.amount;
}

export function formatOrderValue(t: AgreedOrderTerms): string {
  return formatPrice(orderValue(t), t.currency);
}

const SINGULAR: Record<QuantityUnit, string> = { KG: "kg", MT: "MT", UNITS: "unit", LITRES: "litre", CBM: "CBM", CONTAINERS: "container" };

export function formatOrderUnitPrice(t: AgreedOrderTerms): string {
  return `${formatPrice(t.unitPrice, t.currency)} / ${SINGULAR[t.quantity.unit]}`;
}

export function formatOrderQuantity(t: AgreedOrderTerms): string {
  return formatQuantity(t.quantity);
}

export function orderForNegotiation(negotiationId: string, orders: readonly Order[]): Order | undefined {
  return orders.find((o) => o.negotiationId === negotiationId);
}

export function nextOrderId(existing: readonly Order[], year: number): string {
  const max = existing.reduce((m, o) => Math.max(m, Number(o.id.split("-")[2]) || 0), 0);
  return `ORD-${year}-${String(max + 1).padStart(4, "0")}`;
}

export function nextPoNumber(existing: readonly Order[], year: number): string {
  const max = existing.reduce((m, o) => Math.max(m, Number(o.purchaseOrder.number.match(/(\d+)$/)?.[1]) || 0), 0);
  return `PO-${year}-${String(max + 1).padStart(4, "0")}`;
}

/** Copies the agreed terms from a negotiation's agreement event. */
export function termsFromAgreement(n: Negotiation, requirement: ImportRequirement): AgreedOrderTerms | undefined {
  const agreement = [...n.events].reverse().find((e) => e.type === "agreement");
  const offer = agreement?.offer;
  if (!agreement || !offer) return undefined;
  const quote = quotationOf(n);
  const note = [...n.events].reverse().find((e) => e.offer && e.note)?.note;
  return {
    productName: requirement.product.name,
    specification: quote.product.description,
    hsCode: quote.product.hsCode ?? requirement.product.hsCode,
    quantity: { ...offer.quantity },
    unitPrice: offer.unitPrice,
    currency: offer.currency,
    incoterm: offer.incoterm,
    namedPlace: offer.namedPlace,
    paymentTerm: offer.paymentTerm,
    advancePercent: offer.advancePercent,
    paymentSummary: offer.paymentSummary,
    leadTimeDays: offer.leadTimeDays,
    packaging: offer.packaging,
    inspection: offer.inspection,
    commercialNote: note,
    agreedAt: agreement.at,
  };
}

export type OrderEligibility =
  | { ok: true }
  | { ok: false; reason: "not-found" | "not-agreed" | "not-selected" | "supplier-mismatch" | "order-exists" | "invalid-terms"; order?: Order };

/** Whether an order may be created from this negotiation's agreement. */
export function orderEligibility(
  n: Negotiation | undefined,
  requirement: ImportRequirement | undefined,
  orders: readonly Order[],
): OrderEligibility {
  if (!n || !requirement) return { ok: false, reason: "not-found" };
  const existing = orderForNegotiation(n.id, orders);
  if (existing) return { ok: false, reason: "order-exists", order: existing };
  if (negotiationStatus(n) !== "agreed") return { ok: false, reason: "not-agreed" };
  if (requirement.selection?.negotiationId !== n.id) return { ok: false, reason: "not-selected" };
  if (quotationOf(n).supplierId !== n.supplierId || requirement.selection.supplierId !== n.supplierId) {
    return { ok: false, reason: "supplier-mismatch" };
  }
  const terms = termsFromAgreement(n, requirement);
  if (!terms || terms.unitPrice <= 0 || terms.quantity.amount <= 0) return { ok: false, reason: "invalid-terms" };
  return { ok: true };
}

/* ------------------------------------------------------------------------ */
/* Pre-shipment readiness (summary only)                                     */
/* ------------------------------------------------------------------------ */

export type ReadinessState = "complete" | "pending" | "not-started";

export const READINESS_LABEL: Record<ReadinessState, string> = {
  complete: "Complete",
  pending: "Pending",
  "not-started": "Not Started",
};

export interface PreShipmentReadinessItem {
  id: string;
  label: string;
  state: ReadinessState;
}

/** A summary derived from the order status. The underlying workflows are not built. */
export function preShipmentReadiness(o: Order): PreShipmentReadinessItem[] {
  const s = orderStatus(o);
  const confirmed = s === "confirmed" || s === "pre-shipment" || s === "completed";
  const preShip = s === "pre-shipment";
  const done = s === "completed";
  const docs: ReadinessState = done ? "complete" : preShip ? "pending" : "not-started";
  return [
    { id: "po", label: "Purchase Order", state: "complete" },
    { id: "confirmation", label: "Supplier Confirmation", state: confirmed ? "complete" : s === "cancelled" ? "not-started" : "pending" },
    { id: "invoice", label: "Commercial Invoice", state: docs },
    { id: "packing", label: "Packing List", state: docs },
    { id: "coo", label: "Certificate of Origin", state: docs },
    { id: "freight", label: "Freight Booking", state: done ? "complete" : preShip ? "pending" : "not-started" },
    { id: "customs", label: "Customs Documentation", state: done ? "complete" : "not-started" },
  ];
}

/* ------------------------------------------------------------------------ */
/* Mock data                                                                 */
/* ------------------------------------------------------------------------ */

const BUYER_BILLING = "Unit 1204, Trade Centre, Bandra Kurla Complex\nMumbai 400051, Maharashtra, India";
const BUYER_CONTACT: OrderContact = { name: "Demo User", email: "procurement@meridian-imports.example", phone: "+91 22 5555 0142" };

const ev = (id: string, type: OrderEventType, at: string, by: OrderEvent["by"] = "importer", note?: string): OrderEvent => ({ id, type, at, by, note });

export const MOCK_ORDERS: readonly Order[] = [
  {
    id: "ORD-2026-0001",
    requirementId: "RFQ-2026-0038",
    quotationId: "QT-2026-0071",
    negotiationId: "NG-2026-0007",
    supplierId: "sup-blacksea",
    createdAt: "2026-06-19T06:00:00Z",
    terms: {
      productName: "Refined Sunflower Oil",
      specification: "Refined, deodorised, winterised sunflower oil. FFA 0.1% max, peroxide value 2 meq/kg max.",
      hsCode: "1512.19",
      quantity: { amount: 100, unit: "MT" },
      unitPrice: 1105,
      currency: "USD",
      incoterm: "CFR",
      namedPlace: "Nhava Sheva (Mumbai)",
      paymentTerm: "dp",
      advancePercent: 0,
      paymentSummary: "D/P at sight",
      leadTimeDays: 18,
      packaging: "Flexitanks in 20 ft containers",
      inspection: "Independent surveyor at loading port.",
      agreedAt: "2026-06-18T09:00:00Z",
    },
    purchaseOrder: {
      number: "PO-2026-0001",
      issueDate: "2026-06-19",
      requiredBy: "2026-08-25",
      buyerReference: "MI/EO/2026/031",
      billingAddress: BUYER_BILLING,
      deliveryAddress: "Meridian Imports Pvt. Ltd. — Consignee\nc/o JNPT Warehouse 7, Nhava Sheva\nNavi Mumbai 400707, India",
      contact: BUYER_CONTACT,
      supplierInstructions: "Quote PO number on all shipping documents.",
    },
    events: [
      ev("e1", "created", "2026-06-19T06:00:00Z"),
      ev("e2", "po-prepared", "2026-06-19T06:00:00Z", "system"),
      ev("e3", "po-issued", "2026-06-19T08:00:00Z"),
      ev("e4", "supplier-confirmed", "2026-06-21T10:00:00Z", "supplier"),
      ev("e5", "pre-shipment", "2026-07-02T07:00:00Z"),
      ev("e6", "completed", "2026-08-28T12:00:00Z", "importer", "Goods received at Nhava Sheva."),
    ],
  },
  {
    id: "ORD-2026-0002",
    requirementId: "RFQ-2026-0039",
    quotationId: "QT-2026-0072",
    negotiationId: "NG-2026-0008",
    supplierId: "sup-punjab",
    createdAt: "2026-07-25T05:30:00Z",
    terms: {
      productName: "Basmati Rice",
      specification: "1121 Steam Basmati, average grain length 8.35 mm, moisture 12.5% max, broken 2% max.",
      hsCode: "1006.30",
      quantity: { amount: 250, unit: "MT" },
      unitPrice: 985,
      currency: "USD",
      incoterm: "FOB",
      namedPlace: "Mundra",
      paymentTerm: "advance",
      advancePercent: 20,
      paymentSummary: "20% advance / 80% against documents",
      leadTimeDays: 14,
      packaging: "25 kg PP bags",
      inspection: "SGS (or equivalent) pre-shipment inspection at loading port accepted.",
      commercialNote: "We can accept FOB if the advance is reduced to 20%.",
      agreedAt: "2026-07-24T08:30:00Z",
    },
    purchaseOrder: {
      number: "PO-2026-0002",
      issueDate: "2026-07-25",
      requiredBy: "2026-10-20",
      buyerReference: "MI/JA/2026/044",
      billingAddress: BUYER_BILLING,
      deliveryAddress: "Meridian Imports — consignee per buyer's nomination\nJebel Ali Free Zone, Dubai, UAE",
      contact: BUYER_CONTACT,
      buyerInstructions: "Buyer to nominate vessel at least 10 days before readiness.",
      additionalTerms: "Weight and quality final at load port as per SGS certificate.",
    },
    events: [
      ev("e1", "created", "2026-07-25T05:30:00Z"),
      ev("e2", "po-prepared", "2026-07-25T05:30:00Z", "system"),
      ev("e3", "po-issued", "2026-07-25T07:00:00Z"),
      ev("e4", "supplier-confirmed", "2026-07-27T09:30:00Z", "supplier"),
      ev("e5", "pre-shipment", "2026-09-20T06:00:00Z"),
    ],
  },
  {
    id: "ORD-2026-0003",
    requirementId: "RFQ-2026-0040",
    quotationId: "QT-2026-0073",
    negotiationId: "NG-2026-0009",
    supplierId: "sup-coimbatore",
    createdAt: "2026-08-13T06:00:00Z",
    terms: {
      productName: "Compact Cotton Yarn",
      specification: "40s combed compact cotton yarn, 100% cotton, for weaving and knitting.",
      hsCode: "5205.26",
      quantity: { amount: 20_000, unit: "KG" },
      unitPrice: 3.39,
      currency: "USD",
      incoterm: "CFR",
      namedPlace: "Chittagong",
      paymentTerm: "lc",
      advancePercent: 0,
      paymentSummary: "LC at sight",
      leadTimeDays: 21,
      packaging: "Cartons on pallets",
      inspection: "Mill test certificate with each lot.",
      agreedAt: "2026-08-12T10:00:00Z",
    },
    purchaseOrder: {
      number: "PO-2026-0003",
      issueDate: "2026-08-13",
      requiredBy: "2026-10-30",
      billingAddress: BUYER_BILLING,
      deliveryAddress: "Consignee: Meridian Textiles Partner, Chattogram EPZ\nChittagong 4223, Bangladesh",
      contact: BUYER_CONTACT,
    },
    events: [
      ev("e1", "created", "2026-08-13T06:00:00Z"),
      ev("e2", "po-prepared", "2026-08-13T06:00:00Z", "system"),
      ev("e3", "po-issued", "2026-08-13T09:00:00Z"),
      ev("e4", "supplier-confirmed", "2026-08-16T05:00:00Z", "supplier"),
    ],
  },
  {
    id: "ORD-2026-0004",
    requirementId: "RFQ-2026-0041",
    quotationId: "QT-2026-0074",
    negotiationId: "NG-2026-0010",
    supplierId: "sup-indus",
    createdAt: "2026-09-03T07:00:00Z",
    terms: {
      productName: "Red Lentils",
      specification: "Red lentils (masoor), split, machine cleaned and sortexed.",
      hsCode: "0713.40",
      quantity: { amount: 100, unit: "MT" },
      unitPrice: 832,
      currency: "USD",
      incoterm: "CIF",
      namedPlace: "Nhava Sheva",
      paymentTerm: "lc",
      advancePercent: 0,
      paymentSummary: "LC at sight",
      leadTimeDays: 15,
      packaging: "50 kg PP bags",
      inspection: "Third-party inspection at the buyer's cost.",
      agreedAt: "2026-09-02T09:00:00Z",
    },
    purchaseOrder: {
      number: "PO-2026-0004",
      issueDate: "2026-09-03",
      requiredBy: "2026-11-15",
      buyerReference: "MI/NS/2026/052",
      billingAddress: BUYER_BILLING,
      deliveryAddress: "Meridian Imports Pvt. Ltd. — Consignee\nc/o JNPT Warehouse 7, Nhava Sheva\nNavi Mumbai 400707, India",
      contact: BUYER_CONTACT,
      supplierInstructions: "Phytosanitary certificate to accompany original documents.",
    },
    events: [
      ev("e1", "created", "2026-09-03T07:00:00Z"),
      ev("e2", "po-prepared", "2026-09-03T07:00:00Z", "system"),
      ev("e3", "po-issued", "2026-09-04T06:00:00Z"),
    ],
  },
  {
    id: "ORD-2026-0005",
    requirementId: "RFQ-2026-0042",
    quotationId: "QT-2026-0075",
    negotiationId: "NG-2026-0011",
    supplierId: "sup-pampas",
    createdAt: "2026-09-19T05:00:00Z",
    terms: {
      productName: "Refined Soybean Oil",
      specification: "Refined, bleached, deodorised soybean oil. FFA 0.1% max.",
      hsCode: "1507.90",
      quantity: { amount: 200, unit: "MT" },
      unitPrice: 1070,
      currency: "USD",
      incoterm: "FOB",
      namedPlace: "Rosario",
      paymentTerm: "lc",
      advancePercent: 0,
      paymentSummary: "LC at sight",
      leadTimeDays: 25,
      packaging: "Flexitanks in 20 ft containers",
      inspection: "Independent surveyor at loading port.",
      commercialNote: "Need loading by early November.",
      agreedAt: "2026-09-18T08:00:00Z",
    },
    purchaseOrder: {
      number: "PO-2026-0005",
      issueDate: "2026-09-19",
      requiredBy: "2026-12-05",
      billingAddress: BUYER_BILLING,
      deliveryAddress: "Meridian Imports Pvt. Ltd. — Consignee\nc/o JNPT Warehouse 7, Nhava Sheva\nNavi Mumbai 400707, India",
      contact: BUYER_CONTACT,
      buyerInstructions: "Freight to be arranged by buyer; supplier to advise readiness 7 days in advance.",
    },
    events: [ev("e1", "created", "2026-09-19T05:00:00Z"), ev("e2", "po-prepared", "2026-09-19T05:00:00Z", "system")],
  },
];

/** The snapshot date of the demo data, for relative date filters. */
export const ORDERS_NOW = MOCK_NOW;
