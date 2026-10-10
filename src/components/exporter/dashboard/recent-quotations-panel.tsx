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

const th = "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint first:pl-6 last:pr-6";
const td = "whitespace-nowrap px-4 py-3 first:pl-6 last:pr-6";

/** Latest quotations, from the same records My Quotations shows. */
export async function RecentQuotationsPanel({ rows }: { rows: readonly PipelineRow[] }) {
  const t = await getT();

  return (
    <Panel
      title="Recent Quotations"
      action={{ label: "View All Quotations", href: exporterHref("quotations") }}
      bodyClassName="pt-4 pb-2"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="border-y border-line bg-canvas/60">
            <tr>
              <th scope="col" className={th}>{t("Quotation")}</th>
              <th scope="col" className={th}>{t("Product / Destination")}</th>
              <th scope="col" className={`${th} text-right!`}>{t("Quoted Price / Qty")}</th>
              <th scope="col" className={th}>{t("Submitted")}</th>
              <th scope="col" className={th}>{t("Status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const unit = r.quantity ? UNIT_SHORT[r.quantity.unit] : "";
              return (
                <tr key={r.key} className="transition-colors hover:bg-canvas/50">
                  <td className={td}>
                    <Link href={exporterHref(`quotations/${r.key}`)} className={`font-mono text-xs text-teal hover:text-ink ${focusRing}`}>
                      {r.key}
                    </Link>
                  </td>
                  <td className={td}>
                    <p className="font-semibold text-ink">{r.productName}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{r.destinationCountry}</p>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>
                    <p className="font-semibold text-ink">
                      {r.unitMinor !== undefined && r.currency ? `${formatMoney(r.unitMinor, r.currency)} / ${unit}` : "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">{r.quantity ? `${r.quantity.amount.toLocaleString("en-US")} ${unit}` : ""}</p>
                  </td>
                  <td className={`${td} text-ink-muted`}>
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
    </Panel>
  );
}
