"use client";

import { ChevronRight, Clock, Package } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { formatQuantity } from "@/lib/exporter-dashboard";
import type { ExporterProduct } from "@/lib/exporter-products";
import { ProductStatusPill, ReadinessScore } from "./product-ui";

const th =
  "whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint first:pl-6 last:pr-6";
const td = "px-3 py-3.5 align-middle first:pl-6 last:pr-6";

function leadTime(p: ExporterProduct) {
  return `${p.supply.leadTimeDays.min}–${p.supply.leadTimeDays.max} days`;
}

function DemoTag() {
  return (
    <span className="ml-2 rounded bg-orange-soft px-1.5 py-0.5 align-middle text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-orange">
      Demo
    </span>
  );
}

/**
 * The catalogue: a table on wide screens, cards below that. Either opens a
 * product with `onOpen`.
 */
export function ProductList({
  products,
  onOpen,
}: {
  products: readonly ExporterProduct[];
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <div className="relative hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[62rem] text-sm">
          <thead className="border-y border-line bg-canvas/60">
            <tr>
              <th scope="col" className={th}>Product</th>
              <th scope="col" className={th}>Category / HS Code</th>
              <th scope="col" className={`${th} text-right!`}>Capacity</th>
              <th scope="col" className={`${th} text-right!`}>Available</th>
              <th scope="col" className={`${th} text-right!`}>MOQ</th>
              <th scope="col" className={th}>Lead Time</th>
              <th scope="col" className={th}>Readiness</th>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={th}><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-canvas/50">
                <td className={td}>
                  <p className="font-semibold text-ink">
                    {p.name}
                    {p.demo && <DemoTag />}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-ink-muted [overflow-wrap:anywhere]">{p.productCode}</p>
                </td>
                <td className={td}>
                  <p className="text-ink">{p.category}</p>
                  <p className="mt-0.5 font-mono text-xs text-ink-muted">{p.hsCode || "—"}</p>
                </td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums text-ink`}>
                  {formatQuantity(p.supply.monthlyExportCapacity)}
                  <span className="block text-xs text-ink-faint">/ month</span>
                </td>
                <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums text-teal`}>
                  {formatQuantity(p.supply.availableCapacity)}
                </td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums text-ink`}>{formatQuantity(p.supply.moq)}</td>
                <td className={`${td} whitespace-nowrap text-ink`}>{leadTime(p)}</td>
                <td className={td}><ReadinessScore score={p.readiness} /></td>
                <td className={td}><ProductStatusPill status={p.status} /></td>
                <td className={`${td} text-right`}>
                  <button
                    type="button"
                    onClick={() => onOpen(p.id)}
                    aria-label={`View ${p.name}`}
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-teal transition-colors hover:border-teal hover:bg-teal-soft ${focusRing}`}
                  >
                    View
                    <ChevronRight className="size-3.5" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 xl:hidden">
        {products.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onOpen(p.id)}
              className={`flex h-full w-full flex-col rounded-xl border border-line bg-surface p-4 text-left transition hover:border-teal/40 hover:shadow-md ${focusRing}`}
            >
              <span className="flex w-full items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">
                    {p.name}
                    {p.demo && <DemoTag />}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {p.category} · HS <span className="font-mono">{p.hsCode || "—"}</span>
                  </span>
                </span>
                <ProductStatusPill status={p.status} />
              </span>

              <span className="mt-4 grid w-full grid-cols-3 gap-2 text-sm">
                <span>
                  <span className="block text-xs text-ink-faint">Capacity</span>
                  <span className="font-medium tabular-nums text-ink">{formatQuantity(p.supply.monthlyExportCapacity)}</span>
                </span>
                <span>
                  <span className="block text-xs text-ink-faint">Available</span>
                  <span className="font-semibold tabular-nums text-teal">{formatQuantity(p.supply.availableCapacity)}</span>
                </span>
                <span>
                  <span className="block text-xs text-ink-faint">MOQ</span>
                  <span className="font-medium tabular-nums text-ink">{formatQuantity(p.supply.moq)}</span>
                </span>
              </span>

              <span className="mt-4 flex w-full flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <ReadinessScore score={p.readiness} />
                <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                  <Clock className="size-3.5 text-ink-faint" aria-hidden />
                  {leadTime(p)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function EmptyCatalogue({ onReset }: { onReset: () => void }) {
  return (
    <div className="border-t border-line px-6 py-14 text-center">
      <Package className="mx-auto size-8 text-ink-faint" aria-hidden />
      <p className="mt-3 font-semibold text-ink">No products match these filters</p>
      <button
        type="button"
        onClick={onReset}
        className={`mt-3 rounded-lg text-sm font-semibold text-teal hover:text-ink ${focusRing}`}
      >
        Clear filters
      </button>
    </div>
  );
}
