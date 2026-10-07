import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatDayMonth } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import { stageLabel, type ActiveImport } from "@/lib/importer-dashboard-data";
import { focusRing } from "../styles";
import { ImportId, Panel, RouteLabel, StatusBadge } from "./dashboard-ui";

// Shipment detail pages don't exist yet; rows open the shipments section.
const SHIPMENTS_HREF = importerHref("shipments");

export function ActiveImports({
  imports,
  total,
  className = "",
}: {
  imports: readonly ActiveImport[];
  total: number;
  className?: string;
}) {
  return (
    <Panel
      id="active-imports"
      title="Active Imports"
      description={`${imports.length} most recently updated of ${total}`}
      className={className}
      action={
        <Link
          href={SHIPMENTS_HREF}
          className={`inline-flex shrink-0 items-center gap-1 rounded-md text-sm font-semibold text-teal hover:underline ${focusRing}`}
        >
          View all shipments
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      }
    >
      {/* Wide screens: table */}
      <div className="mt-4 hidden xl:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-y border-line bg-canvas/60 text-xs font-medium text-ink-muted">
              <th scope="col" className="py-2.5 pl-6 pr-3 font-medium">Import</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Supplier</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Route</th>
              <th scope="col" className="px-3 py-2.5 font-medium">ETA</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Stage</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              <th scope="col" className="py-2.5 pl-3 pr-6 font-medium">Next Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {imports.map((imp) => (
              <tr
                key={imp.id}
                className="group relative transition-colors focus-within:bg-teal-soft/50 hover:bg-teal-soft/50"
              >
                <th scope="row" className="py-3.5 pl-6 pr-3 font-normal">
                  {/* Stretched link: the whole row is the click target. */}
                  <Link
                    href={SHIPMENTS_HREF}
                    className="font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                  >
                    <ImportId id={imp.id} />
                  </Link>
                </th>
                <td className="px-3 py-3.5 text-ink">{imp.supplier}</td>
                <td className="px-3 py-3.5 text-ink-muted">
                  <RouteLabel route={imp.route} />
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-ink">
                  {formatDayMonth(imp.eta)}
                </td>
                <td className="px-3 py-3.5 text-ink-muted">{stageLabel(imp.stage)}</td>
                <td className="px-3 py-3.5">
                  <StatusBadge status={imp.status} />
                </td>
                <td className="py-3.5 pl-3 pr-6 text-ink-muted">
                  <span className="flex items-center justify-between gap-2">
                    {imp.nextAction}
                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-ink-faint opacity-0 transition group-hover:translate-x-0.5 group-hover:text-teal group-hover:opacity-100"
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Narrower screens: shipment cards */}
      <ul className="mt-4 grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2 sm:px-6 xl:hidden">
        {imports.map((imp) => (
          <li key={imp.id}>
            <Link
              href={SHIPMENTS_HREF}
              className={`block h-full rounded-xl border border-line p-4 transition hover:border-teal/40 hover:bg-teal-soft/40 ${focusRing}`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <ImportId id={imp.id} className="block font-semibold text-ink" />
                  <span className="mt-0.5 block truncate text-sm text-ink-muted">{imp.supplier}</span>
                </span>
                <StatusBadge status={imp.status} />
              </span>
              <span className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="col-span-2">
                  <span className="block text-xs text-ink-faint">Route</span>
                  <RouteLabel route={imp.route} className="text-ink" />
                </span>
                <span>
                  <span className="block text-xs text-ink-faint">ETA</span>
                  <span className="tabular-nums text-ink">{formatDayMonth(imp.eta)}</span>
                </span>
                <span>
                  <span className="block text-xs text-ink-faint">Stage</span>
                  <span className="text-ink">{stageLabel(imp.stage)}</span>
                </span>
              </span>
              <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-sm text-ink-muted">
                <span>
                  <span className="sr-only">Next action: </span>
                  {imp.nextAction}
                </span>
                <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-faint" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
