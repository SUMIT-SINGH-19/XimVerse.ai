import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { DeadlineLabel, MatchScore } from "@/components/exporter/opportunities/opportunity-ui";
import { QuoteWorkspace } from "@/components/exporter/quote/quote-workspace";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDate } from "@/lib/exporter-dashboard";
import { EXPORTER_PRODUCTS, toProductSummary } from "@/lib/exporter-products";
import {
  BUYER_OPPORTUNITIES,
  findOpportunity,
  formatDateTime,
  formatIncoterm,
  formatOpportunityQuantity,
  opportunitySlug,
  PAYMENT_TERM_LABEL,
  UNIT_SHORT,
  type BuyerOpportunity,
} from "@/lib/exporter-opportunities";

export const dynamicParams = false;

export function generateStaticParams() {
  return BUYER_OPPORTUNITIES.map((o) => ({ id: opportunitySlug(o) }));
}

export async function generateMetadata({ params }: PageProps<"/exporter/opportunities/[id]/quote">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Prepare Quotation · ${findOpportunity(id)?.rfqId ?? "Opportunity"}` };
}

/** The buyer's requirement, locked: the quotation can't change the RFQ. */
function BuyerRequirement({ o }: { o: BuyerOpportunity }) {
  const facts = [
    ["Product", o.product.name],
    ["Requested Quantity", formatOpportunityQuantity(o.quantity)],
    [
      "Minimum Acceptable",
      o.quantity.minimumAcceptable !== undefined
        ? `${o.quantity.minimumAcceptable.toLocaleString("en-US")} ${UNIT_SHORT[o.quantity.unit]}`
        : "Full quantity",
    ],
    ["Destination", o.delivery.destinationLocation],
    ["Requested Incoterm", formatIncoterm(o.delivery)],
    ["Required By", formatDate(o.delivery.requiredBy)],
    ["Payment Preference", o.commercial.paymentNotes ?? (o.commercial.paymentTerms ? PAYMENT_TERM_LABEL[o.commercial.paymentTerms] : "—")],
    ["Buyer Market", `${o.buyer.region} · ${o.buyer.country}`],
  ];
  return (
    <section aria-labelledby="buyer-req-heading" className="rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
        <h2 id="buyer-req-heading" className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Buyer Requirement
        </h2>
        <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
          <Lock className="size-3.5" aria-hidden />
          Read-only — from the RFQ
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0 bg-surface px-5 py-3">
            <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-faint">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-ink [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function PrepareQuotationPage({ params }: PageProps<"/exporter/opportunities/[id]/quote">) {
  const { id } = await params;
  const o = findOpportunity(id);
  if (!o) notFound();

  const product = EXPORTER_PRODUCTS.find((p) => p.id === o.match.matchedProductId);

  return (
    <div className="space-y-6">
      <Link
        href={exporterHref(`opportunities/${opportunitySlug(o)}`)}
        className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-teal hover:text-ink ${focusRing}`}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to Opportunity
      </Link>

      <header className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange">Prepare Quotation</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">{o.product.name}</h1>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-sm font-semibold text-ink">{o.rfqId}</span>
            <span className="font-mono text-xs text-ink-faint">Opportunity {o.opportunityId}</span>
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            {o.delivery.destinationLocation} · Quotation due {formatDateTime(o.quotesDueAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <DeadlineLabel opportunity={o} />
          <MatchScore score={o.match.score} size="lg" />
        </div>
      </header>

      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
        Linked to the buyer through the RFQ and opportunity only — buyer identity stays protected by Ximverse.
      </p>

      <QuoteWorkspace
        o={o}
        product={product ? toProductSummary(product) : undefined}
        requirementPanel={<BuyerRequirement o={o} />}
      />
    </div>
  );
}
