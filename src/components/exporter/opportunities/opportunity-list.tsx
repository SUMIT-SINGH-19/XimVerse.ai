"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronRight, CornerDownRight, MapPin, Scale } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { formatDate } from "@/lib/exporter-dashboard";
import { exporterHref } from "@/lib/exporter-nav";
import type { ProductSummary } from "@/lib/exporter-products";
import {
  formatIncoterm,
  formatOpportunityQuantity,
  opportunitySlug,
  shortCountry,
  type BuyerOpportunity,
} from "@/lib/exporter-opportunities";
import { DeadlineLabel, MatchScore, OpportunityStatusPill } from "./opportunity-ui";

const th =
  "whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint first:pl-6 last:pr-6";
const td = "px-3 py-3.5 align-top first:pl-6 last:pr-6";

/** The catalogue product behind a match, as a compact reference. */
function MatchedProduct({ product }: { product?: ProductSummary }) {
  if (!product) return null;
  return (
    <span className="mt-1.5 inline-flex max-w-full items-center gap-1 text-xs text-ink-muted" title={`Matched with ${product.name}`}>
      <CornerDownRight className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
      <span className="sr-only">Matched catalogue product</span>
      <span className="truncate rounded bg-teal-soft px-1.5 py-0.5 font-mono text-[0.6875rem] text-teal">
        {product.productCode}
      </span>
    </span>
  );
}

const dueDate = (o: BuyerOpportunity) => formatDate(o.quotesDueAt.slice(0, 10));

const detailHref = (o: BuyerOpportunity) => exporterHref(`opportunities/${opportunitySlug(o)}`);

/** The feed: a table on wide screens, cards below that. Each opens the detail page. */
export function OpportunityList({
  opportunities,
  productsById,
}: {
  opportunities: readonly BuyerOpportunity[];
  productsById: ReadonlyMap<string, ProductSummary>;
}) {
  return (
    <>
      <div className="relative hidden overflow-x-auto xl:block">
        {/* Columns marked 2xl wait for room beside the sidebar; their data folds into a neighbouring cell until then. */}
        <table className="w-full text-sm">
          <thead className="border-y border-line bg-canvas/60">
            <tr>
              <th scope="col" className={th}>Opportunity</th>
              <th scope="col" className={th}>Product</th>
              <th scope="col" className={th}>Destination</th>
              <th scope="col" className={`${th} text-right!`}>Quantity</th>
              <th scope="col" className={`${th} hidden 2xl:table-cell`}>Incoterm</th>
              <th scope="col" className={th}>Deadline</th>
              <th scope="col" className={th}>Match</th>
              <th scope="col" className={th}><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {opportunities.map((o) => (
              <tr key={o.rfqId} className={`transition-colors hover:bg-canvas/50 ${o.status === "closed" ? "opacity-60" : ""}`}>
                <td className={td}>
                  <p className="whitespace-nowrap font-mono text-xs text-ink-muted">{o.rfqId}</p>
                  <p className="mt-1.5">
                    <OpportunityStatusPill status={o.status} />
                  </p>
                </td>
                <td className={`${td} max-w-72`}>
                  <p className="font-semibold text-ink">{o.product.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{o.product.specification}</p>
                  <MatchedProduct product={productsById.get(o.match.matchedProductId)} />
                </td>
                <td className={td}>
                  <p className="whitespace-nowrap text-ink">{shortCountry(o.delivery.destinationCountry)}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{o.buyer.region}</p>
                  <p className="mt-0.5 text-xs text-ink-muted 2xl:hidden">{formatIncoterm(o.delivery)}</p>
                </td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums text-ink`}>
                  {formatOpportunityQuantity(o.quantity)}
                </td>
                <td className={`${td} hidden 2xl:table-cell whitespace-nowrap text-ink`}>{formatIncoterm(o.delivery)}</td>
                <td className={td}>
                  <p className="whitespace-nowrap text-ink">{dueDate(o)}</p>
                  <p className="mt-0.5">
                    <DeadlineLabel opportunity={o} />
                  </p>
                </td>
                <td className={td}><MatchScore score={o.match.score} /></td>
                <td className={`${td} text-right`}>
                  <Link
                    href={detailHref(o)}
                    aria-label={`View opportunity ${o.rfqId}`}
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-teal transition-colors hover:border-teal hover:bg-teal-soft ${focusRing}`}
                  >
                    View
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 md:grid-cols-2 xl:hidden">
        {opportunities.map((o) => (
          <li
            key={o.rfqId}
            className={`flex flex-col rounded-xl border border-line bg-surface p-4 ${o.status === "closed" ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-ink-muted">{o.rfqId}</p>
                <p className="mt-0.5 font-semibold text-ink">{o.product.name}</p>
                <MatchedProduct product={productsById.get(o.match.matchedProductId)} />
              </div>
              <OpportunityStatusPill status={o.status} />
            </div>

            <dl className="mb-3 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="sr-only">Destination</dt>
                <dd className="flex items-center gap-1.5 text-ink">
                  <MapPin className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
                  {shortCountry(o.delivery.destinationCountry)}
                </dd>
              </div>
              <div>
                <dt className="sr-only">Quantity</dt>
                <dd className="flex items-center gap-1.5 text-ink">
                  <Scale className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
                  {formatOpportunityQuantity(o.quantity)}
                </dd>
              </div>
              <div>
                <dt className="sr-only">Quotation deadline</dt>
                <dd className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-ink">
                    <CalendarDays className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
                    {dueDate(o)}
                  </span>
                  <DeadlineLabel opportunity={o} />
                </dd>
              </div>
              <div>
                <dt className="sr-only">Incoterm</dt>
                <dd className="text-ink">{formatIncoterm(o.delivery)}</dd>
              </div>
            </dl>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <MatchScore score={o.match.score} />
              <Link
                href={detailHref(o)}
                aria-label={`View opportunity ${o.rfqId}`}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-teal transition-colors hover:border-teal hover:bg-teal-soft ${focusRing}`}
              >
                View Opportunity
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
