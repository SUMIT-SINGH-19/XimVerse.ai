"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BellOff, CheckCheck, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { focusRing } from "@/components/workspace/styles";
import { Select } from "@/components/exporter/products/catalogue-filters";
import { useDocumentIndex } from "@/components/exporter/documents/document-ui";
import { useCommunications } from "@/lib/exporter-communication-store";
import { useExporterNegotiations } from "@/lib/exporter-negotiation-store";
import { useStoredDrafts, useStoredQuotations } from "@/lib/exporter-quotation-store";
import { buildPipeline } from "@/lib/exporter-quotation-pipeline";
import { formatDateTime } from "@/lib/exporter-opportunities";
import { dismiss, markRead, markUnread, useNotificationState } from "@/lib/exporter-notification-store";
import {
  applyInteraction,
  attentionOrder,
  buildSignals,
  CATEGORY_LABEL,
  notificationInsights,
  SEVERITY_LABEL,
  signalSummary,
  type NotificationCategory,
  type NotificationView,
  type Severity,
  type SourceType,
} from "@/lib/exporter-notifications";

/** Signals rebuilt from every canonical source on each change; interaction state layered on top. */
function useNotifications(): NotificationView[] {
  const { index, src } = useDocumentIndex();
  const negotiations = useExporterNegotiations();
  const quotations = useStoredQuotations();
  const drafts = useStoredDrafts();
  const { threads, read } = useCommunications();
  const state = useNotificationState();
  return useMemo(() => {
    const signals = buildSignals({ ...src, negotiations, pipeline: buildPipeline(quotations, drafts, negotiations), threads, threadRead: read, documents: index });
    return applyInteraction(signals, state);
  }, [src, index, negotiations, quotations, drafts, threads, read, state]);
}

type View = "all" | "action" | "unread" | "commercial" | "orders" | "documents" | "shipments" | "messages" | "system";
const VIEWS: { id: View; label: string; match: (n: NotificationView) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "action", label: "Action Required", match: (n) => n.actionRequired },
  { id: "unread", label: "Unread", match: (n) => n.unread },
  { id: "commercial", label: "Commercial", match: (n) => n.category === "commercial" },
  { id: "orders", label: "Orders", match: (n) => n.category === "order" },
  { id: "documents", label: "Documents", match: (n) => n.category === "document" || n.category === "compliance" },
  { id: "shipments", label: "Shipments", match: (n) => n.category === "shipment" || n.sourceType === "shipment" },
  { id: "messages", label: "Messages", match: (n) => n.category === "message" },
  { id: "system", label: "System / Informational", match: (n) => !n.actionRequired },
];
type Sort = "attention" | "latest" | "oldest" | "category";
const TONE: Record<Severity, PillTone> = { urgent: "accent", attention: "neutral", info: "muted" };
const SOURCE_LABEL: Record<SourceType, string> = { thread: "Thread", rfq: "RFQ", quotation: "Quotation", negotiation: "Negotiation", deal: "Deal", order: "Order", shipment: "Shipment", document: "Document", company: "Company" };

export function NotificationsList() {
  const list = useNotifications();
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<NotificationCategory | "">("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [readFilter, setReadFilter] = useState<"" | "unread" | "read">("");
  const [action, setAction] = useState<"" | "yes" | "no">("");
  const [source, setSource] = useState<SourceType | "">("");
  const [sort, setSort] = useState<Sort>("attention");
  const [showFilters, setShowFilters] = useState(false);

  const sum = signalSummary(list);
  const unread = list.filter((n) => n.unread).length;
  const metrics = [
    { label: "Unread", value: unread },
    { label: "Action Required", value: sum.action },
    { label: "Urgent", value: sum.urgent },
    { label: "Messages", value: list.filter((n) => n.category === "message").length },
    { label: "Shipment / Customs", value: sum.blockers },
  ];
  const lens = VIEWS.find((v) => v.id === view)!;
  const q = query.trim().toLowerCase();
  const cmp: Record<Sort, (a: NotificationView, b: NotificationView) => number> = {
    attention: attentionOrder,
    latest: (a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""),
    oldest: (a, b) => (a.occurredAt ?? "9999").localeCompare(b.occurredAt ?? "9999"),
    category: (a, b) => a.category.localeCompare(b.category) || attentionOrder(a, b),
  };
  const visible = list
    .filter(
      (n) =>
        lens.match(n) &&
        (!q || [n.title, n.description, n.id, ...n.refs, ...n.context].some((x) => x.toLowerCase().includes(q))) &&
        (!category || n.category === category) &&
        (!severity || n.severity === severity) &&
        (!readFilter || (readFilter === "unread" ? n.unread : !n.unread)) &&
        (!action || (action === "yes" ? n.actionRequired : !n.actionRequired)) &&
        (!source || n.sourceType === source),
    )
    .sort(cmp[sort]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Notifications"
        description="Stay on top of buyer responses, trade-document blockers and shipment actions across your export operations."
        aside={
          <button type="button" disabled={!unread} onClick={() => markRead(list.filter((n) => n.unread))} className={`inline-flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink hover:border-teal hover:bg-teal-soft disabled:opacity-50 ${focusRing}`}>
            <CheckCheck className="size-4" aria-hidden />
            Mark All Read
          </button>
        }
      />

      <ul aria-label="Notification summary" className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {metrics.map((m, i) => (
          <li key={m.label} className={`${i >= 3 ? "hidden sm:flex" : "flex"} flex-col rounded-2xl border border-line bg-surface px-3 py-2.5 sm:p-4`}>
            <span className="text-xs font-medium text-ink-muted sm:text-sm">{m.label}</span>
            <span className={`mt-0.5 text-xl font-bold tabular-nums sm:text-2xl ${m.value > 0 && i < 3 ? "text-orange" : "text-ink"}`}>{m.value}</span>
          </li>
        ))}
      </ul>

      <section aria-labelledby="attention-heading" className="hidden rounded-2xl border border-orange/25 bg-orange-soft/50 p-4 sm:block sm:p-5">
        <h2 id="attention-heading" className="text-sm font-semibold text-ink">Needs Your Attention</h2>
        <p className="mt-1 text-sm text-ink">
          <span className="font-semibold text-orange">{sum.urgent} urgent</span> · {sum.action} need action · {sum.replies} buyer / partner {sum.replies === 1 ? "reply" : "replies"} · {sum.blockers} shipment / document {sum.blockers === 1 ? "blocker" : "blockers"} · {sum.commercial} commercial · {sum.orders} order · {sum.compliance} credential
        </p>
        {list.filter((n) => n.severity === "urgent").sort(attentionOrder).slice(0, 2).map((n) => (
          <Link key={n.id} href={n.href} className={`mt-2 flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-sm hover:text-teal ${focusRing}`}>
            <span className="min-w-0"><span className="font-semibold text-ink">{n.title}</span> <span className="font-mono text-xs text-ink-muted">{n.refs[0]}</span>{n.timing && <span className="text-xs text-orange"> · {n.timing}</span>}</span>
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        ))}
      </section>

      <section aria-labelledby="ntf-heading" className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
          <h2 id="ntf-heading" className="text-base font-semibold tracking-tight text-ink">
            {lens.label} <span className="ml-1 text-sm font-normal text-ink-muted">{visible.length} of {list.length}</span>
          </h2>
          <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 rounded-lg border border-line bg-canvas px-2 text-sm text-ink focus:border-teal focus:outline-none">
              <option value="attention">Needs Attention</option>
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              <option value="category">Category</option>
            </select>
          </label>
        </div>
        <div role="group" aria-label="Views" className="flex flex-wrap gap-1.5 px-4 pb-3 sm:px-6">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)} className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${view === v.id ? "bg-teal text-on-brand" : "bg-canvas text-ink-muted ring-1 ring-inset ring-line hover:text-ink"} ${focusRing}`}>
              {v.label} <span className="tabular-nums opacity-80">{list.filter(v.match).length}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 px-4 pb-3 sm:px-6">
          <span className="relative min-w-0 flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input type="search" aria-label="Search notifications" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title, THR-, ORD-, SHP-, DOC-, product…" className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-2.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20" />
          </span>
          <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink lg:hidden ${focusRing}`}>
            <SlidersHorizontal className="size-4" aria-hidden />
            Filters
          </button>
        </div>
        <div className={`${showFilters ? "grid" : "hidden"} grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 sm:px-6 lg:grid lg:grid-cols-5`}>
          <Select label="Category" value={category} onChange={setCategory} options={(Object.keys(CATEGORY_LABEL) as NotificationCategory[]).map((x) => ({ value: x, label: CATEGORY_LABEL[x] }))} allLabel="All categories" />
          <Select label="Severity" value={severity} onChange={setSeverity} options={(Object.keys(SEVERITY_LABEL) as Severity[]).map((x) => ({ value: x, label: SEVERITY_LABEL[x] }))} allLabel="Any" />
          <Select label="Read state" value={readFilter} onChange={setReadFilter} options={[{ value: "unread", label: "Unread" }, { value: "read", label: "Read" }]} allLabel="Any" />
          <Select label="Action required" value={action} onChange={setAction} options={[{ value: "yes", label: "Action required" }, { value: "no", label: "Informational" }]} allLabel="Any" />
          <Select label="Transaction type" value={source} onChange={setSource} options={(Object.keys(SOURCE_LABEL) as SourceType[]).map((x) => ({ value: x, label: SOURCE_LABEL[x] }))} allLabel="Any" />
        </div>

        {visible.length === 0 ? (
          <div className="border-t border-line px-6 py-14 text-center">
            <BellOff className="mx-auto size-8 text-ink-faint" aria-hidden />
            <p className="mt-3 font-semibold text-ink">Nothing here</p>
          </div>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {visible.map((n) => (
              <li key={n.id} data-id={n.id} className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:px-6 ${n.unread ? "bg-teal-soft/30" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-xs">
                    {n.unread && <span aria-label="Unread" className="size-2 rounded-full bg-orange" />}
                    <StatusPill tone={TONE[n.severity]}>{SEVERITY_LABEL[n.severity]}</StatusPill>
                    <span className="font-semibold uppercase tracking-[0.08em] text-ink-muted">{CATEGORY_LABEL[n.category]}</span>
                    {n.actionRequired && <span className="font-semibold text-orange">Action required</span>}
                  </p>
                  <p className={`mt-1.5 text-sm text-ink ${n.unread ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                  <p className="mt-0.5 text-sm text-ink-muted [overflow-wrap:anywhere]">{n.description}</p>
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <span className="font-mono [overflow-wrap:anywhere]">{n.refs.slice(0, 2).join(" · ")}</span>
                    {n.context.length > 0 && <span>{n.context.join(" · ")}</span>}
                    {n.timing && <span className={n.severity === "urgent" ? "font-semibold text-orange" : ""}>{n.timing}</span>}
                    {n.occurredAt && <span>{formatDateTime(n.occurredAt)}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link href={n.href} onClick={() => markRead([n])} className={`inline-flex h-10 items-center gap-1.5 rounded-lg bg-teal px-3.5 text-sm font-semibold text-on-brand hover:brightness-95 ${focusRing}`}>
                    {n.cta}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <button type="button" onClick={() => (n.unread ? markRead([n]) : markUnread(n.id))} className={`h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink-muted hover:text-ink ${focusRing}`}>
                    {n.unread ? "Mark Read" : "Mark Unread"}
                  </button>
                  {n.dismissible && (
                    <button type="button" onClick={() => dismiss(n)} className={`h-10 rounded-lg px-3 text-sm font-semibold text-ink-faint hover:text-ink ${focusRing}`}>Dismiss</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside aria-label="SUMIT insight" className="rounded-2xl border border-teal/15 bg-teal-soft p-5">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal">
          <Sparkles className="size-3.5 text-orange" aria-hidden />
          SUMIT insight
        </p>
        <ul className="mt-2 space-y-2">
          {notificationInsights(list).map((x) => <li key={x} className="text-sm leading-relaxed text-ink">{x}</li>)}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">Rule-based, from the same signals listed above.</p>
      </aside>

      <p className="text-xs text-ink-faint">Signals are derived live from orders, shipments, documents, negotiations, quotations, messages and the Company Profile. Only read / dismissed state is stored. Nothing is emailed, pushed or texted.</p>
    </div>
  );
}
