"use client";

import Link from "next/link";
import { ArrowLeft, CircleAlert, Info, Award, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { formatPrice, formatQuantity, paymentTermLabel, type ImportRequirement } from "@/lib/import-requirements";
import {
  estimatedArrival,
  estimatedReadiness,
  findQuotation,
  formatIncoterm,
  formatQuotedValue,
  formatUnitPrice,
  formatValidity,
  incotermCoverage,
  INSURANCE_LABEL,
  isDecisionOpen,
  quotationDeviations,
  requirementOf,
  SUPPLIER_TYPE_LABEL,
  supplierOf,
  validityDaysLeft,
  type Quotation,
  type QuotationDeviation,
} from "@/lib/importer-quotations";
import { importerHref } from "@/lib/importer-nav";
import { ImportId } from "../dashboard/dashboard-ui";
import { focusRing, secondaryButton } from "../styles";
import { Availability, DeviationList, QuotationStatusBadge, ShortlistToggle } from "./quotation-ui";
import { toggleShortlist, useQuotationStatus } from "./quotation-status-store";
import { compareHref, MAX_COMPARE } from "./quotations-list";
import { supplierHref } from "../suppliers/supplier-links";
import { useImportRequirements } from "../rfq/requirements-store";
import { NegotiateAction } from "../negotiations/negotiate-action";
import { SumitAnalysisCard } from "./sumit-analysis-card";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;

export function QuotationCompare({ ids }: { ids: readonly string[] }) {
  const { find: findRequirement } = useImportRequirements();
  const unique = [...new Set(ids)];
  const found = unique.map(findQuotation).filter((q): q is Quotation => !!q);
  const unknown = unique.filter((id) => !findQuotation(id));
  const quotes = found.slice(0, MAX_COMPARE);
  const requirementIds = [...new Set(quotes.map((q) => q.requirementId))];

  if (requirementIds.length > 1) {
    return (
      <Problem title="These quotations belong to different requirements">
        Quotations can only be compared within one import requirement. The selection includes{" "}
        {requirementIds.join(" and ")}.
      </Problem>
    );
  }
  const requirement = quotes[0] && (findRequirement(quotes[0].requirementId) ?? requirementOf(quotes[0]));
  if (quotes.length < 2 || !requirement) {
    return (
      <Problem title="Select at least 2 quotations to compare">
        Choose 2–{MAX_COMPARE} quotations for the same requirement from the quotations list.
      </Problem>
    );
  }

  const notices = [
    found.length > MAX_COMPARE && `Only the first ${MAX_COMPARE} quotations are compared.`,
    unknown.length > 0 && `Ignored unknown quotation ${unknown.length === 1 ? "ID" : "IDs"}: ${unknown.join(", ")}.`,
  ].filter(Boolean) as string[];

  return <Comparison quotes={quotes} requirement={requirement} notices={notices} />;
}

function Problem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-orange-soft text-orange">
        <CircleAlert className="size-6" />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted">{children}</p>
      <Link href={importerHref("quotations")} className={`${secondaryButton} mt-6`}>
        <ArrowLeft aria-hidden className="size-4" />
        Back to Quotations
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

interface Row {
  label: string;
  requirement: React.ReactNode;
  cell: (q: Quotation) => React.ReactNode;
  /** Deviation id that flags this row for a quotation. */
  flag?: string | ((q: Quotation) => boolean);
  highlight?: (q: Quotation) => string | undefined;
}

function Comparison({
  quotes,
  requirement: r,
  notices,
}: {
  quotes: Quotation[];
  requirement: ImportRequirement;
  notices: string[];
}) {
  const statusOf = useQuotationStatus();
  const open = isDecisionOpen(r);
  const deviations = new Map(quotes.map((q) => [q.id, quotationDeviations(q, r)]));
  const issues = (q: Quotation) => deviations.get(q.id)!.filter((d) => d.kind === "deviation");
  const flagged = (q: Quotation, id: string) => issues(q).some((d) => d.id === id);

  const highlights = computeHighlights(quotes, issues);
  const differences = normalizationGaps(quotes);
  const pref = r.supplierPreferences;

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: "Supplier",
      rows: [
        { label: "Country", requirement: pref.preferredRegions ? `Preferred: ${pref.preferredRegions}` : undefined, cell: (q) => supplierOf(q).country },
        {
          label: "Supplier type",
          requirement: pref.manufacturerRequired ? "Manufacturer required" : pref.tradersAcceptable ? "Traders acceptable" : undefined,
          cell: (q) => SUPPLIER_TYPE_LABEL[supplierOf(q).type],
          flag: "supplier-type",
        },
        {
          label: "Experience",
          requirement: pref.minimumExperienceYears !== undefined ? `${pref.minimumExperienceYears}+ years` : undefined,
          cell: (q) => `${supplierOf(q).yearsExporting} years exporting`,
          flag: "experience",
        },
        {
          label: "XimVerse history",
          requirement: undefined,
          cell: (q) => `${supplierOf(q).previousTransactions} transactions (demo)`,
        },
      ],
    },
    {
      title: "Product",
      rows: [
        {
          label: "Specification",
          requirement: <span className="line-clamp-5">{r.product.specification}</span>,
          cell: (q) => <span className="line-clamp-5">{q.product.description}</span>,
          flag: "spec",
        },
        { label: "Quantity", requirement: formatQuantity(r.quantity), cell: (q) => formatQuantity(q.product.quantity), flag: "quantity" },
        {
          label: "MOQ",
          requirement: r.quantity.minimumAcceptable && `Min. acceptable ${formatQuantity({ amount: r.quantity.minimumAcceptable, unit: r.quantity.unit })}`,
          cell: (q) => (q.product.moq ? formatQuantity(q.product.moq) : undefined),
        },
        { label: "Origin", requirement: r.quality.originPreference, cell: (q) => q.product.origin, flag: "origin" },
        { label: "Packaging", requirement: r.quality.packaging, cell: (q) => q.product.packaging, flag: "packaging" },
      ],
    },
    {
      title: "Commercial",
      rows: [
        {
          label: "Unit price",
          requirement: r.commercial.targetPrice && `Target ${formatPrice(r.commercial.targetPrice.amount, r.commercial.targetPrice.currency)}`,
          cell: (q) => <span className="font-semibold tabular-nums">{formatUnitPrice(q)}</span>,
          highlight: (q) => highlights.lowestPrice.get(q.id),
        },
        { label: "Currency", requirement: r.commercial.targetPrice?.currency, cell: (q) => q.price.currency },
        { label: "Incoterm", requirement: r.delivery.incoterm, cell: (q) => formatIncoterm(q), flag: "incoterm" },
        {
          label: "Freight",
          requirement: undefined,
          cell: (q) => (incotermCoverage(q.price.incoterm).freightIncluded ? "Included" : "Not included"),
        },
        { label: "Insurance", requirement: undefined, cell: (q) => INSURANCE_LABEL[incotermCoverage(q.price.incoterm).insurance] },
        { label: "Quoted value", requirement: undefined, cell: (q) => <span className="tabular-nums">{formatQuotedValue(q)}</span> },
        {
          label: "Payment terms",
          requirement: r.commercial.paymentTerms && paymentTermLabel(r.commercial.paymentTerms),
          cell: (q) => q.commercial.paymentSummary,
          flag: "payment",
        },
        {
          label: "Validity",
          requirement: undefined,
          cell: (q) => formatValidity(q),
          highlight: (q) => highlights.longestValidity.get(q.id),
        },
      ],
    },
    {
      title: "Delivery",
      rows: [
        {
          label: "Lead time",
          requirement: undefined,
          cell: (q) => `${q.delivery.leadTimeDays} days`,
          highlight: (q) => highlights.shortestLead.get(q.id),
        },
        { label: "Readiness", requirement: undefined, cell: (q) => `~${formatDate(estimatedReadiness(q))}` },
        { label: "Port of loading", requirement: undefined, cell: (q) => q.delivery.portOfLoading },
        {
          label: "Delivered to",
          requirement: r.delivery.destinationLocation,
          cell: (q) =>
            incotermCoverage(q.price.incoterm).freightIncluded ? q.price.namedPlace : `You arrange freight from ${q.delivery.portOfLoading}`,
        },
        {
          label: "Est. arrival",
          requirement: `By ${formatDate(r.delivery.requiredBy)}`,
          cell: (q) => {
            const a = estimatedArrival(q);
            return a ? `~${formatDate(a)}` : "Depends on your freight";
          },
          flag: "timing",
        },
      ],
    },
    {
      title: "Quality",
      rows: [
        ...r.quality.certifications.map<Row>((cert) => ({
          label: cert,
          requirement: "Requested",
          cell: (q) => <Availability value={q.compliance.documents.find((d) => d.name === cert)?.availability ?? "not-offered"} />,
          flag: `doc-${cert}`,
        })),
        {
          label: "Inspection",
          requirement: r.quality.inspection,
          cell: (q) => (
            <>
              <span className="font-medium">{q.compliance.inspectionAccepted ? "Accepted" : "Not accepted"}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{q.compliance.inspection}</span>
            </>
          ),
          flag: "inspection",
        },
        { label: "Quality terms", requirement: undefined, cell: (q) => q.compliance.qualityTerms },
      ],
    },
    {
      title: "Deviations",
      rows: [
        {
          label: "Number of deviations",
          requirement: undefined,
          cell: (q) => <span className="font-semibold tabular-nums">{issues(q).length}</span>,
          highlight: (q) => highlights.fewestDeviations.get(q.id),
        },
        {
          label: "Important differences",
          requirement: undefined,
          cell: (q) => {
            const list = issues(q);
            return list.length ? <DeviationList deviations={list} compact /> : <span className="text-ink-muted">None found</span>;
          },
        },
      ],
    },
  ];

  const columns = quotes.length;
  // Phones drop the requirement column (its value moves under the row label).
  const widths = { "--mw": `${8 + columns * 13}rem`, "--mw-sm": `${8 + 11 + columns * 13}rem` } as React.CSSProperties;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`${importerHref("quotations")}?requirement=${r.id}`} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Quotations
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">Compare quotations</h1>
        <p className="mt-1 text-sm text-ink-muted">
          <Link href={importerHref(`rfqs/${r.id}`)} className={`rounded font-medium text-teal hover:underline ${focusRing}`}>
            <ImportId id={r.id} /> · {r.product.name}
          </Link>{" "}
          · {columns} quotations side by side
        </p>
        {notices.map((n) => (
          <p key={n} className="mt-2 text-sm text-orange">{n}</p>
        ))}
      </div>

      {differences.length > 0 && (
        <section
          aria-labelledby="normalization"
          className="flex gap-3 rounded-2xl border border-orange/30 bg-orange-soft/50 px-5 py-4"
        >
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-orange" />
          <div>
            <h2 id="normalization" className="font-semibold text-ink">
              These quotations are not fully normalized.
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Quoted prices may include different cost components. Compare commercial terms before choosing an offer.
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink">
              {differences.map((d) => (
                <li key={d} className="flex items-center gap-1.5">
                  <span aria-hidden className="size-1.5 rounded-full bg-orange" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="comparison-table" className="rounded-2xl border border-line bg-surface">
        <h2 id="comparison-table" className="sr-only">
          Side-by-side comparison
        </h2>
        <p className="border-b border-line px-4 py-2.5 text-xs text-ink-muted xl:hidden">
          Scroll sideways to see every supplier. Row labels stay in place.
        </p>
        {/* relative: contains absolutely-positioned sr-only text so it can't widen the page. */}
        <div className="relative overflow-x-auto xl:overflow-visible">
          <table className="w-full min-w-(--mw) table-fixed border-separate border-spacing-0 text-left text-sm sm:min-w-(--mw-sm) xl:min-w-0" style={widths}>
            <colgroup>
              <col className="w-32 xl:w-40" />
              <col className="hidden w-44 sm:table-column xl:w-52" />
              {quotes.map((q) => (
                <col key={q.id} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-20 border-b border-line bg-surface px-4 py-4 align-bottom text-xs font-medium text-ink-faint xl:top-[69px] xl:z-30 xl:rounded-tl-2xl">
                  <span className="sr-only">Attribute</span>
                </th>
                <th scope="col" className="hidden border-b border-line bg-canvas px-4 py-4 align-bottom sm:table-cell xl:sticky xl:top-[69px] xl:z-20">
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Your requirement</span>
                  <ImportId id={r.id} className="mt-1 block text-ink" />
                </th>
                {quotes.map((q) => {
                  const status = statusOf(q);
                  const s = supplierOf(q);
                  const others = quotes.filter((x) => x.id !== q.id).map((x) => x.id);
                  return (
                    <th
                      key={q.id}
                      scope="col"
                      className="border-b border-l border-line bg-surface px-4 py-4 align-top font-normal xl:sticky xl:top-[69px] xl:z-20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={supplierHref(s.id)}
                            className={`block rounded font-semibold leading-snug text-ink hover:text-teal ${focusRing}`}
                          >
                            {s.name}
                          </Link>
                          <Link
                            href={importerHref(`quotations/${q.id}`)}
                            className={`rounded text-ink-faint hover:text-teal hover:underline ${focusRing}`}
                          >
                            <ImportId id={q.id} className="text-xs" />
                          </Link>
                        </div>
                        <ShortlistToggle
                          label={`${q.id} from ${s.name}`}
                          shortlisted={status === "shortlisted"}
                          disabled={!open || status === "selected"}
                          onToggle={() => toggleShortlist(q, status)}
                          className="-mr-1.5 -mt-1 shrink-0"
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <QuotationStatusBadge status={status} />
                        {others.length >= 2 && (
                          <Link
                            href={compareHref(others)}
                            className={`inline-flex items-center gap-0.5 rounded text-xs text-ink-faint hover:text-orange ${focusRing}`}
                          >
                            <X aria-hidden className="size-3" />
                            Remove<span className="sr-only"> {s.name} from comparison</span>
                          </Link>
                        )}
                      </div>
                      <div className="mt-2">
                        <NegotiateAction quote={q} compact />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.title}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={2 + columns}
                    className="border-b border-line bg-canvas/70 px-4 pb-2 pt-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted"
                  >
                    <span className="sticky left-4">{g.title}</span>
                  </th>
                </tr>
                {g.rows.map((row) => (
                  <tr key={row.label} className="group">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-3 align-top text-xs font-medium text-ink-muted group-hover:bg-canvas"
                    >
                      {row.label}
                      {row.requirement && (
                        <span className="mt-1 block font-normal text-ink-faint sm:hidden">
                          <span className="font-medium">You: </span>
                          <span className="line-clamp-3">{row.requirement}</span>
                        </span>
                      )}
                    </th>
                    <td className="hidden border-b border-line bg-canvas/50 px-4 py-3 align-top text-ink-muted sm:table-cell">
                      {row.requirement || <span className="text-ink-faint">—</span>}
                    </td>
                    {quotes.map((q) => {
                      const isFlagged =
                        typeof row.flag === "function" ? row.flag(q) : row.flag ? flagged(q, row.flag) : false;
                      const tag = row.highlight?.(q);
                      const value = row.cell(q);
                      return (
                        <td
                          key={q.id}
                          className={`break-words border-b border-l border-line px-4 py-3 align-top text-ink group-hover:bg-canvas/40 ${
                            isFlagged ? "bg-orange-soft/35" : ""
                          }`}
                        >
                          {value ?? <span className="text-ink-faint">—</span>}
                          {isFlagged && (
                            <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-orange">
                              <CircleAlert aria-hidden className="size-3.5 shrink-0" />
                              Differs from requirement
                            </span>
                          )}
                          {tag && (
                            <span className="mt-1.5 flex w-fit items-center gap-1 rounded-full bg-teal-soft px-2 py-0.5 text-xs font-medium text-teal">
                              <Award aria-hidden className="size-3.5 shrink-0" />
                              {tag}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      <p className="flex gap-2 text-xs text-ink-muted">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Highlights describe stated values only — not total landed cost or overall value. Document availability is
        supplier-declared; supplier profiles are demo data.
      </p>

      <SumitAnalysisCard />
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/** Factual, precisely-labelled highlights. Never implies "best" or "cheapest". */
function computeHighlights(quotes: Quotation[], issues: (q: Quotation) => QuotationDeviation[]) {
  const pick = (values: { id: string; v: number }[], best: "min" | "max", label: string) => {
    const out = new Map<string, string>();
    if (values.length < 2) return out;
    const target = best === "min" ? Math.min(...values.map((x) => x.v)) : Math.max(...values.map((x) => x.v));
    const winners = values.filter((x) => x.v === target);
    if (winners.length === values.length) return out; // all equal: nothing to highlight
    winners.forEach((w) => out.set(w.id, label));
    return out;
  };

  // Unit prices are only comparable within one currency and unit.
  const lowestPrice = new Map<string, string>();
  const byBasis = new Map<string, Quotation[]>();
  for (const q of quotes) {
    const key = `${q.price.currency}/${q.product.quantity.unit}`;
    byBasis.set(key, [...(byBasis.get(key) ?? []), q]);
  }
  const multipleCurrencies = new Set(quotes.map((q) => q.price.currency)).size > 1;
  for (const group of byBasis.values()) {
    const label = `Lowest quoted unit price${multipleCurrencies ? ` in ${group[0].price.currency}` : ""}`;
    pick(group.map((q) => ({ id: q.id, v: q.price.unitPrice })), "min", label).forEach((v, k) => lowestPrice.set(k, v));
  }

  const devs = quotes.map((q) => ({ id: q.id, v: issues(q).length }));
  const fewestDeviations = pick(devs, "min", "Fewest deviations");
  devs.filter((d) => d.v === 0).forEach((d) => fewestDeviations.set(d.id, "Requirement matched"));

  return {
    lowestPrice,
    shortestLead: pick(quotes.map((q) => ({ id: q.id, v: q.delivery.leadTimeDays })), "min", "Shortest stated lead time"),
    longestValidity: pick(
      quotes.filter((q) => validityDaysLeft(q) >= 0).map((q) => ({ id: q.id, v: validityDaysLeft(q) })),
      "max",
      "Longest quotation validity",
    ),
    fewestDeviations,
  };
}

/** Reasons quoted prices aren't like-for-like. */
function normalizationGaps(quotes: Quotation[]): string[] {
  const distinct = <T,>(f: (q: Quotation) => T) => [...new Set(quotes.map(f))];
  const out: string[] = [];
  const incoterms = distinct((q) => q.price.incoterm);
  if (incoterms.length > 1) out.push(`Different Incoterms: ${incoterms.join(", ")}`);
  const currencies = distinct((q) => q.price.currency);
  if (currencies.length > 1) out.push(`Different currencies: ${currencies.join(", ")}`);
  const quantities = distinct((q) => formatQuantity(q.product.quantity));
  if (quantities.length > 1) out.push(`Different quantities: ${quantities.join(", ")}`);
  if (distinct((q) => incotermCoverage(q.price.incoterm).freightIncluded).length > 1) out.push("Freight included in some prices only");
  if (distinct((q) => incotermCoverage(q.price.incoterm).insurance).length > 1) out.push("Insurance cover differs");
  return out;
}
