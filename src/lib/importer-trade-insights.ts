/**
 * Trade insights: fixed, deterministic rules over the importer's own XimVerse
 * records. No external market, trade or price data; no predictions; no AI.
 * Every insight states its evidence and links to the workspace that owns it.
 * Rules reuse the report layer and each feature's own definitions.
 */

import { importerHref } from "./importer-nav";
import { orderStatus, orderValue } from "./importer-orders";
import {
  filterReportData,
  formatMoney,
  NO_FILTERS,
  negotiatedPriceChange,
  type ReportData,
  type ReportFilters,
} from "./importer-reports";
import { findSupplier } from "./importer-suppliers";
import { shipmentState } from "./importer-shipments";
import type { Currency } from "./import-requirements";

export const INSIGHTS_NOTICE = "Insights are based only on information recorded in your XimVerse workspace. No external market or trade database is connected.";
export const ORDERING_NOTE = "Insights are ordered by action priority using fixed rules, not AI.";

export type InsightCategory = "sourcing" | "supplier" | "orders" | "shipments" | "documents" | "customs" | "costs" | "payments";
export const CATEGORY_LABEL: Record<InsightCategory, string> = {
  sourcing: "Sourcing",
  supplier: "Supplier",
  orders: "Orders",
  shipments: "Shipments",
  documents: "Documents",
  customs: "Customs",
  costs: "Costs",
  payments: "Payments",
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL) as InsightCategory[];

export type InsightSeverity = "action" | "watch" | "positive" | "information";
export const SEVERITY_LABEL: Record<InsightSeverity, string> = { action: "Action", watch: "Watch", positive: "Positive", information: "Information" };
export const SEVERITY_ORDER: readonly InsightSeverity[] = ["action", "watch", "positive", "information"];

export interface TradeInsight {
  /** Stable: rule + entity (or "portfolio"). */
  id: string;
  rule: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  /** The factual basis, e.g. "ORD-2026-0003 · LC expiry: 31 Oct 2026 · 24 days remaining". */
  evidence: string[];
  metric?: string;
  relatedEntityIds: string[];
  supplierIds: string[];
  products: string[];
  action: { label: string; href: string };
}

const pct = (n: number) => `${Math.round(n * 10) / 10}%`;
const plural = (n: number, w: string, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`;
const fmtDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
const supplierName = (id: string) => findSupplier(id)?.name ?? id;

export function compareInsights(a: TradeInsight, b: TradeInsight): number {
  return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.id.localeCompare(b.id);
}

export function buildTradeInsights(input: ReportData, filters: ReportFilters = NO_FILTERS): TradeInsight[] {
  const d = filterReportData(input, filters);
  const out: TradeInsight[] = [];
  const add = (i: Omit<TradeInsight, "id" | "supplierIds" | "products"> & { scope: string; supplierIds?: string[]; products?: string[] }) => {
    const { scope, ...rest } = i;
    out.push({ supplierIds: [], products: [], ...rest, id: `${i.rule}:${scope}` });
  };
  const reqProduct = (rid: string) => d.requirements.find((r) => r.id === rid)?.product.name ?? input.requirements.find((r) => r.id === rid)?.product.name ?? "";

  /* ---------------- Sourcing ---------------- */
  const qCount = (rid: string) => d.quotations.filter((q) => q.requirementId === rid).length;
  for (const r of d.requirements.filter((r) => ["published", "receiving-quotes", "under-review"].includes(r.status) && qCount(r.id) === 0)) {
    add({ rule: "rfq-no-quotations", scope: r.id, category: "sourcing", severity: "watch", title: `${r.id} has no quotations`, description: `${r.product.name} is open for quotations but none have been received.`, evidence: [`${r.id} · status ${r.status} · created ${fmtDate(r.createdAt)} · 0 quotations`], relatedEntityIds: [r.id], products: [r.product.name], action: { label: "View Requirement", href: importerHref(`rfqs/${r.id}`) } });
  }
  const single = d.requirements.filter((r) => qCount(r.id) === 1);
  if (single.length) {
    add({ rule: "rfq-single-quotation", scope: "portfolio", category: "sourcing", severity: "watch", title: `${plural(single.length, "requirement")} received only one quotation`, description: "With one quotation there is nothing to compare against.", evidence: single.map((r) => `${r.id} · ${r.product.name} · 1 quotation`), metric: String(single.length), relatedEntityIds: single.map((r) => r.id), products: single.map((r) => r.product.name), action: { label: "Compare Quotations", href: importerHref("quotations") } });
  }

  /* ---------------- Supplier concentration (within one currency) ---------------- */
  const activeOrders = d.orders.filter((o) => orderStatus(o) !== "cancelled");
  const byCurrency = new Map<Currency, typeof activeOrders>();
  for (const o of activeOrders) byCurrency.set(o.terms.currency, [...(byCurrency.get(o.terms.currency) ?? []), o]);
  for (const [currency, list] of byCurrency) {
    if (list.length < 2) continue;
    const total = list.reduce((a, o) => a + orderValue(o.terms), 0);
    const bySupplier = new Map<string, number>();
    for (const o of list) bySupplier.set(o.supplierId, (bySupplier.get(o.supplierId) ?? 0) + orderValue(o.terms));
    const [topId, topValue] = [...bySupplier.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const share = (topValue / total) * 100;
    if (share >= 40) {
      add({ rule: "supplier-concentration", scope: currency, category: "supplier", severity: "watch", title: `${pct(share)} of order value in ${currency} is with one supplier`, description: `${supplierName(topId)} accounts for the largest share of your ${currency} orders.`, evidence: [`${supplierName(topId)} · ${formatMoney(topValue, currency)} of ${formatMoney(total, currency)} across ${plural(list.length, "order")} in ${currency}`], metric: pct(share), relatedEntityIds: list.filter((o) => o.supplierId === topId).map((o) => o.id), supplierIds: [topId], action: { label: "View Supplier", href: importerHref(`suppliers/${topId}`) } });
    }
  }
  const openOrders = d.orders.filter((o) => !["completed", "cancelled"].includes(orderStatus(o)));
  for (const [sid, count] of [...new Set(openOrders.map((o) => o.supplierId))].map((s) => [s, openOrders.filter((o) => o.supplierId === s).length] as const)) {
    if (count >= 2) add({ rule: "supplier-active-orders", scope: sid, category: "supplier", severity: "information", title: `${count} active orders are with ${supplierName(sid)}`, description: "A factual dependency on one supplier for current orders.", evidence: openOrders.filter((o) => o.supplierId === sid).map((o) => `${o.id} · ${o.terms.productName}`), relatedEntityIds: openOrders.filter((o) => o.supplierId === sid).map((o) => o.id), supplierIds: [sid], action: { label: "View Supplier", href: importerHref(`suppliers/${sid}`) } });
  }

  /* ---------------- Negotiations ---------------- */
  for (const n of d.negotiations) {
    const c = negotiatedPriceChange(n);
    if (!c?.comparable) continue;
    const quoted = formatMoney(c.quoted!, c.currency!);
    const agreed = formatMoney(c.agreed!, c.currency!);
    const base = { scope: n.id, category: "orders" as const, relatedEntityIds: [n.id, n.requirementId], supplierIds: [n.supplierId], products: [reqProduct(n.requirementId)], evidence: [`${n.id} · quoted ${quoted} / ${c.unit} → agreed ${agreed} / ${c.unit} · same currency, unit and Incoterm`], action: { label: "View Requirement", href: importerHref(`rfqs/${n.requirementId}`) } };
    if (c.difference! < 0) add({ ...base, rule: "negotiated-price-lower", severity: "positive", title: `Agreed price on ${n.requirementId} is ${pct(Math.abs(c.percent!))} below the original quotation`, description: "Negotiated price change compared with the supplier's original quotation.", metric: pct(c.percent!) });
    else if (c.difference! > 0) add({ ...base, rule: "negotiated-price-higher", severity: "watch", title: `Agreed price on ${n.requirementId} is ${pct(c.percent!)} above the original quotation`, description: "Negotiated price change compared with the supplier's original quotation.", metric: pct(c.percent!) });
    else add({ ...base, rule: "negotiated-price-unchanged", severity: "information", title: `Agreed price on ${n.requirementId} is unchanged from the original quotation`, description: "Other terms may have changed; the unit price did not." });
  }

  /* ---------------- Shipments (Tracking owns delay) ---------------- */
  const active = d.tracking.filter((t) => t.state.status !== "delivered");
  for (const t of active.filter((x) => x.schedule.status === "delayed")) {
    const s = t.shipment;
    add({
      rule: t.schedule.overdue ? "shipment-arrival-overdue" : "shipment-delayed",
      scope: s.id,
      category: "shipments",
      severity: t.schedule.overdue ? "action" : "watch",
      title: t.schedule.overdue ? `${s.id} arrival is overdue by ${plural(t.schedule.overdueDays, "day")}` : `${s.id} is delayed by ${plural(t.schedule.etaDelayDays, "day")}`,
      description: `${s.cargo.product} from ${t.supplierName} (${s.route.portOfLoading} → ${s.route.portOfDischarge}).`,
      evidence: [`${s.id} · planned ETA ${fmtDate(t.schedule.baseline.eta)} · latest ETA ${fmtDate(t.schedule.current.eta)}`],
      relatedEntityIds: [s.id, s.orderId],
      supplierIds: [s.supplierId],
      products: [s.cargo.product],
      action: { label: "View Tracking", href: importerHref(`tracking/${s.id}`) },
    });
  }
  const changed = active.filter((t) => t.schedule.changes.length > 0);
  if (changed.length) add({ rule: "schedule-changes", scope: "portfolio", category: "shipments", severity: "information", title: `${plural(changed.length, "active shipment")} ${changed.length === 1 ? "has" : "have"} schedule changes`, description: "Recorded ETD/ETA updates on shipments that have not been delivered.", evidence: changed.map((t) => `${t.shipment.id} · ${plural(t.schedule.changes.length, "change")}`), relatedEntityIds: changed.map((t) => t.shipment.id), action: { label: "View Tracking", href: importerHref("tracking") } });
  if (active.length && !active.some((t) => t.schedule.status === "delayed")) add({ rule: "shipments-on-schedule", scope: "portfolio", category: "shipments", severity: "positive", title: "All active shipments are currently on schedule", description: "No active shipment has a later ETA than planned or an overdue arrival.", evidence: active.map((t) => `${t.shipment.id} · ${t.schedule.status}`), relatedEntityIds: active.map((t) => t.shipment.id), action: { label: "View Tracking", href: importerHref("tracking") } });
  const atCustoms = d.shipments.filter((s) => shipmentState(s).status === "customs");
  if (atCustoms.length) add({ rule: "customs-stage", scope: "portfolio", category: "shipments", severity: "information", title: `Customs is the current stage for ${plural(atCustoms.length, "shipment")}`, description: "Shipments currently in customs clearance.", evidence: atCustoms.map((s) => s.id), relatedEntityIds: atCustoms.map((s) => s.id), action: { label: "View Tracking", href: importerHref("tracking") } });

  /* ---------------- Documents ---------------- */
  const required = d.documents.filter((x) => x.requirement.level === "required" && shipmentState(d.shipments.find((s) => s.id === x.shipmentId)!).status !== "delivered");
  const provided = (x: (typeof required)[number]) => x.status === "available" || x.status === "approved";
  const review = required.filter((x) => x.status === "needs-review");
  if (review.length) add({ rule: "documents-needs-review", scope: "portfolio", category: "documents", severity: "action", title: `${plural(review.length, "required document")} ${review.length === 1 ? "needs" : "need"} review`, description: "Documents marked as needing review are not complete for the workflow.", evidence: review.map((x) => `${x.id} · ${x.label} · ${x.shipmentId}`), relatedEntityIds: review.map((x) => x.id), action: { label: "Manage Documents", href: importerHref(`documents/${review[0].id}`) } });
  const expired = required.filter((x) => x.validity === "expired" && provided(x));
  if (expired.length) add({ rule: "documents-expired", scope: "portfolio", category: "documents", severity: "action", title: `${plural(expired.length, "required document")} ${expired.length === 1 ? "has" : "have"} expired`, description: "An expired document does not count as complete.", evidence: expired.map((x) => `${x.id} · ${x.label} · expired ${x.metadata.expiryDate}`), relatedEntityIds: expired.map((x) => x.id), action: { label: "Manage Documents", href: importerHref(`documents/${expired[0].id}`) } });
  else if (required.length) add({ rule: "documents-none-expired", scope: "portfolio", category: "documents", severity: "positive", title: "No required documents are expired", description: "Across shipments that are not yet delivered.", evidence: [`${plural(required.length, "required document")} checked`], relatedEntityIds: [], action: { label: "Manage Documents", href: importerHref("documents") } });
  const expiring = required.filter((x) => x.validity === "expiring-soon" && provided(x));
  if (expiring.length) add({ rule: "documents-expiring", scope: "portfolio", category: "documents", severity: "watch", title: `${plural(expiring.length, "required certificate")} ${expiring.length === 1 ? "expires" : "expire"} within 30 days`, description: "Valid today, but close to expiry.", evidence: expiring.map((x) => `${x.id} · ${x.label} · expires ${fmtDate(x.metadata.expiryDate!)}`), relatedEntityIds: expiring.map((x) => x.id), action: { label: "Manage Documents", href: importerHref(`documents/${expiring[0].id}`) } });
  const missingByLabel = new Map<string, number>();
  for (const x of required.filter((x) => ["not-started", "requested", "draft"].includes(x.status))) missingByLabel.set(x.label, (missingByLabel.get(x.label) ?? 0) + 1);
  const topMissing = [...missingByLabel.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (topMissing) add({ rule: "documents-common-blocker", scope: "portfolio", category: "documents", severity: "information", title: `${topMissing[0]} is the most common missing required document`, description: "Counted across active shipments.", evidence: [...missingByLabel.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} · missing on ${plural(n, "shipment")}`), metric: String(topMissing[1]), relatedEntityIds: [], action: { label: "Manage Documents", href: importerHref("documents") } });

  /* ---------------- Customs ---------------- */
  const liveCases = d.customsCases.filter((c) => ["preparing", "ready-for-handoff", "with-cha", "clarification-required", "ready-for-filing"].includes(c.status));
  for (const c of liveCases) {
    const open = c.clarifications.filter((x) => x.status === "open");
    if (open.length) add({ rule: "customs-clarification", scope: c.id, category: "customs", severity: "action", title: `${c.id} has ${plural(open.length, "unresolved clarification")}`, description: "The broker is waiting for your response.", evidence: open.map((x) => `${c.id} · ${x.id} · “${x.question}”`), relatedEntityIds: [c.id, c.shipmentId], action: { label: "View Customs Case", href: importerHref(`customs/${c.id}`) } });
    if (c.handoffStale || (c.handoff && c.changedSinceHandoff.length)) add({ rule: "customs-handoff", scope: c.id, category: "customs", severity: "action", title: `${c.id} needs an updated CHA handoff`, description: c.handoffStale ? "The assigned broker changed after the last handoff." : "The package changed since the last handoff.", evidence: [c.handoffStale ? `${c.id} · last handoff to ${c.handoffs.at(-1)?.cha.company}` : `${c.id} · ${c.changedSinceHandoff.join(", ")}`], relatedEntityIds: [c.id], action: { label: "View Customs Case", href: importerHref(`customs/${c.id}`) } });
    const reviewBlock = c.handoff ? c.blockers.filter((b) => b.kind === "document-review") : [];
    if (reviewBlock.length) add({ rule: "customs-review-blocking", scope: c.id, category: "customs", severity: "watch", title: `Document review is blocking Ready for Filing on ${c.id}`, description: "The case was handed over but a required document needs review.", evidence: reviewBlock.map((b) => `${c.id} · ${b.title}`), relatedEntityIds: [c.id], action: { label: "View Customs Case", href: importerHref(`customs/${c.id}`) } });
  }
  const withCha = liveCases.filter((c) => c.status === "with-cha" || c.status === "clarification-required");
  if (withCha.length) add({ rule: "customs-with-cha", scope: "portfolio", category: "customs", severity: "information", title: `${plural(withCha.length, "customs case")} ${withCha.length === 1 ? "is" : "are"} with the CHA`, description: "Handed over to the assigned broker and not yet Ready for Filing.", evidence: withCha.map((c) => `${c.id} · ${c.cha?.company ?? "broker"}`), relatedEntityIds: withCha.map((c) => c.id), action: { label: "View Customs Case", href: importerHref(`customs/${withCha[0].id}`) } });
  const hadClar = liveCases.filter((c) => c.clarifications.length > 0);
  if (hadClar.length && !hadClar.some((c) => c.clarifications.some((x) => x.status === "open"))) add({ rule: "customs-clarifications-resolved", scope: "portfolio", category: "customs", severity: "positive", title: "All customs clarifications have been answered", description: "No open broker questions on active customs cases.", evidence: hadClar.map((c) => `${c.id} · ${plural(c.clarifications.length, "clarification")}`), relatedEntityIds: hadClar.map((c) => c.id), action: { label: "View Customs Case", href: importerHref(`customs/${hadClar[0].id}`) } });

  /* ---------------- Costs (Landed Cost owns completeness) ---------------- */
  const incomplete = d.landedCost.filter((l) => l.result.status !== "complete");
  if (incomplete.length) add({ rule: "landed-incomplete", scope: "portfolio", category: "costs", severity: "watch", title: `${plural(incomplete.length, "order")} ${incomplete.length === 1 ? "does" : "do"} not yet have a complete landed-cost estimate`, description: "Partial or not started; see each sheet's warnings.", evidence: incomplete.map((l) => `${l.orderId} · ${l.result.status === "needs-input" ? "Needs Input" : "Partial Estimate"}`), relatedEntityIds: incomplete.map((l) => l.orderId), action: { label: "View Landed Cost", href: importerHref("landed-cost") } });
  const freightUnknown = d.landedCost.filter((l) => l.result.components.some((c) => c.key === "freight" && c.inclusion === "unknown"));
  if (freightUnknown.length) add({ rule: "freight-unknown", scope: "portfolio", category: "costs", severity: "information", title: `Freight is marked Unknown on ${plural(freightUnknown.length, "cost sheet")}`, description: "Confirm whether freight is included in the agreed price.", evidence: freightUnknown.map((l) => `${l.orderId} · freight inclusion unknown`), relatedEntityIds: freightUnknown.map((l) => l.orderId), action: { label: "View Landed Cost", href: importerHref(`landed-cost/${freightUnknown[0].orderId}`) } });
  for (const l of d.landedCost.filter((x) => x.result.status === "complete" && x.result.total)) {
    const duties = l.result.waterfall.find((w) => w.key === "duties")!.amount;
    const share = (duties / l.result.total!) * 100;
    add({ rule: "duties-share", scope: l.orderId, category: "costs", severity: "information", title: `Duties & taxes are ${pct(share)} of estimated landed cost for ${l.orderId}`, description: "Planning estimate from manually entered rates.", evidence: [`${l.orderId} · duties ${formatMoney(duties, l.result.currency)} of ${formatMoney(l.result.total!, l.result.currency)}`], metric: pct(share), relatedEntityIds: [l.orderId], action: { label: "View Landed Cost", href: importerHref(`landed-cost/${l.orderId}`) } });
  }

  /* ---------------- Payments (Payments owns due logic) ---------------- */
  for (const w of d.payments) {
    const sid = w.order.supplierId;
    const base = { category: "payments" as const, supplierIds: [sid], products: [w.order.terms.productName], action: { label: "View Payments", href: importerHref(`payments/${w.order.id}`) } };
    for (const o of w.obligations.filter((x) => x.status === "overdue")) add({ ...base, rule: "payment-overdue", scope: o.id, severity: "action", title: `${formatMoney(o.remaining, w.currency)} supplier payment is overdue on ${w.order.id}`, description: o.label, evidence: [`${w.order.id} · ${o.label} · due ${fmtDate(o.dueDate!)}`], relatedEntityIds: [w.order.id] });
    for (const o of w.obligations.filter((x) => x.status === "due")) add({ ...base, rule: "payment-due", scope: o.id, severity: "action", title: `${formatMoney(o.remaining, w.currency)} supplier payment is due today on ${w.order.id}`, description: o.label, evidence: [`${w.order.id} · ${o.label} · due ${fmtDate(o.dueDate!)}`], relatedEntityIds: [w.order.id] });
    for (const o of w.obligations.filter((x) => (x.trigger === "documents" || x.trigger === "lc-presentation") && x.status === "awaiting-trigger" && w.shipment))
      add({ ...base, rule: "payment-on-documents", scope: o.id, severity: "information", title: `${formatMoney(o.remaining, w.currency)} becomes payable on ${w.order.id} when required documents are ready`, description: o.triggerDetail, evidence: [`${w.order.id} · ${o.label} · ${o.requiredDocuments.filter((x) => !x.complete).map((x) => x.label).join(", ")} outstanding`], relatedEntityIds: [w.order.id] });
    const lcEx = w.exceptions.find((e) => e.type === "lc-expiring");
    if (lcEx && w.lc) add({ ...base, rule: "lc-expiring", scope: w.order.id, severity: "watch", title: `LC on ${w.order.id} expires within 30 days`, description: "Payment under the LC is not yet recorded.", evidence: [`${w.order.id} · LC expiry: ${fmtDate(w.lc.plan.expiryDate!)} · ${plural(w.lc.daysToExpiry!, "day")} remaining`], relatedEntityIds: [w.order.id] });
  }
  const exposed = d.payments.filter((w) => (w.obligations.length ? w.totals.remaining : w.orderValue) > 0);
  if (exposed.length) {
    const sums = new Map<Currency, number>();
    for (const w of exposed) sums.set(w.currency, (sums.get(w.currency) ?? 0) + (w.obligations.length ? w.totals.remaining : w.orderValue));
    add({ rule: "payment-exposure", scope: "portfolio", category: "payments", severity: "information", title: `${plural(exposed.length, "order")} still ${exposed.length === 1 ? "has" : "have"} supplier payment exposure`, description: `Remaining by currency: ${[...sums.entries()].map(([c, v]) => formatMoney(v, c)).join(" · ")}.`, evidence: exposed.map((w) => `${w.order.id} · ${formatMoney(w.obligations.length ? w.totals.remaining : w.orderValue, w.currency)} remaining`), relatedEntityIds: exposed.map((w) => w.order.id), action: { label: "View Payments", href: importerHref("payments") } });
  }
  const activePay = d.payments.filter((w) => !["completed", "cancelled"].includes(orderStatus(w.order)));
  if (activePay.length && activePay.every((w) => w.obligations.length > 0)) add({ rule: "payment-schedules-configured", scope: "portfolio", category: "payments", severity: "positive", title: "Payment schedules are configured for all active orders", description: "Every active order has a derived or manual payment schedule.", evidence: activePay.map((w) => `${w.order.id} · ${plural(w.obligations.length, "obligation")}`), relatedEntityIds: activePay.map((w) => w.order.id), action: { label: "View Payments", href: importerHref("payments") } });

  return out.sort(compareInsights);
}
