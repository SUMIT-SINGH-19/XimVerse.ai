/**
 * Data behind the importer overview dashboard.
 *
 * Everything here is MOCK data, shaped the way an API response for the
 * dashboard is likely to look. When the backend exists, replace
 * `getImporterDashboard()` with a fetch and keep the types.
 */

export type ImportStage =
  | "sourcing"
  | "order-confirmed"
  | "documentation"
  | "origin"
  | "in-transit"
  | "customs"
  | "delivered";

/** The lifecycle of an import, in order. */
export const IMPORT_STAGES: readonly { id: ImportStage; label: string }[] = [
  { id: "sourcing", label: "Sourcing" },
  { id: "order-confirmed", label: "Order Confirmed" },
  { id: "documentation", label: "Documentation" },
  { id: "origin", label: "Origin" },
  { id: "in-transit", label: "In Transit" },
  { id: "customs", label: "Customs" },
  { id: "delivered", label: "Delivered" },
];

export function stageLabel(stage: ImportStage): string {
  return IMPORT_STAGES.find((s) => s.id === stage)?.label ?? stage;
}

export type ImportStatus =
  | "action-required"
  | "pending-clarification"
  | "on-track"
  | "preparing-shipment";

export const IMPORT_STATUS_LABEL: Record<ImportStatus, string> = {
  "action-required": "Action Required",
  "pending-clarification": "Pending Clarification",
  "on-track": "On Track",
  "preparing-shipment": "Preparing Shipment",
};

export interface TradeRoute {
  origin: string;
  destination: string;
}

export interface ActiveImport {
  id: string;
  supplier: string;
  route: TradeRoute;
  /** Estimated arrival at the destination port, as YYYY-MM-DD. */
  eta: string;
  stage: ImportStage;
  status: ImportStatus;
  nextAction: string;
}

export type ActionPriority = "high" | "medium" | "low";

export interface ActionItem {
  id: string;
  importId: string;
  priority: ActionPriority;
  issue: string;
  counterparty?: { role: string; name: string };
  route?: TradeRoute;
  /** Verb on the call-to-action button. */
  cta: string;
}

export type HealthTone = "complete" | "attention" | "review";

export interface ComplianceHealthItem {
  id: string;
  label: string;
  shipments: number;
  tone: HealthTone;
}

export type ActivityActor = "cha" | "supplier" | "carrier" | "importer";

export interface ActivityEvent {
  id: string;
  importId: string;
  actor: ActivityActor;
  message: string;
  /** ISO timestamp. */
  at: string;
}

export interface ImporterDashboardData {
  /** When this snapshot was produced; relative times are measured from it. */
  asOf: string;
  actions: readonly ActionItem[];
  /** The most recently updated active imports, not all of them. */
  recentImports: readonly ActiveImport[];
  /** Number of imports currently at each stage. */
  pipeline: Record<ImportStage, number>;
  compliance: readonly ComplianceHealthItem[];
  activity: readonly ActivityEvent[];
}

const MOCK_DASHBOARD: ImporterDashboardData = {
  asOf: "2026-10-07T09:30:00Z",
  actions: [
    {
      id: "act-1",
      importId: "IMP-2026-00124",
      priority: "high",
      issue: "Certificate of Origin missing",
      counterparty: { role: "Supplier", name: "Al Noor Foods LLC" },
      route: { origin: "Dubai", destination: "Mumbai" },
      cta: "Resolve",
    },
    {
      id: "act-2",
      importId: "IMP-2026-00131",
      priority: "medium",
      issue: "Customs broker requested HS Code clarification",
      counterparty: { role: "Supplier", name: "Shanghai Industrial Co." },
      route: { origin: "Shanghai", destination: "Nhava Sheva" },
      cta: "Respond",
    },
    {
      id: "act-3",
      importId: "IMP-2026-00135",
      priority: "medium",
      issue: "Draft Bill of Lading awaiting approval",
      counterparty: { role: "Supplier", name: "Pacific Components Ltd." },
      route: { origin: "Singapore", destination: "Chennai" },
      cta: "Review",
    },
    {
      id: "act-4",
      importId: "IMP-2026-00138",
      priority: "low",
      issue: "Commercial Invoice needs confirmation",
      cta: "Review",
    },
  ],
  recentImports: [
    {
      id: "IMP-2026-00124",
      supplier: "Al Noor Foods LLC",
      route: { origin: "Dubai", destination: "Mumbai" },
      eta: "2026-10-14",
      stage: "documentation",
      status: "action-required",
      nextAction: "Upload Certificate of Origin",
    },
    {
      id: "IMP-2026-00131",
      supplier: "Shanghai Industrial Co.",
      route: { origin: "Shanghai", destination: "Nhava Sheva" },
      eta: "2026-10-18",
      stage: "customs",
      status: "pending-clarification",
      nextAction: "Clarify HS Code with broker",
    },
    {
      id: "IMP-2026-00135",
      supplier: "Pacific Components Ltd.",
      route: { origin: "Singapore", destination: "Chennai" },
      eta: "2026-10-21",
      stage: "in-transit",
      status: "on-track",
      nextAction: "Approve draft Bill of Lading",
    },
    {
      id: "IMP-2026-00142",
      supplier: "Nordic Machinery GmbH",
      route: { origin: "Hamburg", destination: "Chennai" },
      eta: "2026-10-26",
      stage: "origin",
      status: "preparing-shipment",
      nextAction: "Await packing list",
    },
  ],
  pipeline: {
    sourcing: 3,
    "order-confirmed": 0,
    documentation: 2,
    origin: 1,
    "in-transit": 4,
    customs: 2,
    delivered: 0,
  },
  compliance: [
    { id: "complete", label: "Documents complete", shipments: 8, tone: "complete" },
    { id: "missing", label: "Missing documents", shipments: 2, tone: "attention" },
    { id: "review", label: "Compliance review required", shipments: 1, tone: "review" },
    { id: "customs", label: "Customs clarification", shipments: 1, tone: "review" },
  ],
  activity: [
    {
      id: "ev-1",
      importId: "IMP-2026-00131",
      actor: "cha",
      message: "CHA uploaded customs checklist",
      at: "2026-10-07T09:18:00Z",
    },
    {
      id: "ev-2",
      importId: "IMP-2026-00124",
      actor: "supplier",
      message: "Supplier uploaded Certificate of Origin",
      at: "2026-10-07T08:47:00Z",
    },
    {
      id: "ev-3",
      importId: "IMP-2026-00135",
      actor: "carrier",
      message: "Shipment departed Singapore",
      at: "2026-10-07T07:30:00Z",
    },
    {
      id: "ev-4",
      importId: "IMP-2026-00138",
      actor: "importer",
      message: "Commercial Invoice updated",
      at: "2026-10-06T06:45:00Z",
    },
  ],
};

export function getImporterDashboard(): ImporterDashboardData {
  return MOCK_DASHBOARD;
}

/* ------------------------------------------------------------------------ */
/* Figures derived from the snapshot, so the dashboard never contradicts     */
/* itself.                                                                   */
/* ------------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

/** Whole days from the snapshot's date to a YYYY-MM-DD date. */
export function daysFromAsOf(asOf: string, date: string): number {
  const start = new Date(asOf);
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  return Math.round((Date.parse(`${date}T00:00:00Z`) - startDay) / DAY_MS);
}

export function activeImportCount(data: ImporterDashboardData): number {
  return IMPORT_STAGES.filter((s) => s.id !== "delivered").reduce(
    (sum, s) => sum + data.pipeline[s.id],
    0,
  );
}

/** Imports still on their way, soonest first. */
export function upcomingArrivals(data: ImporterDashboardData, limit = 3): ActiveImport[] {
  return data.recentImports
    .filter((i) => i.stage !== "delivered" && daysFromAsOf(data.asOf, i.eta) >= 0)
    .toSorted((a, b) => a.eta.localeCompare(b.eta))
    .slice(0, limit);
}

export function arrivingWithin(data: ImporterDashboardData, days: number): ActiveImport[] {
  return upcomingArrivals(data, Infinity).filter((i) => daysFromAsOf(data.asOf, i.eta) <= days);
}
