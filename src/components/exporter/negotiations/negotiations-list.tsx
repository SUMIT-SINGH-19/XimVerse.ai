"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, SearchX } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { focusRing } from "@/components/workspace/styles";
import { Select } from "@/components/exporter/products/catalogue-filters";
import { exporterHref } from "@/lib/exporter-nav";
import { findOpportunity, formatDateTime, shortCountry } from "@/lib/exporter-opportunities";
import {
  agreedTerms,
  buyerLatestOffer,
  formatOfferPrice,
  isActiveNegotiation,
  lastActivity,
  NEGOTIATION_STATUS_LABEL,
  needsExporterResponse,
  negotiationStatus,
  offerValueMinor,
  yourCurrentOffer,
  type CommercialOffer,
  type ExporterNegotiation,
  type ExporterNegotiationStatus,
} from "@/lib/exporter-negotiations";
import { useExporterNegotiations } from "@/lib/exporter-negotiation-store";
import { formatCompactMoney } from "@/lib/exporter-quotation-pipeline";
import type { Currency } from "@/lib/import-requirements";
import { NegotiationStatusPill } from "./negotiation-ui";

interface Row {
  n: ExporterNegotiation;
  status: ExporterNegotiationStatus;
  yours: CommercialOffer;
  buyer?: CommercialOffer;
  agreed?: CommercialOffer;
  productName: string;
  destination: string;
  lastAt: string;
}

type Sort = "attention" | "latest" | "value" | "oldest";

function toRow(n: ExporterNegotiation): Row {
  const o = findOpportunity(n.requirementId);
  return {
    n,
    status: negotiationStatus(n),
    yours: yourCurrentOffer(n),
    buyer: buyerLatestOffer(n),
    agreed: agreedTerms(n),
    productName: o?.product.name ?? n.quotationId,
    destination: o ? shortCountry(o.delivery.destinationCountry) : "—",
    lastAt: lastActivity(n),
  };
}

function byCurrency(rows: Row[], pick: (r: Row) => CommercialOffer | undefined) {
  const out: Partial<Record<Currency, number>> = {};
  for (const r of rows) {
    const o = pick(r);
    if (o) out[o.currency] = (out[o.currency] ?? 0) + offerValueMinor(o);
  }
  return Object.entries(out) as [Currency, number][];
}

function MoneyLines({ values }: { values: [Currency, number][] }) {
  return values.length ? (
    <ul className="mt-1.5 space-y-0.5">
      {values.map(([c, minor]) => (
        <li key={c} className="text-xl font-bold tracking-tight tabular-nums text-ink">
          {formatCompactMoney(minor, c)} <span className="text-xs font-medium text-ink-faint">{c}</span>
        </li>
      ))}
    </ul>
  ) : (
    <span className="mt-1.5 text-2xl font-bold text-ink">—</span>
  );
}

const th = "whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint first:pl-5 last:pr-4";
const td = "px-2.5 py-3.5 align-top first:pl-5 last:pr-4";

/** All negotiations: seeded ones plus this browser's events on them. */
export function NegotiationsList() {
  const negotiations = useExporterNegotiations();
  const rows = useMemo(() => negotiations.map(toRow), [negotiations]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ExporterNegotiationStatus | "">("");
  const [product, setProduct] = useState("");
  const [destination, setDestination] = useState("");
  const [currency, setCurrency] = useState<Currency | "">("");
  const [sort, setSort] = useState<Sort>("attention");

  const active = rows.filter((r) => isActiveNegotiation(r.status));
  const metrics = [
    { label: "Active Negotiations", value: active.length },
    { label: "Awaiting Your Response", value: rows.filter((r) => needsExporterResponse(r.status)).length, alert: true },
    { label: "Awaiting Buyer", value: rows.filter((r) => r.status === "awaiting-buyer").length },
    { label: "Agreement Reached", value: rows.filter((r) => r.status === "agreed").length },
  ];

  const visible = (() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        (!q || [r.n.id, r.n.quotationId, r.n.requirementId, r.productName, r.destination].some((s) => s.toLowerCase().includes(q))) &&
        (!status || r.status === status) &&
        (!product || r.productName === product) &&
        (!destination || r.destination === destination) &&
        (!currency || r.yours.currency === currency),
    );
    const cmp: Record<Sort, (a: Row, b: Row) => number> = {
      attention: (a, b) =>
        Number(!needsExporterResponse(a.status)) - Number(!needsExporterResponse(b.status)) ||
        Number(!isActiveNegotiation(a.status)) - Number(!isActiveNegotiation(b.status)) ||
        a.lastAt.localeCompare(b.lastAt),
      latest: (a, b) => b.lastAt.localeCompare(a.lastAt),
      // Values only compare within a currency.
      value: (a, b) => a.yours.currency.localeCompare(b.yours.currency) || offerValueMinor(b.yours) - offerValueMinor(a.yours),
      oldest: (a, b) => Number(!isActiveNegotiation(a.status)) - Number(!isActiveNegotiation(b.status)) || a.lastAt.localeCompare(b.lastAt),
    };
    return out.sort(cmp[sort]);
  })();

  const uniq = (xs: string[]) => [...new Set(xs)].sort();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Trade" title="Negotiations" description="Review buyer requests, counter-offers and active commercial discussions." />

      <ul aria-label="Negotiation summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m) => (
          <li key={m.label} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
            <span className="text-sm font-medium text-ink-muted">{m.label}</span>
            <span className={`mt-1.5 text-2xl font-bold tabular-nums ${m.alert && m.value > 0 ? "text-orange" : "text-ink"}`}>{m.value}</span>
          </li>
        ))}
        <li className="flex flex-col rounded-2xl border border-line bg-surface p-4">
          <span className="text-sm font-medium text-ink-muted">Under Negotiation</span>
          <MoneyLines values={byCurrency(active, (r) => r.yours)} />
          <span className="mt-0.5 text-xs text-ink-muted">Your current offers, per currency</span>
        </li>
        <li className="flex flex-col rounded-2xl border border-line bg-surface p-4">
          <span className="text-sm font-medium text-ink-muted">Negotiated Value</span>
          <MoneyLines values={byCurrency(rows, (r) => r.agreed)} />
          <span className="mt-0.5 text-xs text-ink-muted">Agreed terms, per currency</span>
        </li>
      </ul>

      <section aria-labelledby="neg-heading" className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <h2 id="neg-heading" className="text-base font-semibold tracking-tight text-ink">
            Negotiations <span className="ml-2 text-sm font-normal text-ink-muted">{visible.length} of {rows.length}</span>
          </h2>
          <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 rounded-lg border border-line bg-canvas px-2 text-sm text-ink focus:border-teal focus:outline-none">
              <option value="attention">Needs Attention</option>
              <option value="latest">Latest Activity</option>
              <option value="value">Highest Value (per currency)</option>
              <option value="oldest">Oldest Waiting</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-3 sm:px-6 xl:grid-cols-5">
          <label className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-3 xl:col-span-1">
            <span className="text-xs font-medium text-ink-faint">Search</span>
            <span className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="NG, QT, RFQ, product…" className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-2.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20" />
            </span>
          </label>
          <Select label="Status" value={status} onChange={setStatus} options={(Object.keys(NEGOTIATION_STATUS_LABEL) as ExporterNegotiationStatus[]).map((s) => ({ value: s, label: NEGOTIATION_STATUS_LABEL[s] }))} allLabel="All statuses" />
          <Select label="Product" value={product} onChange={setProduct} options={uniq(rows.map((r) => r.productName)).map((p) => ({ value: p, label: p }))} allLabel="All products" />
          <Select label="Destination" value={destination} onChange={setDestination} options={uniq(rows.map((r) => r.destination)).map((d) => ({ value: d, label: d }))} allLabel="All destinations" />
          <Select label="Currency" value={currency} onChange={(v) => setCurrency(v as Currency | "")} options={uniq(rows.map((r) => r.yours.currency)).map((c) => ({ value: c, label: c }))} allLabel="All currencies" />
        </div>

        {visible.length === 0 ? (
          <div className="border-t border-line px-6 py-14 text-center">
            <SearchX className="mx-auto size-8 text-ink-faint" aria-hidden />
            <p className="mt-3 font-semibold text-ink">No negotiations match these filters</p>
          </div>
        ) : (
          <>
            <div className="relative hidden overflow-x-auto xl:block">
              {/* Columns marked 2xl wait for room beside the sidebar; their data folds into a neighbouring cell until then. */}
              <table className="w-full text-sm">
                <thead className="border-y border-line bg-canvas/60">
                  <tr>
                    <th scope="col" className={th}>Negotiation</th>
                    <th scope="col" className={`${th} hidden 2xl:table-cell`}>Quotation / RFQ</th>
                    <th scope="col" className={th}>Product</th>
                    <th scope="col" className={th}>Destination</th>
                    <th scope="col" className={`${th} text-right!`}>Your Offer</th>
                    <th scope="col" className={`${th} text-right!`}>Buyer Latest</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={`${th} hidden 2xl:table-cell`}>Last Activity</th>
                    <th scope="col" className={th}><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((r) => (
                    <tr key={r.n.id} className="transition-colors hover:bg-canvas/50">
                      <td className={`${td} whitespace-nowrap font-mono text-xs font-semibold text-ink`}>{r.n.id}</td>
                      <td className={`${td} hidden 2xl:table-cell`}>
                        <p className="whitespace-nowrap font-mono text-xs text-ink">{r.n.quotationId}</p>
                        <p className="mt-0.5 whitespace-nowrap font-mono text-xs text-ink-muted">{r.n.requirementId}</p>
                      </td>
                      <td className={`${td} max-w-48 font-semibold text-ink`}>{r.productName}</td>
                      <td className={`${td} whitespace-nowrap text-ink`}>{r.destination}</td>
                      <td className={`${td} whitespace-nowrap text-right tabular-nums text-ink`}>{formatOfferPrice(r.agreed ?? r.yours)}</td>
                      <td className={`${td} whitespace-nowrap text-right tabular-nums ${r.buyer && needsExporterResponse(r.status) ? "font-semibold text-orange" : "text-ink-muted"}`}>
                        {r.buyer ? formatOfferPrice(r.buyer) : "—"}
                      </td>
                      <td className={td}><NegotiationStatusPill status={r.status} /></td>
                      <td className={`${td} hidden 2xl:table-cell whitespace-nowrap text-xs text-ink-muted`}>{formatDateTime(r.lastAt)}</td>
                      <td className={`${td} text-right`}>
                        <Link href={exporterHref(`negotiations/${r.n.id}`)} aria-label={`Open negotiation ${r.n.id}`} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-teal hover:border-teal hover:bg-teal-soft ${focusRing}`}>
                          Open
                          <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 md:grid-cols-2 xl:hidden">
              {visible.map((r) => (
                <li key={r.n.id} className="flex flex-col rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-ink">{r.n.id}</p>
                      <p className="mt-1 font-semibold text-ink">{r.productName}</p>
                      <p className="font-mono text-xs text-ink-muted">{r.n.quotationId} · {r.n.requirementId}</p>
                    </div>
                    <NegotiationStatusPill status={r.status} />
                  </div>
                  <dl className="mb-3 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-ink-faint">Your offer</dt>
                      <dd className="font-semibold tabular-nums text-ink">{formatOfferPrice(r.agreed ?? r.yours)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-faint">Buyer latest</dt>
                      <dd className={`tabular-nums ${r.buyer && needsExporterResponse(r.status) ? "font-semibold text-orange" : "text-ink"}`}>{r.buyer ? formatOfferPrice(r.buyer) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-faint">Destination</dt>
                      <dd className="text-ink">{r.destination}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-faint">Last activity</dt>
                      <dd className="text-xs text-ink">{formatDateTime(r.lastAt)}</dd>
                    </div>
                  </dl>
                  <Link href={exporterHref(`negotiations/${r.n.id}`)} className={`mt-auto inline-flex items-center justify-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-teal hover:border-teal hover:bg-teal-soft ${focusRing}`}>
                    Open Negotiation
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
