"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck, CircleDashed, CircleX, FileSearch, Plus } from "lucide-react";
import { formatDate } from "@/lib/format";
import { formatQuantity } from "@/lib/import-requirements";
import { importerHref } from "@/lib/importer-nav";
import { DOCUMENT_STATUS_LABEL } from "@/lib/importer-documents";
import { customsCaseForShipment } from "@/lib/importer-customs";
import {
  EXTERNAL_EVENT_NOTE,
  FINANCE_STATUS_LABEL,
  formatMoney,
  INSTRUMENT_LABEL,
  LC_CHECKLIST_NOTE,
  LC_STATUS_LABEL,
  methodLabel,
  READINESS_LABEL,
  TRIGGER_LABEL,
  WORKSPACE_STATUS_LABEL,
  type FinanceStatus,
  type PaymentWorkspace,
} from "@/lib/importer-payments";
import { ImportId, Panel } from "../dashboard/dashboard-ui";
import { useCustomsCases } from "../customs/customs-store";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { supplierHref } from "../suppliers/supplier-links";
import { focusRing, primaryButton, secondaryButton } from "../styles";
import { DueDateForm, FinanceForm, focusSoon, inputClass, LcForm, ManualScheduleForm, RecordPaymentForm, ReferenceForm, smallButton } from "./payment-forms";
import { recordFinanceEvent, recordLcEvent, usePaymentsLoaded, usePaymentWorkspaces } from "./payment-store";
import { ObligationBadge, PAYMENT_PROMPTS, PaymentsNotice, SeverityBadge, SUMIT_PAYMENT_MESSAGE, WorkspaceBadge } from "./payments-ui";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;
const textLink = `inline-flex items-center gap-1 rounded text-sm font-semibold text-teal hover:underline ${focusRing}`;
type Say = (m: string) => void;

export function PaymentsDetail({ orderId }: { orderId: string }) {
  const workspaces = usePaymentWorkspaces();
  const loaded = usePaymentsLoaded();
  const w = workspaces.find((x) => x.order.id === orderId);
  if (!w) {
    if (!loaded) return <p className="py-16 text-center text-sm text-ink-muted">Loading payments…</p>;
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-canvas text-ink-faint">
          <FileSearch className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Order not found</h1>
        <p className="mt-2 text-sm text-ink-muted">There&apos;s no active order <ImportId id={orderId} className="text-ink" /> in this browser tab.</p>
        <Link href={importerHref("payments")} className={`${secondaryButton} mt-6`}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to Payments
        </Link>
      </div>
    );
  }
  return <Workspace w={w} />;
}

function Workspace({ w }: { w: PaymentWorkspace }) {
  const [message, setMessage] = useState("");
  const customsCases = useCustomsCases();
  const customsCase = w.shipment ? customsCaseForShipment(w.shipment.id, customsCases) : undefined;
  const m = (n: number) => formatMoney(n, w.currency);
  const t = w.order.terms;
  const next = w.nextObligation;

  return (
    <div className="space-y-6">
      <div>
        <Link href={importerHref("payments")} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Payments
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <ImportId id={w.order.id} className="text-ink-muted" />
          <span className="text-xs text-ink-faint">{w.order.purchaseOrder.number}</span>
          <WorkspaceBadge status={w.status} />
        </div>
        <h1 className="mt-1 break-words text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          {w.supplierName}
          <span className="font-semibold text-ink-muted"> · {t.productName}</span>
        </h1>
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {[
            ["Order value", m(w.orderValue)],
            ["Currency", w.currency],
            ["Quantity", formatQuantity(t.quantity)],
            ["Payment terms", `${w.terms.label} — ${w.terms.summary}`],
            ["Payment status", WORKSPACE_STATUS_LABEL[w.status]],
            ["Next payment", next ? `${next.label} · ${m(next.remaining)}${next.dueDate ? ` · due ${formatDate(next.dueDate)}` : ""}` : w.obligations.length ? "Nothing open" : "Schedule not set"],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt className="text-ink-faint">{k}</dt>
              <dd className="font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <nav aria-label="Related records" className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Link href={importerHref(`orders/${w.order.id}`)} className={textLink}>View Order</Link>
          <Link href={supplierHref(w.order.supplierId)} className={textLink}>View Supplier</Link>
          {w.shipment && <Link href={importerHref(`shipments/${w.shipment.id}`)} className={textLink}>View Shipment</Link>}
          {w.shipment && <Link href={`${importerHref("documents")}?shipment=${w.shipment.id}`} className={textLink}>View Documents</Link>}
          {customsCase && <Link href={importerHref(`customs/${customsCase.id}`)} className={textLink}>View Customs</Link>}
          <Link href={importerHref(`landed-cost/${w.order.id}`)} className={textLink}>View Landed Cost</Link>
        </nav>
      </div>

      <section aria-labelledby="pay-summary" className="rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
        <h2 id="pay-summary" className="text-base font-semibold text-ink">Payment Summary <span className="font-normal text-ink-muted">· {w.currency} · supplier payments only, not landed cost</span></h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Order Value", m(w.orderValue)],
            ["Total Scheduled", w.obligations.length ? m(w.totals.scheduled) : "Not set"],
            ["Total Payment Recorded", m(w.totals.recorded)],
            ["Remaining", m(w.obligations.length ? w.totals.remaining : w.orderValue)],
            ["Next Due", next?.dueDate ? formatDate(next.dueDate) : "—"],
            ["Overdue Amount", m(w.totals.overdue)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line px-3 py-2" data-total={k}>
              <dt className="text-xs text-ink-faint">{k}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {w.obligations.length > 0 && (
          <p className={`mt-2 text-xs ${w.integrityOk ? "text-ink-muted" : "font-semibold text-orange"}`} id="integrity">
            {w.integrityOk ? `Scheduled total equals the order value (${m(w.orderValue)}).` : "Scheduled total doesn't equal the order value."}
          </p>
        )}
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm font-medium text-teal">{message}</p>
      </section>

      <PaymentsNotice />

      {w.exceptions.length > 0 && (
        <Panel id="pay-exceptions" title="Payment Exceptions" description="Financial workflow issues for this order.">
          <ul className="space-y-2 px-5 pb-5 pt-3 sm:px-6">
            {w.exceptions.map((e) => (
              <li key={e.id} className="rounded-xl border border-line px-4 py-2.5 text-sm" data-exception={e.id}>
                <SeverityBadge severity={e.severity} />
                <p className="mt-1 font-medium text-ink">{e.title}</p>
                <p className="text-ink-muted">{e.detail}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel id="terms" title="Agreed Payment Terms" description="Read-only. Source: accepted negotiation / frozen order terms.">
        <dl className="divide-y divide-line px-5 pb-4 pt-2 text-sm sm:px-6">
          {[
            ["Payment term", w.terms.label],
            ["Agreed wording", w.terms.summary],
            ["Advance", `${w.terms.advancePercent}%`],
            ["Order value", m(w.orderValue)],
            ["Source", "Accepted negotiation / frozen order terms"],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-wrap justify-between gap-x-4 py-2">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="min-w-0 break-words text-right text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Schedule w={w} onMessage={setMessage} />
      <RecordPayment w={w} onMessage={setMessage} />
      <TradeFinance w={w} onMessage={setMessage} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Readiness w={w} />
        <History w={w} />
      </div>

      <SumitAnalysisCard id="sumit-payments-detail" heading="Ask SUMIT about payments" prompts={PAYMENT_PROMPTS} message={SUMIT_PAYMENT_MESSAGE} />
    </div>
  );
}

/* B — Payment schedule. */
function Schedule({ w, onMessage }: { w: PaymentWorkspace; onMessage: Say }) {
  const [setup, setSetup] = useState(false);
  const [dueFor, setDueFor] = useState<string | null>(null);
  const [refFor, setRefFor] = useState<string | null>(null);
  return (
    <Panel id="schedule" title="Payment Schedule" description={w.usingManual ? "Source: manual schedule you set up. The agreed terms on the order are unchanged." : "Derived from the agreed order terms."}>
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
        {w.obligations.length === 0 && (
          <div className="rounded-xl border border-orange/30 bg-orange-soft/40 px-4 py-3" id="manual-required">
            <p className="font-semibold text-ink">Payment schedule requires manual setup.</p>
            <p className="text-ink-muted">{w.interpretation.reason}</p>
          </div>
        )}
        <ol id="obligation-list" className="space-y-3">
          {w.obligations.map((o) => (
            <li key={o.id} className="rounded-xl border border-line px-4 py-3" data-obligation={o.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{o.sequence}. {o.label} · {o.percentage}%</p>
                  <p className="font-mono text-xs text-ink-muted">{o.formula}</p>
                </div>
                <ObligationBadge status={o.status} label={o.statusDetail} />
              </div>
              <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                <div><dt className="inline text-ink-faint">Trigger: </dt><dd className="inline text-ink">{TRIGGER_LABEL[o.trigger]} — {o.triggerDetail}</dd></div>
                <div><dt className="inline text-ink-faint">Due date: </dt><dd className="inline text-ink">{o.dueDate ? formatDate(o.dueDate) : "Not set"}</dd></div>
                <div><dt className="inline text-ink-faint">Recorded: </dt><dd className="inline text-ink">{formatMoney(o.recorded, o.currency)}</dd></div>
                <div><dt className="inline text-ink-faint">Remaining: </dt><dd className="inline font-semibold text-ink">{formatMoney(o.remaining, o.currency)}</dd></div>
                <div className="sm:col-span-2"><dt className="inline text-ink-faint">Source: </dt><dd className="inline text-ink">{o.source}</dd></div>
              </dl>
              {o.requiredDocuments.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5 text-xs" aria-label={`Documents required for ${o.label}`}>
                  {o.requiredDocuments.map((d) => (
                    <li key={d.type} className={`rounded-full border px-2 py-0.5 ${d.complete ? "border-teal/40 text-teal" : "border-orange/40 text-orange"}`}>
                      {d.complete ? "✓" : "○"} {d.label}{d.document ? ` · ${DOCUMENT_STATUS_LABEL[d.document.status]}` : " · No document yet"}
                    </li>
                  ))}
                </ul>
              )}
              {o.records.length > 0 && (
                <ul className="mt-2 divide-y divide-line rounded-lg bg-canvas px-3 text-xs">
                  {o.records.map((r) => (
                    <li key={r.id} className="py-1.5" data-record={r.id}>
                      <span className="font-mono text-ink">{r.id}</span> · {formatMoney(r.amount, r.currency)} on {formatDate(r.paymentDate)} · {methodLabel(r.method)}
                      {r.reference ? ` · Ref ${r.reference}` : " · No reference"}
                      {r.provider ? ` · ${r.provider}` : ""}
                      {r.demo && <span className="ml-1 rounded-full border border-orange/40 px-1.5 font-medium text-orange">Demo</span>}
                      {(r.evidence.bankAdviceNumber || r.evidence.utr || r.evidence.declaredFilename) && (
                        <span className="block text-ink-faint">Evidence: {[r.evidence.bankAdviceNumber && `Advice ${r.evidence.bankAdviceNumber}`, r.evidence.utr && `UTR ${r.evidence.utr}`, r.evidence.declaredFilename && `File ${r.evidence.declaredFilename} (metadata only)`].filter(Boolean).join(" · ")}</span>
                      )}
                      {!r.reference && refFor !== r.id && (
                        <button type="button" className={`${smallButton} mt-1`} onClick={() => { setRefFor(r.id); focusSoon(`ref-input-${r.id}`); }}>
                          Add Reference<span className="sr-only"> to {r.id}</span>
                        </button>
                      )}
                      {refFor === r.id && <ReferenceForm w={w} recordId={r.id} onMessage={onMessage} onDone={() => setRefFor(null)} />}
                    </li>
                  ))}
                </ul>
              )}
              {o.status !== "recorded" && dueFor !== o.id && (
                <button type="button" id={`due-button-${o.sequence}`} className={`${smallButton} mt-2`} onClick={() => { setDueFor(o.id); focusSoon(`due-${o.sequence}`); }}>
                  Set Due Date<span className="sr-only"> for {o.label}</span>
                </button>
              )}
              {dueFor === o.id && <DueDateForm w={w} obligationId={o.id} sequence={o.sequence} current={o.dueDate} onMessage={onMessage} onDone={() => { setDueFor(null); focusSoon(`due-button-${o.sequence}`); }} />}
            </li>
          ))}
        </ol>
        {(w.obligations.length === 0 || w.usingManual) && !setup && (
          <button type="button" id="ms-button" onClick={() => { setSetup(true); focusSoon("ms-label-1"); }} className={`${secondaryButton} mt-3 h-10`}>
            {w.usingManual ? "Edit Payment Schedule" : "Set Up Payment Schedule"}
          </button>
        )}
        {setup && <ManualScheduleForm w={w} onMessage={onMessage} onDone={() => { setSetup(false); focusSoon("ms-button"); }} />}
      </div>
    </Panel>
  );
}

/* C + D — Record an external payment, with evidence metadata. */
function RecordPayment({ w, onMessage }: { w: PaymentWorkspace; onMessage: Say }) {
  const [open, setOpen] = useState(false);
  const canRecord = w.obligations.some((o) => o.remaining > 0);
  return (
    <Panel id="record" title="Record Payment" description="Record an external payment. XimVerse does not transfer funds.">
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
        {!canRecord && <p className="text-ink-muted">{w.obligations.length ? "Every obligation is fully recorded." : "Set up the payment schedule first."}</p>}
        {canRecord && !open && (
          <button type="button" id="record-payment-button" onClick={() => { setOpen(true); focusSoon("pay-obligation"); }} className={`${primaryButton} h-10`}>
            <Plus aria-hidden className="size-4" />
            Record Payment
          </button>
        )}
        {open && <RecordPaymentForm w={w} onMessage={onMessage} onDone={() => { setOpen(false); focusSoon("record-payment-button"); }} />}
      </div>
    </Panel>
  );
}

/* F — Trade finance: LC readiness or a finance plan. Planning only. */
function TradeFinance({ w, onMessage }: { w: PaymentWorkspace; onMessage: Say }) {
  const [editing, setEditing] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [ref, setRef] = useState("");
  const [error, setError] = useState("");
  const lc = w.lc;
  const act = (err: string | undefined, ok: string) => {
    setError(err ?? "");
    if (!err) onMessage(ok);
  };
  return (
    <Panel id="finance" title="Trade Finance" description="Planning and readiness only. No bank or lender is connected.">
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
        <p className="text-ink">
          Instrument: <span className="font-semibold">{INSTRUMENT_LABEL[w.finance.instrument]}</span>
          {w.finance.basis && <span className="text-ink-muted"> — {w.finance.basis}</span>}
        </p>
        {lc ? (
          <div className="mt-3" id="lc-section">
            <h3 className="font-semibold text-ink">Letter of Credit readiness</h3>
            <p className="mt-1">LC status: <span className="font-semibold text-ink" id="lc-status">{LC_STATUS_LABEL[lc.status]}</span></p>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {[
                ["LC Required", lc.required ? "Yes — required by agreed payment terms" : "Recorded by you"],
                ["Issuing Bank", lc.plan.issuingBank],
                ["Advising Bank", lc.plan.advisingBank],
                ["Applicant", lc.plan.applicant],
                ["Beneficiary", lc.plan.beneficiary],
                ["LC Amount", formatMoney(lc.plan.amount, w.currency)],
                ["Expiry Date", lc.plan.expiryDate && formatDate(lc.plan.expiryDate)],
                ["Latest Shipment Date", lc.plan.latestShipmentDate && formatDate(lc.plan.latestShipmentDate)],
                ["Presentation Period", lc.plan.presentationDays !== undefined ? `${lc.plan.presentationDays} days` : undefined],
                ["Reference Number", lc.plan.reference],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="min-w-0 break-words text-right text-ink">{v || <span className="text-orange">Not entered</span>}</dd>
                </div>
              ))}
            </dl>
            <h4 className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">LC document checklist</h4>
            <p className="text-xs text-ink-faint">{LC_CHECKLIST_NOTE} Status is from the Document Center; contents aren&apos;t inspected.</p>
            <ul id="lc-documents" className="mt-1 divide-y divide-line">
              {lc.documents.map((d) => (
                <li key={d.type} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span className="text-ink">{d.label}</span>
                  <span className={d.complete ? "font-medium text-teal" : "text-orange"}>
                    {d.complete ? "Complete" : d.document ? DOCUMENT_STATUS_LABEL[d.document.status] : w.shipment ? "Not in Document Center" : "No shipment yet"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {!editing && <button type="button" id="lc-edit-button" className={smallButton} onClick={() => { setEditing(true); focusSoon("lc-issuingBank"); }}>Edit LC Details</button>}
              <button type="button" className={smallButton} disabled={lc.status !== "draft-prepared"} onClick={() => act(recordLcEvent(w, "application-recorded"), "LC application recorded (external event).")}>Record LC Application</button>
              {!issuing && <button type="button" className={smallButton} disabled={lc.status !== "application-recorded" && lc.status !== "amendment-required"} onClick={() => { setIssuing(true); setRef(lc.plan.reference ?? ""); focusSoon("lc-issue-ref"); }}>Record LC Issuance</button>}
              <button type="button" className={smallButton} disabled={lc.status !== "application-recorded" && lc.status !== "issued-recorded"} onClick={() => act(recordLcEvent(w, "amendment-required"), "LC amendment requirement recorded.")}>Record Amendment Required</button>
              <button type="button" className={smallButton} disabled={!["issued-recorded", "amendment-required", "expired"].includes(lc.status)} onClick={() => act(recordLcEvent(w, "closed"), "LC closure recorded.")}>Record LC Closed</button>
            </div>
            {issuing && (
              <form
                className="mt-2 flex flex-wrap items-end gap-2"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIssuing(false);
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const err = recordLcEvent(w, "issued-recorded", ref);
                  setError(err ?? "");
                  if (!err) {
                    setIssuing(false);
                    onMessage("LC issuance recorded (external event).");
                  }
                }}
              >
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-xs font-medium text-ink-muted">LC reference from the bank</span>
                  <input id="lc-issue-ref" value={ref} onChange={(e) => setRef(e.target.value)} className={inputClass} />
                </label>
                <button type="submit" className={`${primaryButton} h-10`}>Record Issuance</button>
              </form>
            )}
            <p className="mt-2 text-xs text-ink-faint">{EXTERNAL_EVENT_NOTE}</p>
            {error && <p role="alert" className="mt-1 text-sm font-medium text-orange">{error}</p>}
            {editing && <LcForm w={w} onMessage={onMessage} onDone={() => { setEditing(false); focusSoon("lc-edit-button"); }} />}
          </div>
        ) : (
          <FinancePlanView w={w} onMessage={onMessage} />
        )}
      </div>
    </Panel>
  );
}

function FinancePlanView({ w, onMessage }: { w: PaymentWorkspace; onMessage: Say }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const p = w.finance.plan;
  const rec = (to: FinanceStatus) => {
    const err = recordFinanceEvent(w, to);
    setError(err ?? "");
    if (!err) onMessage(`Recorded manually: ${FINANCE_STATUS_LABEL[to]}.`);
  };
  return (
    <div className="mt-3" id="finance-plan">
      <p>Finance status: <span className="font-semibold text-ink" id="finance-status">{FINANCE_STATUS_LABEL[w.finance.status]}</span></p>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {[
          ["Finance needed", p.needed === undefined ? "Not decided" : p.needed ? "Yes" : "No"],
          ["Requested amount", p.requestedAmount !== undefined ? formatMoney(p.requestedAmount, w.currency) : "Not entered"],
          ["Needed by", p.neededBy ? formatDate(p.neededBy) : "Not entered"],
          ["Purpose", p.purpose ?? "Not entered"],
          ["Bank / provider", p.provider ?? "Not entered"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="min-w-0 break-words text-right text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {!editing && <button type="button" id="fin-edit-button" className={smallButton} onClick={() => { setEditing(true); focusSoon("fin-needed"); }}>Edit Finance Plan</button>}
        <button type="button" className={smallButton} onClick={() => rec("application-recorded")}>Record Application (external)</button>
        <button type="button" className={smallButton} onClick={() => rec("approved-recorded")}>Record Approval (external)</button>
        <button type="button" className={smallButton} onClick={() => rec("rejected-recorded")}>Record Rejection (external)</button>
      </div>
      <p className="mt-2 text-xs text-ink-faint">External outcomes are recorded manually. XimVerse doesn&apos;t assess eligibility, recommend providers or calculate interest.</p>
      {error && <p role="alert" className="mt-1 text-sm font-medium text-orange">{error}</p>}
      {editing && <FinanceForm w={w} onMessage={onMessage} onDone={() => { setEditing(false); focusSoon("fin-edit-button"); }} />}
    </div>
  );
}

/* G — Finance readiness checklist. */
function Readiness({ w }: { w: PaymentWorkspace }) {
  const icon = (s: string) => (s === "available" ? <CircleCheck aria-hidden className="size-4 shrink-0 text-teal" /> : s === "missing" ? <CircleX aria-hidden className="size-4 shrink-0 text-orange" /> : <CircleDashed aria-hidden className="size-4 shrink-0 text-ink-faint" />);
  return (
    <Panel id="readiness" title="Finance Readiness" description="From information already recorded in XimVerse. Not an eligibility assessment.">
      <div className="px-5 pb-5 pt-2 text-sm sm:px-6">
        <ul className="divide-y divide-line">
          {w.readiness.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-2" data-readiness={r.id}>
              <span className="flex items-start gap-2">
                {icon(r.state)}
                <span>
                  <span className="text-ink">{r.label}</span>
                  <span className="block text-xs text-ink-faint">{r.detail}</span>
                </span>
              </span>
              <span className="shrink-0 text-xs font-medium text-ink-muted">{READINESS_LABEL[r.state]}</span>
            </li>
          ))}
        </ul>
        <p className={`mt-3 rounded-lg px-3 py-2 ${w.readyToApproach ? "bg-teal-soft/60 text-ink" : "bg-canvas text-ink-muted"}`} id="readiness-result">
          {w.readyToApproach ? "Ready to approach finance provider — the internal checklist is complete." : "Checklist incomplete — some information is missing or not yet applicable."}
        </p>
      </div>
    </Panel>
  );
}

/* E — Payment history (derived milestones + recorded events). */
function History({ w }: { w: PaymentWorkspace }) {
  return (
    <Panel id="pay-history" title="Payment History" description="Oldest first. Recorded entries are append-only.">
      <ol id="history-list" className="px-5 pb-5 pt-3 sm:px-6">
        {w.history.map((h, i) => (
          <li key={h.id} className="relative flex gap-3 pb-3 last:pb-0">
            {i < w.history.length - 1 && <span aria-hidden className="absolute left-[3.5px] top-3 h-full w-px bg-line" />}
            <span aria-hidden className={`relative mt-1.5 size-2 shrink-0 rounded-full ${h.derived ? "bg-line" : "bg-teal"}`} />
            <div className="min-w-0 text-sm">
              <p className="break-words text-ink">{h.text}{h.demo && <span className="ml-1.5 rounded-full border border-orange/40 px-1.5 text-xs font-medium text-orange">Demo</span>}</p>
              <p className="text-xs text-ink-faint"><time dateTime={h.at}>{formatDate(h.at)}</time> · {h.derived ? "Derived" : "Recorded"}</p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
