"use client";

import Link from "next/link";
import { ArrowLeft, Ban, CircleCheck, Hourglass, Lock, MessageSquareWarning, PartyPopper, Scale, Star } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { Field, FieldGrid, ProfileSection } from "@/components/exporter/company/profile-ui";
import { SeverityBadge } from "@/components/exporter/quote/form-ui";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDate } from "@/lib/exporter-dashboard";
import { findOpportunity, formatDateTime, PAYMENT_TERM_LABEL, shortCountry, UNIT_SHORT } from "@/lib/exporter-opportunities";
import {
  COMPLIANCE_RESPONSE_LABEL,
  COST_COVERAGE_LABEL,
  formatMoney,
  LOCAL_QUOTATION_ID,
  SEVERITY_ORDER,
  validityLabel,
  type ExporterQuotation,
} from "@/lib/exporter-quotations";
import { useIsClient, useStoredQuotations } from "@/lib/exporter-quotation-store";
import { useExporterNegotiations } from "@/lib/exporter-negotiation-store";
import {
  buyerLatestOffer,
  formatOfferPrice,
  negotiationForQuotation,
  yourCurrentOffer,
  type ExporterNegotiation,
} from "@/lib/exporter-negotiations";
import { presentedStatus } from "@/lib/exporter-quotation-pipeline";
import { QuotationStatusPill } from "./quotation-ui";

const money = (amount: number, q: ExporterQuotation) => formatMoney(Math.round(amount * 100), q.price.currency);

const disabledAction = "inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink-faint";
const linkAction = `inline-flex h-10 items-center gap-2 rounded-lg bg-orange px-4 text-sm font-semibold text-on-brand shadow-sm shadow-orange/20 transition hover:brightness-95 ${focusRing}`;

function Banner({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "positive" | "attention" | "neutral";
  icon: typeof CircleCheck;
  title: string;
  children?: React.ReactNode;
}) {
  const cls = {
    positive: "border-teal/25 bg-teal-soft",
    attention: "border-orange/25 bg-orange-soft",
    neutral: "border-line bg-surface",
  }[tone];
  const iconCls = { positive: "text-teal", attention: "text-orange", neutral: "text-ink-muted" }[tone];
  return (
    <section className={`rounded-2xl border p-5 ${cls}`}>
      <p className="flex items-center gap-2 font-semibold text-ink">
        <Icon className={`size-5 ${iconCls}`} aria-hidden />
        {title}
      </p>
      {children && <div className="mt-2 space-y-3 text-sm text-ink">{children}</div>}
    </section>
  );
}

/** What the current status means and what (if anything) the exporter can do next. */
function StatusContext({ q, negotiation }: { q: ExporterQuotation; negotiation?: ExporterNegotiation }) {
  const status = presentedStatus(q, negotiation);
  const f = q.feedback;
  const buyer = negotiation && buyerLatestOffer(negotiation);
  const yours = negotiation && yourCurrentOffer(negotiation);
  const negHref = negotiation ? exporterHref(`negotiations/${negotiation.id}`) : undefined;
  const unit = UNIT_SHORT[q.price.pricingUnit];
  switch (status) {
    case "submitted":
      return (
        <Banner tone="neutral" icon={Hourglass} title="Submitted">
          <p>
            {LOCAL_QUOTATION_ID.test(q.id)
              ? "Demo submission stored in this browser. Backend buyer delivery will be connected later."
              : "Awaiting review by Ximverse and the buyer."}
          </p>
        </Banner>
      );
    case "under-review":
      return <Banner tone="neutral" icon={Hourglass} title="Under review"><p>Ximverse and the buyer are reviewing your offer.</p></Banner>;
    case "shortlisted":
      return (
        <Banner tone="positive" icon={Star} title="Shortlisted">
          <p>Your offer has moved to the buyer&apos;s shortlist. No decision has been made yet.</p>
        </Banner>
      );
    case "revision-requested":
      return (
        <Banner tone="attention" icon={MessageSquareWarning} title="Buyer / Ximverse requested changes">
          {f && <p className="rounded-lg bg-surface px-3 py-2">“{f.message}”</p>}
          <p className="text-xs text-ink-muted">This quotation stays as submitted; revised terms are sent through the negotiation.</p>
          {negHref && (
            <Link href={negHref} className={linkAction}>
              Review Revision Request
            </Link>
          )}
        </Banner>
      );
    case "negotiation":
      return (
        <Banner tone="attention" icon={Scale} title="Negotiation in progress">
          {(buyer || f?.counterOffer) && (
            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-surface px-3 py-2">
              <div>
                <dt className="text-xs text-ink-muted">Buyer latest</dt>
                <dd className="font-semibold tabular-nums">
                  {buyer ? formatOfferPrice(buyer) : `${formatMoney(Math.round(f!.counterOffer!.unitPrice * 100), f!.counterOffer!.currency)} / ${unit}`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Your current offer</dt>
                <dd className="font-semibold tabular-nums">{yours ? formatOfferPrice(yours) : `${money(q.price.unitPrice, q)} / ${unit}`}</dd>
              </div>
            </dl>
          )}
          <p className="text-xs text-ink-muted">The submitted quotation below is unchanged; offers move in the negotiation.</p>
          {negHref && (
            <Link href={negHref} className={linkAction}>
              Open Negotiation
            </Link>
          )}
        </Banner>
      );
    case "accepted":
      return (
        <Banner tone="positive" icon={PartyPopper} title="Offer Accepted">
          <p>
            {negotiation
              ? `Agreed through negotiation at ${formatOfferPrice(yours!)}.`
              : (f?.message ?? "The buyer selected your offer.")}{" "}
            This quotation is ready to become a deal and order.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled className={disabledAction}>Deal setup coming next</button>
            {negHref && (
              <Link href={negHref} className={`text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
                View agreement
              </Link>
            )}
          </div>
        </Banner>
      );
    case "rejected":
      return (
        <Banner tone="neutral" icon={Ban} title="Not Selected">
          {f?.reason && <p>Reason: {f.reason}</p>}
          <p className="text-xs text-ink-muted">Other exporters&apos; offers are never shared.</p>
        </Banner>
      );
    case "expired":
      return (
        <Banner tone="neutral" icon={Ban} title={`Expired ${formatDate(q.commercial.validUntil)}`}>
          <p>The offer is no longer valid, so no further actions are available.</p>
        </Banner>
      );
    default:
      return null;
  }
}

export function QuotationDetail({ q }: { q: ExporterQuotation }) {
  const o = findOpportunity(q.requirementId);
  const negotiation = negotiationForQuotation(q.id, useExporterNegotiations());
  const status = presentedStatus(q, negotiation);
  const validity = validityLabel(q);
  const unit = UNIT_SHORT[q.price.pricingUnit];
  const deviations = q.deviations.toSorted((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const late = o && q.delivery.estimatedDelivery > o.delivery.requiredBy;

  return (
    <div className="space-y-6">
      <Link href={exporterHref("quotations")} className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to My Quotations
      </Link>

      <header className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-ink [overflow-wrap:anywhere]">{q.id}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">{o?.product.name ?? "Quotation"}</h1>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted">
            {o ? (
              <Link href={exporterHref(`opportunities/${q.requirementId}`)} className={`font-mono text-teal hover:text-ink ${focusRing}`}>
                {q.requirementId}
              </Link>
            ) : (
              <span className="font-mono">{q.requirementId}</span>
            )}
            <span className="font-mono text-ink-faint">Opportunity {q.opportunityId}</span>
            {o && <span>{o.delivery.destinationLocation}</span>}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <QuotationStatusPill status={status} />
            <span className={`text-sm ${validity.urgent ? "font-semibold text-orange" : "text-ink-muted"}`}>{validity.label}</span>
          </div>
        </div>
        <div className="lg:text-right">
          <p className="text-xs text-ink-faint">Total</p>
          <p className="text-3xl font-bold tracking-tight tabular-nums text-ink">{money(q.price.total, q)}</p>
          <p className="text-sm text-ink-muted tabular-nums">
            {q.product.quantity.amount.toLocaleString("en-US")} {unit} × {money(q.price.unitPrice, q)} / {unit}
          </p>
        </div>
      </header>

      <StatusContext q={q} negotiation={negotiation} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <ProfileSection id="offer" title="Offer" editable={false}>
            <FieldGrid>
              <Field label="Product" wide>
                {o?.product.name}
                <span className="block text-xs text-ink-muted">{q.product.description}</span>
              </Field>
              <Field label="Quantity">{q.product.quantity.amount.toLocaleString("en-US")} {unit}</Field>
              <Field label="Specification">{q.product.specificationAsRequested ? "As requested" : "Differs — see notes"}</Field>
              <Field label="Unit Price">{money(q.price.unitPrice, q)} / {unit}</Field>
              <Field label="Currency">{q.price.currency}</Field>
              <Field label="Total">{money(q.price.total, q)}</Field>
              <Field label="Origin">{q.product.origin}</Field>
            </FieldGrid>
          </ProfileSection>

          <ProfileSection id="logistics" title="Incoterm & Delivery" editable={false}>
            <FieldGrid>
              <Field label="Incoterm">{q.price.incoterm}</Field>
              <Field label="Named Place">{q.price.namedPlace}</Field>
              <Field label="Freight">{COST_COVERAGE_LABEL[q.costCoverage.freight]}</Field>
              <Field label="Insurance">{COST_COVERAGE_LABEL[q.costCoverage.insurance]}</Field>
              <Field label="Port of Loading">{q.delivery.portOfLoading} · {q.delivery.mode}</Field>
              <Field label="Lead Time">{q.delivery.leadTimeDays} days</Field>
              <Field label="Earliest Dispatch">{formatDate(q.delivery.earliestDispatch)}</Field>
              <Field label="Estimated Delivery">
                <span className={late ? "font-semibold text-orange" : undefined}>{formatDate(q.delivery.estimatedDelivery)}</span>
                {o && <span className="block text-xs text-ink-muted">Buyer needs by {formatDate(o.delivery.requiredBy)}</span>}
              </Field>
            </FieldGrid>
          </ProfileSection>

          <ProfileSection id="terms" title="Packaging, Payment & Validity" editable={false}>
            <FieldGrid>
              <Field label="Packaging" wide>
                {q.product.packaging}
                <span className="block text-xs text-ink-muted">{q.product.packagingAsRequested ? "As requested" : "Differs from request"}</span>
              </Field>
              {q.product.privateLabel !== undefined && <Field label="Private Label">{q.product.privateLabel ? "Available" : "Not available"}</Field>}
              <Field label="Payment Term">
                {q.commercial.paymentSummary || PAYMENT_TERM_LABEL[q.commercial.paymentTerm]}
              </Field>
              <Field label="Valid Until">{formatDate(q.commercial.validUntil)}</Field>
            </FieldGrid>
          </ProfileSection>

          <ProfileSection id="compliance" title="Compliance Responses" editable={false}>
            {q.compliance.documents.length ? (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {q.compliance.documents.map((d) => (
                  <li key={d.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="font-medium text-ink">{d.name}</span>
                    <span className={d.response === "cannot-provide" ? "font-semibold text-orange" : "text-ink-muted"}>
                      {COMPLIANCE_RESPONSE_LABEL[d.response]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-faint">No shipment documents were requested.</p>
            )}
            {q.compliance.inspection && (
              <p className="mt-3 text-sm text-ink-muted">
                Inspection ({q.compliance.inspection}): <span className="font-medium text-ink">{q.compliance.inspectionAccepted ? "Accepted" : "Not accepted"}</span>
              </p>
            )}
          </ProfileSection>

          <ProfileSection id="notes" title="Notes to Buyer" editable={false}>
            <p className="whitespace-pre-line text-sm text-ink">{q.commercial.notes || "None."}</p>
          </ProfileSection>
        </div>

        <div className="min-w-0 space-y-6">
          <section aria-labelledby="deviations-heading" className="rounded-2xl border border-line bg-surface p-5">
            <h2 id="deviations-heading" className="text-base font-semibold tracking-tight text-ink">
              {deviations.length} {deviations.length === 1 ? "Deviation" : "Deviations"}
            </h2>
            {deviations.length ? (
              <ul className="mt-3 space-y-3">
                {deviations.map((d) => (
                  <li key={d.id} className="rounded-xl bg-canvas p-3 text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={d.severity} />
                      <span className="font-medium text-ink">{d.message}</span>
                    </span>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                      <dt className="text-ink-faint">Buyer requested</dt>
                      <dd className="text-ink">{d.buyerRequirement}</dd>
                      <dt className="text-ink-faint">You offered</dt>
                      <dd className="text-ink">{d.exporterOffer}</dd>
                    </dl>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 flex items-center gap-2 text-sm text-teal">
                <CircleCheck className="size-4" aria-hidden />
                Offer matched every stated requirement.
              </p>
            )}
          </section>

          {o && (
            <section aria-labelledby="buyer-heading" className="rounded-2xl border border-line bg-surface p-5">
              <h2 id="buyer-heading" className="text-base font-semibold tracking-tight text-ink">Buyer Market</h2>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Region</dt><dd className="text-ink">{o.buyer.region}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Country</dt><dd className="text-ink">{shortCountry(o.buyer.country)}</dd></div>
                {o.buyer.industry && <div className="flex justify-between gap-3"><dt className="text-ink-muted">Industry</dt><dd className="text-right text-ink">{o.buyer.industry}</dd></div>}
              </dl>
              <p className="mt-3 text-xs text-ink-faint">Buyer identity stays protected by Ximverse.</p>
            </section>
          )}

          <section aria-labelledby="history-heading" className="rounded-2xl border border-line bg-surface p-5">
            <h2 id="history-heading" className="text-base font-semibold tracking-tight text-ink">History</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Created</dt><dd className="text-right text-ink">{formatDateTime(q.createdAt)}</dd></div>
              {q.submittedAt && <div className="flex justify-between gap-3"><dt className="text-ink-muted">Submitted</dt><dd className="text-right text-ink">{formatDateTime(q.submittedAt)}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Updated</dt><dd className="text-right text-ink">{formatDateTime(q.updatedAt)}</dd></div>
              {q.feedback && <div className="flex justify-between gap-3"><dt className="text-ink-muted">Latest feedback</dt><dd className="text-right text-ink">{formatDateTime(q.feedback.at)}</dd></div>}
            </dl>
            <p className="mt-3 text-xs text-ink-faint">Quoted as {q.exporterCompanyId}</p>
          </section>

          {q.internalNote && (
            <section aria-labelledby="internal-heading" className="rounded-2xl border border-dashed border-line p-5">
              <h2 id="internal-heading" className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Lock className="size-4 text-ink-faint" aria-hidden />
                Internal Note
              </h2>
              <p className="mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-muted">PRIVATE — only visible to your team</p>
              <p className="mt-2 text-sm text-ink">{q.internalNote}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** For browser-created quotations: looks the ID up in this browser's store. */
export function LocalQuotationDetail({ id }: { id: string }) {
  const isClient = useIsClient();
  const q = useStoredQuotations().find((x) => x.id === id);
  if (!isClient) return <p className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-sm text-ink-muted">Loading quotation…</p>;
  if (!q) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <p className="font-semibold text-ink">Quotation {id} isn&apos;t stored in this browser</p>
        <p className="mt-1 text-sm text-ink-muted">Demo quotations live in the browser where they were submitted.</p>
        <Link href={exporterHref("quotations")} className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to My Quotations
        </Link>
      </div>
    );
  }
  return <QuotationDetail q={q} />;
}
