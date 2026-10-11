"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, FileSearch, FlaskConical, Info } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import { describeDocumentEvent, DOCUMENT_SOURCE_LABEL } from "@/lib/importer-documents";
import { CUSTOMS_CASE_STATUS_LABEL, CUSTOMS_READINESS_LABEL, customsActivity } from "@/lib/importer-customs";
import {
  milestones,
  modeLabel,
  SCHEDULE_CHANGE_REASONS,
  SHIPMENT_STATUSES,
  shipmentStatusLabel,
  stageLabel,
  type ScheduleChangeReason,
} from "@/lib/importer-shipments";
import {
  EXCEPTION_SOURCE_LABEL,
  EXCEPTION_TYPE_LABEL,
  formatDayShift,
  SCHEDULE_STATUS_LABEL,
  type TrackingException,
  type TrackingView,
} from "@/lib/importer-tracking";
import { ImportId, Panel } from "../dashboard/dashboard-ui";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { describeEvent, eventParty } from "../shipments/shipment-ui";
import { recordScheduleUpdate } from "../shipments/shipment-store";
import { supplierHref } from "../suppliers/supplier-links";
import { focusRing, ghostButton, primaryButton, secondaryButton } from "../styles";
import { acknowledgeException, clearAcknowledgement, useTrackingLoaded, useTrackingViews } from "./tracking-store";
import { ExceptionSummary, ScheduleBadge, SeverityBadge, SUMIT_TRACKING_MESSAGE, TRACKING_PROMPTS, TrackingNotice } from "./tracking-ui";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;
const textLink = `inline-flex items-center gap-1 rounded text-sm font-semibold text-teal hover:underline ${focusRing}`;
const smallButton = `inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink transition hover:border-teal/40 hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;
const inputClass = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";
const demoTag = <span className="whitespace-nowrap rounded-full border border-orange/40 px-1.5 text-xs font-medium text-orange">Demo</span>;
const focusSoon = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

export function TrackingDetail({ shipmentId }: { shipmentId: string }) {
  const views = useTrackingViews();
  const loaded = useTrackingLoaded();
  const view = views.find((v) => v.shipment.id === shipmentId);
  if (!view) {
    if (!loaded) return <p className="py-16 text-center text-sm text-ink-muted">Loading shipment…</p>;
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-canvas text-ink-faint">
          <FileSearch className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Shipment not found</h1>
        <p className="mt-2 text-sm text-ink-muted">
          There&apos;s no shipment <ImportId id={shipmentId} className="text-ink" /> in this browser tab. Shipments you create are kept in this tab&apos;s session only.
        </p>
        <Link href={importerHref("tracking")} className={`${secondaryButton} mt-6`}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to Tracking
        </Link>
      </div>
    );
  }
  return <Workspace view={view} />;
}

const BASIS_TEXT: Record<TrackingView["nextAction"]["basis"], string> = {
  critical: "From the most pressing critical exception.",
  "action-required": "From the most pressing exception that needs action.",
  shipment: "The shipment's next workflow step.",
  watch: "No action is required; this item is worth watching.",
  await: "Nothing needs action now.",
};

function Workspace({ view }: { view: TrackingView }) {
  const [message, setMessage] = useState("");
  const sh = view.shipment;
  const st = view.state;

  return (
    <div className="space-y-6">
      <div>
        <Link href={importerHref("tracking")} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Tracking
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <ImportId id={sh.id} className="text-ink-muted" />
          <span className="text-xs text-ink-faint">Order <ImportId id={sh.orderId} className="text-xs text-ink-muted" /></span>
          <ScheduleBadge status={view.schedule.status} />
          <ExceptionSummary view={view} />
        </div>
        <h1 className="mt-1 break-words text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          {sh.cargo.product}
          <span className="font-semibold text-ink-muted"> from {view.supplierName}</span>
        </h1>
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {[
            ["Route", `${sh.route.portOfLoading} → ${sh.route.portOfDischarge}`],
            ["Mode", modeLabel(sh.route.mode)],
            ["Current stage", stageLabel(st.stage)],
            ["Shipment status", shipmentStatusLabel(st.status)],
            ["ETD", formatDate(view.schedule.current.etd)],
            ["ETA", formatDate(view.schedule.current.eta)],
            ["Open exceptions", String(view.open.length)],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt className="text-ink-faint">{k}</dt>
              <dd className="font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <nav aria-label="Related records" className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Link href={importerHref(`shipments/${sh.id}`)} className={textLink}>View Shipment</Link>
          <Link href={importerHref(`orders/${sh.orderId}`)} className={textLink}>View Order</Link>
          <Link href={`${importerHref("documents")}?shipment=${sh.id}`} className={textLink}>View Documents</Link>
          <Link href={importerHref(`compliance/${sh.id}`)} className={textLink}>View Compliance</Link>
          {view.customsCase && <Link href={importerHref(`customs/${view.customsCase.id}`)} className={textLink}>View Customs Case</Link>}
          <Link href={supplierHref(sh.supplierId)} className={textLink}>View Supplier</Link>
        </nav>
      </div>

      <section aria-labelledby="tracking-next" className={`rounded-2xl border px-5 py-5 sm:px-6 ${view.nextAction.basis === "critical" || view.nextAction.basis === "action-required" ? "border-orange/30 bg-orange-soft/40" : "border-teal/30 bg-teal-soft/50"}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Next action</p>
        <h2 id="tracking-next" className="mt-1 text-xl font-semibold text-ink">{view.nextAction.label}</h2>
        <p className="mt-1 text-sm text-ink-muted">{BASIS_TEXT[view.nextAction.basis]}</p>
        {view.nextAction.cta && (
          <Link href={view.nextAction.cta.href} className={`${primaryButton} mt-3 h-10`}>
            {view.nextAction.cta.label}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm font-medium text-teal">{message}</p>
      </section>

      <TrackingNotice />

      <Journey view={view} />
      <RouteStrip view={view} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Exceptions view={view} onMessage={setMessage} />
          <Schedule view={view} onMessage={setMessage} />
          <Timeline view={view} />
        </div>
        <div className="min-w-0 space-y-6">
          <CustomsVisibility view={view} />
          <DocumentVisibility view={view} />
          <Milestones view={view} />
          <SumitAnalysisCard id="sumit-tracking-detail" heading="Ask SUMIT about this shipment" prompts={TRACKING_PROMPTS} message={SUMIT_TRACKING_MESSAGE} />
        </div>
      </div>
    </div>
  );
}

/* Section A — canonical shipment statuses, no tracking-specific stages. */
function Journey({ view }: { view: TrackingView }) {
  const current = SHIPMENT_STATUSES.findIndex((s) => s.id === view.state.status);
  const delivered = view.state.status === "delivered";
  return (
    <section aria-labelledby="journey" className="rounded-2xl border border-line bg-surface px-5 py-4 sm:px-6">
      <h2 id="journey" className="text-base font-semibold text-ink">Journey</h2>
      <p className="text-sm text-ink-muted">Current workflow stage, from the shipment record.</p>
      <ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 xl:grid-cols-7">
        {SHIPMENT_STATUSES.map((s, i) => {
          const done = i < current || delivered;
          const isCurrent = i === current && !delivered;
          const state = done ? "Completed" : isCurrent ? "Current" : "Upcoming";
          return (
            <li key={s.id} className="flex items-center gap-2" aria-current={isCurrent ? "step" : undefined}>
              <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${done ? "bg-teal text-on-brand" : isCurrent ? "border-2 border-orange text-orange" : "border border-line text-ink-faint"}`}>
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 text-sm leading-tight">
                <span className={isCurrent ? "font-semibold text-ink" : done ? "text-ink" : "text-ink-faint"}>{s.label}</span>
                <span className="block text-xs text-ink-faint">{state}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* Section B — a simple route strip; no map, no coordinates. */
function RouteStrip({ view }: { view: TrackingView }) {
  const r = view.shipment.route;
  const points = [
    ["Origin", r.origin],
    ["Port of Loading", r.portOfLoading],
    ["Port of Discharge", r.portOfDischarge],
    ["Final Destination", r.finalDelivery],
  ];
  return (
    <section aria-labelledby="route" className="rounded-2xl border border-line bg-surface px-5 py-4 sm:px-6">
      <h2 id="route" className="text-base font-semibold text-ink">Route</h2>
      <ol className="mt-3 flex flex-col gap-2 md:flex-row md:items-stretch md:gap-0">
        {points.map(([label, place], i) => (
          <li key={label} className="flex min-w-0 items-center gap-2 md:flex-1">
            <span className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2">
              <span className="block text-xs text-ink-faint">{label}</span>
              <span className="block break-words text-sm font-medium text-ink">{place}</span>
            </span>
            {i < points.length - 1 && <ArrowRight aria-hidden className="hidden size-4 shrink-0 text-ink-faint md:mx-1 md:block" />}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-ink-muted">{modeLabel(r.mode)} · Recorded stage: {stageLabel(view.state.stage)}</p>
    </section>
  );
}

/* Section D — derived exceptions. Acknowledging never resolves them. */
function Exceptions({ view, onMessage }: { view: TrackingView; onMessage: (m: string) => void }) {
  const info = view.exceptions.filter((e) => e.severity === "information");
  return (
    <Panel id="exceptions" title="Exceptions" description="Derived from shipment, schedule, document, compliance and customs records. Each closes only when its source is fixed.">
      <div className="px-5 pb-5 pt-3 sm:px-6">
        {view.open.length === 0 ? (
          <p className="text-sm text-ink-muted">No open exceptions.</p>
        ) : (
          <ul id="exception-list" className="space-y-3">
            {view.open.map((e) => (
              <ExceptionCard key={e.id} e={e} onMessage={onMessage} />
            ))}
          </ul>
        )}
        {info.length > 0 && (
          <details className="mt-4 rounded-xl border border-line px-4 py-2 text-sm">
            <summary className={`cursor-pointer rounded font-medium text-ink-muted ${focusRing}`}>Information ({info.length})</summary>
            <ul id="information-list" className="mt-2 divide-y divide-line">
              {info.map((e) => (
                <li key={e.id} className="py-2">
                  <p className="text-ink">{e.title}</p>
                  <p className="text-xs text-ink-faint">{EXCEPTION_SOURCE_LABEL[e.source]} · {e.detail}</p>
                  <Link href={e.cta.href} className={`${textLink} mt-1 text-xs`}>{e.cta.label}</Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Panel>
  );
}

function ExceptionCard({ e, onMessage }: { e: TrackingException; onMessage: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const formId = `ack-note-${e.id.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const buttonId = `ack-button-${e.id.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const close = () => {
    setOpen(false);
    focusSoon(buttonId);
  };
  return (
    <li className="rounded-xl border border-line px-4 py-3" data-exception={e.id}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={e.severity} />
        <span className="text-xs text-ink-muted">Source: {EXCEPTION_SOURCE_LABEL[e.source]}</span>
        <span className="text-xs text-ink-faint">· {EXCEPTION_TYPE_LABEL[e.type]}</span>
        {e.acknowledged && <span className="rounded-full border border-teal/40 px-1.5 text-xs font-medium text-teal">Acknowledged</span>}
      </div>
      <p className="mt-1.5 font-medium text-ink">{e.title}</p>
      <p className="break-words text-sm text-ink-muted">{e.detail}</p>
      <p className="mt-1 text-xs text-ink-faint">Closes when: {e.resolvesWhen}</p>
      {e.acknowledged && (
        <p className="mt-1 text-xs text-ink-muted">
          Acknowledged by {e.acknowledged.by} on <time dateTime={e.acknowledged.at}>{formatDate(e.acknowledged.at)}</time>
          {e.acknowledged.note ? ` — “${e.acknowledged.note}”` : ""}. Still open until the source is fixed.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link href={e.cta.href} className={`${secondaryButton} h-9 px-3`}>
          {e.cta.label}
          <span className="sr-only"> for {e.title}</span>
        </Link>
        {!e.acknowledged && !open && (
          <button type="button" id={buttonId} onClick={() => { setOpen(true); setNote(""); setError(""); focusSoon(formId); }} className={smallButton}>
            Acknowledge<span className="sr-only"> {e.title}</span>
          </button>
        )}
        {e.acknowledged && (
          <button type="button" onClick={() => { clearAcknowledgement(e); onMessage(`Acknowledgement removed: ${e.title}.`); }} className={smallButton}>
            Remove acknowledgement<span className="sr-only"> for {e.title}</span>
          </button>
        )}
      </div>
      {open && (
        <form
          className="mt-2 space-y-2"
          onKeyDown={(ev) => {
            if (ev.key === "Escape") close();
          }}
          onSubmit={(ev) => {
            ev.preventDefault();
            const err = acknowledgeException(e, note);
            if (err) return setError(err);
            setOpen(false);
            onMessage(`Acknowledged: ${e.title}. It stays open until the source is fixed.`);
          }}
        >
          <label htmlFor={formId} className="block text-xs font-medium text-ink-muted">Note <span className="font-normal text-ink-faint">Optional</span></label>
          <input id={formId} value={note} onChange={(ev) => { setNote(ev.target.value); setError(""); }} className={inputClass} />
          {error && <p role="alert" className="text-xs font-medium text-orange">{error}</p>}
          <p className="text-xs text-ink-faint">Acknowledging records that you have seen this. It does not resolve the issue.</p>
          <div className="flex gap-2">
            <button type="submit" className={`${primaryButton} h-9 px-3`}>Acknowledge</button>
            <button type="button" onClick={close} className={`${ghostButton} h-9`}>Cancel</button>
          </div>
        </form>
      )}
    </li>
  );
}

/* Section C — planned vs current schedule, from shipment schedule events. */
function Schedule({ view, onMessage }: { view: TrackingView; onMessage: (m: string) => void }) {
  const sc = view.schedule;
  const st = view.state;
  const [open, setOpen] = useState(false);
  const departed = st.status === "in-transit";
  const editable = ["preparing", "ready-to-ship", "at-origin", "in-transit"].includes(st.status);
  const [etd, setEtd] = useState(sc.current.etd);
  const [eta, setEta] = useState(sc.current.eta);
  const [reason, setReason] = useState<ScheduleChangeReason>("Carrier schedule change");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const close = () => {
    setOpen(false);
    setError("");
    focusSoon("schedule-update-button");
  };
  const rows: [string, string, string?][] = [
    ["Cargo Ready Date", sc.current.readyDate],
    ["Planned ETD", sc.baseline.etd],
    ["Current ETD", sc.current.etd, sc.etdDelayDays ? formatDayShift(sc.etdDelayDays) : undefined],
    ["Planned ETA", sc.baseline.eta],
    ["Current ETA", sc.current.eta, sc.etaDelayDays ? formatDayShift(sc.etaDelayDays) : undefined],
  ];
  return (
    <Panel id="schedule" title="Schedule" description="Planned dates are kept; updates are recorded as events. No carrier schedule feed is connected.">
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6" id="schedule-body">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-ink-muted">Schedule status</span>
          <ScheduleBadge status={sc.status} />
          {sc.overdue && <span className="font-medium text-orange">ETA passed {formatDayShift(sc.overdueDays).replace("+", "")} ago without an arrival</span>}
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {rows.map(([k, v, shift]) => (
            <div key={k} className="rounded-xl border border-line px-3 py-2">
              <dt className="text-xs text-ink-faint">{k}</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {formatDate(v)}
                {shift && <span className="ml-1.5 text-xs font-semibold text-orange">{shift}</span>}
              </dd>
            </div>
          ))}
        </dl>

        {sc.changes.length === 0 ? (
          <p className="mt-3 text-ink-muted" id="schedule-changes">{SCHEDULE_STATUS_LABEL["on-schedule"]} — no schedule changes recorded.</p>
        ) : (
          <ul id="schedule-changes" className="mt-3 space-y-2">
            {sc.changes.map((c) => (
              <li key={`${c.eventId}-${c.field}`} className="rounded-xl bg-canvas px-3 py-2">
                <p className="flex flex-wrap items-center gap-x-2 font-medium text-ink">
                  {c.field === "readyDate" ? "Cargo ready date" : c.field.toUpperCase()} changed
                  <span className="text-ink-muted">{formatDate(c.from)} → {formatDate(c.to)}</span>
                  <span className="text-orange">{formatDayShift(c.days)}</span>
                  {c.demo && demoTag}
                </p>
                <p className="text-xs text-ink-faint">
                  Recorded <time dateTime={c.at}>{formatDate(c.at)}</time>
                  {c.reason ? ` · Reason: ${c.reason} (selected by user)` : ""}
                  {c.note ? ` · ${c.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}

        {sc.etaHistory.length > 1 && (
          <div className="mt-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">ETA history</h3>
            <ol id="eta-history" className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {sc.etaHistory.map((h, i) => (
                <li key={`${h.value}-${i}`} className="flex items-center gap-2">
                  <span><span className="text-ink-faint">{h.label}:</span> <span className="font-medium text-ink">{formatDate(h.value)}</span></span>
                  {i < sc.etaHistory.length - 1 && <ArrowRight aria-hidden className="size-3.5 text-ink-faint" />}
                </li>
              ))}
            </ol>
          </div>
        )}

        {editable && !open && (
          <button type="button" id="schedule-update-button" onClick={() => { setEtd(sc.current.etd); setEta(sc.current.eta); setNote(""); setError(""); setOpen(true); focusSoon(departed ? "sched-eta" : "sched-etd"); }} className={`${smallButton} mt-4`}>
            <FlaskConical aria-hidden className="size-3.5 text-orange" />
            Record Schedule Update {demoTag}
          </button>
        )}
        {open && (
          <form
            aria-labelledby="schedule-form-heading"
            className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-line p-4 sm:grid-cols-2"
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
            }}
            onSubmit={(e) => {
              e.preventDefault();
              const err = recordScheduleUpdate(view.shipment.id, { etd: departed ? undefined : etd, eta }, reason, note);
              if (err) return setError(err);
              close();
              onMessage("Schedule update recorded (demo). No carrier system is connected.");
            }}
          >
            <h3 id="schedule-form-heading" className="flex items-center gap-2 font-semibold text-ink sm:col-span-2">Record schedule update {demoTag}</h3>
            <div>
              <label htmlFor="sched-etd" className="mb-1 block text-xs font-medium text-ink-muted">New ETD</label>
              <input id="sched-etd" type="date" value={etd} disabled={departed} onChange={(e) => { setEtd(e.target.value); setError(""); }} className={`${inputClass} disabled:opacity-60`} />
              {departed && <p className="mt-1 text-xs text-ink-faint">The shipment has departed; ETD is fixed.</p>}
            </div>
            <div>
              <label htmlFor="sched-eta" className="mb-1 block text-xs font-medium text-ink-muted">New ETA</label>
              <input id="sched-eta" type="date" value={eta} onChange={(e) => { setEta(e.target.value); setError(""); }} className={inputClass} />
            </div>
            <div>
              <label htmlFor="sched-reason" className="mb-1 block text-xs font-medium text-ink-muted">Reason</label>
              <select id="sched-reason" value={reason} onChange={(e) => setReason(e.target.value as ScheduleChangeReason)} className={inputClass}>
                {SCHEDULE_CHANGE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sched-note" className="mb-1 block text-xs font-medium text-ink-muted">Note <span className="font-normal text-ink-faint">Optional</span></label>
              <input id="sched-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </div>
            {error && <p role="alert" className="text-sm font-medium text-orange sm:col-span-2">{error}</p>}
            <p className="text-xs text-ink-faint sm:col-span-2">Recorded locally — no carrier system is connected. The reason is your selection; XimVerse does not detect causes.</p>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className={`${primaryButton} h-10`}>Record Update</button>
              <button type="button" onClick={close} className={`${ghostButton} h-10`}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}

interface TimelineItem {
  id: string;
  at: string;
  text: string;
  source: "Shipment" | "Schedule" | "Document" | "Customs";
  party: string;
  demo?: boolean;
  note?: string;
}

/* Section F — built from canonical event streams, chronological. */
function Timeline({ view }: { view: TrackingView }) {
  const items: TimelineItem[] = [
    ...view.shipment.events.map<TimelineItem>((e) => ({
      id: `s-${e.id}`,
      at: e.at,
      text: describeEvent(e),
      source: e.type === "schedule-updated" ? "Schedule" : e.type === "customs-updated" ? "Customs" : "Shipment",
      party: eventParty(e),
      demo: e.demo,
      note: e.type === "schedule-updated" ? [e.reason, e.note].filter(Boolean).join(" · ") || undefined : e.note,
    })),
    ...view.documents.flatMap((d) =>
      d.events.map<TimelineItem>((e) => ({
        id: `d-${e.id}`,
        at: e.at,
        text: describeDocumentEvent(e, d.label),
        source: "Document",
        party: e.by === "importer" ? "You" : e.by === "system" ? "XimVerse" : DOCUMENT_SOURCE_LABEL[e.by],
        demo: e.demo,
        note: e.note,
      })),
    ),
    // Customs case events only (its document and status items are already above).
    ...(view.customsCase
      ? customsActivity(view.customsCase)
          .filter((a) => !a.id.startsWith("shp-") && !a.id.startsWith("doc-"))
          .map<TimelineItem>((a) => ({ id: `c-${a.id}`, at: a.at, text: a.text, source: "Customs", party: a.party, demo: a.demo, note: a.note }))
      : []),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));

  return (
    <Panel id="timeline" title="Operational Timeline" description="Oldest first. Built from shipment, document and customs records.">
      <ol id="timeline-list" className="max-h-[40rem] overflow-y-auto px-5 pb-5 pt-4 sm:px-6">
        {items.map((e, i) => (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0" data-at={e.at}>
            {i < items.length - 1 && <span aria-hidden className="absolute left-[3.5px] top-3 h-full w-px bg-line" />}
            <span aria-hidden className="relative mt-1.5 size-2 shrink-0 rounded-full bg-teal" />
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="break-words font-medium text-ink">{e.text}</span>
                <span className="rounded border border-line px-1 text-xs text-ink-muted">{e.source}</span>
                {e.demo && demoTag}
              </p>
              <p className="text-xs text-ink-faint">
                <time dateTime={e.at}>{formatDate(e.at)}</time> · {e.party}
              </p>
              {e.note && <p className="mt-0.5 break-words text-sm text-ink-muted">{e.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* Section G — canonical shipment milestones. */
function Milestones({ view }: { view: TrackingView }) {
  const list = milestones(view.shipment, view.documents);
  const nextIndex = list.findIndex((m) => !m.at);
  return (
    <Panel id="tracking-milestones" title="Milestones" description="Recorded dates only.">
      <ol className="px-5 pb-5 pt-4 sm:px-6">
        {list.map((m, i) => (
          <li key={m.id} className="flex items-baseline justify-between gap-3 py-1 text-sm">
            <span className={m.at ? "text-ink" : "text-ink-faint"}>
              {m.at ? <Check aria-hidden className="mr-1.5 inline size-3.5 text-teal" /> : null}
              {m.label}
            </span>
            <span className="shrink-0 text-xs text-ink-faint">
              {m.at ? (
                <>
                  <time dateTime={m.at}>{formatDate(m.at)}</time> {m.demo ? "· Demo" : "· Completed"}
                </>
              ) : i === nextIndex ? (
                "Pending"
              ) : (
                "Future"
              )}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* Section H — compact customs status from the customs case. */
function CustomsVisibility({ view }: { view: TrackingView }) {
  const c = view.customsCase;
  const delivered = view.state.status === "delivered";
  return (
    <Panel id="tracking-customs" title="Customs">
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
        {c ? (
          <>
            <dl className="divide-y divide-line">
              {[
                ["Case", c.id],
                ["CHA", c.cha?.company ?? "Not assigned"],
                ["Customs status", CUSTOMS_CASE_STATUS_LABEL[c.status]],
                ["Readiness", CUSTOMS_READINESS_LABEL[c.readiness]],
                ["Open clarifications", String(c.clarifications.filter((x) => x.status === "open").length)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="min-w-0 break-words text-right text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <Link href={importerHref(`customs/${c.id}`)} className={`${secondaryButton} mt-3 h-10 w-full`}>View Customs Case</Link>
          </>
        ) : (
          <>
            <p className="text-ink-muted">Customs preparation not started.</p>
            {!delivered && (
              <Link href={`${importerHref("customs/new")}?shipment=${view.shipment.id}`} className={`${secondaryButton} mt-3 h-10 w-full`}>Prepare Customs</Link>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

/* Section I — compact document counts; the Document Center has the detail. */
function DocumentVisibility({ view }: { view: TrackingView }) {
  const d = view.documentSummary;
  return (
    <Panel id="tracking-documents" title="Documents">
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
        <dl className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5 xl:grid-cols-3">
          {[
            ["Required", d.required],
            ["Complete", d.complete],
            ["Missing", d.missing],
            ["Needs Review", d.needsReview],
            ["Expired", d.expired],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col rounded-lg border border-line px-2 py-2">
              <dt className="text-xs text-ink-muted">{k}</dt>
              <dd className="order-first text-lg font-semibold tabular-nums text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <Link href={`${importerHref("documents")}?shipment=${view.shipment.id}`} className={`${secondaryButton} mt-3 h-10 w-full`}>Manage Documents</Link>
        <p className="mt-2 flex gap-1.5 text-xs text-ink-faint">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Counts cover required documents only.
        </p>
      </div>
    </Panel>
  );
}
