/*
 * Transaction communication: threads attached to the trade graph.
 *
 *   RFQ / Quotation / Negotiation / Deal / Order / Document / Shipment → Thread → Messages
 *
 * Messages are their own canonical data (unlike documents): append-only,
 * never edited or deleted. Domain events stay in their owners' histories —
 * a thread may reference them, never replace them, and a message never
 * changes an order, shipment or document.
 *
 * Privacy: the buyer is a role ("Buyer via Ximverse"), never an identity.
 * No buyer name, contact, address, notes, target price or other-supplier
 * data exists anywhere in this module, its seeds or its search text.
 *
 * IDs: seeded threads THR-2026-81xx, browser-created THR-2026-9001+.
 * Messages are `${threadId}-m${n}`.
 */

import { DEMO_TODAY, daysBetween } from "./exporter-quotations";
import { isPreDeparture, shipmentState, type ExporterShipment } from "./exporter-shipments";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export type SubjectType = "rfq" | "quotation" | "negotiation" | "deal" | "order" | "document" | "shipment" | "general";

export const SUBJECT_LABEL: Record<SubjectType, string> = {
  rfq: "RFQ",
  quotation: "Quotation",
  negotiation: "Negotiation",
  deal: "Deal",
  order: "Order",
  document: "Document",
  shipment: "Shipment",
  general: "Ximverse Support",
};

export type Role = "exporter" | "buyer" | "ximverse" | "cha" | "forwarder" | "carrier" | "bank" | "team" | "system";

/** Role labels — the only way any party is named here. */
export const ROLE_LABEL: Record<Role, string> = {
  exporter: "You",
  buyer: "Buyer via Ximverse",
  ximverse: "Ximverse",
  cha: "CHA",
  forwarder: "Freight Forwarder",
  carrier: "Carrier",
  bank: "Bank",
  team: "Your Team",
  system: "System",
};

export const ROLE_INITIALS: Record<Role, string> = { exporter: "You", buyer: "B", ximverse: "X", cha: "CHA", forwarder: "FF", carrier: "C", bank: "BK", team: "T", system: "S" };

export type MessageType =
  | "text"
  | "request"
  | "clarification"
  | "status-update"
  | "system-note"
  | "document-query"
  | "commercial-query"
  | "shipment-exception"
  | "resolution"
  | "reopened";

export const MESSAGE_TYPE_LABEL: Record<MessageType, string> = {
  text: "Message",
  request: "Request",
  clarification: "Clarification",
  "status-update": "Status Update",
  "system-note": "System Note",
  "document-query": "Document Query",
  "commercial-query": "Commercial Query",
  "shipment-exception": "Shipment Exception",
  resolution: "Resolved",
  reopened: "Reopened",
};

/** Message types that expect an answer from the exporter. */
const ASKS_FOR_REPLY: ReadonlySet<MessageType> = new Set(["text", "request", "clarification", "document-query", "commercial-query", "shipment-exception"]);

/**
 * participants: everyone on the thread · exporter-internal: your team only ·
 * system: generated notes. (Ximverse-internal and party-specific messages are
 * never delivered to the exporter, so they don't exist in this data.)
 */
export type Visibility = "participants" | "exporter-internal" | "system";

export type RefKind = "rfq" | "quotation" | "negotiation" | "deal" | "order" | "shipment" | "document";

/** A pointer to a canonical record — never a copy of it. */
export interface EntityRef {
  kind: RefKind;
  id: string;
}

/** What a message asks for, and the canonical place where it gets done. */
export interface ActionRequest {
  label: string;
  /** Owner page that performs the action; Messages never does it. */
  href: string;
  /** When set, a Documents Center blocker that reflects whether the ask is met. */
  check?: { documentId: string; blockerKey: string };
}

export interface Message {
  id: string;
  threadId: string;
  sender: Role;
  type: MessageType;
  body: string;
  /** ISO timestamp. */
  at: string;
  visibility: Visibility;
  refs?: EntityRef[];
  action?: ActionRequest;
  /** Demo records — nothing was emailed, messaged or delivered externally. */
  demo: true;
}

export type Priority = "normal" | "important" | "urgent";

export const PRIORITY_LABEL: Record<Priority, string> = { normal: "Normal", important: "Important", urgent: "Urgent" };

export interface Thread {
  /** THR-YYYY-NNNN */
  id: string;
  subjectType: SubjectType;
  /** Canonical ID of the subject (RFQ, QT, NG, DL, ORD, DOC, SHP…). */
  subjectId: string;
  /** Related canonical records, for context and search. */
  refs: EntityRef[];
  topic: string;
  participants: Role[];
  /** Base priority; context can raise it (see threadState). */
  priority: Priority;
  createdAt: string;
  /** Seed read position: external messages after this start unread. */
  readAt?: string;
  messages: readonly Message[];
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

export type ReplyState = "needs-reply" | "awaiting-buyer" | "awaiting-cha" | "awaiting-ximverse" | "awaiting-forwarder" | "awaiting-other" | "resolved" | "no-reply-needed";

export const REPLY_STATE_LABEL: Record<ReplyState, string> = {
  "needs-reply": "Needs Your Reply",
  "awaiting-buyer": "Awaiting Buyer",
  "awaiting-cha": "Awaiting CHA",
  "awaiting-ximverse": "Awaiting Ximverse",
  "awaiting-forwarder": "Awaiting Forwarder",
  "awaiting-other": "Awaiting Response",
  resolved: "Resolved",
  "no-reply-needed": "No Reply Needed",
};

export type ThreadStatus = "open" | "action-required" | "awaiting-response" | "resolved";

export const THREAD_STATUS_LABEL: Record<ThreadStatus, string> = {
  open: "Open",
  "action-required": "Action Required",
  "awaiting-response": "Awaiting Response",
  resolved: "Resolved",
};

/** Context the thread can't know by itself (ETD of its shipment). */
export interface ThreadContext {
  /** ETD of the related shipment while it hasn't departed. */
  etd?: string;
}

export interface ThreadState {
  replyState: ReplyState;
  status: ThreadStatus;
  priority: Priority;
  /** Why priority was raised, when it was. */
  priorityReason?: string;
  unread: number;
  /** The latest message the exporter can see. */
  last?: Message;
  lastActivity: string;
  /** The open ask, if the latest external message carries one. */
  openAction?: ActionRequest;
  /** The external party whose message is waiting. */
  waitingOn?: Role;
}

const isExternal = (m: Message) => m.visibility === "participants" && m.sender !== "exporter" && m.sender !== "team";

const AWAIT: Partial<Record<Role, ReplyState>> = { buyer: "awaiting-buyer", cha: "awaiting-cha", ximverse: "awaiting-ximverse", forwarder: "awaiting-forwarder" };

/** Replays a thread's messages. readAt is the exporter's stored read position. */
export function threadState(t: Thread, readAt: string | undefined, ctx: ThreadContext = {}): ThreadState {
  const last = t.messages.at(-1);
  let lastAsk: Message | undefined;
  let lastExporter: Message | undefined;
  let lastResolution: Message | undefined;
  let lastReopen: Message | undefined;
  for (const m of t.messages) {
    if (m.type === "resolution") lastResolution = m;
    else if (m.type === "reopened") lastReopen = m;
    else if (isExternal(m) && ASKS_FOR_REPLY.has(m.type)) lastAsk = m;
    else if (m.sender === "exporter" && m.visibility === "participants") lastExporter = m;
  }
  const resolvedAt = lastResolution && (!lastReopen || lastResolution.at > lastReopen.at) ? lastResolution.at : undefined;
  // A new external ask after resolving reopens the conversation.
  const resolved = Boolean(resolvedAt && (!lastAsk || lastAsk.at <= resolvedAt));
  const counterpart = t.participants.find((p) => p !== "exporter" && p !== "team" && p !== "system");

  let replyState: ReplyState;
  if (resolved) replyState = "resolved";
  else if (lastAsk && (!lastExporter || lastAsk.at > lastExporter.at)) replyState = "needs-reply";
  else if (lastExporter) replyState = AWAIT[lastAsk?.sender ?? counterpart ?? "ximverse"] ?? "awaiting-other";
  else replyState = "no-reply-needed";

  const openAction = replyState === "needs-reply" ? lastAsk?.action : undefined;
  const status: ThreadStatus = resolved ? "resolved" : replyState === "needs-reply" ? (openAction ? "action-required" : "open") : replyState === "no-reply-needed" ? "open" : "awaiting-response";

  const read = readAt ?? t.readAt ?? t.createdAt;
  const unread = t.messages.filter((m) => isExternal(m) && m.at > read).length;

  let priority = t.priority;
  let priorityReason: string | undefined;
  if (!resolved && ctx.etd) {
    const days = daysBetween(DEMO_TODAY, ctx.etd);
    if (days <= 7) {
      priority = "urgent";
      priorityReason = days < 0 ? `ETD ${ctx.etd} has passed` : `ETD is in ${days} day${days === 1 ? "" : "s"}`;
    }
  }
  return {
    replyState,
    status,
    priority,
    priorityReason,
    unread,
    last,
    lastActivity: t.messages.at(-1)?.at ?? t.createdAt,
    openAction,
    waitingOn: replyState === "needs-reply" ? lastAsk?.sender : undefined,
  };
}

/** What a counterparty would see: everything except exporter-internal notes. */
export function externalProjection(t: Thread): Message[] {
  return t.messages.filter((m) => m.visibility !== "exporter-internal");
}

/** Text the inbox search runs over — IDs, topic and visible message bodies. */
export function searchText(t: Thread): string {
  return [t.id, t.topic, t.subjectId, ...t.refs.map((r) => r.id), ...t.messages.map((m) => m.body)].join(" ").toLowerCase();
}

/** The shipment a thread concerns: its subject, or a shipment ref (document threads carry one). */
export function shipmentOf(t: Thread): string | undefined {
  return t.subjectType === "shipment" ? t.subjectId : t.refs.find((r) => r.kind === "shipment")?.id;
}

/** ETD for priority — only while that shipment hasn't departed. */
export function threadContext(t: Thread, shipments: readonly ExporterShipment[]): ThreadContext {
  const sh = shipments.find((x) => x.id === shipmentOf(t));
  if (!sh) return {};
  const st = shipmentState(sh);
  return isPreDeparture(st.status) && st.status !== "cancelled" ? { etd: st.schedule.etd } : {};
}

export const LOCAL_THREAD_ID = /^THR-\d{4}-9\d{3,}$/;

export function nextThreadId(local: readonly { id: string }[], year: number): string {
  const max = local.reduce((m, t) => Math.max(m, Number(t.id.split("-")[2]) || 0), 9000);
  return `THR-${year}-${max + 1}`;
}

/** Inbox views — lenses over one collection. */
export type InboxView = "all" | "needs-reply" | "commercial" | "orders" | "documents" | "shipments" | "ximverse" | "resolved";

export const INBOX_VIEWS: { id: InboxView; label: string; match: (t: Thread, s: ThreadState) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "needs-reply", label: "Needs Reply", match: (_, s) => s.replyState === "needs-reply" },
  { id: "commercial", label: "Buyer / Commercial", match: (t) => ["rfq", "quotation", "negotiation", "deal"].includes(t.subjectType) || t.participants.includes("buyer") },
  { id: "orders", label: "Orders", match: (t) => t.subjectType === "order" },
  { id: "documents", label: "Documents", match: (t) => t.subjectType === "document" },
  { id: "shipments", label: "Shipments", match: (t) => t.subjectType === "shipment" || t.refs.some((r) => r.kind === "shipment") },
  { id: "ximverse", label: "Ximverse", match: (t) => t.participants.includes("ximverse") },
  { id: "resolved", label: "Resolved", match: (_, s) => s.status === "resolved" },
];

export const isQuery = (t: Thread, s: ThreadState) => s.status !== "resolved" && (t.subjectType === "document" || t.subjectType === "shipment" || t.messages.some((m) => m.type === "document-query" || m.type === "shipment-exception"));

// ---------------------------------------------------------------------------
// Seeds — every thread references an existing exporter transaction.
// ---------------------------------------------------------------------------

type SeedMessage = Omit<Message, "id" | "threadId" | "demo" | "visibility"> & { visibility?: Visibility };

function seeded(t: Omit<Thread, "messages">, messages: SeedMessage[]): Thread {
  return {
    ...t,
    messages: messages.map((m, i) => ({ visibility: m.sender === "system" ? "system" : "participants", ...m, id: `${t.id}-m${i + 1}`, threadId: t.id, demo: true })),
  };
}

const at = (date: string, time = "06:00") => `${date}T${time}:00Z`;
const shp = (id: string) => `/exporter/shipments/${id}`;

export const SEEDED_THREADS: readonly Thread[] = [
  // Document / Shipping Bill query — CHA proposed by Ximverse, before assignment on the shipment.
  seeded(
    {
      id: "THR-2026-8101",
      subjectType: "document",
      subjectId: "DOC-SHP-2026-8101-SB",
      refs: [{ kind: "shipment", id: "SHP-2026-8101" }, { kind: "order", id: "ORD-2026-8101" }, { kind: "document", id: "DOC-SHP-2026-8101-SB" }],
      topic: "Shipping Bill clarification",
      participants: ["exporter", "cha", "ximverse"],
      priority: "important",
      createdAt: at("2026-10-06", "13:30"),
      readAt: at("2026-10-06", "15:00"),
    },
    [
      { sender: "ximverse", type: "status-update", at: at("2026-10-06", "13:30"), body: "Shipping Bill data preparation has started for SHP-2026-8101. Kandla Clearing Agency (demo) can review once a CHA is assigned on the shipment.", refs: [{ kind: "document", id: "DOC-SHP-2026-8101-SB" }] },
      {
        sender: "cha",
        type: "document-query",
        at: at("2026-10-06", "14:00"),
        body: "Please confirm gross weight and package count for the 60 MT before we review the Shipping Bill data.",
        refs: [{ kind: "shipment", id: "SHP-2026-8101" }],
        action: { label: "Update cargo details", href: `${shp("SHP-2026-8101")}#cargo`, check: { documentId: "DOC-SHP-2026-8101-SB", blockerKey: "cargo" } },
      },
      { sender: "exporter", type: "text", at: at("2026-10-06", "14:40"), body: "Package count is 2,400 bags. Gross weight will be updated on the shipment shortly." },
      { sender: "team", type: "text", visibility: "exporter-internal", at: at("2026-10-06", "14:45"), body: "Weighbridge slip for the 60 MT lot is with the Karnal unit — get it before updating." },
      {
        sender: "cha",
        type: "document-query",
        at: at("2026-10-07", "05:30"),
        body: "Thanks. Please also confirm the Shipping Instructions once final — the Shipping Bill can't move to filing before that.",
        refs: [{ kind: "document", id: "DOC-SHP-2026-8101-SI" }],
        action: { label: "Finalise Shipping Instructions", href: `${shp("SHP-2026-8101")}#instructions`, check: { documentId: "DOC-SHP-2026-8101-SB", blockerKey: "instructions" } },
      },
    ],
  ),
  // Buyer commercial clarification during a live negotiation.
  seeded(
    {
      id: "THR-2026-8102",
      subjectType: "negotiation",
      subjectId: "NG-2026-8102",
      refs: [{ kind: "negotiation", id: "NG-2026-8102" }, { kind: "quotation", id: "QT-2026-8187" }],
      topic: "Packaging for the revised offer",
      participants: ["exporter", "buyer", "ximverse"],
      priority: "important",
      createdAt: at("2026-10-06", "16:50"),
      readAt: at("2026-10-06", "16:00"),
    },
    [
      { sender: "system", type: "system-note", at: at("2026-10-06", "16:45"), body: "The buyer requested a revision on NG-2026-8102 (delivery date and packaging). The request itself is in the negotiation history.", refs: [{ kind: "negotiation", id: "NG-2026-8102" }] },
      { sender: "buyer", type: "commercial-query", at: at("2026-10-06", "16:50"), body: "Please confirm whether 20 kg paper bag packaging can be maintained for the final shipment, not only the first lot.", action: { label: "Respond in the negotiation", href: "/exporter/negotiations/NG-2026-8102" } },
    ],
  ),
  // Deal communication after agreement — Ximverse relays verification.
  seeded(
    {
      id: "THR-2026-8103",
      subjectType: "deal",
      subjectId: "DL-2026-8101",
      refs: [{ kind: "deal", id: "DL-2026-8101" }, { kind: "negotiation", id: "NG-2026-8103" }, { kind: "order", id: "ORD-2026-8101" }],
      topic: "Deal confirmation and buyer verification",
      participants: ["exporter", "ximverse"],
      priority: "normal",
      createdAt: at("2026-09-12", "12:00"),
      readAt: at("2026-09-14", "10:00"),
    },
    [
      { sender: "system", type: "system-note", at: at("2026-09-12", "12:00"), body: "Negotiation agreement reached on NG-2026-8103 at $1,085 / MT. Deal DL-2026-8101 created.", refs: [{ kind: "deal", id: "DL-2026-8101" }] },
      { sender: "ximverse", type: "status-update", at: at("2026-09-12", "13:00"), body: "Buyer verification is in progress. The buyer's identity stays protected until Ximverse completes it." },
      { sender: "exporter", type: "text", at: at("2026-09-14", "09:30"), body: "Noted. We have confirmed order ORD-2026-8101 and started planning production. Please update us when verification completes." },
    ],
  ),
  // Order cargo-ready query.
  seeded(
    {
      id: "THR-2026-8104",
      subjectType: "order",
      subjectId: "ORD-2026-8101",
      refs: [{ kind: "order", id: "ORD-2026-8101" }],
      topic: "Expected cargo-ready date",
      participants: ["exporter", "buyer", "ximverse"],
      priority: "normal",
      createdAt: at("2026-10-02", "05:00"),
      readAt: at("2026-10-02", "06:00"),
    },
    [
      { sender: "buyer", type: "clarification", at: at("2026-10-02", "05:00"), body: "Please confirm the expected cargo-ready date for this order." },
      { sender: "exporter", type: "text", at: at("2026-10-02", "07:00"), body: "Production is in progress. The expected cargo-ready date is 9 Oct; it is recorded on the order.", refs: [{ kind: "order", id: "ORD-2026-8101" }] },
    ],
  ),
  // Shipment scheduling exception — the schedule itself stays with the shipment.
  seeded(
    {
      id: "THR-2026-8105",
      subjectType: "shipment",
      subjectId: "SHP-2026-8104",
      refs: [{ kind: "shipment", id: "SHP-2026-8104" }, { kind: "order", id: "ORD-2026-8102" }],
      topic: "Possible ETD change",
      participants: ["exporter", "forwarder", "ximverse"],
      priority: "important",
      createdAt: at("2026-10-07", "04:00"),
      readAt: at("2026-10-07", "03:00"),
    },
    [
      { sender: "forwarder", type: "shipment-exception", at: at("2026-10-07", "04:00"), body: "The carrier advises the 9 Oct sailing may move to 11 Oct. Not yet confirmed — we will revert with the final schedule.", refs: [{ kind: "shipment", id: "SHP-2026-8104" }] },
      { sender: "ximverse", type: "status-update", at: at("2026-10-07", "04:30"), body: "The shipment schedule is unchanged until the forwarder confirms. Update the ETD on the shipment only once it does." },
    ],
  ),
  // Ximverse support on an order requirement.
  seeded(
    {
      id: "THR-2026-8106",
      subjectType: "order",
      subjectId: "ORD-2026-8104",
      refs: [{ kind: "order", id: "ORD-2026-8104" }, { kind: "document", id: "DOC-ORD-2026-8104-FUMIGATION" }],
      topic: "Fumigation arrangement",
      participants: ["exporter", "ximverse"],
      priority: "normal",
      createdAt: at("2026-10-06", "09:00"),
      readAt: at("2026-10-06", "08:00"),
    },
    [
      {
        sender: "ximverse",
        type: "request",
        at: at("2026-10-06", "09:00"),
        body: "Fumigation for ORD-2026-8104 is still to be arranged. Would you like Ximverse to suggest an agency near the loading port?",
        refs: [{ kind: "document", id: "DOC-ORD-2026-8104-FUMIGATION" }],
        action: { label: "Track fumigation on the order", href: "/exporter/orders/ORD-2026-8104" },
      },
    ],
  ),
  // RFQ clarification, already resolved.
  seeded(
    {
      id: "THR-2026-8107",
      subjectType: "rfq",
      subjectId: "RFQ-2026-0048",
      refs: [{ kind: "rfq", id: "RFQ-2026-0048" }],
      topic: "Private-label artwork timing",
      participants: ["exporter", "ximverse"],
      priority: "normal",
      createdAt: at("2026-10-06", "11:00"),
      readAt: at("2026-10-06", "12:30"),
    },
    [
      { sender: "exporter", type: "text", at: at("2026-10-06", "11:00"), body: "The RFQ asks for the buyer's private label on 25 kg bags. When would label artwork be shared?" },
      { sender: "ximverse", type: "clarification", at: at("2026-10-06", "12:00"), body: "Artwork is shared after award. Please quote on the stated specification and packaging." },
      { sender: "exporter", type: "resolution", at: at("2026-10-06", "12:30"), body: "Marked resolved — we will quote on the stated packaging." },
    ],
  ),
];

export const SEEDED_THREAD_IDS = SEEDED_THREADS.map((t) => t.id);

export function findSeededThread(id: string): Thread | undefined {
  return SEEDED_THREADS.find((t) => t.id === id);
}

/** The first thread about a subject (e.g. a document), for "Discuss" links. */
export function threadForSubject(threads: readonly Thread[], subjectId: string): Thread | undefined {
  return threads.find((t) => t.subjectId === subjectId) ?? threads.find((t) => t.refs.some((r) => r.id === subjectId && r.kind !== "order"));
}

// ---------------------------------------------------------------------------
// SUMIT — counts and dates the threads carry, nothing inferred.
// ---------------------------------------------------------------------------

export function communicationInsights(rows: readonly { t: Thread; s: ThreadState }[]): string[] {
  const out: string[] = [];
  const waiting = rows.filter((r) => r.s.replyState === "needs-reply");
  out.push(waiting.length ? `You have ${waiting.length} conversation${waiting.length === 1 ? "" : "s"} awaiting your response.` : "No conversation is waiting for your reply.");
  const urgent = rows.filter((r) => r.s.priority === "urgent" && r.s.status !== "resolved");
  if (urgent[0]) out.push(`The most urgent thread is “${urgent[0].t.topic}” on ${urgent[0].t.refs.find((x) => x.kind === "shipment")?.id ?? urgent[0].t.subjectId} because its ${urgent[0].s.priorityReason}.`);
  for (const r of waiting.filter((x) => x.s.waitingOn === "buyer").slice(0, 2)) out.push(`The buyer (via Ximverse) is waiting for your reply on ${r.t.subjectId}: “${r.t.topic}”.`);
  const unread = rows.reduce((n, r) => n + r.s.unread, 0);
  if (unread) out.push(`${unread} unread message${unread === 1 ? "" : "s"} across ${rows.filter((r) => r.s.unread).length} thread${rows.filter((r) => r.s.unread).length === 1 ? "" : "s"}.`);
  return out;
}
