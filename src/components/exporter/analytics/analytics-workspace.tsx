"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Info, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { focusRing } from "@/components/workspace/styles";
import { useDocumentIndex } from "@/components/exporter/documents/document-ui";
import { useExporterNegotiations } from "@/lib/exporter-negotiation-store";
import { useStoredDrafts, useStoredQuotations } from "@/lib/exporter-quotation-store";
import { buildPipeline } from "@/lib/exporter-quotation-pipeline";
import { formatMoney, QUOTATION_STATUS_LABEL, type ExporterQuotationStatus } from "@/lib/exporter-quotations";
import { NEGOTIATION_STATUS_LABEL, type ExporterNegotiationStatus } from "@/lib/exporter-negotiations";
import { DEAL_STATUS_LABEL, type DealStatus } from "@/lib/exporter-deals";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/exporter-orders";
import { SHIPMENT_STATUS_LABEL, type ShipmentStatus } from "@/lib/exporter-shipments";
import { analyticsInsights, buildAnalytics, formatHours, RANGE_LABEL, type ByCurrency, type Duration, type GroupRow, type RangeKey, type Rate } from "@/lib/exporter-analytics";
import type { Currency } from "@/lib/import-requirements";

/** Live analytics: recomputed from every canonical store on each change. Nothing is persisted. */
function useAnalytics(range: RangeKey) {
  const { index, src } = useDocumentIndex();
  const negotiations = useExporterNegotiations();
  const quotations = useStoredQuotations();
  const drafts = useStoredDrafts();
  return useMemo(
    () => buildAnalytics({ ...src, negotiations, pipeline: buildPipeline(quotations, drafts, negotiations), documents: index }, range),
    [src, index, negotiations, quotations, drafts, range],
  );
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function Section({ id, title, children, aside, note }: { id: string; title: string; children: React.ReactNode; aside?: React.ReactNode; note?: string }) {
  return (
    <section aria-labelledby={`${id}-h`} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-h`} className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {aside}
      </div>
      {note && <p className="mt-1 text-xs text-ink-faint">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const pct = (r: Rate) => (r.percent === undefined ? "—" : `${r.percent}%`);
const basis = (r: Rate, noun: string) => (r.percent === undefined ? `Insufficient ${noun}` : `${r.num} of ${r.den}`);

function Money({ v, empty = "—" }: { v: ByCurrency; empty?: string }) {
  const entries = Object.entries(v) as [Currency, number][];
  if (!entries.length) return <span className="text-ink-faint">{empty}</span>;
  return (
    <span className="flex flex-col">
      {entries.map(([c, minor]) => (
        <span key={c} className="tabular-nums" data-currency={c}>{formatMoney(minor, c)}</span>
      ))}
    </span>
  );
}

function Dur({ d, label }: { d: Duration; label: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line py-2 text-sm last:border-0">
      <span className="text-ink">{label}</span>
      {d.sample ? (
        <span className="text-right">
          <span className="font-semibold tabular-nums text-ink">{formatHours(d.avgHours)}</span>
          <span className="ml-1.5 text-xs text-ink-muted">avg{d.medianHours !== undefined ? ` · median ${formatHours(d.medianHours)}` : ""} · {d.sample} record{d.sample === 1 ? "" : "s"}</span>
        </span>
      ) : (
        <span className="text-xs text-ink-faint">Insufficient data</span>
      )}
    </div>
  );
}

function Counts<T extends string>({ counts, labels, href }: { counts: Partial<Record<T, number>>; labels: Record<T, string>; href: string }) {
  const max = Math.max(1, ...(Object.values(counts) as number[]));
  const entries = (Object.keys(labels) as T[]).filter((k) => counts[k]);
  if (!entries.length) return <p className="text-sm text-ink-faint">No records in this range.</p>;
  return (
    <ul className="space-y-1.5">
      {entries.map((k) => (
        <li key={k}>
          <Link href={href} className={`grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 rounded text-sm hover:text-teal ${focusRing}`}>
            <span className="truncate text-ink">{labels[k]}</span>
            <span aria-hidden className="h-2 rounded-full bg-teal-soft"><span className="block h-2 rounded-full bg-teal" style={{ width: `${((counts[k] ?? 0) / max) * 100}%` }} /></span>
            <span className="w-6 text-right font-semibold tabular-nums text-ink">{counts[k]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Kpi({ label, value, hint, href }: { label: string; value: string; hint?: string; href: string }) {
  return (
    <li>
      <Link href={href} className={`flex h-full flex-col rounded-2xl border border-line bg-surface px-3 py-2.5 hover:border-teal sm:p-4 ${focusRing}`}>
        <span className="text-xs font-medium text-ink-muted sm:text-sm">{label}</span>
        <span className="mt-0.5 text-xl font-bold tabular-nums text-ink sm:text-2xl">{value}</span>
        {hint && <span className="text-[0.6875rem] text-ink-faint">{hint}</span>}
      </Link>
    </li>
  );
}

function GroupTable({ rows, caption }: { rows: readonly GroupRow[]; caption: string }) {
  if (!rows.length) return <p className="text-sm text-ink-faint">No records in this range.</p>;
  const cols: [string, (r: GroupRow) => React.ReactNode][] = [
    ["Opportunities", (r) => r.opportunities],
    ["Quoted", (r) => r.quoted],
    ["Negotiated", (r) => r.negotiated],
    ["Won", (r) => r.won],
    ["Win rate", (r) => <span title={basis(r.winRate, "finalised quotations")}>{pct(r.winRate)}</span>],
    ["Deals", (r) => r.deals],
    ["Deal value", (r) => <Money v={r.dealValue} />],
    ["Active orders", (r) => r.activeOrders],
    ["Delivered", (r) => r.delivered],
  ];
  return (
    <>
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-line text-left text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th scope="col" className="py-2 pr-3 font-semibold">{caption}</th>
              {cols.map(([c]) => <th key={c} scope="col" className="px-2 py-2 text-right font-semibold">{c}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">{r.label}</th>
                {cols.map(([c, f]) => <td key={c} className="px-2 py-2 text-right tabular-nums text-ink">{f(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid grid-cols-1 gap-2 md:hidden">
        {rows.map((r) => (
          <li key={r.key} className="rounded-xl border border-line p-3">
            <p className="font-semibold text-ink">{r.label}</p>
            <dl className="mt-1.5 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
              {cols.map(([c, f]) => (
                <div key={c} className="min-w-0"><dt className="text-ink-faint">{c}</dt><dd className="tabular-nums text-ink">{f(r)}</dd></div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AnalyticsWorkspace() {
  const [range, setRange] = useState<RangeKey>("all");
  const r = useAnalytics(range);
  const currencies = [...new Set(Object.values(r.pipeline).flatMap((v) => Object.keys(v)))] as Currency[];
  const funnelMax = Math.max(1, r.funnel[0]?.count ?? 1);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Analytics"
        description="Understand opportunity conversion, commercial performance and export execution across Ximverse."
        aside={
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            Date range
            <select value={range} onChange={(e) => setRange(e.target.value as RangeKey)} className="h-9 rounded-lg border border-line bg-canvas px-2 text-sm text-ink focus:border-teal focus:outline-none">
              {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => <option key={k} value={k}>{RANGE_LABEL[k]}</option>)}
            </select>
          </label>
        }
      />
      {r.start && <p className="-mt-3 text-xs text-ink-faint">Records from {r.start} onward (demo date 7 Oct 2026). Browser-created records are always included.</p>}

      <ul aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Opportunities" value={String(r.funnel[0].count)} href="/exporter/opportunities" />
        <Kpi label="Quotations Submitted" value={String(r.quotations.total)} href="/exporter/quotations" />
        <Kpi label="Deals" value={String(r.deals.total)} href="/exporter/deals" />
        <Kpi label="Win Rate" value={pct(r.winRate)} hint={basis(r.winRate, "finalised quotes")} href="/exporter/quotations" />
        <Kpi label="Active Orders" value={String(r.orders.active)} href="/exporter/orders" />
        <Kpi label="Active Shipments" value={String(r.shipments.active)} href="/exporter/shipments" />
        <Kpi label="Delivered Shipments" value={String(r.shipments.delivered)} href="/exporter/shipments" />
        <Kpi label="On-Time Delivery" value={pct(r.shipments.onTimeDelivery)} hint={basis(r.shipments.onTimeDelivery, "data")} href="/exporter/shipments" />
      </ul>

      <Section id="funnel" title="Commercial Funnel" note="Each stage counts unique opportunities (RFQs) — nothing is counted twice.">
        <ol className="space-y-1.5">
          {r.funnel.map((s) => (
            <li key={s.key}>
              <Link href={s.href} title={s.definition} className={`grid grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-2 rounded text-sm hover:text-teal sm:grid-cols-[11rem_1fr_6rem] ${focusRing}`}>
                <span className="truncate text-ink">{s.label}</span>
                <span aria-hidden className="h-5 rounded bg-canvas ring-1 ring-inset ring-line"><span className="block h-5 rounded bg-teal/80" style={{ width: `${(s.count / funnelMax) * 100}%` }} /></span>
                <span className="text-right tabular-nums"><span className="font-semibold text-ink">{s.count}</span>{s.key !== "opportunities" && funnelMax > 0 && <span className="ml-1 text-xs text-ink-muted">{Math.round((s.count / funnelMax) * 100)}%</span>}</span>
              </Link>
            </li>
          ))}
        </ol>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-canvas p-3"><dt className="text-xs text-ink-muted">Quote rate</dt><dd className="text-lg font-bold text-ink">{pct(r.quoteRate)} <span className="text-xs font-normal text-ink-muted">{basis(r.quoteRate, "opportunities")} opportunities quoted</span></dd></div>
          <div className="rounded-xl bg-canvas p-3"><dt className="text-xs text-ink-muted">Win rate (finalised quotations)</dt><dd className="text-lg font-bold text-ink">{pct(r.winRate)} <span className="text-xs font-normal text-ink-muted">{r.winRate.percent === undefined ? "Insufficient finalised quotations" : `${r.winRate.num} accepted of ${r.winRate.den} accepted + rejected`}</span></dd></div>
        </dl>
      </Section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section id="quotations" title="Quotation Performance" aside={<Link href="/exporter/quotations" className="text-xs font-semibold text-teal hover:text-ink">My Quotations →</Link>}>
          <Counts counts={r.quotations.byStatus} labels={QUOTATION_STATUS_LABEL as Record<ExporterQuotationStatus, string>} href="/exporter/quotations" />
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-ink-muted">Quoted value (all submitted)</p><Money v={r.quotations.value} /></div>
            <div><p className="text-xs text-ink-muted">Active quotations</p><p className="font-semibold text-ink">{r.quotations.active}</p></div>
          </div>
          <div className="mt-3"><Dur d={r.quotations.timeToQuote} label="Time to quote (shared → submitted)" /></div>
          <p className="mt-1 text-xs text-ink-faint">{r.quotations.timeToQuote.sample} of {r.quotations.total} submitted quotations have both timestamps.</p>
        </Section>

        <Section id="negotiations" title="Negotiation Performance" aside={<Link href="/exporter/negotiations" className="text-xs font-semibold text-teal hover:text-ink">Negotiations →</Link>}>
          <Counts counts={r.negotiations.byStatus} labels={NEGOTIATION_STATUS_LABEL as Record<ExporterNegotiationStatus, string>} href="/exporter/negotiations" />
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-ink-muted">Agreement rate</dt><dd className="font-semibold text-ink" title={basis(r.negotiations.agreementRate, "finalised")}>{pct(r.negotiations.agreementRate)}</dd></div>
            <div><dt className="text-xs text-ink-muted">Avg rounds</dt><dd className="font-semibold text-ink">{r.negotiations.avgRounds ?? "—"}</dd></div>
            <div><dt className="text-xs text-ink-muted">1 round</dt><dd className="font-semibold text-ink">{r.negotiations.rounds.one}</dd></div>
            <div><dt className="text-xs text-ink-muted">2 / 3+ rounds</dt><dd className="font-semibold text-ink">{r.negotiations.rounds.two} / {r.negotiations.rounds.threePlus}</dd></div>
          </dl>
          <h3 className="mt-4 text-sm font-semibold text-ink">Price movement (agreed, comparable)</h3>
          {r.negotiations.priceMoves.length ? (
            <ul className="mt-1.5 divide-y divide-line text-sm">
              {r.negotiations.priceMoves.map((p) => (
                <li key={p.negotiationId} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <Link href={`/exporter/negotiations/${p.negotiationId}`} className="font-mono text-xs text-teal hover:text-ink">{p.negotiationId}</Link>
                  <span className="tabular-nums text-ink">{formatMoney(Math.round(p.original * 100), p.currency)} → {formatMoney(Math.round(p.agreed * 100), p.currency)} / {p.unit} <span className={p.diff < 0 ? "text-orange" : "text-teal"}>({p.diff > 0 ? "+" : ""}{formatMoney(Math.round(p.diff * 100), p.currency)}, {p.percent > 0 ? "+" : ""}{p.percent}%)</span></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-ink-faint">No agreed negotiations in this range.</p>
          )}
          {r.negotiations.incomparable > 0 && <p className="mt-1 text-xs text-ink-faint">{r.negotiations.incomparable} agreement(s) skipped — currency or pricing unit changed.</p>}
        </Section>

        <Section id="deals" title="Deals" aside={<Link href="/exporter/deals" className="text-xs font-semibold text-teal hover:text-ink">Deals →</Link>}>
          <Counts counts={r.deals.byStatus} labels={DEAL_STATUS_LABEL as Record<DealStatus, string>} href="/exporter/deals" />
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-ink-muted">Contract value</dt><dd><Money v={r.deals.value} /></dd></div>
            <div><dt className="text-xs text-ink-muted">Direct acceptance · {r.deals.bySource.direct.count}</dt><dd><Money v={r.deals.bySource.direct.value} /></dd></div>
            <div><dt className="text-xs text-ink-muted">Negotiated agreement · {r.deals.bySource.negotiated.count}</dt><dd><Money v={r.deals.bySource.negotiated.value} /></dd></div>
          </dl>
          <p className="mt-2 text-xs text-ink-faint">A breakdown by source, not a comparison of which performs better.</p>
        </Section>

        <Section id="orders" title="Orders / Execution" aside={<Link href="/exporter/orders" className="text-xs font-semibold text-teal hover:text-ink">Orders →</Link>}>
          <Counts counts={r.orders.byStatus} labels={ORDER_STATUS_LABEL as Record<OrderStatus, string>} href="/exporter/orders" />
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-ink-muted">Needs attention</dt><dd className="font-semibold text-ink">{r.orders.needsAttention}</dd></div>
            <div><dt className="text-xs text-ink-muted">Active order value</dt><dd><Money v={r.orders.value} /></dd></div>
          </dl>
          <div className="mt-3">
            <Dur d={r.orders.cycles.confirm} label="Order created → exporter confirmed" />
            <Dur d={r.orders.cycles.production} label="Production started → completed" />
            <Dur d={r.orders.cycles.firstShipment} label="Order created → first shipment" />
            <Dur d={r.orders.cycles.completed} label="Order created → completed" />
          </div>
        </Section>
      </div>

      <Section id="documents" title="Documents / Customs" aside={<Link href="/exporter/documents" className="text-xs font-semibold text-teal hover:text-ink">Documents →</Link>} note="Read from the Documents Center index — current state, not history.">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div><dt className="text-xs text-ink-muted">Need attention</dt><dd className="text-lg font-bold text-ink">{r.documents.attention}</dd></div>
              <div><dt className="text-xs text-ink-muted">Blocked Shipping Bills</dt><dd className="text-lg font-bold text-ink">{r.documents.blockedShippingBills}</dd></div>
              <div><dt className="text-xs text-ink-muted">Pending credentials</dt><dd className="text-lg font-bold text-ink">{r.documents.pendingCredentials}</dd></div>
            </dl>
            <ul className="mt-4 space-y-2 text-sm">
              {([["Order documents", r.documents.readiness.orders], ["Shipment documents", r.documents.readiness.shipments], ["Customs documentation", r.documents.readiness.customs]] as const).map(([l, x]) => (
                <li key={l}>
                  <p className="flex justify-between"><span className="text-ink">{l} readiness</span><span className="font-semibold tabular-nums text-ink">{x.percent}% <span className="text-xs font-normal text-ink-muted">({x.done}/{x.required})</span></span></p>
                  <span aria-hidden className="block h-1.5 rounded-full bg-teal-soft"><span className="block h-1.5 rounded-full bg-teal" style={{ width: `${x.percent}%` }} /></span>
                </li>
              ))}
            </ul>
            <div className="mt-4"><Dur d={r.documents.sbToLeo} label="Shipping Bill filed → LEO (demo records)" /></div>
            {r.documents.sbToLeo.sample > 0 && <p className="text-xs text-ink-faint">Fastest {formatHours(r.documents.sbToLeo.minHours)} · slowest {formatHours(r.documents.sbToLeo.maxHours)}</p>}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Current Document / Customs Bottlenecks</h3>
            {r.documents.bottlenecks.length ? (
              <ul className="mt-2 divide-y divide-line text-sm">
                {r.documents.bottlenecks.slice(0, 10).map((b) => (
                  <li key={b.label}><Link href={b.href} className={`flex justify-between gap-3 py-1.5 hover:text-teal ${focusRing}`}><span className="text-ink">{b.label}</span><span className="font-semibold tabular-nums">{b.count}</span></Link></li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-faint">No current blockers.</p>
            )}
          </div>
        </div>
      </Section>

      <Section id="shipments" title="Shipments" aside={<Link href="/exporter/shipments" className="text-xs font-semibold text-teal hover:text-ink">Shipments →</Link>}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <Counts counts={r.shipments.byStatus} labels={SHIPMENT_STATUS_LABEL as Record<ShipmentStatus, string>} href="/exporter/shipments" />
            <div className="mt-3">
              <Dur d={r.shipments.cycles.toDeparture} label="Created → departed" />
              <Dur d={r.shipments.cycles.transit} label="Departed → arrived" />
              <Dur d={r.shipments.cycles.toDelivery} label="Arrived → delivered" />
              <Dur d={r.shipments.cycles.total} label="Total cycle (created → delivered)" />
            </div>
          </div>
          <div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-canvas p-3"><dt className="text-xs text-ink-muted">On-time departure</dt><dd className="text-lg font-bold text-ink">{pct(r.shipments.onTimeDeparture)}</dd><dd className="text-xs text-ink-muted">{basis(r.shipments.onTimeDeparture, "departed shipments")} departed with ETD</dd></div>
              <div className="rounded-xl bg-canvas p-3"><dt className="text-xs text-ink-muted">On-time delivery</dt><dd className="text-lg font-bold text-ink">{pct(r.shipments.onTimeDelivery)}</dd><dd className="text-xs text-ink-muted">{basis(r.shipments.onTimeDelivery, "delivered shipments")} delivered with an agreed date</dd></div>
              <div className="rounded-xl bg-canvas p-3"><dt className="text-xs text-ink-muted">Current delivery risk</dt><dd className="text-lg font-bold text-ink">{r.shipments.risk.atRisk.length} at risk</dd><dd className="text-xs text-ink-muted">{r.shipments.risk.onTrack} on track · {r.shipments.risk.comparable} active with ETA and agreed date</dd></div>
              <div className="rounded-xl bg-canvas p-3"><dt className="text-xs text-ink-muted">Avg readiness (pre-departure)</dt><dd className="text-lg font-bold text-ink">{r.shipments.readiness.avgCustoms ?? "—"}% / {r.shipments.readiness.avgFreight ?? "—"}%</dd><dd className="text-xs text-ink-muted">customs / freight · {r.shipments.readiness.rows.length} shipments</dd></div>
            </dl>
            {(r.shipments.readiness.customsBelow50.length > 0 || r.shipments.readiness.freightBelow50.length > 0) && (
              <p className="mt-2 text-xs text-ink-muted">
                Below 50% customs: {r.shipments.readiness.customsBelow50.join(", ") || "none"} · Below 50% freight: {r.shipments.readiness.freightBelow50.join(", ") || "none"}
              </p>
            )}
            <p className="mt-2 text-xs text-ink-muted">Delivered volume: {Object.entries(r.shipments.deliveredVolume).map(([u, q]) => `${q.toLocaleString("en-US")} ${u}`).join(" · ") || "—"} (per unit)</p>
          </div>
        </div>
      </Section>

      <Section id="pipeline" title="Pipeline Value" note="Per currency, per stage. Stages aren't added together — one transaction moves through several.">
        {currencies.length ? (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-[0.08em] text-ink-faint">
                <tr><th scope="col" className="py-2 pr-3">Currency</th>{["Quoted (active)", "Negotiation", "Deals", "Active orders", "Delivered"].map((h) => <th key={h} scope="col" className="px-2 py-2 text-right">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {currencies.map((c) => (
                  <tr key={c} data-currency-row={c}>
                    <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink">{c}</th>
                    {[r.pipeline.quoted, r.pipeline.negotiation, r.pipeline.deals, r.pipeline.orders, r.pipeline.delivered].map((v, i) => (
                      <td key={i} className="px-2 py-2 text-right tabular-nums text-ink">{v[c] !== undefined ? formatMoney(v[c]!, c) : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-faint">No commercial values in this range.</p>
        )}
      </Section>

      <Section id="products" title="Product Performance" note="Grouped by your catalogue product (the opportunity's matched product).">
        <GroupTable rows={r.products} caption="Product" />
      </Section>

      <Section id="markets" title="Market Performance" note="Grouped by buyer destination country. No buyer identities.">
        <GroupTable rows={r.markets} caption="Market" />
        <h3 className="mt-5 text-sm font-semibold text-ink">Destinations (port / location)</h3>
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          {r.destinations.map(([d, n]) => <li key={d} className="rounded-full bg-canvas px-2.5 py-1 text-ink ring-1 ring-inset ring-line">{d} · {n}</li>)}
        </ul>
      </Section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section id="match" title="Match Score" note="Outcome by band; a comparison, not a cause.">
          <p className="text-sm text-ink">Average match score: <span className="font-semibold">{r.match.average ?? "—"}</span></p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {r.match.bands.map((b) => (
              <li key={b.key} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span className="text-ink">{b.label}</span>
                <span className="text-ink-muted">{b.opportunities} opportunities · {b.quoted} quoted · {b.won} won · win rate {b.winRate.percent === undefined ? "— (fewer than 3 finalised)" : `${b.winRate.percent}%`}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="trend" title="Trend">
          {r.trend ? (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs uppercase tracking-[0.08em] text-ink-faint"><tr><th scope="col" className="py-2">Month</th><th scope="col" className="text-right">Opportunities</th><th scope="col" className="text-right">Quotations</th><th scope="col" className="text-right">Deals</th><th scope="col" className="text-right">Delivered</th></tr></thead>
                <tbody className="divide-y divide-line">{r.trend.map((t) => <tr key={t.month}><th scope="row" className="py-1.5 text-left font-medium">{t.month}</th><td className="text-right">{t.opportunities}</td><td className="text-right">{t.quotations}</td><td className="text-right">{t.deals}</td><td className="text-right">{t.delivered}</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-faint">Insufficient historical range — records span {r.months.length} month{r.months.length === 1 ? "" : "s"} ({r.months.join(", ") || "none"}). A trend needs at least 3.</p>
          )}
        </Section>
      </div>

      <aside aria-label="SUMIT insight" className="rounded-2xl border border-teal/15 bg-teal-soft p-5">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal"><Sparkles className="size-3.5 text-orange" aria-hidden />SUMIT insight</p>
        <ul className="mt-2 space-y-2">{analyticsInsights(r).map((x) => <li key={x} className="text-sm leading-relaxed text-ink">{x}</li>)}</ul>
        <p className="mt-3 text-xs text-ink-muted">Rule-based statements from the figures above. No forecasts or strategy advice.</p>
      </aside>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section id="definitions" title="How Metrics Are Calculated">
          <dl className="space-y-2 text-sm">
            {[
              ["Quote Rate", "Opportunities with at least one submitted quotation ÷ opportunities in range. Drafts don't count."],
              ["Win Rate", "Accepted ÷ (accepted + rejected) quotations. Active and expired quotations are excluded."],
              ["Agreement Rate", "Agreed ÷ finalised negotiations (agreed, closed or withdrawn). Active ones are excluded."],
              ["Negotiation rounds", "Offer exchanges only: buyer counters, revision requests, your revisions and kept offers. Notes and the original quotation aren't rounds."],
              ["On-Time Departure", "Departed shipments whose actual departure date ≤ ETD, of those with both dates."],
              ["On-Time Delivery", "Delivered shipments whose delivery date ≤ the order's agreed delivery date, of those with both dates. Active shipments never count as late."],
              ["Pipeline Value", "Shown per currency and per stage. No conversion, and stages aren't summed."],
            ].map(([t, d]) => <div key={t}><dt className="font-semibold text-ink">{t}</dt><dd className="text-ink-muted">{d}</dd></div>)}
          </dl>
        </Section>
        <Section id="coverage" title="Data Coverage">
          <ul className="space-y-1.5 text-sm text-ink-muted">
            <li>{r.quotations.timeToQuote.sample} of {r.quotations.total} submitted quotations have both shared and submitted timestamps.</li>
            <li>{r.winRate.den} finalised quotations (accepted or rejected) for win rate.</li>
            <li>{r.negotiations.finalised} finalised negotiations for agreement rate; {r.negotiations.priceMoves.length} comparable agreed price movements.</li>
            <li>{r.shipments.onTimeDeparture.den} departed shipments with an ETD; {r.shipments.onTimeDelivery.den} delivered shipments with an agreed delivery date.</li>
            <li>{r.documents.sbToLeo.sample} shipments with both Shipping Bill filing and LEO timestamps (demo records).</li>
            <li>Values in {currencies.join(", ") || "no currency"} — never converted.</li>
          </ul>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-faint"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />Everything here is derived live from your opportunities, quotations, negotiations, deals, orders, shipments and documents. Nothing is stored. Where data is missing, the metric shows “—”, never 0%.</p>
        </Section>
      </div>
      <Link href="/exporter/notifications" className={`inline-flex items-center gap-1 self-start text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>What needs action now → Notifications <ArrowRight className="size-4" aria-hidden /></Link>
    </div>
  );
}
