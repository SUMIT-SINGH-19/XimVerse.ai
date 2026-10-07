/**
 * Data behind the CHA (Customs House Agent) overview dashboard.
 *
 * Everything here is MOCK data, shaped the way an API response for the
 * dashboard is likely to look. When the backend exists, replace
 * `getChaDashboard()` with a fetch and keep the types.
 *
 * The operating model the dashboard reflects:
 *
 *   Client creates shipment → uploads documents → Sumit extracts + validates
 *   → shipment enters the CHA work queue → CHA reviews
 *   → missing info? request it from the client : generate the filing
 *   → CHA review → client approval → DSC sign → customs filing → ACK / query
 *   → assessment → clearance.
 *
 * Headline figures, filters and the timeline are derived from the shipment
 * list (see the bottom of this file) so the sections never disagree.
 */

/* ------------------------------------------------------------------------ */
/* Shipments                                                                 */
/* ------------------------------------------------------------------------ */

export type ShipmentType = "export" | "import";

/** Where a shipment sits in the CHA's own work, as shown in the work queue. */
export type WorkStage =
  | "document-review"
  | "awaiting-client"
  | "ready-to-file"
  | "filed"
  | "customs-query"
  | "assessment"
  | "examination"
  | "cleared";

export const WORK_STAGE_LABEL: Record<WorkStage, string> = {
  "document-review": "Document Review",
  "awaiting-client": "Awaiting Client",
  "ready-to-file": "Ready to File",
  filed: "Filed · Awaiting ACK",
  "customs-query": "Customs Query",
  assessment: "Assessment",
  examination: "Examination",
  cleared: "Cleared",
};

export type Priority = "critical" | "high" | "medium" | "low";

export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export type SlaState = "on-track" | "at-risk" | "delayed";

/** The customs journey of an export, in order. */
export const EXPORT_JOURNEY = [
  { id: "documents", label: "Documents" },
  { id: "sb-filed", label: "SB Filed" },
  { id: "assessment", label: "Assessment" },
  { id: "examination", label: "Examination" },
  { id: "leo", label: "LEO" },
  { id: "gate-in", label: "Gate-In" },
  { id: "vessel", label: "Vessel" },
] as const;

/** The customs journey of an import, in order. */
export const IMPORT_JOURNEY = [
  { id: "documents", label: "Documents" },
  { id: "be-filed", label: "BE Filed" },
  { id: "assessment", label: "Assessment" },
  { id: "duty", label: "Duty" },
  { id: "examination", label: "Examination" },
  { id: "ooc", label: "OOC" },
  { id: "delivery", label: "Delivery" },
] as const;

export type ExportStep = (typeof EXPORT_JOURNEY)[number]["id"];
export type ImportStep = (typeof IMPORT_JOURNEY)[number]["id"];

interface ShipmentBase {
  id: string;
  client: string;
  /** Customs station, e.g. "Nhava Sheva (JNPA)". */
  port: string;
  cargo: string;
  stage: WorkStage;
  priority: Priority;
  nextAction: string;
  sla: SlaState;
  /** Why the shipment is stuck at its current journey step, if it is. */
  blockedReason?: string;
  /** Date clearance (LEO / OOC) is expected, as YYYY-MM-DD. */
  clearanceExpected?: string;
}

export interface ExportShipment extends ShipmentBase {
  type: "export";
  journeyStep: ExportStep;
}

export interface ImportShipment extends ShipmentBase {
  type: "import";
  journeyStep: ImportStep;
}

export type Shipment = ExportShipment | ImportShipment;

export function journeyFor(type: ShipmentType): readonly { id: string; label: string }[] {
  return type === "export" ? EXPORT_JOURNEY : IMPORT_JOURNEY;
}

/** Zero-based position of the shipment on its journey. */
export function journeyIndex(shipment: Shipment): number {
  return journeyFor(shipment.type).findIndex((s) => s.id === shipment.journeyStep);
}

/* ------------------------------------------------------------------------ */
/* Actions                                                                   */
/* ------------------------------------------------------------------------ */

export type ActionStatus = "critical" | "urgent" | "review" | "ready" | "waiting-client";

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  critical: "Critical",
  urgent: "Urgent",
  review: "Review",
  ready: "Ready",
  "waiting-client": "Waiting Client",
};

const ACTION_STATUS_RANK: Record<ActionStatus, number> = {
  critical: 0,
  urgent: 1,
  ready: 2,
  review: 3,
  "waiting-client": 4,
};

/** Workspace section an action's button opens. */
export type ActionDestination = "shipments" | "filings" | "queries";

export interface ActionItem {
  id: string;
  shipmentId: string;
  client: string;
  issue: string;
  status: ActionStatus;
  /** Verb on the call-to-action button. */
  cta: string;
  destination: ActionDestination;
}

/* ------------------------------------------------------------------------ */
/* Filings                                                                   */
/* ------------------------------------------------------------------------ */

export type FilingKind =
  | "shipping-bill"
  | "bill-of-entry"
  | "amendment"
  | "query-response"
  | "declaration";

export const FILING_KIND_LABEL: Record<FilingKind, string> = {
  "shipping-bill": "Shipping Bill",
  "bill-of-entry": "Bill of Entry",
  amendment: "Amendment",
  "query-response": "Query Response",
  declaration: "Supporting Declaration",
};

/** A filing's workflow, in order. */
export const FILING_WORKFLOW = [
  { id: "draft", label: "Draft", owner: "cha" },
  { id: "ai-validated", label: "AI Validated", owner: "cha" },
  { id: "cha-review", label: "CHA Review", owner: "cha" },
  { id: "client-approval", label: "Client Approval", owner: "client" },
  { id: "dsc-sign", label: "Ready for DSC", owner: "cha" },
  { id: "filed", label: "Filed", owner: "customs" },
  { id: "ack", label: "ACK", owner: "done" },
] as const;

export type FilingStatus = (typeof FILING_WORKFLOW)[number]["id"];
/** Who the filing is waiting on at a given step. */
export type FilingOwner = (typeof FILING_WORKFLOW)[number]["owner"];

export interface Filing {
  id: string;
  shipmentId: string;
  kind: FilingKind;
  status: FilingStatus;
  nextAction: string;
}

export function filingStep(status: FilingStatus) {
  const index = FILING_WORKFLOW.findIndex((s) => s.id === status);
  return { index, ...FILING_WORKFLOW[index] };
}

/* ------------------------------------------------------------------------ */
/* Compliance                                                                */
/* ------------------------------------------------------------------------ */

export type ComplianceCheck =
  | "commercial-invoice"
  | "packing-list"
  | "bill-of-lading"
  | "iec"
  | "gstin"
  | "ad-code"
  | "lut-igst"
  | "rcmc"
  | "coo"
  | "export-scheme"
  | "rodtep"
  | "drawback"
  | "valuation"
  | "container"
  | "transport"
  | "declarations";

export const COMPLIANCE_CHECK_LABEL: Record<ComplianceCheck, string> = {
  "commercial-invoice": "Commercial Invoice",
  "packing-list": "Packing List",
  "bill-of-lading": "Bill of Lading / AWB",
  iec: "IEC",
  gstin: "GSTIN",
  "ad-code": "AD Code",
  "lut-igst": "LUT / IGST",
  rcmc: "RCMC",
  coo: "Certificate of Origin",
  "export-scheme": "Export Scheme",
  rodtep: "RoDTEP",
  drawback: "Drawback",
  valuation: "Valuation Declaration",
  container: "Container Information",
  transport: "Transport Details",
  declarations: "Customs Declarations",
};

export interface CheckResult {
  check: ComplianceCheck;
  passed: boolean;
  /** What is wrong, for failed checks. */
  issue?: string;
}

/** Sumit's validation of one shipment's data and documents. */
export interface ComplianceReport {
  shipmentId: string;
  checks: readonly CheckResult[];
}

/* ------------------------------------------------------------------------ */
/* Sumit briefing and activity                                               */
/* ------------------------------------------------------------------------ */

export interface BriefingItem {
  shipmentId: string;
  message: string;
  /** When the underlying event happened, for "28 min ago". */
  at?: string;
}

export type ActivityActor = "customs" | "client" | "team" | "sumit";

export interface ActivityEvent {
  id: string;
  shipmentId: string;
  actor: ActivityActor;
  message: string;
  /** ISO timestamp. */
  at: string;
}

export interface ChaDashboardData {
  /** When this snapshot was produced; "today" and relative times use it. */
  asOf: string;
  /** Time zone the CHA works in; clock times are shown in it. */
  timeZone: string;
  shipments: readonly Shipment[];
  actions: readonly ActionItem[];
  filings: readonly Filing[];
  compliance: readonly ComplianceReport[];
  briefing: readonly BriefingItem[];
  activity: readonly ActivityEvent[];
}

/* ------------------------------------------------------------------------ */
/* Mock snapshot: 09:00 IST, Wednesday 7 October 2026                        */
/* ------------------------------------------------------------------------ */

/** Checks every export runs before a Shipping Bill is generated. */
const EXPORT_CHECKS: readonly ComplianceCheck[] = [
  "commercial-invoice",
  "packing-list",
  "iec",
  "gstin",
  "ad-code",
  "lut-igst",
  "rcmc",
  "coo",
  "export-scheme",
  "rodtep",
  "drawback",
  "container",
  "transport",
  "declarations",
];

const IMPORT_CHECKS: readonly ComplianceCheck[] = [
  "commercial-invoice",
  "packing-list",
  "bill-of-lading",
  "iec",
  "gstin",
  "coo",
  "valuation",
  "transport",
  "declarations",
];

/** A report where every check passes except the listed issues. */
function report(
  shipmentId: string,
  checks: readonly ComplianceCheck[],
  issues: Partial<Record<ComplianceCheck, string>> = {},
): ComplianceReport {
  return {
    shipmentId,
    checks: checks.map((check) =>
      issues[check] ? { check, passed: false, issue: issues[check] } : { check, passed: true },
    ),
  };
}

const MOCK_DASHBOARD: ChaDashboardData = {
  asOf: "2026-10-07T03:30:00Z",
  timeZone: "Asia/Kolkata",
  shipments: [
    {
      id: "XIM-IMP-1051",
      client: "Nova Imports Pvt Ltd",
      type: "import",
      port: "Nhava Sheva (JNPA)",
      cargo: "Industrial valves · HS 8481",
      stage: "customs-query",
      priority: "critical",
      nextAction: "Respond to query",
      sla: "delayed",
      journeyStep: "assessment",
      blockedReason: "Valuation query from appraising group",
      clearanceExpected: "2026-10-07",
    },
    {
      id: "XIM-EXP-1042",
      client: "ABC Exports Pvt Ltd",
      type: "export",
      port: "ICD Bengaluru",
      cargo: "Granite slabs · HS 6802",
      stage: "document-review",
      priority: "high",
      nextAction: "Review invoice",
      sla: "at-risk",
      journeyStep: "documents",
      blockedReason: "Invoice quantity differs from packing list",
      clearanceExpected: "2026-10-08",
    },
    {
      id: "XIM-EXP-1062",
      client: "Sunrise Textiles",
      type: "export",
      port: "Nhava Sheva (JNPA)",
      cargo: "Cotton knitwear · HS 6109",
      stage: "ready-to-file",
      priority: "high",
      nextAction: "Sign & file SB",
      sla: "on-track",
      journeyStep: "documents",
      clearanceExpected: "2026-10-07",
    },
    {
      id: "XIM-EXP-1055",
      client: "Greenfield Exports",
      type: "export",
      port: "Mundra",
      cargo: "Groundnut kernels · HS 1202",
      stage: "awaiting-client",
      priority: "high",
      nextAction: "Request details",
      sla: "at-risk",
      journeyStep: "documents",
      blockedReason: "Container number missing",
      clearanceExpected: "2026-10-08",
    },
    {
      id: "XIM-IMP-1044",
      client: "Orion Pharma Ltd",
      type: "import",
      port: "Delhi Air Cargo",
      cargo: "Active pharma ingredients · HS 2941",
      stage: "assessment",
      priority: "high",
      nextAction: "Chase duty payment",
      sla: "at-risk",
      journeyStep: "duty",
      blockedReason: "Duty unpaid — free time ends tomorrow",
      clearanceExpected: "2026-10-08",
    },
    {
      id: "XIM-EXP-1047",
      client: "RK Foods",
      type: "export",
      port: "Chennai",
      cargo: "Basmati rice, 25 kg bags · HS 1006",
      stage: "ready-to-file",
      priority: "medium",
      nextAction: "File SB",
      sla: "on-track",
      journeyStep: "documents",
      clearanceExpected: "2026-10-07",
    },
    {
      id: "XIM-IMP-1058",
      client: "Vertex Machine Tools",
      type: "import",
      port: "ICD Tughlakabad",
      cargo: "CNC lathe spares · HS 8466",
      stage: "awaiting-client",
      priority: "medium",
      nextAction: "Await BE approval",
      sla: "on-track",
      journeyStep: "documents",
      clearanceExpected: "2026-10-09",
    },
    {
      id: "XIM-IMP-1049",
      client: "Kaveri Electronics",
      type: "import",
      port: "Chennai",
      cargo: "LED driver modules · HS 8504",
      stage: "examination",
      priority: "medium",
      nextAction: "Attend exam, 14:00",
      sla: "on-track",
      journeyStep: "examination",
      clearanceExpected: "2026-10-07",
    },
    {
      id: "XIM-EXP-1039",
      client: "Malabar Spice Traders",
      type: "export",
      port: "Chennai",
      cargo: "Black pepper · HS 0904",
      stage: "filed",
      priority: "low",
      nextAction: "Await assessment",
      sla: "on-track",
      journeyStep: "assessment",
      clearanceExpected: "2026-10-07",
    },
    {
      id: "XIM-EXP-1054",
      client: "Eastern Foods",
      type: "export",
      port: "Mundra",
      cargo: "Frozen shrimp · HS 0306",
      stage: "awaiting-client",
      priority: "low",
      nextAction: "Waiting",
      sla: "on-track",
      journeyStep: "documents",
      clearanceExpected: "2026-10-10",
    },
    {
      id: "XIM-IMP-1040",
      client: "Meridian Imports Pvt Ltd",
      type: "import",
      port: "Nhava Sheva (JNPA)",
      cargo: "Medjool dates · HS 0804",
      stage: "cleared",
      priority: "low",
      nextAction: "Arrange delivery",
      sla: "on-track",
      journeyStep: "ooc",
      clearanceExpected: "2026-10-07",
    },
    {
      id: "XIM-EXP-1036",
      client: "Shree Agro Exports",
      type: "export",
      port: "Mundra",
      cargo: "Steam basmati rice · HS 1006",
      stage: "cleared",
      priority: "low",
      nextAction: "Track gate-in",
      sla: "on-track",
      journeyStep: "leo",
      clearanceExpected: "2026-10-06",
    },
  ],
  actions: [
    {
      id: "act-1",
      shipmentId: "XIM-IMP-1051",
      client: "Nova Imports Pvt Ltd",
      issue: "Customs query received on declared value",
      status: "critical",
      cta: "Respond",
      destination: "queries",
    },
    {
      id: "act-2",
      shipmentId: "XIM-EXP-1042",
      client: "ABC Exports Pvt Ltd",
      issue: "Commercial Invoice mismatch detected",
      status: "urgent",
      cta: "Review",
      destination: "shipments",
    },
    {
      id: "act-3",
      shipmentId: "XIM-EXP-1055",
      client: "Greenfield Exports",
      issue: "Container number missing",
      status: "urgent",
      cta: "Request Details",
      destination: "shipments",
    },
    {
      id: "act-4",
      shipmentId: "XIM-IMP-1044",
      client: "Orion Pharma Ltd",
      issue: "Duty unpaid — free time ends tomorrow",
      status: "urgent",
      cta: "Remind Client",
      destination: "shipments",
    },
    {
      id: "act-5",
      shipmentId: "XIM-EXP-1062",
      client: "Sunrise Textiles",
      issue: "Shipping Bill approved, awaiting DSC",
      status: "ready",
      cta: "Sign & File",
      destination: "filings",
    },
    {
      id: "act-6",
      shipmentId: "XIM-EXP-1047",
      client: "RK Foods",
      issue: "Shipping Bill draft ready",
      status: "review",
      cta: "Review & File",
      destination: "filings",
    },
    {
      id: "act-7",
      shipmentId: "XIM-IMP-1058",
      client: "Vertex Machine Tools",
      issue: "Bill of Entry awaiting client approval",
      status: "waiting-client",
      cta: "Follow Up",
      destination: "filings",
    },
  ],
  filings: [
    {
      id: "fil-1",
      shipmentId: "XIM-EXP-1062",
      kind: "shipping-bill",
      status: "dsc-sign",
      nextAction: "Sign & File",
    },
    {
      id: "fil-2",
      shipmentId: "XIM-EXP-1047",
      kind: "shipping-bill",
      status: "cha-review",
      nextAction: "Review Filing",
    },
    {
      id: "fil-3",
      shipmentId: "XIM-IMP-1051",
      kind: "query-response",
      status: "ai-validated",
      nextAction: "Review Draft Reply",
    },
    {
      id: "fil-4",
      shipmentId: "XIM-IMP-1058",
      kind: "bill-of-entry",
      status: "client-approval",
      nextAction: "Waiting Approval",
    },
    {
      id: "fil-5",
      shipmentId: "XIM-EXP-1042",
      kind: "declaration",
      status: "draft",
      nextAction: "Complete After Invoice Fix",
    },
    {
      id: "fil-6",
      shipmentId: "XIM-EXP-1039",
      kind: "amendment",
      status: "filed",
      nextAction: "Awaiting ACK",
    },
    {
      id: "fil-7",
      shipmentId: "XIM-IMP-1049",
      kind: "bill-of-entry",
      status: "ack",
      nextAction: "Acknowledged",
    },
  ],
  compliance: [
    report("XIM-EXP-1042", EXPORT_CHECKS, {
      "commercial-invoice": "Invoice quantity differs from packing list",
      container: "Container number missing",
    }),
    report("XIM-EXP-1055", EXPORT_CHECKS, {
      container: "Container number missing",
      transport: "Vehicle details for factory stuffing not provided",
    }),
    report("XIM-IMP-1051", IMPORT_CHECKS, {
      valuation: "Supplier contract needed to support declared value",
    }),
    report("XIM-EXP-1047", EXPORT_CHECKS),
  ],
  briefing: [
    {
      shipmentId: "XIM-IMP-1051",
      message: "Nova Imports received a customs query",
      at: "2026-10-07T03:02:00Z",
    },
    { shipmentId: "XIM-EXP-1047", message: "RK Foods' Shipping Bill is ready for review" },
    { shipmentId: "XIM-EXP-1042", message: "ABC Exports is missing its container number" },
  ],
  activity: [
    {
      id: "ev-1",
      shipmentId: "XIM-EXP-1047",
      actor: "sumit",
      message: "Shipping Bill draft generated",
      at: "2026-10-07T03:12:00Z",
    },
    {
      id: "ev-2",
      shipmentId: "XIM-IMP-1051",
      actor: "customs",
      message: "Customs query received",
      at: "2026-10-07T03:02:00Z",
    },
    {
      id: "ev-3",
      shipmentId: "XIM-EXP-1042",
      actor: "client",
      message: "ABC Exports uploaded revised invoice",
      at: "2026-10-07T03:01:00Z",
    },
    {
      id: "ev-4",
      shipmentId: "XIM-IMP-1049",
      actor: "customs",
      message: "Bill of Entry acknowledged",
      at: "2026-10-07T02:34:00Z",
    },
    {
      id: "ev-5",
      shipmentId: "XIM-IMP-1040",
      actor: "customs",
      message: "Out of charge granted",
      at: "2026-10-07T02:05:00Z",
    },
    {
      id: "ev-6",
      shipmentId: "XIM-EXP-1036",
      actor: "customs",
      message: "LEO received",
      at: "2026-10-06T12:15:00Z",
    },
  ],
};

export function getChaDashboard(): ChaDashboardData {
  return MOCK_DASHBOARD;
}

/* ------------------------------------------------------------------------ */
/* Figures derived from the snapshot, so the dashboard never contradicts     */
/* itself.                                                                   */
/* ------------------------------------------------------------------------ */

/** The snapshot's calendar date in the CHA's time zone, as YYYY-MM-DD. */
export function snapshotDate(data: Pick<ChaDashboardData, "asOf" | "timeZone">): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: data.timeZone }).format(new Date(data.asOf));
}

export function activeShipments(data: ChaDashboardData): Shipment[] {
  return data.shipments.filter((s) => s.stage !== "cleared");
}

/** Active shipments, most pressing first. */
export function workQueue(data: ChaDashboardData): Shipment[] {
  return activeShipments(data).toSorted(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );
}

export function sortedActions(data: ChaDashboardData): ActionItem[] {
  return data.actions.toSorted((a, b) => ACTION_STATUS_RANK[a.status] - ACTION_STATUS_RANK[b.status]);
}

/** Shipments due to clear today (including any that already have). */
export function clearingToday(data: ChaDashboardData): Shipment[] {
  const today = snapshotDate(data);
  return data.shipments.filter((s) => s.clearanceExpected === today);
}

/**
 * Shipments to show on the clearance timeline: today's clearances plus
 * anything blocked, stuck shipments first.
 */
export function timelineShipments(data: ChaDashboardData, limit = 6): Shipment[] {
  const today = snapshotDate(data);
  return activeShipments(data)
    .filter((s) => s.blockedReason || s.clearanceExpected === today)
    .toSorted((a, b) => Number(Boolean(b.blockedReason)) - Number(Boolean(a.blockedReason)))
    .slice(0, limit);
}

const OWNER_RANK: Record<FilingOwner, number> = { cha: 0, client: 1, customs: 2, done: 3 };

/**
 * Filings waiting on the CHA first (closest to filing at the top), then those
 * with the client, then those already with customs.
 */
export function filingQueue(data: ChaDashboardData): Filing[] {
  return data.filings.toSorted((a, b) => {
    const sa = filingStep(a.status);
    const sb = filingStep(b.status);
    return OWNER_RANK[sa.owner] - OWNER_RANK[sb.owner] || sb.index - sa.index;
  });
}

export function complianceScore(report: ComplianceReport) {
  const passed = report.checks.filter((c) => c.passed).length;
  return {
    passed,
    total: report.checks.length,
    percent: Math.round((passed / report.checks.length) * 100),
    issues: report.checks.filter((c) => !c.passed),
  };
}

export function shipmentById(data: ChaDashboardData, id: string): Shipment | undefined {
  return data.shipments.find((s) => s.id === id);
}

export interface ChaSummary {
  active: number;
  activeImports: number;
  awaitingDocuments: number;
  readyToFile: number;
  readyForDsc: number;
  customsQueries: number;
  criticalQueries: number;
  clearanceToday: number;
  clearedToday: number;
  slaRisk: number;
  delayed: number;
  /** Distinct shipments with an open action. */
  needsAttention: number;
}

export function summarize(data: ChaDashboardData): ChaSummary {
  const active = activeShipments(data);
  const queries = active.filter((s) => s.stage === "customs-query");
  const today = clearingToday(data);
  const atRisk = active.filter((s) => s.sla !== "on-track");

  return {
    active: active.length,
    activeImports: active.filter((s) => s.type === "import").length,
    awaitingDocuments: active.filter((s) => s.stage === "awaiting-client").length,
    readyToFile: active.filter((s) => s.stage === "ready-to-file").length,
    readyForDsc: data.filings.filter((f) => f.status === "dsc-sign").length,
    customsQueries: queries.length,
    criticalQueries: queries.filter((s) => s.priority === "critical").length,
    clearanceToday: today.length,
    clearedToday: today.filter((s) => s.stage === "cleared").length,
    slaRisk: atRisk.length,
    delayed: atRisk.filter((s) => s.sla === "delayed").length,
    needsAttention: new Set(data.actions.map((a) => a.shipmentId)).size,
  };
}

/* ------------------------------------------------------------------------ */
/* Work queue filters                                                        */
/* ------------------------------------------------------------------------ */

export type WorkQueueFilter = "all" | "export" | "import" | "urgent" | "waiting-client" | "ready-to-file";

export const WORK_QUEUE_FILTERS: readonly {
  id: WorkQueueFilter;
  label: string;
  matches: (s: Shipment) => boolean;
}[] = [
  { id: "all", label: "All", matches: () => true },
  { id: "export", label: "Export", matches: (s) => s.type === "export" },
  { id: "import", label: "Import", matches: (s) => s.type === "import" },
  {
    id: "urgent",
    label: "Urgent",
    matches: (s) => s.priority === "critical" || s.priority === "high",
  },
  { id: "waiting-client", label: "Waiting Client", matches: (s) => s.stage === "awaiting-client" },
  { id: "ready-to-file", label: "Ready to File", matches: (s) => s.stage === "ready-to-file" },
];
