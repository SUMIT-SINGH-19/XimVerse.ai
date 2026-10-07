/**
 * Data behind the Freight Forwarder overview dashboard.
 *
 * Everything here is MOCK data, shaped the way an API response for the
 * dashboard is likely to look. When the backend exists, replace
 * `getFreightForwarderDashboard()` with a fetch and keep the types.
 *
 * The operating model the dashboard reflects:
 *
 *   Shipment request / RFQ → review cargo → freight quote → quote accepted
 *   → carrier booking → pickup / container planning → documentation
 *   → CHA coordination → customs clearance (by the CHA) → departure
 *   → in-transit tracking → destination handoff → billing → completed.
 *
 * The forwarder owns freight, carriers, equipment, transport and BL / AWB.
 * Customs filing belongs to the CHA and shipment data to the exporter, so
 * most items record who they are waiting on.
 */

/* ------------------------------------------------------------------------ */
/* Shared vocabulary                                                         */
/* ------------------------------------------------------------------------ */

export type TransportMode = "ocean" | "air" | "road";

export const MODE_LABEL: Record<TransportMode, string> = {
  ocean: "Ocean",
  air: "Air",
  road: "Road",
};

/** Parties a shipment can be waiting on. "forwarder" is the signed-in team. */
export type Stakeholder =
  | "forwarder"
  | "exporter"
  | "importer"
  | "cha"
  | "customs"
  | "carrier"
  | "transporter";

export const STAKEHOLDER_LABEL: Record<Stakeholder, string> = {
  forwarder: "You",
  exporter: "Exporter",
  importer: "Importer",
  cha: "CHA",
  customs: "Customs",
  carrier: "Carrier",
  transporter: "Transporter",
};

export interface Lane {
  origin: string;
  destination: string;
}

export type Incoterm = "EXW" | "FCA" | "FOB" | "CFR" | "CIF" | "CIP" | "DAP" | "DDP";

/* ------------------------------------------------------------------------ */
/* Summary                                                                   */
/* ------------------------------------------------------------------------ */

/** Headline counts across the whole book of business, not just the rows shown. */
export interface FreightForwarderSummary {
  activeShipments: { total: number; byMode: Record<TransportMode, number> };
  newRfqs: { total: number; dueToday: number };
  confirmedBookings: { total: number; departingThisWeek: number };
  inTransit: { total: number; lanes: number };
}

/* ------------------------------------------------------------------------ */
/* Action required                                                           */
/* ------------------------------------------------------------------------ */

export type ActionKind =
  | "quote-required"
  | "documentation-pending"
  | "carrier-confirmation"
  | "cha-awaiting-documents"
  | "exception";

export const ACTION_KIND_LABEL: Record<ActionKind, string> = {
  "quote-required": "Quote Required",
  "documentation-pending": "Documentation Pending",
  "carrier-confirmation": "Carrier Confirmation Pending",
  "cha-awaiting-documents": "CHA Awaiting Documents",
  exception: "Exception",
};

export type Urgency = "critical" | "high" | "medium";

const URGENCY_RANK: Record<Urgency, number> = { critical: 0, high: 1, medium: 2 };

export interface FreightAction {
  id: string;
  kind: ActionKind;
  /** RFQ or shipment the action belongs to. */
  reference: string;
  title: string;
  detail: string;
  urgency: Urgency;
  /** Hard deadline, as an ISO timestamp. */
  deadline?: string;
  waitingOn?: Stakeholder;
  cta: string;
  /** Workspace section the call to action opens. */
  destination: string;
}

/* ------------------------------------------------------------------------ */
/* RFQs and quotes                                                           */
/* ------------------------------------------------------------------------ */

export type RfqStatus = "new" | "reviewing" | "quoted";

export const RFQ_STATUS_LABEL: Record<RfqStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  quoted: "Quoted",
};

export const RFQ_CTA: Record<RfqStatus, string> = {
  new: "Prepare Quote",
  reviewing: "Continue Quote",
  quoted: "View Quote",
};

export interface FreightRFQ {
  id: string;
  customer: { name: string; role: "exporter" | "importer" };
  lane: Lane;
  mode: TransportMode;
  cargo: string;
  weightKg: number;
  volumeCbm?: number;
  /** Container, ULD or vehicle requested, e.g. "20 FT Dry". */
  equipment: string;
  incoterm: Incoterm;
  /** YYYY-MM-DD. */
  requiredDeparture: string;
  /** When the customer needs the quote by, as an ISO timestamp. */
  quoteDeadline: string;
  status: RfqStatus;
}

export type QuoteStatus = "accepted" | "awaiting" | "declined";

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  accepted: "Accepted",
  awaiting: "Awaiting Response",
  declined: "Declined",
};

export interface FreightQuote {
  id: string;
  rfqId: string;
  customer: string;
  lane: Lane;
  mode: TransportMode;
  /** All-in freight amount in INR. */
  amount: number;
  status: QuoteStatus;
  sentAt: string;
}

export interface CommercialOverview {
  quotesSent: number;
  quotesAccepted: number;
  /** INR, confirmed this month. */
  revenueConfirmed: number;
  /** INR, invoiced and not yet paid. */
  receivables: number;
  avgResponseMinutes: number;
  recentQuotes: readonly FreightQuote[];
}

/* ------------------------------------------------------------------------ */
/* Shipments                                                                 */
/* ------------------------------------------------------------------------ */

/** The forwarder's view of a shipment's journey, in order. */
export const SHIPMENT_STAGES = [
  { id: "booking-confirmed", label: "Booking Confirmed" },
  { id: "pickup-scheduled", label: "Pickup Scheduled" },
  { id: "container-loaded", label: "Container Loaded" },
  { id: "customs-clearance", label: "Customs Clearance" },
  { id: "awaiting-leo", label: "Awaiting LEO" },
  { id: "gate-in", label: "Gate In" },
  { id: "departed", label: "Departed" },
  { id: "in-transit", label: "In Transit" },
  { id: "arrived", label: "Arrived" },
  { id: "destination-handoff", label: "Destination Handoff" },
] as const;

export type ShipmentStage = (typeof SHIPMENT_STAGES)[number]["id"];

export function stageIndex(stage: ShipmentStage): number {
  return SHIPMENT_STAGES.findIndex((s) => s.id === stage);
}

/** Stage name, with the departure worded for the mode ("Vessel Departed"). */
export function stageLabel(stage: ShipmentStage, mode: TransportMode): string {
  if (stage === "departed") {
    return { ocean: "Vessel Departed", air: "Flight Departed", road: "Dispatched" }[mode];
  }
  if (stage === "container-loaded" && mode !== "ocean") return "Cargo Loaded";
  return SHIPMENT_STAGES[stageIndex(stage)].label;
}

export type ShipmentHealth = "on-track" | "attention" | "delayed";

export const SHIPMENT_HEALTH_LABEL: Record<ShipmentHealth, string> = {
  "on-track": "On Track",
  attention: "Attention",
  delayed: "Delayed",
};

const HEALTH_RANK: Record<ShipmentHealth, number> = { delayed: 0, attention: 1, "on-track": 2 };

export interface FreightShipment {
  id: string;
  customer: string;
  lane: Lane;
  mode: TransportMode;
  /** Shipping line, airline or trucking company. */
  carrier: string;
  /** Container number, AWB or vehicle number, depending on the mode. */
  reference: string;
  stage: ShipmentStage;
  /** YYYY-MM-DD. */
  etd: string;
  eta: string;
  health: ShipmentHealth;
  /** Who the next step depends on, when it isn't simply moving. */
  waitingOn?: Stakeholder;
}

export const REFERENCE_LABEL: Record<TransportMode, string> = {
  ocean: "Container",
  air: "AWB",
  road: "Vehicle",
};

/** Count of shipments at each step of the funnel, from RFQ to delivery. */
export interface PipelineStage {
  id: string;
  label: string;
  count: number;
  phase: "commercial" | "execution" | "done";
}

/* ------------------------------------------------------------------------ */
/* Departures and bookings                                                   */
/* ------------------------------------------------------------------------ */

export interface UpcomingDeparture {
  shipmentId: string;
  exporter: string;
  lane: Lane;
  mode: TransportMode;
  carrier: string;
  /** Vessel and voyage, or flight number. */
  voyage: string;
  /** Carrier cut-off, as an ISO timestamp. */
  cutoff: string;
  etd: string;
  equipment: string;
  /** Pre-departure checklist: how many items, and which are still open. */
  checklist: { total: number; pending: readonly string[] };
}

export function readiness(departure: UpcomingDeparture): number {
  const { total, pending } = departure.checklist;
  return Math.round(((total - pending.length) / total) * 100);
}

export type BookingStatus =
  | "confirmed"
  | "pending"
  | "space-requested"
  | "rolled-over"
  | "equipment-pending";

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  "space-requested": "Space Requested",
  "rolled-over": "Rolled Over",
  "equipment-pending": "Equipment Pending",
};

export interface CarrierBooking {
  id: string;
  carrier: string;
  bookingNumber: string;
  shipmentId: string;
  voyage: string;
  status: BookingStatus;
  equipment: string;
  cutoff: string;
  /** When the carrier confirmed, as an ISO timestamp. */
  confirmedAt?: string;
}

/* ------------------------------------------------------------------------ */
/* Documents                                                                 */
/* ------------------------------------------------------------------------ */

export type ShipmentDocument =
  | "commercial-invoice"
  | "packing-list"
  | "shipping-bill"
  | "shipping-instructions"
  | "bl-draft"
  | "certificate-of-origin"
  | "vgm"
  | "e-way-bill"
  | "insurance-certificate"
  | "container-details";

export const DOCUMENT_LABEL: Record<ShipmentDocument, string> = {
  "commercial-invoice": "Commercial Invoice",
  "packing-list": "Packing List",
  "shipping-bill": "Shipping Bill",
  "shipping-instructions": "Shipping Instructions",
  "bl-draft": "Bill of Lading Draft",
  "certificate-of-origin": "Certificate of Origin",
  vgm: "VGM",
  "e-way-bill": "e-Way Bill",
  "insurance-certificate": "Insurance Certificate",
  "container-details": "Container Details",
};

export type DocumentState =
  | "ready"
  | "generated"
  | "under-review"
  | "pending-exporter"
  | "pending-cha"
  | "pending-carrier"
  | "issue";

export const DOCUMENT_STATE_LABEL: Record<DocumentState, string> = {
  ready: "Ready",
  generated: "Generated",
  "under-review": "Under Review",
  "pending-exporter": "Pending Exporter",
  "pending-cha": "Pending CHA",
  "pending-carrier": "Pending Carrier",
  issue: "Issue",
};

export interface DocumentStatus {
  id: string;
  shipmentId: string;
  document: ShipmentDocument;
  state: DocumentState;
  note?: string;
}

export interface DocumentationOverview {
  /** Document counts across all active shipments. */
  totals: { ready: number; pending: number; issues: number };
  /** The documents most likely to hold up a departure. */
  priority: readonly DocumentStatus[];
}

/* ------------------------------------------------------------------------ */
/* CHA coordination, exceptions, activity                                    */
/* ------------------------------------------------------------------------ */

export interface CHAUpdate {
  id: string;
  shipmentId: string;
  cha: string;
  customsStage: string;
  at: string;
  pendingFrom: Stakeholder;
  action: { label: string; kind: "track" | "request" | "send" };
}

export type Severity = "critical" | "warning" | "info";

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

export interface ShipmentException {
  id: string;
  shipmentId: string;
  title: string;
  detail: string;
  severity: Severity;
  raisedAt: string;
  /** Who to contact to resolve it. */
  stakeholder: { role: Stakeholder; name: string };
}

export interface FreightActivity {
  id: string;
  at: string;
  actor: Stakeholder;
  message: string;
  reference: string;
}

export interface SUMITInsight {
  id: string;
  reference: string;
  message: string;
  severity: Severity;
}

/* ------------------------------------------------------------------------ */
/* The dashboard payload                                                     */
/* ------------------------------------------------------------------------ */

export interface FreightForwarderDashboardData {
  /** When this snapshot was produced; deadlines and relative times use it. */
  asOf: string;
  /** Time zone the team works in; clock times are shown in it. */
  timeZone: string;
  user: { firstName: string };
  summary: FreightForwarderSummary;
  actions: readonly FreightAction[];
  rfqs: readonly FreightRFQ[];
  shipments: readonly FreightShipment[];
  pipeline: readonly PipelineStage[];
  departures: readonly UpcomingDeparture[];
  documents: DocumentationOverview;
  chaUpdates: readonly CHAUpdate[];
  bookings: readonly CarrierBooking[];
  exceptions: readonly ShipmentException[];
  commercial: CommercialOverview;
  activity: readonly FreightActivity[];
  sumit: readonly SUMITInsight[];
}

/* ------------------------------------------------------------------------ */
/* Mock snapshot: 09:00 IST, Wednesday 7 October 2026                        */
/* ------------------------------------------------------------------------ */

const MOCK_DASHBOARD: FreightForwarderDashboardData = {
  asOf: "2026-10-07T03:30:00Z",
  timeZone: "Asia/Kolkata",
  user: { firstName: "Rahul" },

  summary: {
    activeShipments: { total: 24, byMode: { ocean: 8, air: 11, road: 5 } },
    newRfqs: { total: 9, dueToday: 4 },
    confirmedBookings: { total: 17, departingThisWeek: 6 },
    inTransit: { total: 12, lanes: 7 },
  },

  actions: [
    {
      id: "act-1",
      kind: "exception",
      reference: "XMV-1028",
      title: "Container pickup delayed by 5 hours",
      detail: "Truck for CMAU-3318402 now expected at 2:00 PM; ETD 11 Oct still holds.",
      urgency: "critical",
      waitingOn: "transporter",
      cta: "Resolve",
      destination: "shipments",
    },
    {
      id: "act-2",
      kind: "quote-required",
      reference: "RFQ-2048",
      title: "Rice Export — Bengaluru → Jebel Ali",
      detail: "20 FT container · 18,500 kg · CIF",
      urgency: "high",
      deadline: "2026-10-07T05:45:00Z",
      cta: "Prepare Quote",
      destination: "rfqs",
    },
    {
      id: "act-3",
      kind: "cha-awaiting-documents",
      reference: "XMV-1032",
      title: "Commercial Invoice requested",
      detail: "Skyline Customs needs it to file the Shipping Bill before tonight's flight.",
      urgency: "high",
      waitingOn: "forwarder",
      cta: "Send Documents",
      destination: "document-requests",
    },
    {
      id: "act-4",
      kind: "documentation-pending",
      reference: "XMV-1048",
      title: "Missing: Shipping Instructions",
      detail: "Needed to raise the BL draft with the carrier.",
      urgency: "high",
      waitingOn: "exporter",
      cta: "Review Documents",
      destination: "documents",
    },
    {
      id: "act-5",
      kind: "carrier-confirmation",
      reference: "XMV-1039",
      title: "Carrier: Maersk",
      detail: "Booking MAEU-930118 requested yesterday, not yet confirmed.",
      urgency: "medium",
      waitingOn: "carrier",
      cta: "Check Booking",
      destination: "bookings",
    },
  ],

  rfqs: [
    {
      id: "RFQ-2048",
      customer: { name: "GreenHarvest Foods Pvt Ltd", role: "exporter" },
      lane: { origin: "Bengaluru ICD", destination: "Jebel Ali, UAE" },
      mode: "ocean",
      cargo: "Basmati Rice",
      weightKg: 18_500,
      equipment: "20 FT Dry",
      incoterm: "CIF",
      requiredDeparture: "2026-10-12",
      quoteDeadline: "2026-10-07T05:45:00Z",
      status: "new",
    },
    {
      id: "RFQ-2047",
      customer: { name: "Kerala Coco Exports", role: "exporter" },
      lane: { origin: "Kochi", destination: "Rotterdam, NL" },
      mode: "ocean",
      cargo: "Desiccated Coconut",
      weightKg: 22_000,
      equipment: "40 FT HC",
      incoterm: "CIF",
      requiredDeparture: "2026-10-16",
      quoteDeadline: "2026-10-07T09:00:00Z",
      status: "reviewing",
    },
    {
      id: "RFQ-2046",
      customer: { name: "Pacific Rim Home Goods Inc.", role: "importer" },
      lane: { origin: "Nhava Sheva", destination: "Los Angeles, US" },
      mode: "ocean",
      cargo: "Cotton Bed Linen",
      weightKg: 14_200,
      volumeCbm: 58,
      equipment: "40 FT HC",
      incoterm: "FOB",
      requiredDeparture: "2026-10-20",
      quoteDeadline: "2026-10-07T12:30:00Z",
      status: "new",
    },
    {
      id: "RFQ-2043",
      customer: { name: "Sundaram Auto Components", role: "exporter" },
      lane: { origin: "Chennai", destination: "Singapore" },
      mode: "ocean",
      cargo: "Brake Assemblies",
      weightKg: 3_900,
      volumeCbm: 6.4,
      equipment: "LCL",
      incoterm: "FOB",
      requiredDeparture: "2026-10-14",
      quoteDeadline: "2026-10-07T10:30:00Z",
      status: "reviewing",
    },
    {
      id: "RFQ-2045",
      customer: { name: "Medisure Formulations", role: "exporter" },
      lane: { origin: "Delhi (DEL)", destination: "Frankfurt (FRA)" },
      mode: "air",
      cargo: "Pharmaceutical Tablets",
      weightKg: 1_250,
      volumeCbm: 7.8,
      equipment: "Loose · 2–8 °C",
      incoterm: "CIP",
      requiredDeparture: "2026-10-10",
      quoteDeadline: "2026-10-08T06:30:00Z",
      status: "new",
    },
  ],

  shipments: [
    {
      id: "XMV-1028",
      customer: "Indus Home Textiles",
      lane: { origin: "Nhava Sheva", destination: "Los Angeles" },
      mode: "ocean",
      carrier: "CMA CGM",
      reference: "CMAU-3318402",
      stage: "pickup-scheduled",
      etd: "2026-10-11",
      eta: "2026-11-06",
      health: "delayed",
      waitingOn: "transporter",
    },
    {
      id: "XMV-1041",
      customer: "GreenHarvest Foods",
      lane: { origin: "Bengaluru", destination: "Jebel Ali" },
      mode: "ocean",
      carrier: "Maersk",
      reference: "MSKU-7834912",
      stage: "customs-clearance",
      etd: "2026-10-09",
      eta: "2026-10-17",
      health: "on-track",
      waitingOn: "cha",
    },
    {
      id: "XMV-1037",
      customer: "CocoPure Exports",
      lane: { origin: "Kochi", destination: "Rotterdam" },
      mode: "ocean",
      carrier: "MSC",
      reference: "MSCU-5940381",
      stage: "gate-in",
      etd: "2026-10-08",
      eta: "2026-10-29",
      health: "attention",
      waitingOn: "carrier",
    },
    {
      id: "XMV-1039",
      customer: "Malabar Spice Traders",
      lane: { origin: "Chennai", destination: "Singapore" },
      mode: "ocean",
      carrier: "Maersk",
      reference: "MSKU-4410276",
      stage: "container-loaded",
      etd: "2026-10-10",
      eta: "2026-10-15",
      health: "attention",
      waitingOn: "exporter",
    },
    {
      id: "XMV-1033",
      customer: "Sunrise Textiles",
      lane: { origin: "Mundra", destination: "Hamburg" },
      mode: "ocean",
      carrier: "Hapag-Lloyd",
      reference: "HLXU-6623190",
      stage: "gate-in",
      etd: "2026-10-10",
      eta: "2026-11-08",
      health: "attention",
      waitingOn: "carrier",
    },
    {
      id: "XMV-1018",
      customer: "Kaveri Electronics",
      lane: { origin: "Chennai (MAA)", destination: "Singapore (SIN)" },
      mode: "air",
      carrier: "Singapore Airlines Cargo",
      reference: "618-55120943",
      stage: "awaiting-leo",
      etd: "2026-10-07",
      eta: "2026-10-08",
      health: "attention",
      waitingOn: "customs",
    },
    {
      id: "XMV-1032",
      customer: "Vertex Auto Components",
      lane: { origin: "Delhi (DEL)", destination: "Frankfurt (FRA)" },
      mode: "air",
      carrier: "Lufthansa Cargo",
      reference: "020-48213376",
      stage: "customs-clearance",
      etd: "2026-10-08",
      eta: "2026-10-09",
      health: "on-track",
      waitingOn: "forwarder",
    },
    {
      id: "XMV-1025",
      customer: "Bengal Jute Mills",
      lane: { origin: "Kolkata", destination: "Dhaka" },
      mode: "road",
      carrier: "VRL Logistics",
      reference: "WB-23-C-4471",
      stage: "in-transit",
      etd: "2026-10-05",
      eta: "2026-10-08",
      health: "on-track",
    },
    {
      id: "XMV-1021",
      customer: "Spice Route Organics",
      lane: { origin: "Kochi", destination: "Rotterdam" },
      mode: "ocean",
      carrier: "MSC",
      reference: "MSCU-7720145",
      stage: "in-transit",
      etd: "2026-09-29",
      eta: "2026-10-21",
      health: "on-track",
    },
  ],

  // Booking + Pickup + Customs + Departed = the 24 active shipments.
  pipeline: [
    { id: "rfq", label: "RFQ", count: 9, phase: "commercial" },
    { id: "quoted", label: "Quoted", count: 6, phase: "commercial" },
    { id: "accepted", label: "Accepted", count: 5, phase: "commercial" },
    { id: "booking", label: "Booking", count: 3, phase: "execution" },
    { id: "pickup", label: "Pickup", count: 6, phase: "execution" },
    { id: "customs", label: "Customs", count: 3, phase: "execution" },
    { id: "departed", label: "Departed", count: 12, phase: "execution" },
    { id: "delivered", label: "Delivered", count: 18, phase: "done" },
  ],

  departures: [
    {
      shipmentId: "XMV-1037",
      exporter: "CocoPure Exports",
      lane: { origin: "Kochi", destination: "Rotterdam" },
      mode: "ocean",
      carrier: "MSC",
      voyage: "MSC Aurora · FX642W",
      cutoff: "2026-10-07T14:30:00Z",
      etd: "2026-10-08T09:00:00Z",
      equipment: "2 × 40 FT HC",
      checklist: { total: 12, pending: ["Second container release", "Gate-in", "BL draft approval"] },
    },
    {
      shipmentId: "XMV-1032",
      exporter: "Vertex Auto Components",
      lane: { origin: "Delhi (DEL)", destination: "Frankfurt (FRA)" },
      mode: "air",
      carrier: "Lufthansa Cargo",
      voyage: "LH 8405",
      cutoff: "2026-10-08T08:30:00Z",
      etd: "2026-10-08T17:10:00Z",
      equipment: "2 × PMC pallets",
      checklist: { total: 10, pending: ["Commercial Invoice to CHA"] },
    },
    {
      shipmentId: "XMV-1041",
      exporter: "GreenHarvest Foods",
      lane: { origin: "Bengaluru ICD", destination: "Jebel Ali" },
      mode: "ocean",
      carrier: "Maersk",
      voyage: "MV Maersk Denver · 241W",
      cutoff: "2026-10-08T12:30:00Z",
      etd: "2026-10-09T18:00:00Z",
      equipment: "MSKU-7834912 · 20 FT Dry",
      checklist: { total: 13, pending: ["VGM submission"] },
    },
    {
      shipmentId: "XMV-1039",
      exporter: "Malabar Spice Traders",
      lane: { origin: "Chennai", destination: "Singapore" },
      mode: "ocean",
      carrier: "Maersk",
      voyage: "Maersk Kensington · 242E",
      cutoff: "2026-10-09T10:30:00Z",
      etd: "2026-10-10T00:30:00Z",
      equipment: "MSKU-4410276 · 20 FT Dry",
      checklist: { total: 13, pending: ["VGM", "Booking confirmation", "Shipping Bill", "BL draft"] },
    },
  ],

  documents: {
    totals: { ready: 42, pending: 7, issues: 2 },
    priority: [
      {
        id: "doc-1",
        shipmentId: "XMV-1037",
        document: "bl-draft",
        state: "issue",
        note: "Consignee name differs from SI",
      },
      {
        id: "doc-2",
        shipmentId: "XMV-1028",
        document: "e-way-bill",
        state: "issue",
        note: "Vehicle changed; needs re-issue",
      },
      { id: "doc-3", shipmentId: "XMV-1048", document: "shipping-instructions", state: "pending-exporter" },
      { id: "doc-4", shipmentId: "XMV-1039", document: "vgm", state: "pending-exporter" },
      { id: "doc-5", shipmentId: "XMV-1041", document: "shipping-bill", state: "pending-cha" },
      { id: "doc-6", shipmentId: "XMV-1033", document: "container-details", state: "pending-carrier" },
      { id: "doc-7", shipmentId: "XMV-1041", document: "bl-draft", state: "generated" },
    ],
  },

  chaUpdates: [
    {
      id: "cha-1",
      shipmentId: "XMV-1041",
      cha: "Apex Customs Services",
      customsStage: "Shipping Bill Filed",
      at: "2026-10-07T03:18:00Z",
      pendingFrom: "customs",
      action: { label: "Track", kind: "track" },
    },
    {
      id: "cha-2",
      shipmentId: "XMV-1038",
      cha: "FastClear CHA",
      customsStage: "Awaiting Exporter Document",
      at: "2026-10-07T02:54:00Z",
      pendingFrom: "exporter",
      action: { label: "Request Document", kind: "request" },
    },
    {
      id: "cha-3",
      shipmentId: "XMV-1032",
      cha: "Skyline Customs (Delhi Air Cargo)",
      customsStage: "Commercial Invoice Requested",
      at: "2026-10-07T02:25:00Z",
      pendingFrom: "forwarder",
      action: { label: "Send Documents", kind: "send" },
    },
    {
      id: "cha-4",
      shipmentId: "XMV-1018",
      cha: "Coastal Clearing House",
      customsStage: "Examination Ordered",
      at: "2026-10-07T01:50:00Z",
      pendingFrom: "customs",
      action: { label: "Track", kind: "track" },
    },
  ],

  bookings: [
    {
      id: "bk-1",
      carrier: "Maersk",
      bookingNumber: "MAEU-928471",
      shipmentId: "XMV-1041",
      voyage: "Maersk Denver · 241W",
      status: "confirmed",
      equipment: "20 FT Dry",
      cutoff: "2026-10-08T12:30:00Z",
      confirmedAt: "2026-10-07T03:22:00Z",
    },
    {
      id: "bk-2",
      carrier: "MSC",
      bookingNumber: "MSC-849203",
      shipmentId: "XMV-1037",
      voyage: "MSC Aurora · FX642W",
      status: "equipment-pending",
      equipment: "2 × 40 FT HC",
      cutoff: "2026-10-07T14:30:00Z",
      confirmedAt: "2026-10-03T06:40:00Z",
    },
    {
      id: "bk-3",
      carrier: "Maersk",
      bookingNumber: "MAEU-930118",
      shipmentId: "XMV-1039",
      voyage: "Maersk Kensington · 242E",
      status: "pending",
      equipment: "20 FT Dry",
      cutoff: "2026-10-09T10:30:00Z",
    },
    {
      id: "bk-4",
      carrier: "Hapag-Lloyd",
      bookingNumber: "HLCU-2610055",
      shipmentId: "XMV-1033",
      voyage: "Hamburg Express · 041W",
      status: "confirmed",
      equipment: "40 FT HC",
      cutoff: "2026-10-09T08:30:00Z",
      confirmedAt: "2026-10-02T11:05:00Z",
    },
    {
      id: "bk-5",
      carrier: "ONE",
      bookingNumber: "ONEY-MUN4412870",
      shipmentId: "XMV-1050",
      voyage: "ONE Apus · 088W",
      status: "space-requested",
      equipment: "40 FT HC",
      cutoff: "2026-10-14T08:30:00Z",
    },
    {
      id: "bk-6",
      carrier: "CMA CGM",
      bookingNumber: "CMA-NAM2610447",
      shipmentId: "XMV-1044",
      voyage: "CMA CGM Tage · 0FL4RW",
      status: "rolled-over",
      equipment: "40 FT Dry",
      cutoff: "2026-10-12T08:30:00Z",
      confirmedAt: "2026-10-06T09:15:00Z",
    },
  ],

  exceptions: [
    {
      id: "ex-1",
      shipmentId: "XMV-1028",
      title: "Container Pickup Delayed",
      detail: "Truck arrival delayed by 5 hours.",
      severity: "critical",
      raisedAt: "2026-10-07T02:40:00Z",
      stakeholder: { role: "transporter", name: "Konkan Roadlines" },
    },
    {
      id: "ex-2",
      shipmentId: "XMV-1039",
      title: "Documentation Issue",
      detail: "VGM missing.",
      severity: "warning",
      raisedAt: "2026-10-07T01:15:00Z",
      stakeholder: { role: "exporter", name: "Malabar Spice Traders" },
    },
    {
      id: "ex-3",
      shipmentId: "XMV-1018",
      title: "Customs Hold",
      detail: "Inspection requested.",
      severity: "warning",
      raisedAt: "2026-10-07T01:50:00Z",
      stakeholder: { role: "cha", name: "Coastal Clearing House" },
    },
    {
      id: "ex-4",
      shipmentId: "XMV-1033",
      title: "Vessel Schedule Changed",
      detail: "ETD moved from 9 Oct to 10 Oct.",
      severity: "info",
      raisedAt: "2026-10-06T16:20:00Z",
      stakeholder: { role: "carrier", name: "Hapag-Lloyd" },
    },
  ],

  commercial: {
    quotesSent: 34,
    quotesAccepted: 21,
    revenueConfirmed: 840_000,
    receivables: 210_000,
    avgResponseMinutes: 38,
    recentQuotes: [
      {
        id: "Q-3121",
        rfqId: "RFQ-2044",
        customer: "Nilgiri Tea Estates",
        lane: { origin: "Bengaluru", destination: "Dubai" },
        mode: "ocean",
        amount: 142_000,
        status: "accepted",
        sentAt: "2026-10-06T07:10:00Z",
      },
      {
        id: "Q-3118",
        rfqId: "RFQ-2041",
        customer: "Western Ceramics",
        lane: { origin: "Mumbai", destination: "Rotterdam" },
        mode: "ocean",
        amount: 284_000,
        status: "awaiting",
        sentAt: "2026-10-05T12:45:00Z",
      },
      {
        id: "Q-3116",
        rfqId: "RFQ-2042",
        customer: "Sundaram Auto Components",
        lane: { origin: "Chennai", destination: "Singapore" },
        mode: "ocean",
        amount: 68_500,
        status: "accepted",
        sentAt: "2026-10-05T09:30:00Z",
      },
      {
        id: "Q-3112",
        rfqId: "RFQ-2039",
        customer: "Medisure Formulations",
        lane: { origin: "Delhi", destination: "Frankfurt" },
        mode: "air",
        amount: 312_000,
        status: "declined",
        sentAt: "2026-10-04T10:00:00Z",
      },
    ],
  },

  activity: [
    {
      id: "ev-1",
      at: "2026-10-07T03:22:00Z",
      actor: "carrier",
      message: "Maersk booking confirmed",
      reference: "XMV-1041",
    },
    {
      id: "ev-2",
      at: "2026-10-07T03:18:00Z",
      actor: "cha",
      message: "Apex Customs filed the Shipping Bill",
      reference: "XMV-1041",
    },
    {
      id: "ev-3",
      at: "2026-10-07T02:58:00Z",
      actor: "exporter",
      message: "GreenHarvest uploaded the Packing List",
      reference: "XMV-1041",
    },
    {
      id: "ev-4",
      at: "2026-10-07T02:42:00Z",
      actor: "exporter",
      message: "New RFQ received for Bengaluru → Jebel Ali",
      reference: "RFQ-2048",
    },
    {
      id: "ev-5",
      at: "2026-10-07T02:30:00Z",
      actor: "forwarder",
      message: "Container HLXU-6623190 assigned",
      reference: "XMV-1033",
    },
    {
      id: "ev-6",
      at: "2026-10-07T01:50:00Z",
      actor: "customs",
      message: "Examination ordered at Chennai Air Cargo",
      reference: "XMV-1018",
    },
  ],

  sumit: [
    {
      id: "si-1",
      reference: "XMV-1041",
      message: "VGM is the last open item before tomorrow's 6:00 PM Maersk cut-off.",
      severity: "critical",
    },
    {
      id: "si-2",
      reference: "XMV-1033",
      message: "Hapag-Lloyd moved the departure by 14 hours; Sunrise Textiles hasn't been told yet.",
      severity: "warning",
    },
    {
      id: "si-3",
      reference: "RFQ-2048",
      message: "Expires in 2h 15m and matches your preferred Maersk rate on the UAE lane.",
      severity: "info",
    },
  ],
};

export function getFreightForwarderDashboard(): FreightForwarderDashboardData {
  return MOCK_DASHBOARD;
}

/* ------------------------------------------------------------------------ */
/* Derived views                                                             */
/* ------------------------------------------------------------------------ */

export function sortedActions(data: FreightForwarderDashboardData): FreightAction[] {
  return data.actions.toSorted((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]);
}

/** Active shipments with problems first, then by departure date. */
export function shipmentsByUrgency(data: FreightForwarderDashboardData): FreightShipment[] {
  return data.shipments.toSorted(
    (a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health] || a.etd.localeCompare(b.etd),
  );
}

/** Open RFQs, soonest quote deadline first. */
export function rfqsByDeadline(data: FreightForwarderDashboardData): FreightRFQ[] {
  return data.rfqs.toSorted((a, b) => a.quoteDeadline.localeCompare(b.quoteDeadline));
}

export function departuresByCutoff(data: FreightForwarderDashboardData): UpcomingDeparture[] {
  return data.departures.toSorted((a, b) => a.cutoff.localeCompare(b.cutoff));
}

export function exceptionsBySeverity(data: FreightForwarderDashboardData): ShipmentException[] {
  return data.exceptions.toSorted(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.raisedAt.localeCompare(a.raisedAt),
  );
}

/** Exceptions that need someone to act (everything but informational ones). */
export function openExceptionCount(data: FreightForwarderDashboardData): number {
  return data.exceptions.filter((e) => e.severity !== "info").length;
}

/** Share of sent quotes that were accepted, as a percentage to one decimal. */
export function conversionRate(commercial: CommercialOverview): number {
  if (!commercial.quotesSent) return 0;
  return Math.round((commercial.quotesAccepted / commercial.quotesSent) * 1000) / 10;
}
