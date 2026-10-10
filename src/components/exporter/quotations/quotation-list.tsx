"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, PencilLine } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { exporterHref } from "@/lib/exporter-nav";
import { UNIT_SHORT } from "@/lib/exporter-opportunities";
import { formatMoney } from "@/lib/exporter-quotations";
import type { PipelineRow } from "@/lib/exporter-quotation-pipeline";
import { QuotationStatusPill, ValidityText } from "./quotation-ui";

const th =
  "whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint first:pl-5 last:pr-4";
const td = "px-2.5 py-3.5 align-top first:pl-5 last:pr-4";

const action = `inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-teal transition-colors hover:border-teal hover:bg-teal-soft ${focusRing}`;

function savedTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(iso));
}

function hrefFor(r: PipelineRow) {
  return r.kind === "draft" ? exporterHref(`opportunities/${r.rfqId}/quote`) : exporterHref(`quotations/${r.key}`);
}

function RowAction({ r, long = false }: { r: PipelineRow; long?: boolean }) {
  return r.kind === "draft" ? (
    <Link href={hrefFor(r)} className={action} aria-label={`Continue draft for ${r.rfqId}`}>
      <PencilLine className="size-3.5" aria-hidden />
      {long ? "Continue Draft" : "Continue"}
    </Link>
  ) : (
    <Link href={hrefFor(r)} className={action} aria-label={`View quotation ${r.key}`}>
      {long ? "View Quotation" : "View"}
      {long ? <ArrowRight className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
    </Link>
  );
}

function Reference({ r }: { r: PipelineRow }) {
  return r.kind === "draft" ? (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Draft</p>
      <p className="mt-0.5 text-xs text-ink-faint">Saved {savedTime(r.activityAt)}</p>
    </>
  ) : (
    <>
      <p className="font-mono text-xs font-semibold text-ink [overflow-wrap:anywhere]">{r.key}</p>
      {r.source === "local" && <p className="mt-0.5 text-[0.6875rem] text-ink-faint">Created in this browser</p>}
    </>
  );
}

const qty = (r: PipelineRow) => (r.quantity ? `${r.quantity.amount.toLocaleString("en-US")} ${UNIT_SHORT[r.quantity.unit]}` : "—");
const unitPrice = (r: PipelineRow) =>
  r.unitMinor !== undefined && r.currency && r.quantity ? `${formatMoney(r.unitMinor, r.currency)} / ${UNIT_SHORT[r.quantity.unit]}` : "—";
const total = (r: PipelineRow) => (r.totalMinor !== undefined && r.currency ? formatMoney(r.totalMinor, r.currency) : "—");

/** The quotation pipeline: a table on wide screens, cards below that. */
export function QuotationList({ rows }: { rows: readonly PipelineRow[] }) {
  return (
    <>
      <div className="relative hidden overflow-x-auto xl:block">
        {/* Columns marked 2xl wait for room beside the sidebar; their data folds into a neighbouring cell until then. */}
        <table className="w-full text-sm">
          <thead className="border-y border-line bg-canvas/60">
            <tr>
              <th scope="col" className={th}>Quotation</th>
              <th scope="col" className={th}>Product / RFQ</th>
              <th scope="col" className={th}>Destination</th>
              <th scope="col" className={`${th} text-right!`}>Qty · Unit Price</th>
              <th scope="col" className={`${th} text-right!`}>Total</th>
              <th scope="col" className={`${th} hidden 2xl:table-cell`}>Incoterm</th>
              <th scope="col" className={th}>Validity</th>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={th}><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.key} className={`transition-colors hover:bg-canvas/50 ${r.status === "expired" || r.status === "rejected" ? "opacity-70" : ""}`}>
                <td className={td}><Reference r={r} /></td>
                <td className={`${td} max-w-44`}>
                  <p className="font-semibold text-ink">{r.productName}</p>
                  <p className="mt-0.5 font-mono text-xs text-ink-muted">{r.rfqId}</p>
                </td>
                <td className={td}>
                  <p className="whitespace-nowrap text-ink">{r.destinationCountry ?? "—"}</p>
                  <p className="mt-0.5 hidden text-xs text-ink-muted 2xl:block">{r.destinationLocation?.split(",")[0]}</p>
                  <p className="mt-0.5 text-xs text-ink-muted 2xl:hidden">{r.incoterm?.split(",")[0]}</p>
                </td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                  <p className="text-ink">{qty(r)}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{unitPrice(r)}</p>
                </td>
                <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums text-ink`}>{total(r)}</td>
                <td className={`${td} hidden 2xl:table-cell whitespace-nowrap text-ink`} title={r.incoterm}>{r.incoterm?.split(",")[0] || "—"}</td>
                <td className={td}><ValidityText validUntil={r.validUntil} status={r.status} /></td>
                <td className={td}><QuotationStatusPill status={r.status} /></td>
                <td className={`${td} text-right`}><RowAction r={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 md:grid-cols-2 xl:hidden">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-col rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Reference r={r} />
                <p className="mt-1 font-semibold text-ink">{r.productName}</p>
                <p className="font-mono text-xs text-ink-muted">{r.rfqId}</p>
              </div>
              <QuotationStatusPill status={r.status} />
            </div>
            <dl className="mb-3 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-ink-faint">Destination</dt>
                <dd className="text-ink">{r.destinationCountry ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Total</dt>
                <dd className="font-semibold tabular-nums text-ink">{total(r)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Quantity · price</dt>
                <dd className="tabular-nums text-ink">
                  {qty(r)}
                  <span className="block text-xs text-ink-muted">{unitPrice(r)}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Validity</dt>
                <dd><ValidityText validUntil={r.validUntil} status={r.status} /></dd>
              </div>
            </dl>
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
              <span className="min-w-0 truncate text-xs text-ink-muted">{r.incoterm}</span>
              <RowAction r={r} long />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
