"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck, CircleDot, FileText, Lock, ShieldCheck } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { textarea } from "@/components/exporter/quote/form-ui";
import { DocumentStatusBadge, useDocumentIndex } from "@/components/exporter/documents/document-ui";
import { exporterHref } from "@/lib/exporter-nav";
import { findOpportunity, formatDateTime, shortCountry, UNIT_SHORT } from "@/lib/exporter-opportunities";
import { formatDate } from "@/lib/exporter-dashboard";
import { useIsClient } from "@/lib/exporter-quotation-store";
import { useExporterNegotiations } from "@/lib/exporter-negotiation-store";
import { NEGOTIATION_STATUS_LABEL, negotiationStatus } from "@/lib/exporter-negotiations";
import { COUNTERPARTY_ACCESS_LABEL, DEAL_STATUS_LABEL, dealStatus } from "@/lib/exporter-deals";
import { ORDER_STATUS_LABEL } from "@/lib/exporter-orders";
import { customsReadiness, orderStateWithShipments, score, SHIPMENT_STATUS_LABEL, shipmentStage, shipmentState } from "@/lib/exporter-shipments";
import { addInternalNote, markRead, markResolved, reopenThread, sendReply, type CommResult } from "@/lib/exporter-communication-store";
import type { DocumentItem, DocumentSources } from "@/lib/exporter-documents";
import {
  MESSAGE_TYPE_LABEL,
  REPLY_STATE_LABEL,
  ROLE_INITIALS,
  ROLE_LABEL,
  SUBJECT_LABEL,
  type ActionRequest,
  type EntityRef,
  type Message,
  type Thread,
  type ThreadState,
} from "@/lib/exporter-communications";
import { PriorityPill, refHref, ThreadStatusPill, useThreadRows } from "./message-ui";

const btn = `inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition-colors hover:border-teal hover:bg-teal-soft disabled:opacity-50 ${focusRing}`;
const primary = `inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange px-4 text-sm font-semibold text-on-brand transition hover:brightness-95 disabled:opacity-50 ${focusRing}`;

/** Whether an action's linked blocker is met now — read live from the Documents Center. */
function checkMet(a: ActionRequest | undefined, index: readonly DocumentItem[]): boolean | undefined {
  if (!a?.check) return undefined;
  const d = index.find((x) => x.id === a.check!.documentId);
  const b = d?.blockers.find((x) => x.key === a.check!.blockerKey);
  // No longer listed as a prerequisite (the document moved past that step) counts as met.
  return d ? (b ? b.done : true) : undefined;
}

function RefChip({ r, index }: { r: EntityRef; index: readonly DocumentItem[] }) {
  const doc = r.kind === "document" ? index.find((d) => d.id === r.id) : undefined;
  return (
    <Link href={refHref(r.kind, r.id)} className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-canvas px-2 py-1 text-xs hover:border-teal ${focusRing}`}>
      {r.kind === "document" && <FileText className="size-3.5 shrink-0 text-ink-faint" aria-hidden />}
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {doc ? <span className="font-medium text-ink">{doc.title} </span> : <span className="text-ink-faint">{SUBJECT_LABEL[r.kind]} </span>}
        <span className="font-mono text-teal">{r.id}</span>
      </span>
      {doc && <DocumentStatusBadge status={doc.status} />}
    </Link>
  );
}

/** Compact, read-only context from the canonical owner. */
function Context({ t, src, index }: { t: Thread; src: DocumentSources; index: readonly DocumentItem[] }) {
  const negotiations = useExporterNegotiations();
  const shipmentId = t.subjectType === "shipment" ? t.subjectId : t.refs.find((r) => r.kind === "shipment")?.id;
  const orderId = t.subjectType === "order" ? t.subjectId : t.refs.find((r) => r.kind === "order")?.id;
  const sh = src.shipments.find((s) => s.id === shipmentId);
  const order = src.orders.find((o) => o.id === (orderId ?? sh?.orderId));
  const doc = t.subjectType === "document" ? index.find((d) => d.id === t.subjectId) : undefined;
  const rows: [string, React.ReactNode][] = [];
  let cta: { label: string; href: string } | undefined;

  if (doc) {
    rows.push(["Document", <span key="d">{doc.title} <DocumentStatusBadge status={doc.status} /></span>], ["Open blockers", String(doc.blockers.filter((b) => !b.done).length)]);
  }
  if (sh && order) {
    const st = shipmentState(sh);
    const os = orderStateWithShipments(order, src.shipments);
    const stage = shipmentStage(sh, st);
    rows.push(
      ["Shipment", <Link key="s" href={exporterHref(`shipments/${sh.id}`)} className="font-mono text-teal hover:text-ink">{sh.id}</Link>],
      ["Status", `${SHIPMENT_STATUS_LABEL[st.status]} · ${stage.phase}`],
      ["Customs readiness", `${score(customsReadiness(sh, st, os))}%`],
      ["ETD / ETA", `${st.schedule.etd ? formatDate(st.schedule.etd) : "—"} / ${st.schedule.eta ? formatDate(st.schedule.eta) : "—"}`],
    );
    cta = { label: "Open Shipment", href: exporterHref(`shipments/${sh.id}`) };
  }
  if (order) {
    const os = orderStateWithShipments(order, src.shipments);
    const opp = findOpportunity(order.requirementId);
    rows.push(
      ["Order", <Link key="o" href={exporterHref(`orders/${order.id}`)} className="font-mono text-teal hover:text-ink">{order.id}</Link>],
      ["Product", `${order.terms.productName} · ${order.terms.quantity.amount.toLocaleString("en-US")} ${UNIT_SHORT[order.terms.quantity.unit]}`],
      ...(opp ? ([["Destination", shortCountry(opp.delivery.destinationCountry)]] as [string, string][]) : []),
      ...(!sh ? ([["Order status", ORDER_STATUS_LABEL[os.status]], ["Cargo ready", os.production.actualCargoReady ? formatDate(os.production.actualCargoReady) : os.production.expectedCargoReady ? `${formatDate(os.production.expectedCargoReady)} (expected)` : "—"]] as [string, string][]) : []),
    );
    cta ??= { label: "Open Order", href: exporterHref(`orders/${order.id}`) };
  }
  if (t.subjectType === "negotiation") {
    const n = negotiations.find((x) => x.id === t.subjectId);
    if (n) rows.push(["Negotiation", NEGOTIATION_STATUS_LABEL[negotiationStatus(n)]]);
    cta = { label: "Open Negotiation", href: exporterHref(`negotiations/${t.subjectId}`) };
  }
  if (t.subjectType === "deal") {
    const d = src.deals.find((x) => x.id === t.subjectId);
    if (d) rows.push(["Deal", DEAL_STATUS_LABEL[dealStatus(d)]], ["Buyer identity", COUNTERPARTY_ACCESS_LABEL[d.counterpartyAccess]]);
    cta = { label: "Open Deal", href: exporterHref(`deals/${t.subjectId}`) };
  }
  if (t.subjectType === "rfq") {
    const opp = findOpportunity(t.subjectId);
    if (opp) rows.push(["Product", opp.product.name], ["Destination", opp.delivery.destinationLocation], ["Quotes due", formatDateTime(opp.quotesDueAt)]);
    cta = { label: "Open Opportunity", href: exporterHref(`opportunities/${t.subjectId}`) };
  }
  if (doc) cta = { label: "View Document", href: exporterHref(`documents/${doc.id}`) };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{SUBJECT_LABEL[t.subjectType]} · live from source</h2>
      <p className="mt-1 font-mono text-sm font-semibold text-ink [overflow-wrap:anywhere]">{t.subjectId}</p>
      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map(([l, v]) => (
          <div key={l} className="flex justify-between gap-3">
            <dt className="text-ink-muted">{l}</dt>
            <dd className="min-w-0 text-right text-ink [overflow-wrap:anywhere]">{v}</dd>
          </div>
        ))}
      </dl>
      {cta && (
        <Link href={cta.href} className={`${btn} mt-4 w-full`}>
          {cta.label}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {t.refs.map((r) => <RefChip key={`${r.kind}-${r.id}`} r={r} index={index} />)}
      </div>
    </section>
  );
}

function MessageItem({ m, index }: { m: Message; index: readonly DocumentItem[] }) {
  const internal = m.visibility === "exporter-internal";
  const met = checkMet(m.action, index);
  if (m.sender === "system" || m.type === "resolution" || m.type === "reopened") {
    return (
      <li className="flex justify-center">
        <p className="max-w-xl rounded-lg bg-canvas px-3 py-1.5 text-center text-xs text-ink-muted ring-1 ring-inset ring-line">
          <span className="font-semibold">{m.sender === "system" ? "System" : ROLE_LABEL[m.sender]} · {MESSAGE_TYPE_LABEL[m.type]}</span> — {m.body}
          <span className="block text-ink-faint">{formatDateTime(m.at)}</span>
        </p>
      </li>
    );
  }
  const mine = m.sender === "exporter" || m.sender === "team";
  return (
    <li className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
      <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold ${internal ? "bg-orange-soft text-orange" : mine ? "bg-teal text-on-brand" : "bg-canvas text-ink ring-1 ring-inset ring-line"}`}>
        {internal ? <Lock className="size-3.5" /> : ROLE_INITIALS[m.sender]}
      </span>
      <div className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-sm ${internal ? "border border-dashed border-orange/50 bg-orange-soft/40" : mine ? "bg-teal-soft" : "border border-line bg-surface"}`}>
        <p className="flex flex-wrap items-center gap-x-2 text-xs">
          <span className="font-semibold text-ink">{internal ? "Private note · your team" : ROLE_LABEL[m.sender]}</span>
          {internal && <span className="rounded bg-orange px-1.5 py-px text-[0.625rem] font-bold uppercase tracking-wider text-on-brand">Private</span>}
          {m.type !== "text" && <span className="text-ink-muted">{MESSAGE_TYPE_LABEL[m.type]}</span>}
          <span className="text-ink-faint">{formatDateTime(m.at)}</span>
        </p>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed text-ink [overflow-wrap:anywhere]">{m.body}</p>
        {internal && <p className="mt-1 text-xs text-ink-muted">Visible only to your exporter team.</p>}
        {m.refs && m.refs.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{m.refs.map((r) => <RefChip key={`${r.kind}-${r.id}`} r={r} index={index} />)}</div>}
        {m.action && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2">
            <span className="text-xs">
              <span className="font-semibold text-orange">Action Required</span> · {m.action.label}
              {met !== undefined && (
                <span className={`ml-1 font-semibold ${met ? "text-teal" : "text-ink-muted"}`}>{met ? "· Underlying blocker resolved" : "· Still open on the source"}</span>
              )}
            </span>
            <Link href={m.action.href} className={`text-xs font-semibold text-teal hover:text-ink ${focusRing}`}>Open source →</Link>
          </div>
        )}
      </div>
    </li>
  );
}

function ThreadView({ t, s, src, index }: { t: Thread; s: ThreadState; src: DocumentSources; index: readonly DocumentItem[] }) {
  const [draft, setDraft] = useState("");
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const resolved = s.status === "resolved";
  const openMet = checkMet(s.openAction, index);

  // Opening the thread marks its visible external messages as read.
  useEffect(() => {
    if (s.unread > 0) markRead(t.id, s.lastActivity);
  }, [t.id, s.unread, s.lastActivity]);

  const run = (r: CommResult, ok: string, clear = false) => {
    setFlash(r.ok ? { ok: true, text: ok } : { ok: false, text: r.reason });
    if (r.ok && clear) setDraft("");
  };
  const buyerProtected = t.participants.includes("buyer");

  return (
    <div className="space-y-6">
      <Link href={exporterHref("messages")} className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to Messages
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <ThreadStatusPill status={s.status} />
          <PriorityPill priority={s.priority} />
          {s.priorityReason && <span className="text-xs text-orange">{s.priorityReason}</span>}
          <span className="text-xs text-ink-muted">{REPLY_STATE_LABEL[s.replyState]}</span>
        </div>
        <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">{t.topic}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          <span className="font-mono">{t.id}</span> · {SUBJECT_LABEL[t.subjectType]}{" "}
          {t.subjectType === "general" ? <span className="font-mono">{t.subjectId}</span> : <Link href={refHref(t.subjectType, t.subjectId)} className="font-mono text-teal hover:text-ink">{t.subjectId}</Link>} · Last activity {formatDateTime(s.lastActivity)}
        </p>
        <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {t.participants.map((p) => <span key={p} className="rounded-full bg-canvas px-2.5 py-0.5 font-medium text-ink ring-1 ring-inset ring-line">{ROLE_LABEL[p]}</span>)}
        </p>
        {buyerProtected && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-muted"><ShieldCheck className="size-3.5 text-teal" aria-hidden />Buyer identity protected — the buyer takes part only as “Buyer via Ximverse”.</p>
        )}
      </header>

      {s.openAction && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ${openMet ? "bg-teal-soft" : "bg-orange-soft"}`}>
          <span>
            <span className={`font-semibold ${openMet ? "text-teal" : "text-orange"}`}>{openMet ? "Underlying blocker resolved" : "Currently asked"}</span>
            <span className="text-ink"> — {s.openAction.label}. {openMet ? "You can reply and mark this thread resolved." : "Do it on the source page; Messages never changes it."}</span>
          </span>
          <Link href={s.openAction.href} className={`text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>Open source →</Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <ol aria-label="Messages" className="space-y-3">
            {t.messages.map((m) => <MessageItem key={m.id} m={m} index={index} />)}
          </ol>

          <section aria-label="Reply" className="rounded-2xl border border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
            <label htmlFor="reply" className="sr-only">Write a reply</label>
            <textarea id="reply" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Write a reply..." className={textarea} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" disabled={!draft.trim()} onClick={() => run(sendReply(t.id, draft), "Reply stored locally for the demo — not emailed or delivered.", true)} className={primary}>Send Reply</button>
              <button type="button" disabled={!draft.trim()} onClick={() => run(addInternalNote(t.id, draft), "Private note added — visible only to your team.", true)} className={btn}>
                <Lock className="size-4" aria-hidden />
                Add Internal Note
              </button>
              <span className="ml-auto">
                {resolved ? (
                  <button type="button" onClick={() => run(reopenThread(t.id), "Thread reopened.")} className={btn}>Reopen</button>
                ) : (
                  <button type="button" onClick={() => run(markResolved(t.id), "Thread marked resolved. The underlying order, shipment or document is unchanged.")} className={btn}>
                    <CircleCheck className="size-4" aria-hidden />
                    Mark Resolved
                  </button>
                )}
              </span>
            </div>
            <p role="status" className={flash ? `mt-2 rounded-lg px-3 py-2 text-sm text-ink ${flash.ok ? "bg-teal-soft" : "bg-orange-soft"}` : ""}>{flash?.text}</p>
            <p className="mt-2 text-xs text-ink-faint">Demo: stored in this browser only. Nothing is emailed, sent by WhatsApp or SMS, or delivered to any party. Messages can&apos;t be edited or deleted.</p>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <Context t={t} src={src} index={index} />
          <section className="rounded-2xl border border-line bg-surface p-5 text-sm">
            <h2 className="flex items-center gap-1.5 font-semibold text-ink"><CircleDot className="size-4 text-teal" aria-hidden />Who needs to respond</h2>
            <p className="mt-1 text-ink-muted">{s.replyState === "needs-reply" ? `You — ${s.waitingOn ? ROLE_LABEL[s.waitingOn] : "the other party"} is waiting.` : REPLY_STATE_LABEL[s.replyState]}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Resolves a thread (seeded or created in this browser). */
export function ThreadById({ id }: { id: string }) {
  const isClient = useIsClient();
  const { rows } = useThreadRows();
  const { index, src } = useDocumentIndex();
  const row = rows.find((r) => r.t.id === id);
  if (row) return <ThreadView t={row.t} s={row.s} src={src} index={index} />;
  if (!isClient) return <p className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-sm text-ink-muted">Loading thread…</p>;
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
      <p className="font-semibold text-ink">Thread {id} isn&apos;t stored in this browser</p>
      <Link href={exporterHref("messages")} className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to Messages
      </Link>
    </div>
  );
}
