import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { Panel } from "@/components/workspace/panel";
import { focusRing } from "@/components/workspace/styles";
import { MatchScore, OpportunityStatusPill } from "@/components/exporter/opportunities/opportunity-ui";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n/translate";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDate } from "@/lib/exporter-dashboard";
import {
  formatIncoterm,
  formatOpportunityQuantity,
  shortCountry,
  type BuyerOpportunity,
} from "@/lib/exporter-opportunities";

const listHref = exporterHref("opportunities");

function ViewLink({
  rfqId,
  t,
  short = false,
}: {
  rfqId: string;
  t: Translate;
  /** "View" until 2xl, where the table has room for the full label. */
  short?: boolean;
}) {
  return (
    <Link
      href={exporterHref(`opportunities/${rfqId}`)}
      aria-label={t("View opportunity {id}", { id: rfqId })}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-teal transition-colors hover:border-teal hover:bg-teal-soft ${focusRing}`}
    >
      {short ? (
        <>
          <span className="2xl:hidden">{t("View")}</span>
          <span className="hidden 2xl:inline">{t("View Opportunity")}</span>
        </>
      ) : (
        t("View Opportunity")
      )}
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
export async function OpportunitiesPanel({ opportunities }: { opportunities: readonly BuyerOpportunity[] }) {
  const t = await getT();

  return (
    <Panel
      title="Buyer Opportunities"
      description="Buyer requirements matched with your products and export capabilities."
      action={{ label: "View all", href: listHref }}
      bodyClassName="pt-4 pb-2"
    >
      {/* Wide screens: table. Destination folds into the Incoterm column until 2xl. */}
      <div className="relative hidden overflow-x-auto xl:block">
        <table className="w-full text-sm">
          <thead className="border-y border-line bg-canvas/60">
            <tr>
              <th scope="col" className={th}>{t("RFQ / Status")}</th>
              <th scope="col" className={th}>{t("Product")}</th>
              <th scope="col" className={`${th} hidden 2xl:table-cell`}>{t("Destination")}</th>
              <th scope="col" className={th}>{t("Quantity")}</th>
              <th scope="col" className={th}>{t("Incoterm")}</th>
              <th scope="col" className={th}>{t("Required By")}</th>
              <th scope="col" className={th}>{t("Match")}</th>
              <th scope="col" className={th}><span className="sr-only">{t("Action")}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {opportunities.map((o) => (
              <tr key={o.rfqId} className="transition-colors hover:bg-canvas/50">
                <td className={td}>
                  <p className="whitespace-nowrap font-mono text-xs text-ink-muted">{o.rfqId}</p>
                  <p className="mt-1.5">
                    <OpportunityStatusPill status={o.status} />
                  </p>
                </td>
                <td className={`${td} min-w-44 max-w-64`}>
                  <p className="font-semibold text-ink">{o.product.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{o.product.specification}</p>
                </td>
                <td className={`${td} hidden whitespace-nowrap text-ink 2xl:table-cell`}>{shortCountry(o.delivery.destinationCountry)}</td>
                <td className={`${td} whitespace-nowrap text-ink`}>{formatOpportunityQuantity(o.quantity)}</td>
                <td className={`${td} min-w-36 text-ink`}>{formatIncoterm(o.delivery)}</td>
                <td className={`${td} whitespace-nowrap text-ink`}>{formatDate(o.delivery.requiredBy)}</td>
                <td className={td}><MatchScore score={o.match.score} /></td>
                <td className={`${td} text-right`}><ViewLink rfqId={o.rfqId} t={t} short /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones and tablets: stacked cards. */}
      <ul className="divide-y divide-line border-t border-line xl:hidden">
        {opportunities.map((o) => (
          <li key={o.rfqId} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-ink-muted">{o.rfqId}</p>
                <p className="mt-0.5 font-semibold text-ink">{o.product.name}</p>
              </div>
              <OpportunityStatusPill status={o.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
              <div>
                <dt className="sr-only">{t("Destination")}</dt>
                <dd className="flex items-center gap-1.5 text-ink">
                  <MapPin className="size-3.5 text-ink-faint" aria-hidden />
                  {shortCountry(o.delivery.destinationCountry)}
                </dd>
              </div>
              <div>
                <dt className="sr-only">{t("Required By")}</dt>
                <dd className="flex items-center gap-1.5 text-ink">
                  <CalendarDays className="size-3.5 text-ink-faint" aria-hidden />
                  {formatDate(o.delivery.requiredBy)}
                </dd>
              </div>
              <div>
                <dt className="sr-only">{t("Quantity")}</dt>
                <dd className="text-ink">{formatOpportunityQuantity(o.quantity)}</dd>
              </div>
              <div>
                <dt className="sr-only">{t("Incoterm")}</dt>
                <dd className="text-ink">{formatIncoterm(o.delivery)}</dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-3">
              <MatchScore score={o.match.score} />
              <ViewLink rfqId={o.rfqId} t={t} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
