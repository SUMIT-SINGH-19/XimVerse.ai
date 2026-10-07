import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { Panel } from "@/components/workspace/panel";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { focusRing } from "@/components/workspace/styles";
import { exporterHref } from "@/lib/exporter-nav";
import {
  formatDate,
  formatQuantity,
  OPPORTUNITY_STATUS_LABEL,
  type BuyerOpportunity,
  type OpportunityStatus,
} from "@/lib/exporter-dashboard";

const STATUS_TONE: Record<OpportunityStatus, PillTone> = {
  new: "accent",
  viewed: "neutral",
  quoted: "brand",
};

// Opportunity detail pages don't exist yet; every action lands on the list.
const opportunityHref = exporterHref("opportunities");

function MatchScore({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span
        role="meter"
        aria-label="Match score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        className="h-1.5 w-12 overflow-hidden rounded-full bg-teal-soft"
      >
        <span className="block h-full rounded-full bg-teal" style={{ width: `${score}%` }} />
      </span>
      <span className="whitespace-nowrap text-sm font-semibold text-teal">{score}% Match</span>
    </div>
  );
}

function ViewLink({ rfqId, className = "" }: { rfqId: string; className?: string }) {
  return (
    <Link
      href={opportunityHref}
      aria-label={`View opportunity ${rfqId}`}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-teal transition-colors hover:border-teal hover:bg-teal-soft ${focusRing} ${className}`}
    >
      View Opportunity
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

const th =
  "whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint first:pl-6 last:pr-6";
const td = "px-3 py-3.5 align-middle first:pl-6 last:pr-6";

/**
 * Buyer demand matched to this exporter. Rows carry no buyer identity — see
 * BuyerOpportunity for why.
 */
export function OpportunitiesPanel({ opportunities }: { opportunities: readonly BuyerOpportunity[] }) {
  return (
    <Panel
      title="Buyer Opportunities"
      description="Buyer requirements matched with your products and export capabilities."
      action={{ label: "View all", href: opportunityHref }}
      bodyClassName="pt-4 pb-2"
    >
      {/* Wide screens: table. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="border-y border-line bg-canvas/60">
            <tr>
              <th scope="col" className={th}>RFQ / Status</th>
              <th scope="col" className={th}>Product</th>
              <th scope="col" className={th}>Destination</th>
              <th scope="col" className={th}>Quantity</th>
              <th scope="col" className={th}>Incoterm</th>
              <th scope="col" className={th}>Required By</th>
              <th scope="col" className={th}>Match</th>
              <th scope="col" className={th}><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {opportunities.map((o) => (
              <tr key={o.rfqId} className="transition-colors hover:bg-canvas/50">
                <td className={td}>
                  <p className="whitespace-nowrap font-mono text-xs text-ink-muted">{o.rfqId}</p>
                  <p className="mt-1.5">
                    <StatusPill tone={STATUS_TONE[o.status]}>{OPPORTUNITY_STATUS_LABEL[o.status]}</StatusPill>
                  </p>
                </td>
                <td className={`${td} min-w-44`}>
                  <p className="font-semibold text-ink">{o.product}</p>
                  {o.specification && <p className="mt-0.5 text-xs text-ink-muted">{o.specification}</p>}
                </td>
                <td className={`${td} whitespace-nowrap text-ink`}>{o.buyerCountry}</td>
                <td className={`${td} whitespace-nowrap text-ink`}>{formatQuantity(o.quantity)}</td>
                <td className={`${td} whitespace-nowrap text-ink`}>
                  <span className="font-semibold">{o.incoterm.term}</span> {o.incoterm.place}
                </td>
                <td className={`${td} whitespace-nowrap text-ink`}>{formatDate(o.requiredBy)}</td>
                <td className={td}><MatchScore score={o.matchScore} /></td>
                <td className={`${td} text-right`}><ViewLink rfqId={o.rfqId} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Small screens: stacked cards. */}
      <ul className="divide-y divide-line border-t border-line md:hidden">
        {opportunities.map((o) => (
          <li key={o.rfqId} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-ink-muted">{o.rfqId}</p>
                <p className="mt-0.5 font-semibold text-ink">{o.product}</p>
              </div>
              <StatusPill tone={STATUS_TONE[o.status]}>{OPPORTUNITY_STATUS_LABEL[o.status]}</StatusPill>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="sr-only">Destination</dt>
                <dd className="flex items-center gap-1.5 text-ink">
                  <MapPin className="size-3.5 text-ink-faint" aria-hidden />
                  {o.buyerCountry}
                </dd>
              </div>
              <div>
                <dt className="sr-only">Required by</dt>
                <dd className="flex items-center gap-1.5 text-ink">
                  <CalendarDays className="size-3.5 text-ink-faint" aria-hidden />
                  {formatDate(o.requiredBy)}
                </dd>
              </div>
              <div>
                <dt className="sr-only">Quantity</dt>
                <dd className="text-ink">{formatQuantity(o.quantity)}</dd>
              </div>
              <div>
                <dt className="sr-only">Incoterm</dt>
                <dd className="text-ink">
                  <span className="font-semibold">{o.incoterm.term}</span> {o.incoterm.place}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-3">
              <MatchScore score={o.matchScore} />
              <ViewLink rfqId={o.rfqId} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
