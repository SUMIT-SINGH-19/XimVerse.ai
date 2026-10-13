/*
 * Notifications & Action Center: derived signals, never business state.
 *
 * Every signal is rebuilt from its canonical source on each call, using that
 * source's own rules:
 *
 *   threads     → threadState                          (exporter-communications)
 *   negotiations→ negotiationStatus / needsExporterResponse
 *   quotations  → buildPipeline presented status / validity
 *   deals       → dealStatus + orderForDeal
 *   orders      → actionsRequired / shipmentEligibility (exporter-orders, -shipments)
 *   shipments   → shipmentActions / shipmentState
 *   documents   → the Step 12 document index (blockers, credentials, expiry)
 *
 * Only read / dismissed interaction state is stored (exporter-notification-store);
 * when a source condition stops being true, its signal simply isn't produced.
 *
 * IDs are deterministic: NTF-<SOURCE ID>-<CONDITION>, e.g.
 * NTF-THR-2026-8101-REPLY, NTF-DOC-SHP-2026-8101-SB-BLOCKED,
 * NTF-ORD-2026-8101-ACTIONS, NTF-NG-2026-8102-RESPONSE, NTF-COMP-ORGANIC-PENDING.
 * The fingerprint changes when the signal's content changes (e.g. blocker
 * count), so a read signal resurfaces as unread only when there's news.
 */

import { threadState, threadContext, ROLE_LABEL, type Thread } from "./exporter-communications";
import { dealStatus, type ExporterDeal } from "./exporter-deals";
import type { DocumentItem } from "./exporter-documents";
import { lastActivity, NEGOTIATION_STATUS_LABEL, needsExporterResponse, negotiationStatus, type ExporterNegotiation } from "./exporter-negotiations";
import { BUYER_OPPORTUNITIES, findOpportunity, isOpen, OPPORTUNITIES_NOW, shortCountry } from "./exporter-opportunities";
import { actionsRequired, isActiveOrder, orderForDeal, type ExporterOrder } from "./exporter-orders";
import type { PipelineRow } from "./exporter-quotation-pipeline";
import { DEMO_TODAY, daysBetween } from "./exporter-quotations";
import {
  formatShortDate,
  isArrivingSoon,
  isPreDeparture,
  orderStateWithShipments,
  shipmentActions,
  shipmentEligibility,
  shipmentState,
  type ExporterShipment,
} from "./exporter-shipments";

export type NotificationCategory = "commercial" | "message" | "order" | "document" | "shipment" | "compliance" | "system";
export type Severity = "info" | "attention" | "urgent";

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  commercial: "Commercial",
  message: "Message",
  order: "Order",
  document: "Document",
  shipment: "Shipment",
  compliance: "Compliance",
  system: "System",
};

export const SEVERITY_LABEL: Record<Severity, string> = { info: "Info", attention: "Attention", urgent: "Urgent" };

export type SourceType = "thread" | "rfq" | "quotation" | "negotiation" | "deal" | "order" | "shipment" | "document" | "company";

export interface NotificationSignal {
  id: string;
  sourceType: SourceType;
  sourceId: string;
  category: NotificationCategory;
  severity: Severity;
  actionRequired: boolean;
  title: string;
  description: string;
  /** Canonical page where the condition is resolved. */
  href: string;
  cta: string;
  /** When the source last changed, if it records it. */
  occurredAt?: string;
  /** A relevant date (ETD, expiry, due) in words. */
  timing?: string;
  /** IDs and context shown on the card — never buyer identity. */
  refs: string[];
  context: string[];
  /** Changes whenever the signal's content changes. */
  fingerprint: string;
  /** For message signals: the source itself still has unread messages. */
  sourceUnread?: boolean;
  /** Informational notices may be dismissed; action items stay until resolved. */
  dismissible: boolean;
}

export interface SignalSources {
  orders: readonly ExporterOrder[];
  shipments: readonly ExporterShipment[];
  deals: readonly ExporterDeal[];
  negotiations: readonly ExporterNegotiation[];
  pipeline: readonly PipelineRow[];
  threads: readonly Thread[];
  threadRead: Readonly<Record<string, string>>;
  documents: readonly DocumentItem[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const etdTiming = (etd?: string) => {
  if (!etd) return undefined;
  const d = daysBetween(DEMO_TODAY, etd);
  return d < 0 ? `ETD ${formatShortDate(etd)} passed` : `ETD in ${plural(d, "day")} (${formatShortDate(etd)})`;
};
const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Where an order lives, for context lines. */
function orderContext(o: ExporterOrder | undefined): string[] {
  if (!o) return [];
  const opp = findOpportunity(o.requirementId);
  return [o.terms.productName, ...(opp ? [shortCountry(opp.delivery.destinationCountry)] : [])];
}

// ---------------------------------------------------------------------------
// Builders, one per source. Each returns only the conditions true right now.
// ---------------------------------------------------------------------------

function messageSignals(src: SignalSources): NotificationSignal[] {
  const out: NotificationSignal[] = [];
  for (const t of src.threads) {
    const s = threadState(t, src.threadRead[t.id], threadContext(t, src.shipments));
    if (s.status === "resolved") continue;
    const refs = [t.id, t.subjectId];
    const href = `/exporter/messages/${t.id}`;
    const last = s.last?.id ?? "";
    // One signal per thread: a reply request outranks a plain unread notice.
    if (s.replyState === "needs-reply") {
      const who = s.waitingOn ? ROLE_LABEL[s.waitingOn] : "The other party";
      const ask = [...t.messages].reverse().find((m) => m.sender === s.waitingOn);
      out.push({
        id: `NTF-${t.id}-REPLY`,
        sourceType: "thread",
        sourceId: t.id,
        category: "message",
        severity: s.priority === "urgent" ? "urgent" : "attention",
        actionRequired: true,
        title: s.waitingOn === "buyer" ? "Buyer reply required" : `${who} is waiting for your reply`,
        description: `${t.topic}: “${clip(ask?.body ?? "")}”`,
        href,
        cta: "Open Thread",
        occurredAt: s.lastActivity,
        timing: s.priorityReason,
        refs,
        context: [`${who}${s.unread ? ` · ${plural(s.unread, "unread message")}` : ""}`],
        fingerprint: `${last}|${s.priority}`,
        sourceUnread: s.unread > 0,
        dismissible: false,
      });
    } else if (s.unread > 0) {
      out.push({
        id: `NTF-${t.id}-UNREAD`,
        sourceType: "thread",
        sourceId: t.id,
        category: "message",
        severity: "info",
        actionRequired: false,
        title: `New message — ${t.topic}`,
        description: s.last ? `${ROLE_LABEL[s.last.sender]}: “${clip(s.last.body)}”` : t.topic,
        href,
        cta: "Open Thread",
        occurredAt: s.lastActivity,
        refs,
        context: [plural(s.unread, "unread message")],
        fingerprint: last,
        sourceUnread: true,
        dismissible: true,
      });
    }
  }
  return out;
}

function commercialSignals(src: SignalSources): NotificationSignal[] {
  const out: NotificationSignal[] = [];
  for (const n of src.negotiations) {
    const status = negotiationStatus(n);
    const base = { sourceType: "negotiation" as const, sourceId: n.id, category: "commercial" as const, href: `/exporter/negotiations/${n.id}`, cta: "Open Negotiation", occurredAt: lastActivity(n), refs: [n.id, n.quotationId], context: ["Buyer via Ximverse"] };
    if (needsExporterResponse(status)) {
      out.push({
        ...base,
        id: `NTF-${n.id}-RESPONSE`,
        severity: "attention",
        actionRequired: true,
        title: status === "revision-requested" ? "Revision requested" : status === "draft-counter" ? "Counter offer drafted, not sent" : "Buyer counter received",
        description: `${NEGOTIATION_STATUS_LABEL[status]} on ${n.quotationId}. Respond in the negotiation.`,
        fingerprint: `${status}|${lastActivity(n)}`,
        dismissible: false,
      });
    } else if (status === "agreed") {
      const deal = src.deals.find((d) => d.negotiationId === n.id);
      if (!deal) {
        out.push({ ...base, id: `NTF-${n.id}-AGREED`, severity: "attention", actionRequired: true, title: "Agreement reached — create the deal", description: `The buyer agreed on ${n.quotationId}. The deal hasn't been created yet.`, fingerprint: "agreed", dismissible: false });
      }
    }
  }
  for (const r of src.pipeline) {
    const q = r.quotation;
    if (!q) continue;
    const base = { sourceType: "quotation" as const, sourceId: q.id, category: "commercial" as const, href: `/exporter/quotations/${q.id}`, cta: "Open Quotation", occurredAt: r.activityAt, refs: [q.id, r.rfqId], context: [r.productName, ...(r.destinationCountry ? [shortCountry(r.destinationCountry)] : [])] };
    if (r.status === "shortlisted") {
      out.push({ ...base, id: `NTF-${q.id}-SHORTLISTED`, category: "system", severity: "info", actionRequired: false, title: "Quotation shortlisted", description: `${q.id} is on the buyer's shortlist.`, fingerprint: "shortlisted", dismissible: true });
    }
    if (r.status === "accepted" && !r.negotiationId && !src.deals.some((d) => d.quotationId === q.id)) {
      out.push({ ...base, id: `NTF-${q.id}-DEAL`, severity: "attention", actionRequired: true, title: "Accepted quotation ready for a deal", description: `${q.id} was accepted. Create the deal to lock the terms.`, fingerprint: "accepted", dismissible: false });
    }
    if (r.validUntil && ["submitted", "under-review", "shortlisted"].includes(r.status)) {
      const days = daysBetween(DEMO_TODAY, r.validUntil);
      if (days >= 0 && days <= 3) {
        out.push({ ...base, id: `NTF-${q.id}-VALIDITY`, severity: days <= 1 ? "urgent" : "attention", actionRequired: true, title: "Quotation validity ending", description: `${q.id} is valid until ${formatShortDate(r.validUntil)}.`, timing: `Valid ${plural(days, "more day")}`, fingerprint: r.validUntil, dismissible: false });
      }
    }
  }
  // New opportunities closing soon, not yet quoted.
  const quoted = new Set(src.pipeline.map((r) => r.rfqId));
  for (const o of BUYER_OPPORTUNITIES.filter(isOpen)) {
    if (quoted.has(o.rfqId)) continue;
    const hours = (Date.parse(o.quotesDueAt) - Date.parse(OPPORTUNITIES_NOW)) / 3_600_000;
    if (hours < 0 || hours > 48) continue;
    out.push({
      id: `NTF-${o.rfqId}-DUE`,
      sourceType: "rfq",
      sourceId: o.rfqId,
      category: "commercial",
      severity: hours <= 24 ? "urgent" : "attention",
      actionRequired: true,
      title: "Quotation deadline approaching",
      description: `${o.product.name} → ${o.delivery.destinationLocation}. Quotes close soon.`,
      href: `/exporter/opportunities/${o.rfqId}`,
      cta: "Open Opportunity",
      timing: `Due in ${Math.max(1, Math.round(hours))} h`,
      refs: [o.rfqId],
      context: ["Buyer via Ximverse", `${o.quantity.amount.toLocaleString("en-US")} ${o.quantity.unit}`],
      fingerprint: o.quotesDueAt,
      dismissible: false,
    });
  }
  for (const d of src.deals) {
    const status = dealStatus(d);
    const base = { sourceType: "deal" as const, sourceId: d.id, category: "commercial" as const, href: `/exporter/deals/${d.id}`, cta: "Open Deal", refs: [d.id, d.quotationId], context: [d.terms.productName] };
    if (status === "pending-setup") {
      out.push({ ...base, id: `NTF-${d.id}-CONFIRM`, severity: "attention", actionRequired: true, title: "Deal needs your confirmation", description: `Confirm the agreed terms on ${d.id}.`, fingerprint: status, dismissible: false });
    } else if ((status === "confirmed" || status === "ready-for-execution") && !orderForDeal(d.id, src.orders)) {
      out.push({ ...base, id: `NTF-${d.id}-ORDER`, severity: "attention", actionRequired: true, title: "Confirmed deal ready for an order", description: `Create the order for ${d.id}.`, fingerprint: status, dismissible: false });
    }
  }
  return out;
}

/** Document-related order actions are covered by the grouped document signal. */
const DOCUMENT_ACTION = /document|arranged/i;

function orderSignals(src: SignalSources): NotificationSignal[] {
  const out: NotificationSignal[] = [];
  for (const o of src.orders) {
    const s = orderStateWithShipments(o, src.shipments);
    if (!isActiveOrder(s.status)) continue;
    const context = orderContext(o);
    const actions = actionsRequired(o, s).filter((a) => !DOCUMENT_ACTION.test(a));
    if (actions.length) {
      out.push({
        id: `NTF-${o.id}-ACTIONS`,
        sourceType: "order",
        sourceId: o.id,
        category: "order",
        severity: "attention",
        actionRequired: true,
        title: actions.length === 1 ? actions[0] : `${plural(actions.length, "order action")} outstanding`,
        description: actions.length === 1 ? `Recorded on ${o.id} — resolve it on the order.` : actions.join(" · "),
        href: `/exporter/orders/${o.id}`,
        cta: "Open Order",
        occurredAt: s.updatedAt,
        timing: s.production.expectedCargoReady && !s.production.actualCargoReady ? `Cargo ready ${formatShortDate(s.production.expectedCargoReady)} (expected)` : undefined,
        refs: [o.id],
        context,
        fingerprint: actions.join("|"),
        dismissible: false,
      });
    }
    const docs = src.documents.filter((d) => d.ownerType === "order" && d.ownerId === o.id && d.attention);
    if (docs.length) {
      out.push({
        id: `NTF-${o.id}-DOCS`,
        sourceType: "order",
        sourceId: o.id,
        category: "document",
        severity: "attention",
        actionRequired: true,
        title: `${plural(docs.length, "order document")} ${docs.length === 1 ? "needs" : "need"} attention`,
        description: docs.map((d) => `${d.title} (${d.sourceStatus.toLowerCase()})`).join(" · "),
        href: `/exporter/orders/${o.id}`,
        cta: "Open Order",
        refs: [o.id, ...docs.map((d) => d.id)],
        context,
        fingerprint: docs.map((d) => `${d.id}:${d.status}`).join("|"),
        dismissible: false,
      });
    }
    const eligible = shipmentEligibility(o, s);
    if (eligible.ok && s.quantities.allocated === 0 && s.production.status === "completed") {
      out.push({
        id: `NTF-${o.id}-SHIPMENT`,
        sourceType: "order",
        sourceId: o.id,
        category: "order",
        severity: "info",
        actionRequired: true,
        title: "Order ready for a shipment",
        description: `${eligible.available.toLocaleString("en-US")} ${o.terms.quantity.unit} produced and unallocated.${eligible.warnings.length ? ` Outstanding: ${eligible.warnings.join(", ")}.` : ""}`,
        href: `/exporter/shipments/new?order=${o.id}`,
        cta: "Create Shipment",
        refs: [o.id],
        context,
        fingerprint: `${eligible.available}|${eligible.warnings.join("|")}`,
        dismissible: false,
      });
    }
  }
  return out;
}

/** Shipment actions the Shipping Bill blocker signal already covers. */
const COVERED_BY_SB = new Set(["cargo", "containers", "instructions", "documents", "order"]);

function shipmentSignals(src: SignalSources): NotificationSignal[] {
  const out: NotificationSignal[] = [];
  for (const sh of src.shipments) {
    const order = src.orders.find((o) => o.id === sh.orderId);
    if (!order) continue;
    const st = shipmentState(sh);
    if (st.status === "cancelled") continue;
    const os = orderStateWithShipments(order, src.shipments);
    const pre = isPreDeparture(st.status);
    const etd = pre ? st.schedule.etd : undefined;
    const soon = etd !== undefined && daysBetween(DEMO_TODAY, etd) <= 7;
    const context = [sh.orderId, ...orderContext(order).slice(1)];
    const sb = src.documents.find((d) => d.id === `DOC-${sh.id}-SB`);

    if (sb?.blocking) {
      const failing = sb.blockers.filter((b) => !b.done);
      out.push({
        id: `NTF-${sb.id}-BLOCKED`,
        sourceType: "document",
        sourceId: sb.id,
        category: "document",
        severity: soon ? "urgent" : "attention",
        actionRequired: true,
        title: "Shipping Bill blocked",
        description: `${plural(failing.length, "prerequisite")} outstanding for ${sb.blockedStep}: ${failing.slice(0, 3).map((b) => b.detail ?? b.label).join(", ")}${failing.length > 3 ? ` and ${failing.length - 3} more` : ""}.`,
        href: `/exporter/documents/${sb.id}`,
        cta: "Why blocked?",
        occurredAt: st.updatedAt,
        timing: etdTiming(etd),
        refs: [sh.id, sb.id],
        context,
        fingerprint: failing.map((b) => b.key).join("|"),
        dismissible: false,
      });
    }
    // Remaining shipment actions (freight, customs queries, BL, delivery), grouped per shipment.
    const sbCovered = sb?.blocking ?? false;
    const actions = shipmentActions(sh, st, os).filter((a) => !(sbCovered && (COVERED_BY_SB.has(a.section) || (a.section === "customs" && /CHA|Shipping Bill/.test(a.text)))) && a.section !== "documents" && a.section !== "order");
    if (actions.length) {
      out.push({
        id: `NTF-${sh.id}-ACTIONS`,
        sourceType: "shipment",
        sourceId: sh.id,
        category: "shipment",
        severity: soon ? "urgent" : "attention",
        actionRequired: true,
        title: actions.length === 1 ? actions[0].text : `${plural(actions.length, "shipment action")} outstanding`,
        description: actions.map((a) => a.text).join(" · "),
        href: `/exporter/shipments/${sh.id}#${actions[0].section}`,
        cta: "Open Shipment",
        occurredAt: st.updatedAt,
        timing: etdTiming(etd),
        refs: [sh.id],
        context,
        fingerprint: actions.map((a) => a.text).join("|"),
        dismissible: false,
      });
    }
    const bl = src.documents.find((d) => d.ownerId === sh.id && d.stage === "Transport" && d.code !== "CONTAINERS" && d.attention && d.status === "needs-review");
    if (bl) {
      out.push({ id: `NTF-${bl.id}-REVIEW`, sourceType: "document", sourceId: bl.id, category: "document", severity: "attention", actionRequired: true, title: `${bl.title} draft to review`, description: `The ${bl.title} draft for ${sh.id} is waiting for your review (demo).`, href: `/exporter/documents/${bl.id}`, cta: "Open Document", occurredAt: st.updatedAt, refs: [sh.id, bl.id], context, fingerprint: bl.status, dismissible: false });
    }
    // Informational milestones — the meaningful ones only.
    const info = (id: string, title: string, description: string, timing?: string) =>
      out.push({ id: `NTF-${sh.id}-${id}`, sourceType: "shipment", sourceId: sh.id, category: "system", severity: "info", actionRequired: false, title, description, href: `/exporter/shipments/${sh.id}`, cta: "Open Shipment", occurredAt: st.updatedAt, timing, refs: [sh.id], context, fingerprint: st.status, dismissible: true });
    if (st.status === "ready-to-ship") info("READY", "Ready for departure", `LEO received (demo) for ${sh.id}; awaiting departure.`, etdTiming(st.schedule.etd));
    if (isArrivingSoon(st) && st.schedule.eta) info("ARRIVING", "Arrival approaching", `${sh.id} is in transit to ${sh.route.portOfDischarge}.`, `ETA ${formatShortDate(st.schedule.eta)}`);
    if (st.status === "delivered" && st.milestones.delivered && daysBetween(st.milestones.delivered.slice(0, 10), DEMO_TODAY) <= 14) info("DELIVERED", "Shipment delivered", `${sh.id} was delivered to ${sh.route.finalDelivery}.`, `Delivered ${formatShortDate(st.milestones.delivered)}`);
  }
  return out;
}

function complianceSignals(src: SignalSources): NotificationSignal[] {
  return src.documents
    .filter((d) => d.ownerType === "company" && d.attention)
    .map((d): NotificationSignal => {
      const expiring = d.expiry && d.expiry.band !== "valid";
      return {
        id: `NTF-${d.id.replace(/^DOC-/, "")}-${expiring ? "EXPIRY" : "PENDING"}`,
        sourceType: "company",
        sourceId: d.id,
        category: "compliance",
        severity: expiring && (d.expiry!.band === "expired" || d.expiry!.band === "7" || d.expiry!.band === "30") ? "urgent" : "attention",
        actionRequired: true,
        title: expiring ? `${d.title} ${d.expiry!.band === "expired" ? "expired" : "expiring"}` : `${d.title} pending`,
        description: expiring ? d.expiry!.label : `${d.title} is ${d.sourceStatus.toLowerCase()} on the Company Profile.`,
        href: d.source.href,
        cta: "Open Company Profile",
        timing: d.expiry?.label,
        refs: [d.id],
        context: ["Company Profile"],
        fingerprint: `${d.status}|${d.expiry?.band ?? ""}`,
        dismissible: false,
      };
    });
}

export function buildSignals(src: SignalSources): NotificationSignal[] {
  return [...messageSignals(src), ...commercialSignals(src), ...orderSignals(src), ...shipmentSignals(src), ...complianceSignals(src)];
}

// ---------------------------------------------------------------------------
// Interaction state applied on top — read / dismissed, nothing else.
// ---------------------------------------------------------------------------

export interface InteractionState {
  /** notificationId → fingerprint the user read. */
  read: Readonly<Record<string, string>>;
  /** notificationId → fingerprint dismissed (informational only). */
  dismissed: Readonly<Record<string, string>>;
}

export interface NotificationView extends NotificationSignal {
  unread: boolean;
}

/**
 * Unread unless the user read this exact fingerprint. Message signals are read
 * once their thread has no unread messages — opening the thread reads them.
 */
export function applyInteraction(signals: readonly NotificationSignal[], state: InteractionState): NotificationView[] {
  return signals
    .filter((s) => !(s.dismissible && state.dismissed[s.id] === s.fingerprint))
    .map((s) => ({ ...s, unread: s.sourceType === "thread" ? Boolean(s.sourceUnread) && state.read[s.id] !== s.fingerprint : state.read[s.id] !== s.fingerprint }));
}

const SEVERITY_RANK: Record<Severity, number> = { urgent: 0, attention: 1, info: 2 };

/** Urgent → action required → unread → most recent. */
export function attentionOrder(a: NotificationView, b: NotificationView): number {
  return (
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    Number(b.actionRequired) - Number(a.actionRequired) ||
    Number(b.unread) - Number(a.unread) ||
    (b.occurredAt ?? "").localeCompare(a.occurredAt ?? "")
  );
}

// ---------------------------------------------------------------------------
// Summaries and SUMIT — counts of the signals above, nothing more.
// ---------------------------------------------------------------------------

export function signalSummary(list: readonly NotificationSignal[]) {
  const action = list.filter((s) => s.actionRequired);
  return {
    urgent: list.filter((s) => s.severity === "urgent").length,
    action: action.length,
    replies: list.filter((s) => s.sourceType === "thread" && s.actionRequired).length,
    blockers: action.filter((s) => s.category === "document" || s.category === "shipment").length,
    commercial: action.filter((s) => s.category === "commercial").length,
    compliance: action.filter((s) => s.category === "compliance").length,
    orders: action.filter((s) => s.category === "order").length,
  };
}

export function notificationInsights(list: readonly NotificationView[]): string[] {
  const out: string[] = [];
  const sorted = [...list].sort(attentionOrder);
  const top = sorted.find((s) => s.severity === "urgent");
  if (top) out.push(`Your most urgent action is “${top.title}” on ${top.refs[0]}${top.timing ? `; ${/^[A-Z]{2}/.test(top.timing) ? top.timing : top.timing.charAt(0).toLowerCase() + top.timing.slice(1)}` : ""}.`);
  const sum = signalSummary(list);
  const parts = [sum.replies && plural(sum.replies, "conversation") + " waiting for a response", sum.blockers && plural(sum.blockers, "shipment/document blocker"), sum.commercial && plural(sum.commercial, "commercial action")].filter(Boolean) as string[];
  if (parts.length) out.push(`You have ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]}.`);
  const ready = list.find((s) => s.id.endsWith("-SHIPMENT"));
  if (ready) out.push(`${ready.sourceId} is ready for its next execution step — a shipment can be created${ready.description.includes("Outstanding") ? ", with items still outstanding" : ""}.`);
  const unread = list.filter((s) => s.unread).length;
  out.push(unread ? `${plural(unread, "notification")} unread.` : "Everything is read.");
  return out;
}
