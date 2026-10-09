"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, Check, CircleAlert, CircleCheck, Factory, Lock, ShieldCheck, Ship, Sparkles } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { Modal } from "@/components/exporter/products/modal";
import { input } from "@/components/exporter/quote/form-ui";
import { qtyText, unitPriceText, valueText } from "@/components/exporter/deals/deal-ui";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDate } from "@/lib/exporter-dashboard";
import { findOpportunity, formatDateTime, PAYMENT_TERM_LABEL, shortCountry } from "@/lib/exporter-opportunities";
import { COST_COVERAGE_LABEL, DEMO_TODAY } from "@/lib/exporter-quotations";
import { COMMITMENT_LABEL, findSeededDeal } from "@/lib/exporter-deals";
import {
  actionsRequired,
  complianceStatusText,
  DOCUMENT_STATUS_LABEL,
  EXECUTION_STAGES,
  orderInsights,
  orderState,
  PAYMENT_STEPS,
  preShipmentReadiness,
  readinessScore,
  type ExporterOrder,
  type OrderDocumentStatus,
  type OrderEvent,
} from "@/lib/exporter-orders";
import {
  completeProduction,
  confirmOrder,
  setCargoReadyDate,
  startProduction,
  updateDocument,
  updatePayment,
  updateProduction,
  useExporterOrders,
} from "@/lib/exporter-order-store";
import { useExporterDeals } from "@/lib/exporter-deal-store";
import { useIsClient } from "@/lib/exporter-quotation-store";
import { DocumentStatusPill, OrderStatusPill, ProgressBar } from "./order-ui";

const primary = `inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange px-4 text-sm font-semibold text-on-brand shadow-sm shadow-orange/20 transition hover:brightness-95 disabled:opacity-50 ${focusRing}`;
const secondary = `inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition-colors hover:border-teal hover:bg-teal-soft disabled:opacity-50 ${focusRing}`;

const EDITABLE_DOC_STATUSES: OrderDocumentStatus[] = ["not-started", "preparing", "ready", "verified", "blocked", "not-required"];

function Card({ id, title, children, aside }: { id?: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function eventText(e: OrderEvent, o: ExporterOrder): string {
  switch (e.type) {
    case "created":
      return `Order created from ${o.dealId}`;
    case "supplier-confirmed":
      return "You confirmed the order";
    case "production-started":
      return `Production started${e.plannedStart ? ` (planned ${formatDate(e.plannedStart)})` : ""}`;
    case "production-updated":
      return `Production updated to ${e.producedQuantity?.toLocaleString("en-US")} ${o.terms.quantity.unit} (${Math.round(((e.producedQuantity ?? 0) / o.terms.quantity.amount) * 100)}%)`;
    case "cargo-ready-date-set":
      return `Expected cargo-ready date set: ${e.expectedCargoReady ? formatDate(e.expectedCargoReady) : "—"}`;
    case "production-completed":
      return `Production completed — cargo ready ${e.actualCargoReady ? formatDate(e.actualCargoReady) : ""}`;
    case "payment-updated":
      return `Payment status: ${PAYMENT_STEPS[o.terms.paymentTerm].find((p) => p.id === e.paymentStep)?.label ?? e.paymentStep}`;
    case "document-updated": {
      const d = o.documents.find((x) => x.id === e.document?.id);
      return `${d?.label ?? "Document"} → ${e.document ? DOCUMENT_STATUS_LABEL[e.document.status] : ""}`;
    }
    case "shipment-created":
      return `Shipment ${e.shipment?.id} created`;
    default:
      return e.type.replace(/-/g, " ");
  }
}

/** One order: locked terms, where execution stands, and what's next. */
export function OrderDetail({ order: o }: { order: ExporterOrder }) {
  const deals = useExporterDeals();
  const deal = deals.find((d) => d.id === o.dealId) ?? findSeededDeal(o.dealId);
  const opp = findOpportunity(o.requirementId);
  const s = orderState(o);
  const readiness = preShipmentReadiness(o, s);
  const score = readinessScore(o, s);
  const actions = actionsRequired(o, s);
  const t = o.terms;
  const unit = t.quantity.unit;
  const paymentSteps = PAYMENT_STEPS[t.paymentTerm];
  const paymentIndex = paymentSteps.findIndex((p) => p.id === s.paymentStep.id);
  const stageIndex = EXECUTION_STAGES.indexOf(s.stage as (typeof EXECUTION_STAGES)[number]);
  const live = s.status !== "cancelled" && s.status !== "completed";

  const [confirming, setConfirming] = useState(false);
  const [plannedStart, setPlannedStart] = useState(DEMO_TODAY);
  const [produced, setProduced] = useState(String(s.production.produced));
  const [prodNote, setProdNote] = useState("");
  const [cargoDate, setCargoDate] = useState(s.production.expectedCargoReady ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = (ok: boolean, success: string, failure: string) => {
    setError(ok ? null : failure);
    setNotice(ok ? success : null);
  };

  const headerAction = !live ? null : !s.confirmed ? (
    <button type="button" onClick={() => setConfirming(true)} className={primary}><Check className="size-4" aria-hidden />Confirm Order</button>
  ) : s.production.status === "not-started" ? (
    <a href="#production" className={primary}><Factory className="size-4" aria-hidden />Start Production</a>
  ) : s.production.status === "in-progress" ? (
    <a href="#production" className={primary}><Factory className="size-4" aria-hidden />Update Production</a>
  ) : (
    <button type="button" disabled title="Shipments are the next feature" className={`${primary} cursor-not-allowed bg-orange/40`}><Ship className="size-4" aria-hidden />Create Shipment · coming next</button>
  );

  const chain = [
    { label: "RFQ", id: o.requirementId, href: exporterHref(`opportunities/${o.requirementId}`) },
    { label: "Opportunity", id: o.opportunityId, href: exporterHref(`opportunities/${o.requirementId}`) },
    { label: "Quotation", id: o.quotationId, href: exporterHref(`quotations/${o.quotationId}`) },
    ...(o.negotiationId ? [{ label: "Negotiation", id: o.negotiationId, href: exporterHref(`negotiations/${o.negotiationId}`) }] : []),
    { label: "Deal", id: o.dealId, href: exporterHref(`deals/${o.dealId}`) },
    { label: "Order", id: o.id },
  ];

  const terms: [string, React.ReactNode][] = [
    ["Product", <>{t.productName}<span className="block text-xs text-ink-muted">{t.specification}</span></>],
    ["Quantity", qtyText(t)],
    ["Unit Price", unitPriceText(t)],
    ["Total", <span key="v" className="font-bold">{valueText(t)}</span>],
    ["Incoterm", t.incoterm],
    ["Named Place", t.namedPlace],
    ["Payment", t.paymentSummary || PAYMENT_TERM_LABEL[t.paymentTerm]],
    ["Packaging", t.packaging ?? "—"],
    ["Delivery", t.estimatedDelivery ? formatDate(t.estimatedDelivery) : `${t.leadTimeDays}-day lead time`],
    ["Freight", COST_COVERAGE_LABEL[t.costCoverage.freight]],
    ["Insurance", COST_COVERAGE_LABEL[t.costCoverage.insurance]],
  ];

  return (
    <div className="space-y-6">
      <Link href={exporterHref("orders")} className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to Orders
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-ink">{o.id}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">{t.productName}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {qtyText(t)} · {opp ? opp.delivery.destinationLocation : t.namedPlace} · Delivery {t.estimatedDelivery ? formatDate(t.estimatedDelivery) : "—"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <OrderStatusPill status={s.status} />
              <span className="text-xs text-ink-muted">Stage: <span className="font-semibold text-ink">{s.stage}</span></span>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <p className="text-3xl font-bold tracking-tight tabular-nums text-ink">{valueText(t)}</p>
            <div className="w-full min-w-48 lg:w-56">
              <p className="mb-1 flex justify-between text-xs text-ink-muted"><span>Pre-shipment readiness</span><span className="font-semibold text-ink">{score}%</span></p>
              <ProgressBar value={score} label="Pre-shipment readiness" />
            </div>
            {headerAction}
          </div>
        </div>
      </header>

      {(notice || error) && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${error ? "bg-orange-soft text-ink" : "bg-teal-soft text-ink"}`}>{error ?? notice}</p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card
            title="Agreed Order Terms"
            aside={
              <Link href={exporterHref(`deals/${o.dealId}`)} className={`inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-ink-muted ring-1 ring-inset ring-line hover:text-ink ${focusRing}`}>
                <Lock className="size-3" aria-hidden />
                Locked from Deal {o.dealId} · View Deal
              </Link>
            }
          >
            <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
              {terms.map(([label, value]) => (
                <div key={label} className={`bg-surface px-4 py-2.5 ${label === "Product" ? "sm:col-span-2" : ""}`}>
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-faint">{label}</dt>
                  <dd className="mt-0.5 text-sm text-ink [overflow-wrap:anywhere]">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Execution Lifecycle">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
              {EXECUTION_STAGES.map((stage, i) => {
                const current = i === stageIndex;
                const done = stageIndex >= 0 && i < stageIndex;
                return (
                  <li key={stage} className="flex items-center gap-2">
                    <span
                      aria-current={current ? "step" : undefined}
                      className={`rounded-lg px-2.5 py-1 font-medium ${current ? "bg-teal text-on-brand" : done ? "bg-teal-soft text-teal" : "bg-canvas text-ink-faint ring-1 ring-inset ring-line"}`}
                    >
                      {done && <Check className="mr-1 inline size-3.5" aria-hidden />}
                      {stage}
                    </span>
                    {i < EXECUTION_STAGES.length - 1 && <span aria-hidden className="text-ink-faint">→</span>}
                  </li>
                );
              })}
            </ol>
            {stageIndex < 0 && <p className="mt-2 text-sm text-orange">Awaiting your confirmation before execution starts.</p>}
          </Card>

          <Card id="production" title="Production" aside={<span className="text-sm font-semibold text-ink">{s.production.status === "not-started" ? "Not Started" : s.production.status === "in-progress" ? "In Progress" : "Completed"}</span>}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-ink-faint">Ordered</dt><dd className="font-semibold tabular-nums text-ink">{s.production.ordered.toLocaleString("en-US")} {unit}</dd></div>
              <div><dt className="text-xs text-ink-faint">Produced</dt><dd className="font-semibold tabular-nums text-ink">{s.production.produced.toLocaleString("en-US")} {unit}</dd></div>
              <div><dt className="text-xs text-ink-faint">Planned start</dt><dd className="text-ink">{s.production.plannedStart ? formatDate(s.production.plannedStart) : "—"}</dd></div>
              <div><dt className="text-xs text-ink-faint">Actual start</dt><dd className="text-ink">{s.production.actualStart ? formatDate(s.production.actualStart) : "—"}</dd></div>
              <div><dt className="text-xs text-ink-faint">Expected cargo ready</dt><dd className="text-ink">{s.production.expectedCargoReady ? formatDate(s.production.expectedCargoReady) : "—"}</dd></div>
              <div><dt className="text-xs text-ink-faint">Actual cargo ready</dt><dd className="text-ink">{s.production.actualCargoReady ? formatDate(s.production.actualCargoReady) : "—"}</dd></div>
              <div className="col-span-2">
                <dt className="mb-1 flex justify-between text-xs text-ink-faint"><span>Progress</span><span className="font-semibold text-ink">{s.production.progress}%</span></dt>
                <dd><ProgressBar value={s.production.progress} label="Production progress" /></dd>
              </div>
            </dl>
            {s.production.notes.length > 0 && <p className="mt-3 text-sm text-ink-muted">Notes: {s.production.notes.join(" · ")}</p>}

            {live && s.confirmed && s.production.status === "not-started" && (
              <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-4">
                <label className="text-sm text-ink">
                  Planned start
                  <input type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} className={`${input} mt-1.5 w-44`} />
                </label>
                <button type="button" onClick={() => run(startProduction(o.id, plannedStart || undefined), "Production started.", "Production couldn't be started.")} className={primary}>
                  Start Production
                </button>
              </div>
            )}
            {live && s.production.status === "in-progress" && (
              <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="produced" className="text-sm font-medium text-ink">Produced quantity ({unit})</label>
                  <input id="produced" inputMode="decimal" value={produced} onChange={(e) => setProduced(e.target.value)} className={input} />
                  <input aria-label="Production note" placeholder="Note (optional)" value={prodNote} onChange={(e) => setProdNote(e.target.value)} className={input} />
                  <button
                    type="button"
                    onClick={() => {
                      const q = Number(produced);
                      if (!(q >= 0)) return run(false, "", "Enter a quantity.");
                      if (q > s.production.ordered) return run(false, "", `Can't exceed the ordered ${s.production.ordered} ${unit}.`);
                      if (q < s.production.produced) return run(false, "", `Can't go below the ${s.production.produced} ${unit} already recorded.`);
                      run(updateProduction(o.id, q, prodNote.trim() || undefined), "Production updated.", "Nothing to update.");
                      setProdNote("");
                    }}
                    className={secondary}
                  >
                    Update Production
                  </button>
                </div>
                <div className="space-y-2">
                  <label htmlFor="cargo" className="text-sm font-medium text-ink">Expected cargo-ready date</label>
                  <input id="cargo" type="date" value={cargoDate} onChange={(e) => setCargoDate(e.target.value)} className={input} />
                  <button type="button" disabled={!cargoDate} onClick={() => run(setCargoReadyDate(o.id, cargoDate), "Cargo-ready date set.", "Date couldn't be set.")} className={secondary}>
                    Set Cargo-Ready Date
                  </button>
                  <button
                    type="button"
                    disabled={s.production.produced < s.production.ordered}
                    title={s.production.produced < s.production.ordered ? "Record the full ordered quantity first" : undefined}
                    onClick={() => run(completeProduction(o.id, DEMO_TODAY), "Production complete — cargo ready.", "Production can't be completed yet.")}
                    className={`${primary} w-full`}
                  >
                    Mark Production Complete
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Document Requirements" aside={<span className="text-xs text-ink-faint">Shipment documents only — company credentials live in Company Profile</span>}>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {s.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="min-w-0 text-sm">
                    <span className="font-medium text-ink">{d.label}</span>
                    <span className="block text-xs text-ink-faint">{d.phase === "shipment-stage" ? "Issued at shipment" : d.commitment ? `Deal: ${COMMITMENT_LABEL[d.commitment]}` : "Pre-shipment"}</span>
                  </span>
                  {d.phase === "shipment-stage" || !live ? (
                    <DocumentStatusPill status={d.status} label={d.phase === "shipment-stage" ? "At shipment" : undefined} />
                  ) : (
                    <select
                      aria-label={`${d.label} status`}
                      value={d.status}
                      onChange={(e) => run(updateDocument(o.id, d.id, e.target.value as OrderDocumentStatus), `${d.label}: ${DOCUMENT_STATUS_LABEL[e.target.value as OrderDocumentStatus]}.`, "Status unchanged.")}
                      className={`${input} h-9 w-auto`}
                    >
                      {EDITABLE_DOC_STATUSES.map((st) => (
                        <option key={st} value={st}>{DOCUMENT_STATUS_LABEL[st]}</option>
                      ))}
                    </select>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-faint">No files are uploaded here. Shipping bill and BL/AWB are never marked filed from the order.</p>
          </Card>

          <Card title="Compliance Execution">
            <p className="mb-3 text-sm text-ink-muted">Commercial promises from the deal, as operational tasks.</p>
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="grid grid-cols-3 bg-canvas text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
                <span className="px-3 py-2">Requirement</span><span className="px-3 py-2">Deal</span><span className="px-3 py-2">Order</span>
              </div>
              <ul className="divide-y divide-line text-sm">
                {s.documents.filter((d) => d.commitment).map((d) => (
                  <li key={d.id} className="grid grid-cols-3">
                    <span className="px-3 py-2.5 font-medium text-ink">{d.label.replace(/ Certificate$/, "")}</span>
                    <span className="px-3 py-2.5 text-ink-muted">{COMMITMENT_LABEL[d.commitment!]}</span>
                    <span className={`px-3 py-2.5 ${d.status === "ready" || d.status === "verified" ? "text-teal" : "font-medium text-orange"}`}>{complianceStatusText(d)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card title="Shipment Readiness">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-ink-faint">Agreed delivery</dt><dd className="text-ink">{t.estimatedDelivery ? formatDate(t.estimatedDelivery) : "—"}</dd></div>
              <div><dt className="text-xs text-ink-faint">Cargo ready</dt><dd className="text-ink">{s.production.actualCargoReady ? formatDate(s.production.actualCargoReady) : s.production.expectedCargoReady ? `${formatDate(s.production.expectedCargoReady)} (expected)` : "—"}</dd></div>
              <div><dt className="text-xs text-ink-faint">Port of loading</dt><dd className="text-ink">{t.portOfLoading ?? "—"}</dd></div>
              <div><dt className="text-xs text-ink-faint">Incoterm</dt><dd className="text-ink">{t.incoterm} {t.namedPlace}</dd></div>
              <div><dt className="text-xs text-ink-faint">Destination</dt><dd className="text-ink">{opp?.delivery.destinationLocation ?? t.namedPlace}</dd></div>
              <div><dt className="text-xs text-ink-faint">Allocated to shipments</dt><dd className="tabular-nums text-ink">{s.shipments.reduce((n, x) => n + x.quantity, 0).toLocaleString("en-US")} of {s.production.ordered.toLocaleString("en-US")} {unit}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
              <p className="text-sm text-ink-muted">{s.shipments.length ? `${s.shipments.length} shipment(s)` : "No shipments created"} — an order can be split across several shipments.</p>
              <button type="button" disabled title="Shipments are the next feature" className={`${secondary} cursor-not-allowed`}>
                <Ship className="size-4" aria-hidden />
                Create Shipment · coming next
              </button>
            </div>
          </Card>

          <Card title="Source Traceability">
            <ol className="flex flex-col items-start gap-1">
              {chain.map((c, i) => (
                <li key={c.label} className="flex flex-col items-start">
                  <span className="flex items-baseline gap-2">
                    <span className="w-24 text-xs text-ink-faint">{c.label}</span>
                    {c.href ? <Link href={c.href} className={`font-mono text-sm text-teal hover:text-ink ${focusRing}`}>{c.id}</Link> : <span className="font-mono text-sm font-semibold text-ink">{c.id}</span>}
                  </span>
                  {i < chain.length - 1 && <ArrowDown className="ml-26 size-3.5 text-ink-faint" aria-hidden />}
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Activity History">
            <ol className="relative space-y-3 pl-5 before:absolute before:inset-y-1 before:left-[0.3125rem] before:w-px before:bg-line">
              {deal && (
                <li className="relative text-sm">
                  <span aria-hidden className="absolute -left-5 top-1.5 size-2.5 rounded-full bg-teal" />
                  <span className="text-ink">Deal {deal.id} created</span>
                  <span className="block text-xs text-ink-faint">{formatDateTime(deal.createdAt)}</span>
                </li>
              )}
              {o.events.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span aria-hidden className="absolute -left-5 top-1.5 size-2.5 rounded-full bg-teal" />
                  <span className="text-ink">{eventText(e, o)}</span>
                  {e.note && <span className="ml-1 text-ink-muted">— {e.note}</span>}
                  <span className="block text-xs text-ink-faint">{formatDateTime(e.at)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Pre-Shipment Readiness" aside={<span className="text-lg font-bold tabular-nums text-teal">{score}%</span>}>
            <p className="-mt-2 mb-3 text-xs text-ink-faint">How ready this Order is to move into shipment execution — not match, quotation or deal readiness.</p>
            <ul className="space-y-2">
              {readiness.map((r) => (
                <li key={r.key} className="flex items-start gap-2 text-sm">
                  {r.done ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-label="Done" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-label="Pending" />}
                  <span>
                    <span className={r.done ? "text-ink-muted" : "font-medium text-ink"}>{r.label}</span>
                    {r.detail && <span className="block text-xs text-ink-muted">{r.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Action Required">
            {actions.length ? (
              <ul className="space-y-1.5">
                {actions.map((a) => (
                  <li key={a} className="flex items-start gap-2 text-sm text-ink">
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden />
                    {a}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-teal">Nothing outstanding.</p>
            )}
          </Card>

          <Card title="Payment Readiness">
            <p className="text-sm font-semibold text-ink">{t.paymentSummary || PAYMENT_TERM_LABEL[t.paymentTerm]}</p>
            <ol className="mt-3 space-y-1.5">
              {paymentSteps.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  {i <= paymentIndex ? <CircleCheck className="size-4 text-teal" aria-hidden /> : <span aria-hidden className="size-4 rounded-full border-2 border-line" />}
                  <span className={i === paymentIndex ? "font-semibold text-ink" : i < paymentIndex ? "text-ink-muted" : "text-ink-faint"}>{p.label}</span>
                </li>
              ))}
            </ol>
            {live && paymentIndex < paymentSteps.length - 1 && (
              <button type="button" onClick={() => run(updatePayment(o.id, paymentSteps[paymentIndex + 1].id), `Payment: ${paymentSteps[paymentIndex + 1].label}.`, "Payment unchanged.")} className={`${secondary} mt-3 w-full`}>
                Mark “{paymentSteps[paymentIndex + 1].label}”
              </button>
            )}
            <p className="mt-2 text-xs text-ink-faint">Operational status only — no banking integration or real payments.</p>
          </Card>

          <aside aria-label="SUMIT insight" className="rounded-2xl border border-teal/15 bg-teal-soft p-5">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal">
              <Sparkles className="size-3.5 text-orange" aria-hidden />
              SUMIT insight
            </p>
            <ul className="mt-2 space-y-2">
              {orderInsights(o, s).map((x) => (
                <li key={x} className="text-sm leading-relaxed text-ink">{x}</li>
              ))}
            </ul>
          </aside>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
              <ShieldCheck className="size-4 text-teal" aria-hidden />
              Buyer &amp; Purchase Order
            </h2>
            <p className="mt-2 text-sm font-medium text-ink">Buyer identity protected by Ximverse</p>
            <dl className="mt-3 space-y-1 text-sm">
              {opp && <div className="flex justify-between gap-3"><dt className="text-ink-muted">Buyer market</dt><dd className="text-right text-ink">{opp.buyer.region} · {shortCountry(opp.buyer.country)}</dd></div>}
              {opp?.buyer.industry && <div className="flex justify-between gap-3"><dt className="text-ink-muted">Industry</dt><dd className="text-right text-ink">{opp.buyer.industry}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">PO number</dt><dd className="font-mono text-ink">{o.purchaseOrder.number ?? "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">PO issued</dt><dd className="text-ink">{o.purchaseOrder.issueDate ? formatDate(o.purchaseOrder.issueDate) : "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">PO status</dt><dd className="text-ink">{{ "not-received": "Not yet received", received: "Received via Ximverse", acknowledged: "Acknowledged" }[o.purchaseOrder.status]}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-ink-faint">Billing, delivery addresses and buyer contacts stay with Ximverse while access is {deal?.counterpartyAccess === "approved" || deal?.counterpartyAccess === "shared" ? "granted" : "protected"}.</p>
          </section>
        </div>
      </div>

      <Modal open={confirming} onClose={() => setConfirming(false)} labelledBy="confirm-order-title">
        <header className="border-b border-line px-5 py-4 sm:px-6">
          <h2 id="confirm-order-title" className="text-lg font-bold tracking-tight text-ink">Confirm Order</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Confirm you will execute these locked terms. Nothing here can be edited.</p>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <dl className="divide-y divide-line rounded-xl border border-line">
            {([
              ["Product", t.productName],
              ["Quantity", qtyText(t)],
              ["Value", valueText(t)],
              ["Incoterm", `${t.incoterm} ${t.namedPlace}`],
              ["Payment", t.paymentSummary],
              ["Delivery", t.estimatedDelivery ? formatDate(t.estimatedDelivery) : "—"],
            ] as [string, string][]).map(([l, v]) => (
              <div key={l} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <dt className="text-ink-muted">{l}</dt>
                <dd className="text-right font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
          <button type="button" onClick={() => setConfirming(false)} className={`h-10 rounded-lg px-4 text-sm font-semibold text-ink-muted hover:bg-canvas hover:text-ink ${focusRing}`}>Cancel</button>
          <button
            type="button"
            onClick={() => {
              run(confirmOrder(o.id), "Order confirmed.", "Order already confirmed.");
              setConfirming(false);
            }}
            className={primary}
          >
            Confirm Order
          </button>
        </footer>
      </Modal>
    </div>
  );
}

/** Resolves an order (seeded or created in this browser). */
export function OrderById({ id }: { id: string }) {
  const isClient = useIsClient();
  const order = useExporterOrders().find((o) => o.id === id);
  if (order) return <OrderDetail order={order} />;
  if (!isClient) return <p className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-sm text-ink-muted">Loading order…</p>;
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
      <p className="font-semibold text-ink">Order {id} isn&apos;t stored in this browser</p>
      <p className="mt-1 text-sm text-ink-muted">Demo orders live in the browser where they were created.</p>
      <Link href={exporterHref("orders")} className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to Orders
      </Link>
    </div>
  );
}
