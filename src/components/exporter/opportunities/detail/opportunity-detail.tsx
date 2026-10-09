import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { StatusPill } from "@/components/workspace/status-pill";
import { exporterHref } from "@/lib/exporter-nav";
import type { ExporterProduct } from "@/lib/exporter-products";
import {
  deadlineInfo,
  formatOpportunityQuantity,
  opportunityInsights,
  RFQ_STATUS_LABEL,
  type BuyerOpportunity,
} from "@/lib/exporter-opportunities";
import { MatchScore, OpportunityStatusPill } from "../opportunity-ui";
import { PrepareQuotationButton } from "./prepare-quotation-button";
import { DecisionPanel } from "./decision-panel";
import { ProductMatch, SumitNotes, WhyMatched } from "./match-panels";
import {
  CommercialContext,
  ComplianceRequirements,
  OpportunityTimeline,
  PackagingQuality,
  ProductRequirements,
  QuantityDelivery,
  RequirementSummary,
} from "./requirement-sections";

function DeadlineBadge({ o }: { o: BuyerOpportunity }) {
  const { urgency, label } = deadlineInfo(o);
  const text = urgency === "closed" ? "Quotations closed" : label.replace(/^Closes in/, "Quotation due in");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        urgency === "within-24h" ? "bg-orange-soft text-orange" : "bg-canvas text-ink-muted ring-1 ring-inset ring-line"
      }`}
    >
      {text}
    </span>
  );
}

/**
 * One opportunity, laid out for a quote / no-quote decision: the requirement
 * in the main column, fit and next steps alongside.
 */
export function OpportunityDetail({ o, product }: { o: BuyerOpportunity; product?: ExporterProduct }) {
  return (
    <div className="space-y-6">
      <Link
        href={exporterHref("opportunities")}
        className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-teal hover:text-ink ${focusRing}`}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to Buyer Opportunities
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-sm font-semibold text-ink">{o.rfqId}</span>
              <span className="font-mono text-xs text-ink-faint">Opportunity {o.opportunityId}</span>
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">{o.product.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {formatOpportunityQuantity(o.quantity)} · {o.delivery.destinationLocation}
              {o.delivery.incoterm && ` · ${o.delivery.incoterm.term}`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <OpportunityStatusPill status={o.status} />
              <StatusPill tone="neutral">RFQ: {RFQ_STATUS_LABEL[o.rfqStatus]}</StatusPill>
              <DeadlineBadge o={o} />
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start lg:flex-col lg:items-end">
            <MatchScore score={o.match.score} size="lg" />
            {o.status !== "quoted" && o.status !== "closed" && <PrepareQuotationButton rfqId={o.rfqId} />}
          </div>
        </div>

        <p className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-sm text-ink-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
          <span>
            <span className="font-semibold text-ink">Buyer identity protected by Ximverse.</span> You see the
            buyer&apos;s country, region, industry and requirement; company and contact details are shared at the
            appropriate stage of the transaction.
          </span>
        </p>
      </header>

      <RequirementSummary o={o} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <ProductRequirements o={o} />
          <QuantityDelivery o={o} />
          <PackagingQuality o={o} />
          <ComplianceRequirements o={o} />
          <CommercialContext o={o} />
          <OpportunityTimeline o={o} />
        </div>
        <div className="min-w-0 space-y-6">
          <ProductMatch o={o} product={product} />
          <WhyMatched o={o} />
          <SumitNotes notes={opportunityInsights(o)} />
          <DecisionPanel rfqId={o.rfqId} status={o.status} />
        </div>
      </div>
    </div>
  );
}
