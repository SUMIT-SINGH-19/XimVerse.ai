import Link from "next/link";
import { Panel } from "@/components/workspace/panel";
import { focusRing } from "@/components/workspace/styles";
import { QuotationStatusPill } from "@/components/exporter/quotations/quotation-ui";
import { getT } from "@/i18n/server";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDate } from "@/lib/exporter-dashboard";
import { UNIT_SHORT } from "@/lib/exporter-opportunities";
import { formatMoney } from "@/lib/exporter-quotations";
import type { PipelineRow } from "@/lib/exporter-quotation-pipeline";

const th = "whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint first:pl-6 last:pr-6";
const td = "px-3 py-3 align-top first:pl-6 last:pr-6";
/*
 * The panel is full width up to xl, two-thirds of the page from xl, and only
 * has room for the submitted date again at 2xl.
 */
const submittedCol = "hidden md:table-cell xl:hidden 2xl:table-cell";

const price = (r: PipelineRow, unit: string) =>
  r.unitMinor !== undefined && r.currency ? `${formatMoney(r.unitMinor, r.currency)} / ${unit}` : "—";
const qty = (r: PipelineRow, unit: string) => (r.quantity ? `${r.quantity.amount.toLocaleString("en-US")} ${unit}` : "");
const unitOf = (r: PipelineRow) => (r.quantity ? UNIT_SHORT[r.quantity.unit] : "");
const keyLink = `font-mono text-xs text-teal hover:text-ink ${focusRing}`;

/** Latest quotations, from the same records My Quotations shows. */
export async function RecentQuotationsPanel({ rows }: { rows: readonly PipelineRow[] }) {
  const t = await getT();

  return (
    <Panel
      title="Recent Quotations"
      action={{ label: "View All Quotations", href: exporterHref("quotations") }}
      bodyClassName="pt-4 pb-2"
    >
      {/* Tablets and up: table. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="border-y border-line bg-canvas/60">
            <tr>
              <th scope="col" className={th}>{t("Quotation")}</th>
              <th scope="col" className={`${th} text-right!`}>{t("Quoted Price / Qty")}</th>
              <th scope="col" className={`${th} ${submittedCol}`}>{t("Submitted")}</th>
              <th scope="col" className={th}>{t("Status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const unit = unitOf(r);
              return (
                <tr key={r.key} className="transition-colors hover:bg-canvas/50">
                  <td className={td}>
                    <Link href={exporterHref(`quotations/${r.key}`)} className={keyLink}>
                      {r.key}
                    </Link>
                    <p className="mt-0.5 font-semibold text-ink">{r.productName}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{r.destinationCountry}</p>
                  </td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                    <p className="font-semibold text-ink">{price(r, unit)}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{qty(r, unit)}</p>
                  </td>
                  <td className={`${td} ${submittedCol} whitespace-nowrap text-ink-muted`}>
                    {r.quotation?.submittedAt ? formatDate(r.quotation.submittedAt.slice(0, 10)) : "—"}
                  </td>
                  <td className={td}>
                    <QuotationStatusPill status={r.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phones: stacked rows. */}
      <ul className="divide-y divide-line border-t border-line sm:hidden">
        {rows.map((r) => {
          const unit = unitOf(r);
          return (
            <li key={r.key} className="px-5 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <Link href={exporterHref(`quotations/${r.key}`)} className={keyLink}>
                  {r.key}
                </Link>
                <QuotationStatusPill status={r.status} />
              </div>
              <div className="mt-1 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{r.productName}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{r.destinationCountry}</p>
                </div>
                <div className="shrink-0 text-right text-sm tabular-nums">
                  <p className="font-semibold text-ink">{price(r, unit)}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{qty(r, unit)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
