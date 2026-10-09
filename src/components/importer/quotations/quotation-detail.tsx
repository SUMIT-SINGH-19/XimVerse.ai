"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleAlert, Info, MessageSquareWarning, ThumbsDown, Undo2 } from "lucide-react";
import { formatDate, formatTimeAgo } from "@/lib/format";
import { formatQuantity, MOCK_NOW, paymentTermLabel, type ImportRequirement } from "@/lib/import-requirements";
import {
  estimatedArrival,
  estimatedReadiness,
  formatIncoterm,
  formatQuotedValue,
  formatUnitPrice,
  formatValidity,
  incotermCoverage,
  isDecisionOpen,
  quotationDeviations,
  SUPPLIER_TYPE_LABEL,
  supplierOf,
  type Quotation,
  type QuotationStatus,
} from "@/lib/importer-quotations";
import { importerHref } from "@/lib/importer-nav";
import { DEMO_DISCLAIMER, PROFILE_STATUS_LABEL } from "@/lib/importer-suppliers";
import { supplierHref } from "../suppliers/supplier-links";
import { useImportRequirements } from "../rfq/requirements-store";
import { NegotiateAction } from "../negotiations/negotiate-action";
import { QuotationOrderLink } from "../orders/order-ui";
import { ImportId, Panel } from "../dashboard/dashboard-ui";
import { focusRing, secondaryButton } from "../styles";
import { FactList, type Fact } from "../rfq/requirement-sections";
import { Availability, DeviationList, IncotermCoverageList, QuotationStatusBadge, ShortlistToggle } from "./quotation-ui";
import { setQuotationStatus, toggleShortlist, useQuotationStatus } from "./quotation-status-store";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;

export function QuotationDetail({ quote, requirement: initial }: { quote: Quotation; requirement: ImportRequirement }) {
  const status = useQuotationStatus()(quote);
  // The store's copy reflects supplier selection made through negotiation.
  const requirement = useImportRequirements().find(initial.id) ?? initial;
  const s = supplierOf(quote);
  const open = isDecisionOpen(requirement) && status !== "selected";
  const deviations = quotationDeviations(quote, requirement);
  const deviationTotal = deviations.filter((d) => d.kind === "deviation").length;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`${importerHref("quotations")}?requirement=${quote.requirementId}`} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Quotations
        </Link>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <ImportId id={quote.id} className="text-ink-muted" />
              <QuotationStatusBadge status={status} />
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">{s.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              For{" "}
              <Link href={importerHref(`rfqs/${requirement.id}`)} className={`rounded font-medium text-teal hover:underline ${focusRing}`}>
                <ImportId id={requirement.id} /> · {requirement.product.name}
              </Link>
              <span className="text-ink-faint"> · Received {formatTimeAgo(quote.receivedAt, MOCK_NOW).toLowerCase()}</span>
            </p>
          </div>
          <Actions quote={quote} status={status} open={open} />
        </div>
        {!open && (
          <p className="mt-3 text-sm text-ink-muted">
            {status === "selected"
              ? "This quotation was selected for the requirement."
              : `This requirement is ${requirement.status === "closed" ? "closed" : "already assigned to a supplier"}, so no further decisions can be made.`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Section id="product" title="Product Offer">
            <ComparisonTable
              rows={[
                { label: "Product", requested: requirement.product.name, offered: requirement.product.name },
                {
                  label: "Specification",
                  requested: requirement.product.specification,
                  offered: quote.product.description,
                  differs: !quote.product.specificationAsRequested,
                },
                {
                  label: "Quantity",
                  requested: formatQuantity(requirement.quantity),
                  offered: formatQuantity(quote.product.quantity),
                  differs: quote.product.quantity.amount < requirement.quantity.amount,
                },
                {
                  label: "MOQ",
                  requested: requirement.quantity.minimumAcceptable
                    ? `Minimum acceptable ${formatQuantity({ amount: requirement.quantity.minimumAcceptable, unit: requirement.quantity.unit })}`
                    : undefined,
                  offered: quote.product.moq && formatQuantity(quote.product.moq),
                },
                {
                  label: "Packaging",
                  requested: requirement.quality.packaging,
                  offered: quote.product.packaging,
                  differs: !!requirement.quality.packaging && !quote.product.packagingAsRequested,
                },
                {
                  label: "Country of origin",
                  requested: requirement.quality.originPreference,
                  offered: quote.product.origin,
                  differs:
                    !!requirement.quality.originPreference &&
                    requirement.quality.originPreference.toLowerCase() !== quote.product.origin.toLowerCase(),
                },
                { label: "HS Code", requested: requirement.product.hsCode, offered: quote.product.hsCode },
              ]}
            />
          </Section>

          <Section id="pricing" title="Pricing">
            <FactList
              facts={[
                { label: "Unit price", value: <span className="text-base font-semibold">{formatUnitPrice(quote)}</span> },
                { label: "Quantity", value: formatQuantity(quote.product.quantity) },
                { label: "Currency", value: quote.price.currency },
                { label: "Quoted product value", value: formatQuotedValue(quote) },
                { label: "Incoterm", value: quote.price.incoterm },
                { label: "Named place / port", value: quote.price.namedPlace },
              ]}
            />
            <div className="mt-6 rounded-xl border border-line bg-canvas/50 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-ink">What {formatIncoterm(quote)} typically covers</h3>
              <div className="mt-4">
                <IncotermCoverageList coverage={incotermCoverage(quote.price.incoterm)} />
              </div>
              <p className="mt-4 flex gap-2 text-xs text-ink-muted">
                <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                Informational summary of common Incoterms® 2020 responsibilities. Actual obligations depend on the
                sales contract.
              </p>
            </div>
          </Section>

          <Section id="delivery" title="Delivery">
            <FactList facts={deliveryFacts(quote, requirement)} />
          </Section>

          <Section id="payment" title="Payment">
            <FactList
              facts={[
                { label: "Payment terms", value: quote.commercial.paymentSummary },
                { label: "Details", value: quote.commercial.paymentDetail },
                {
                  label: "You requested",
                  value:
                    [requirement.commercial.paymentTerms && paymentTermLabel(requirement.commercial.paymentTerms), requirement.commercial.paymentNotes]
                      .filter(Boolean)
                      .join(" — ") || undefined,
                },
                { label: "Quotation validity", value: formatValidity(quote) },
                { label: "Commercial notes", value: quote.commercial.notes, wide: true },
              ]}
            />
          </Section>

          <Section id="compliance" title="Quality & Compliance">
            {requirement.quality.certifications.length > 0 ? (
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Requested certifications and supplier availability</caption>
                <thead>
                  <tr className="text-xs text-ink-faint">
                    <th scope="col" className="pb-2 font-medium">Requested from supplier</th>
                    <th scope="col" className="pb-2 font-medium">Supplier declares</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line border-y border-line">
                  {requirement.quality.certifications.map((cert) => (
                    <tr key={cert}>
                      <th scope="row" className="py-2.5 pr-4 font-normal text-ink">{cert}</th>
                      <td className="py-2.5">
                        <Availability value={quote.compliance.documents.find((d) => d.name === cert)?.availability ?? "not-offered"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-ink-muted">Your requirement doesn&apos;t request specific certifications.</p>
            )}
            {quote.compliance.documents.some((d) => !requirement.quality.certifications.includes(d.name)) && (
              <p className="mt-3 text-sm text-ink-muted">
                Also offered:{" "}
                {quote.compliance.documents
                  .filter((d) => !requirement.quality.certifications.includes(d.name))
                  .map((d) => `${d.name} (${d.availability === "available" ? "available" : d.availability === "on-request" ? "on request" : "not offered"})`)
                  .join(", ")}
              </p>
            )}
            <p className="mt-3 flex gap-2 text-xs text-ink-muted">
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              Availability is declared by the supplier. XimVerse has not verified these documents.
            </p>
            <div className="mt-6">
              <FactList
                facts={[
                  { label: "Inspection", value: quote.compliance.inspection, wide: true },
                  { label: "Your inspection requirement", value: requirement.quality.inspection, wide: true },
                  { label: "Quality terms", value: quote.compliance.qualityTerms, wide: true },
                ]}
              />
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <section
            aria-labelledby="deviations"
            className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(11,46,48,0.04),0_8px_24px_rgba(11,46,48,0.05)] sm:p-6"
          >
            <h2 id="deviations" className="text-base font-semibold tracking-tight text-ink">
              Deviations from your requirement
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {deviationTotal === 0
                ? "No deviations found against your requirement."
                : `${deviationTotal} ${deviationTotal === 1 ? "deviation" : "deviations"} found.`}
            </p>
            <div className="mt-4">
              <DeviationList deviations={[...deviations].sort((a, b) => order(a.kind) - order(b.kind))} />
            </div>
            <p className="mt-4 text-xs text-ink-faint">Checked automatically against {requirement.id}.</p>
          </section>

          <Panel id="supplier" title="Supplier">
            <div className="px-5 pb-5 pt-4 sm:px-6">
              <FactList
                facts={[
                  {
                    label: "Name",
                    value: (
                      <Link href={supplierHref(s.id)} className={`rounded font-medium text-teal hover:underline ${focusRing}`}>
                        {s.name}
                      </Link>
                    ),
                    wide: true,
                  },
                  { label: "Country", value: s.country },
                  { label: "Supplier type", value: SUPPLIER_TYPE_LABEL[s.type] },
                  { label: "Years exporting", value: `${s.yearsExporting} years` },
                  { label: "Previous XimVerse transactions", value: `${s.previousTransactions} (demo)` },
                  {
                    label: "Profile",
                    value: PROFILE_STATUS_LABEL[s.profileStatus],
                    wide: true,
                  },
                ]}
              />
              <p className="mt-4 flex gap-2 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-muted">
                <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                {DEMO_DISCLAIMER}
              </p>
              <Link
                href={supplierHref(s.id)}
                className={`mt-3 inline-flex items-center gap-1 rounded text-sm font-semibold text-teal hover:underline ${focusRing}`}
              >
                View supplier profile
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function order(kind: string) {
  return kind === "deviation" ? 0 : kind === "note" ? 1 : 2;
}

function deliveryFacts(q: Quotation, r: ImportRequirement): Fact[] {
  const arrival = estimatedArrival(q);
  return [
    { label: "Origin", value: q.product.origin },
    { label: "Port of loading", value: q.delivery.portOfLoading },
    { label: "Destination", value: `${r.delivery.destinationLocation} (your requirement)` },
    { label: "Required by", value: formatDate(r.delivery.requiredBy) },
    { label: "Lead time", value: `${q.delivery.leadTimeDays} days from order confirmation` },
    { label: "Estimated readiness", value: `${formatDate(estimatedReadiness(q))}, if confirmed ${formatDate(MOCK_NOW)}` },
    {
      label: "Estimated transit",
      value: q.delivery.transitDays !== undefined ? `${q.delivery.transitDays} days (supplier estimate)` : "Not quoted — you arrange main freight",
    },
    { label: "Estimated arrival", value: arrival ? formatDate(arrival) : "Depends on the freight you arrange" },
    { label: "Shipment mode", value: [q.delivery.mode, q.delivery.shipmentNote].filter(Boolean).join(" · ") },
  ];
}

function Actions({ quote, status, open }: { quote: Quotation; status: QuotationStatus; open: boolean }) {
  const s = supplierOf(quote);
  return (
    <div className="flex flex-wrap gap-2">
      <NegotiateAction quote={quote} />
      {status === "selected" && <QuotationOrderLink quotationId={quote.id} />}
      <ShortlistToggle
        label={`${quote.id} from ${s.name}`}
        shortlisted={status === "shortlisted"}
        disabled={!open}
        onToggle={() => toggleShortlist(quote, status)}
        withText
      />
      {status === "clarification-required" || status === "not-selected" ? (
        <button
          type="button"
          disabled={!open}
          onClick={() => setQuotationStatus(quote.id, "under-review")}
          className={`${secondaryButton} h-10 px-4`}
        >
          <Undo2 aria-hidden className="size-4" />
          {status === "not-selected" ? "Reconsider" : "Mark clarification resolved"}
        </button>
      ) : null}
      {status !== "clarification-required" && (
        <button
          type="button"
          disabled={!open}
          onClick={() => setQuotationStatus(quote.id, "clarification-required")}
          className={`${secondaryButton} h-10 px-4`}
        >
          <MessageSquareWarning aria-hidden className="size-4" />
          Request Clarification
        </button>
      )}
      {status !== "not-selected" && (
        <button
          type="button"
          disabled={!open}
          onClick={() => setQuotationStatus(quote.id, "not-selected")}
          className={`${secondaryButton} h-10 px-4 enabled:hover:border-orange/40 enabled:hover:bg-orange-soft enabled:hover:text-orange`}
        >
          <ThumbsDown aria-hidden className="size-4" />
          Not Interested
        </button>
      )}
      <p className="basis-full text-xs text-ink-faint lg:text-right">
        Status changes are saved in this browser tab only. Suppliers are not notified.
      </p>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Panel id={`qt-${id}`} title={title}>
      <div className="px-5 pb-6 pt-4 sm:px-6">{children}</div>
    </Panel>
  );
}

/** Requirement vs offer, row by row; differing rows are flagged in text and colour. */
function ComparisonTable({
  rows,
}: {
  rows: { label: string; requested?: string; offered?: string; differs?: boolean }[];
}) {
  return (
    <table className="w-full table-fixed text-left text-sm">
      <caption className="sr-only">Your requirement compared with the supplier&apos;s offer</caption>
      <thead>
        <tr className="text-xs text-ink-faint">
          <th scope="col" className="w-28 pb-2 font-medium sm:w-36">
            <span className="sr-only">Item</span>
          </th>
          <th scope="col" className="pb-2 pr-3 font-medium">You requested</th>
          <th scope="col" className="pb-2 font-medium">Supplier offers</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line border-t border-line">
        {rows.map((row) => (
          <tr key={row.label} className={row.differs ? "bg-orange-soft/40" : undefined}>
            <th scope="row" className="py-3 pr-3 align-top text-xs font-medium text-ink-faint">
              {row.label}
            </th>
            <td className="break-words py-3 pr-3 align-top text-ink-muted">{row.requested ?? "—"}</td>
            <td className="break-words py-3 align-top text-ink">
              {row.offered ?? "—"}
              {row.differs && (
                <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-orange">
                  <CircleAlert aria-hidden className="size-3.5" />
                  Differs from your requirement
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

