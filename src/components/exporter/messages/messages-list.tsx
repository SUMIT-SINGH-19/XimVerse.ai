"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MessageSquarePlus, Search, SearchX, SlidersHorizontal, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { focusRing } from "@/components/workspace/styles";
import { Select } from "@/components/exporter/products/catalogue-filters";
import { Modal } from "@/components/exporter/products/modal";
import { input, textarea } from "@/components/exporter/quote/form-ui";
import { useDocumentIndex } from "@/components/exporter/documents/document-ui";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDateTime } from "@/lib/exporter-opportunities";
import { createThread } from "@/lib/exporter-communication-store";
import {
  communicationInsights,
  INBOX_VIEWS,
  isQuery,
  PRIORITY_LABEL,
  REPLY_STATE_LABEL,
  ROLE_LABEL,
  searchText,
  SUBJECT_LABEL,
  THREAD_STATUS_LABEL,
  type EntityRef,
  type InboxView,
  type Priority,
  type Role,
  type SubjectType,
  type ThreadStatus,
} from "@/lib/exporter-communications";
import { PriorityPill, ThreadStatusPill, useThreadRows, type ThreadRow } from "./message-ui";

type Sort = "attention" | "latest" | "oldest-waiting" | "unread";
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, important: 1, normal: 2 };
const th = "whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint first:pl-5 last:pr-4";
const td = "px-2.5 py-3 align-top first:pl-5 last:pr-4";

function participants(r: ThreadRow) {
  return r.t.participants.map((p) => ROLE_LABEL[p]).join(" · ");
}

function preview(r: ThreadRow) {
  const m = r.s.last;
  if (!m) return "";
  const who = m.visibility === "exporter-internal" ? "Private note" : ROLE_LABEL[m.sender];
  return `${who}: ${m.body}`;
}

/** Scoped creation: a query to Ximverse about a transaction, or an internal discussion. */
function NewThreadModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: string }) {
  const router = useRouter();
  const { index, src } = useDocumentIndex();
  const options = [
    ...src.orders.map((o) => ({ value: `order:${o.id}`, label: `Order ${o.id} · ${o.terms.productName}` })),
    ...src.shipments.map((s) => ({ value: `shipment:${s.id}`, label: `Shipment ${s.id} · ${s.orderId}` })),
    ...index.filter((d) => d.ownerType !== "company").map((d) => ({ value: `document:${d.id}`, label: `${d.title} · ${d.ownerId}` })),
  ];
  const start = initial ? options.find((o) => o.value.endsWith(`:${initial}`))?.value ?? "" : "";
  const [about, setAbout] = useState(start);
  const [withRole, setWithRole] = useState<"ximverse" | "team">("ximverse");
  const doc = index.find((d) => `document:${d.id}` === about);
  const [topic, setTopic] = useState(doc ? `${doc.title} query` : "");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const [kind, id] = about.split(/:(.+)/) as [SubjectType, string];
    const refs: EntityRef[] = [];
    if (kind === "document") {
      const d = index.find((x) => x.id === id);
      refs.push({ kind: "document", id }, ...(d?.shipmentId ? [{ kind: "shipment" as const, id: d.shipmentId }] : []), ...(d?.orderId ? [{ kind: "order" as const, id: d.orderId }] : []));
    } else if (kind === "shipment") {
      refs.push({ kind: "shipment", id }, { kind: "order", id: src.shipments.find((s) => s.id === id)?.orderId ?? "" });
    } else if (kind === "order") refs.push({ kind: "order", id });
    const r = createThread({ subjectType: kind, subjectId: id ?? "", refs: refs.filter((x) => x.id), topic, body, with: withRole, type: kind === "document" ? "document-query" : "request" });
    if (!r.ok) return setError(r.reason);
    onClose();
    router.push(exporterHref(`messages/${r.id}`));
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="new-thread-title">
      <header className="border-b border-line px-5 py-4 sm:px-6">
        <h2 id="new-thread-title" className="text-lg font-bold tracking-tight text-ink">New thread</h2>
        <p className="mt-0.5 text-sm text-ink-muted">Always about a transaction. Stored locally for the demo — nobody is emailed or notified.</p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5 sm:px-6">
        <label className="block text-sm font-medium text-ink">
          About
          <select value={about} onChange={(e) => setAbout(e.target.value)} className={`${input} mt-1.5`}>
            <option value="">Choose an order, shipment or document…</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-ink">With</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(["ximverse", "team"] as const).map((r) => (
              <label key={r} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${withRole === r ? "border-teal bg-teal-soft text-ink" : "border-line text-ink-muted"}`}>
                <input type="radio" name="with" checked={withRole === r} onChange={() => setWithRole(r)} className="accent-teal" />
                {r === "ximverse" ? "Ask Ximverse" : "Internal discussion (private)"}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium text-ink">
          Subject
          <input value={topic} onChange={(e) => setTopic(e.target.value)} className={`${input} mt-1.5`} />
        </label>
        <label className="block text-sm font-medium text-ink">
          Message
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={`${textarea} mt-1.5`} />
        </label>
        {error && <p role="alert" className="text-sm text-orange">{error}</p>}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
        <button type="button" onClick={onClose} className={`h-10 rounded-lg px-4 text-sm font-semibold text-ink-muted hover:bg-canvas hover:text-ink ${focusRing}`}>Cancel</button>
        <button type="button" onClick={submit} className={`inline-flex h-10 items-center rounded-lg bg-orange px-4 text-sm font-semibold text-on-brand ${focusRing}`}>Create Thread</button>
      </footer>
    </Modal>
  );
}

/** One thread collection; views and filters are lenses over it. */
export function MessagesList({ newFor }: { newFor?: string }) {
  const { rows } = useThreadRows();
  const [view, setView] = useState<InboxView>("all");
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<SubjectType | "">("");
  const [participant, setParticipant] = useState<Role | "">("");
  const [status, setStatus] = useState<ThreadStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [unreadOnly, setUnreadOnly] = useState<"" | "yes">("");
  const [needsReply, setNeedsReply] = useState<"" | "yes">("");
  const [sort, setSort] = useState<Sort>("attention");
  const [showFilters, setShowFilters] = useState(false);
  const [creating, setCreating] = useState(Boolean(newFor));

  const metrics = [
    { label: "Unread", value: rows.reduce((n, r) => n + r.s.unread, 0), alert: true },
    { label: "Needs Your Reply", value: rows.filter((r) => r.s.replyState === "needs-reply").length, alert: true },
    { label: "Open Queries", value: rows.filter((r) => isQuery(r.t, r.s)).length },
    { label: "Shipment / Customs", value: rows.filter((r) => r.s.status !== "resolved" && (r.t.subjectType === "shipment" || r.t.subjectType === "document")).length },
    { label: "Resolved", value: rows.filter((r) => r.s.status === "resolved").length },
  ];

  const lens = INBOX_VIEWS.find((v) => v.id === view)!;
  const q = query.trim().toLowerCase();
  const waitingSince = (r: ThreadRow) => (r.s.replyState === "needs-reply" ? r.s.lastActivity : "9999");
  const cmp: Record<Sort, (a: ThreadRow, b: ThreadRow) => number> = {
    attention: (a, b) =>
      Number(a.s.status === "resolved") - Number(b.s.status === "resolved") ||
      Number(b.s.replyState === "needs-reply") - Number(a.s.replyState === "needs-reply") ||
      PRIORITY_RANK[a.s.priority] - PRIORITY_RANK[b.s.priority] ||
      b.s.lastActivity.localeCompare(a.s.lastActivity),
    latest: (a, b) => b.s.lastActivity.localeCompare(a.s.lastActivity),
    "oldest-waiting": (a, b) => waitingSince(a).localeCompare(waitingSince(b)),
    unread: (a, b) => b.s.unread - a.s.unread || b.s.lastActivity.localeCompare(a.s.lastActivity),
  };
  const visible = rows
    .filter(
      (r) =>
        lens.match(r.t, r.s) &&
        (!q || searchText(r.t).includes(q)) &&
        (!subject || r.t.subjectType === subject) &&
        (!participant || r.t.participants.includes(participant)) &&
        (!status || r.s.status === status) &&
        (!priority || r.s.priority === priority) &&
        (!unreadOnly || r.s.unread > 0) &&
        (!needsReply || r.s.replyState === "needs-reply"),
    )
    .sort(cmp[sort]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Messages"
        description="Manage buyer, Ximverse and execution conversations across your export transactions."
        aside={
          <button type="button" onClick={() => setCreating(true)} className={`inline-flex h-10 items-center gap-2 rounded-lg bg-orange px-4 text-sm font-semibold text-on-brand ${focusRing}`}>
            <MessageSquarePlus className="size-4" aria-hidden />
            New Thread
          </button>
        }
      />

      <ul aria-label="Message summary" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {metrics.map((m, i) => (
          <li key={m.label} className={`${i >= 2 ? "hidden sm:flex" : "flex"} flex-col rounded-2xl border border-line bg-surface px-3 py-2.5 sm:p-4`}>
            <span className="text-xs font-medium text-ink-muted sm:text-sm">{m.label}</span>
            <span className={`mt-0.5 text-xl font-bold tabular-nums sm:text-2xl ${m.alert && m.value > 0 ? "text-orange" : "text-ink"}`}>{m.value}</span>
          </li>
        ))}
      </ul>

      <section aria-labelledby="threads-heading" className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
          <h2 id="threads-heading" className="text-base font-semibold tracking-tight text-ink">
            {lens.label} <span className="ml-1 text-sm font-normal text-ink-muted">{visible.length} of {rows.length}</span>
          </h2>
          <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 rounded-lg border border-line bg-canvas px-2 text-sm text-ink focus:border-teal focus:outline-none">
              <option value="attention">Needs Attention</option>
              <option value="latest">Latest Activity</option>
              <option value="oldest-waiting">Oldest Waiting</option>
              <option value="unread">Unread First</option>
            </select>
          </label>
        </div>
        <div role="group" aria-label="Views" className="flex flex-wrap gap-1.5 px-4 pb-3 sm:px-6">
          {INBOX_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${view === v.id ? "bg-teal text-on-brand" : "bg-canvas text-ink-muted ring-1 ring-inset ring-line hover:text-ink"} ${focusRing}`}
            >
              {v.label} <span className="tabular-nums opacity-80">{rows.filter((r) => v.match(r.t, r.s)).length}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 px-4 pb-3 sm:px-6">
          <span className="relative min-w-0 flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input type="search" aria-label="Search messages" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="THR-, RFQ, QT, ORD, SHP, DOC, subject or text…" className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-2.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20" />
          </span>
          <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink lg:hidden ${focusRing}`}>
            <SlidersHorizontal className="size-4" aria-hidden />
            Filters
          </button>
        </div>
        <div className={`${showFilters ? "grid" : "hidden"} grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 sm:px-6 lg:grid lg:grid-cols-6`}>
          <Select label="Subject type" value={subject} onChange={setSubject} options={(Object.keys(SUBJECT_LABEL) as SubjectType[]).map((x) => ({ value: x, label: SUBJECT_LABEL[x] }))} allLabel="All subjects" />
          <Select label="Participant" value={participant} onChange={setParticipant} options={(["buyer", "ximverse", "cha", "forwarder", "team"] as Role[]).map((x) => ({ value: x, label: ROLE_LABEL[x] }))} allLabel="Anyone" />
          <Select label="Status" value={status} onChange={setStatus} options={(Object.keys(THREAD_STATUS_LABEL) as ThreadStatus[]).map((x) => ({ value: x, label: THREAD_STATUS_LABEL[x] }))} allLabel="All statuses" />
          <Select label="Priority" value={priority} onChange={setPriority} options={(Object.keys(PRIORITY_LABEL) as Priority[]).map((x) => ({ value: x, label: PRIORITY_LABEL[x] }))} allLabel="Any" />
          <Select label="Unread" value={unreadOnly} onChange={setUnreadOnly} options={[{ value: "yes", label: "Unread only" }]} allLabel="Any" />
          <Select label="Needs reply" value={needsReply} onChange={setNeedsReply} options={[{ value: "yes", label: "Needs your reply" }]} allLabel="Any" />
        </div>

        {visible.length === 0 ? (
          <div className="border-t border-line px-6 py-14 text-center">
            <SearchX className="mx-auto size-8 text-ink-faint" aria-hidden />
            <p className="mt-3 font-semibold text-ink">No conversations match</p>
          </div>
        ) : (
          <>
            <div className="relative hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[62rem] text-sm">
                <thead className="border-y border-line bg-canvas/60">
                  <tr>
                    <th scope="col" className={th}>Thread / Subject</th>
                    <th scope="col" className={th}>Transaction</th>
                    <th scope="col" className={th}>Participants</th>
                    <th scope="col" className={th}>Last Message</th>
                    <th scope="col" className={th}>Last Activity</th>
                    <th scope="col" className={th}>Unread</th>
                    <th scope="col" className={th}>Priority</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={th}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((r) => (
                    <tr key={r.t.id} className={`transition-colors hover:bg-canvas/50 ${r.s.unread ? "bg-teal-soft/30" : ""}`}>
                      <td className={`${td} max-w-52`}>
                        <Link href={exporterHref(`messages/${r.t.id}`)} className={`font-semibold text-ink hover:text-teal ${focusRing}`}>{r.t.topic}</Link>
                        <span className="block font-mono text-[0.6875rem] text-ink-faint">{r.t.id}</span>
                      </td>
                      <td className={`${td} font-mono text-xs text-ink-muted`}>
                        <span className="block font-sans text-[0.6875rem] text-ink-faint">{SUBJECT_LABEL[r.t.subjectType]}</span>
                        <span className="[overflow-wrap:anywhere]">{r.t.subjectId}</span>
                      </td>
                      <td className={`${td} max-w-36 text-xs text-ink-muted`}>{participants(r)}</td>
                      <td className={`${td} max-w-64 text-xs text-ink-muted`}><span className="line-clamp-2">{preview(r)}</span></td>
                      <td className={`${td} whitespace-nowrap text-xs text-ink-muted`}>{formatDateTime(r.s.lastActivity)}</td>
                      <td className={`${td} text-xs`}>{r.s.unread ? <span className="rounded-full bg-orange px-2 py-0.5 font-semibold text-on-brand">{r.s.unread}</span> : <span className="text-ink-faint">—</span>}</td>
                      <td className={td}><PriorityPill priority={r.s.priority} /></td>
                      <td className={td}>
                        <ThreadStatusPill status={r.s.status} />
                        <span className="mt-1 block text-xs text-ink-muted">{REPLY_STATE_LABEL[r.s.replyState]}</span>
                      </td>
                      <td className={td}>
                        <Link href={exporterHref(`messages/${r.t.id}`)} aria-label={`Open thread ${r.t.id}`} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-teal hover:border-teal hover:bg-teal-soft ${focusRing}`}>
                          Open Thread
                          <ArrowRight className="size-3" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 md:grid-cols-2 xl:hidden">
              {visible.map((r) => (
                <li key={r.t.id}>
                  <Link href={exporterHref(`messages/${r.t.id}`)} className={`flex h-full flex-col rounded-xl border p-4 hover:border-teal ${r.s.unread ? "border-teal/40 bg-teal-soft/30" : "border-line bg-surface"} ${focusRing}`}>
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink">{r.t.topic}</span>
                        <span className="block font-mono text-xs text-ink-muted [overflow-wrap:anywhere]">{r.t.subjectId}</span>
                      </span>
                      {r.s.unread > 0 && <span className="shrink-0 rounded-full bg-orange px-2 py-0.5 text-xs font-semibold text-on-brand">{r.s.unread} new</span>}
                    </span>
                    <span className="mt-1 text-xs text-ink-muted">{participants(r)}</span>
                    <span className="mt-1.5 line-clamp-1 text-sm text-ink sm:line-clamp-2">{preview(r)}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      <PriorityPill priority={r.s.priority} />
                      <span>{REPLY_STATE_LABEL[r.s.replyState]}</span>
                      <span>· {formatDateTime(r.s.lastActivity)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <aside aria-label="SUMIT insight" className="rounded-2xl border border-teal/15 bg-teal-soft p-5">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal">
          <Sparkles className="size-3.5 text-orange" aria-hidden />
          SUMIT insight
        </p>
        <ul className="mt-2 space-y-2">
          {communicationInsights(rows).map((x) => <li key={x} className="text-sm leading-relaxed text-ink">{x}</li>)}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">Rule-based, from thread state and shipment dates. No sentiment analysis.</p>
      </aside>

      <p className="text-xs text-ink-faint">Demo: conversations are stored in this browser. Nothing is emailed, sent by WhatsApp or SMS, or delivered to the buyer, CHA or forwarder.</p>

      {creating && <NewThreadModal open={creating} onClose={() => setCreating(false)} initial={newFor} />}
    </div>
  );
}
