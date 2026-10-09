"use client";

import Link from "next/link";
import { ArrowDown, ArrowLeft, CircleAlert, CircleCheck, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDate } from "@/lib/exporter-dashboard";
import { findOpportunity, formatDateTime, PAYMENT_TERM_LABEL, shortCountry } from "@/lib/exporter-opportunities";
import { COST_COVERAGE_LABEL, formatMoney, type ExporterQuotation } from "@/lib/exporter-quotations";
import { SEEDED_QUOTATIONS } from "@/lib/exporter-quotation-history";
import { useIsClient, useStoredQuotations } from "@/lib/exporter-quotation-store";
import {
  COUNTERPARTY_ACCESS_LABEL,
  dealInsights,
  dealMilestones,
  dealReadiness,
  dealStatus,
  dealValueMinor,
  type ExporterDeal,
} from "@/lib/exporter-deals";
import { confirmDeal, useExporterDeals } from "@/lib/exporter-deal-store";
import { useExporterOrders } from "@/lib/exporter-order-store";
import { orderForDeal } from "@/lib/exporter-orders";
import { CreateOrderAction } from "@/components/exporter/orders/create-order";
import { COMMITMENT_LABEL, DealStatusPill, qtyText, SourceBadge, unitPriceText, valueText } from "./deal-ui";

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const linkCls = `font-mono text-sm text-teal hover:text-ink ${focusRing}`;

/** What was agreed, where it came from, and what's left before execution. */
export function DealDetail({ d }: { d: ExporterDeal }) {
  const local = useStoredQuotations();
  const o = findOpportunity(d.requirementId);
  const q: ExporterQuotation | undefined = SEEDED_QUOTATIONS.find((x) => x.id === d.quotationId) ?? local.find((x) => x.id === d.quotationId);
  const t = d.terms;
  const status = dealStatus(d);
  const orderId = orderForDeal(d.id, useExporterOrders())?.id;
  const milestones = dealMilestones(d, orderId);
  const readiness = dealReadiness(d, orderId);

  // Original vs final: informational, only when directly comparable.
  const comparable = q && q.price.currency === t.currency && q.price.pricingUnit === t.quantity.unit;
  const origMinor = q ? Math.round(q.price.unitPrice * 100) : 0;
  const finalMinor = Math.round(t.unitPrice * 100);
  const delta = finalMinor - origMinor;

  const terms: [string, React.ReactNode][] = [
    ["Product", <>{t.productName}<span className="block text-xs text-ink-muted">{t.specification}</span></>],
    ["HS Code", <span key="hs" className="font-mono">{t.hsCode ?? "—"}</span>],
    ["Quantity", qtyText(t)],
    ["Unit Price", unitPriceText(t)],
    ["Total Value", <span key="v" className="font-bold">{valueText(t)}</span>],
    ["Incoterm", t.incoterm],
    ["Named Place", t.namedPlace],
    ["Port of Loading", t.portOfLoading ?? "—"],
    ["Freight", COST_COVERAGE_LABEL[t.costCoverage.freight]],
    ["Insurance", COST_COVERAGE_LABEL[t.costCoverage.insurance]],
    ["Payment Terms", t.paymentSummary || PAYMENT_TERM_LABEL[t.paymentTerm]],
    ["Packaging", t.packaging ?? "—"],
    ["Lead Time", `${t.leadTimeDays} days`],
    ["Earliest Dispatch", t.earliestDispatch ? formatDate(t.earliestDispatch) : "—"],
    ["Delivery", <>{t.estimatedDelivery ? formatDate(t.estimatedDelivery) : "—"}{t.requiredBy && <span className="block text-xs text-ink-muted">RFQ required by {formatDate(t.requiredBy)}</span>}</>],
  ];

  const chain = [
    { label: "RFQ", id: d.requirementId, href: exporterHref(`opportunities/${d.requirementId}`) },
    { label: "Opportunity", id: d.opportunityId, href: exporterHref(`opportunities/${d.requirementId}`) },
    { label: "Quotation", id: d.quotationId, href: exporterHref(`quotations/${d.quotationId}`) },
    ...(d.negotiationId ? [{ label: "Negotiation", id: d.negotiationId, href: exporterHref(`negotiations/${d.negotiationId}`) }] : []),
    { label: "Deal", id: d.id },
  ];

  return (
    <div className="space-y-6">
      <Link href={exporterHref("deals")} className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to Deals
      </Link>

      <header className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-ink">{d.id}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">{t.productName}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {qtyText(t)} · {t.incoterm} {t.namedPlace}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <DealStatusPill status={status} />
            <SourceBadge source={d.source} />
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <p className="text-3xl font-bold tracking-tight tabular-nums text-ink">{valueText(t)}</p>
          <div className="flex flex-wrap items-center gap-2">
            {status === "pending-setup" && (
              <button type="button" onClick={() => confirmDeal(d.id)} className={`inline-flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink hover:border-teal hover:bg-teal-soft ${focusRing}`}>
                <CircleCheck className="size-4" aria-hidden />
                Confirm Deal Terms
              </button>
            )}
            <CreateOrderAction deal={d} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card
            title="Agreed Commercial Terms"
            aside={
              <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-ink-muted ring-1 ring-inset ring-line">
                <Lock className="size-3" aria-hidden />
                Locked agreement
              </span>
            }
          >
            <p className="mb-3 text-sm text-ink-muted">These terms reflect the accepted commercial agreement, agreed {formatDateTime(t.agreedAt)}.</p>
            <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
              {terms.map(([label, value]) => (
                <div key={label} className={`bg-surface px-4 py-2.5 ${label === "Product" ? "sm:col-span-2" : ""}`}>
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-faint">{label}</dt>
                  <dd className="mt-0.5 text-sm text-ink [overflow-wrap:anywhere]">{value}</dd>
                </div>
              ))}
            </dl>
            {t.commercialNote && <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">Note on the accepted terms: “{t.commercialNote}”</p>}
          </Card>

          <Card title="Compliance Commitments">
            <ul className="divide-y divide-line rounded-xl border border-line">
              {t.complianceCommitments.map((c) => (
                <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="font-medium text-ink">{c.name}</span>
                  <span className={c.commitment === "committed" ? "text-teal" : "font-semibold text-orange"}>{COMMITMENT_LABEL[c.commitment]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-faint">Document completion is tracked later in the order workflow.</p>
          </Card>

          <Card title="Agreement Source">
            <ol className="flex flex-col items-start gap-1">
              {chain.map((s, i) => (
                <li key={s.label} className="flex flex-col items-start">
                  <span className="flex items-baseline gap-2">
                    <span className="w-24 text-xs text-ink-faint">{s.label}</span>
                    {s.href ? <Link href={s.href} className={linkCls}>{s.id}</Link> : <span className="font-mono text-sm font-semibold text-ink">{s.id}</span>}
                  </span>
                  {i < chain.length - 1 && <ArrowDown className="ml-26 size-3.5 text-ink-faint" aria-hidden />}
                </li>
              ))}
            </ol>
          </Card>

          {d.source === "negotiated-agreement" && q && (
            <Card title="Original Quote vs Final Agreement">
              {comparable ? (
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-ink-faint">Original quote</dt><dd className="font-semibold tabular-nums text-ink">{formatMoney(origMinor, t.currency)} / {t.quantity.unit}</dd></div>
                  <div><dt className="text-xs text-ink-faint">Final agreement</dt><dd className="font-semibold tabular-nums text-ink">{unitPriceText(t)}</dd></div>
                  <div>
                    <dt className="text-xs text-ink-faint">Difference</dt>
                    <dd className="font-semibold tabular-nums text-ink">
                      {delta === 0 ? "None" : `${delta > 0 ? "+" : "−"}${formatMoney(Math.abs(delta), t.currency)} / ${t.quantity.unit}`}
                      {delta !== 0 && origMinor > 0 && <span className="block text-xs font-normal text-ink-muted">{((delta / origMinor) * 100).toFixed(2)}%</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-faint">Value</dt>
                    <dd className="tabular-nums text-ink">
                      <span className="text-ink-muted line-through">{formatMoney(Math.round(origMinor * q.product.quantity.amount), t.currency)}</span>{" "}
                      <span className="font-semibold">{formatMoney(dealValueMinor(t), t.currency)}</span>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-ink-muted">Not directly comparable (currency or unit differs).</p>
              )}
              <p className="mt-2 text-xs text-ink-faint">Informational. The quotation itself still shows the original submitted price.</p>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Deal Readiness" aside={<span className="text-lg font-bold tabular-nums text-teal">{readiness}%</span>}>
            <p className="-mt-2 mb-3 text-xs text-ink-faint">How ready this agreed deal is to enter execution — not the match or quotation readiness.</p>
            <ul className="space-y-2">
              {milestones.map((m) => (
                <li key={m.key} className="flex items-start gap-2 text-sm">
                  {m.done ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-label="Done" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-label="Pending" />}
                  <span>
                    <span className={m.done ? "text-ink-muted" : "font-medium text-ink"}>{m.label}</span>
                    {m.detail && <span className="block text-xs text-ink-muted">{m.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Payment Setup">
            <p className="text-sm font-semibold text-ink">{t.paymentSummary || PAYMENT_TERM_LABEL[t.paymentTerm]}</p>
            <p className="mt-1 text-sm text-orange">Payment setup pending — awaiting buyer instrument.</p>
            <p className="mt-2 text-xs text-ink-faint">Payment workflow arrives with Orders / Finance.</p>
          </Card>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
              <ShieldCheck className="size-4 text-teal" aria-hidden />
              Counterparty Access
            </h2>
            <p className="mt-2 text-sm font-medium text-ink">Buyer identity protected by Ximverse</p>
            <p className="mt-1 text-xs text-ink-muted">Status: {COUNTERPARTY_ACCESS_LABEL[d.counterpartyAccess]}</p>
            {o && (
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Country</dt><dd className="text-ink">{shortCountry(o.buyer.country)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Region</dt><dd className="text-ink">{o.buyer.region}</dd></div>
                {o.buyer.industry && <div className="flex justify-between gap-3"><dt className="text-ink-muted">Industry</dt><dd className="text-right text-ink">{o.buyer.industry}</dd></div>}
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Destination</dt><dd className="text-right text-ink">{o.delivery.destinationLocation}</dd></div>
              </dl>
            )}
            <p className="mt-3 text-xs text-ink-faint">
              Identity and direct contact are shared only when permitted by the transaction workflow and Ximverse verification policy.
            </p>
          </section>

          <aside aria-label="SUMIT insight" className="rounded-2xl border border-teal/15 bg-teal-soft p-5">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal">
              <Sparkles className="size-3.5 text-orange" aria-hidden />
              SUMIT insight
            </p>
            <ul className="mt-2 space-y-2">
              {dealInsights(d).map((x) => (
                <li key={x} className="text-sm leading-relaxed text-ink">{x}</li>
              ))}
            </ul>
          </aside>

          <section className="rounded-2xl border border-line bg-surface p-5 text-sm">
            <h2 className="text-base font-semibold tracking-tight text-ink">History</h2>
            <ul className="mt-3 space-y-1.5">
              {d.events.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span className="text-ink-muted">{e.type === "created" ? "Deal created" : e.type === "exporter-confirmed" ? "You confirmed the terms" : e.type}</span>
                  <span className="text-right text-xs text-ink">{formatDateTime(e.at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Resolves a deal (seeded or created in this browser) and renders it. */
export function DealById({ id }: { id: string }) {
  const isClient = useIsClient();
  const deal = useExporterDeals().find((d) => d.id === id);
  if (deal) return <DealDetail d={deal} />;
  if (!isClient) return <p className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-sm text-ink-muted">Loading deal…</p>;
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
      <p className="font-semibold text-ink">Deal {id} isn&apos;t stored in this browser</p>
      <p className="mt-1 text-sm text-ink-muted">Demo deals live in the browser where they were created.</p>
      <Link href={exporterHref("deals")} className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to Deals
      </Link>
    </div>
  );
}
