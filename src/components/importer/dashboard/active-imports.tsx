"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatDayMonth } from "@/lib/format";
import type { ActiveImportRow } from "@/lib/importer-dashboard";
import { importerHref } from "@/lib/importer-nav";
import { shipmentStatusLabel } from "@/lib/importer-shipments";
import { useT } from "@/i18n/client";
import { focusRing } from "../styles";
import { ScheduleBadge } from "../tracking/tracking-ui";
import { ImportId, Panel, RouteLabel } from "./dashboard-ui";

const SHOWN = 5;

function exceptionsText(row: ActiveImportRow, t: ReturnType<typeof useT>) {
  if (!row.openExceptions) return t("No open exceptions");
  return `${t(row.openExceptions === 1 ? "{count} exception" : "{count} exceptions", { count: row.openExceptions })}${row.highest ? ` · ${t(row.highest)}` : ""}`;
}

/** Active shipments in Tracking's attention order; rows open the tracking view. */
export function ActiveImports({
  imports,
  className = "",
}: {
  imports: readonly ActiveImportRow[];
  className?: string;
}) {
  const t = useT();
  const shown = imports.slice(0, SHOWN);

  return (
    <Panel
      id="active-imports"
      title="Active Imports"
      description={t("{shown} of {total} active shipments, most pressing first", { shown: shown.length, total: imports.length })}
      className={className}
      action={
        <Link
          href={importerHref("tracking")}
          className={`inline-flex shrink-0 items-center gap-1 rounded-md text-sm font-semibold text-teal hover:underline ${focusRing}`}
        >
          {t("View all tracking")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      }
    >
      {imports.length === 0 ? (
        <p className="px-6 py-8 text-sm text-ink-muted">
          {t("No active shipments yet. Shipments appear here once an order ships.")}
        </p>
      ) : (
        <>
          {/* Wide screens: table */}
          <div className="mt-4 hidden xl:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-y border-line bg-canvas/60 text-xs font-medium text-ink-muted">
                  <th scope="col" className="py-2.5 pl-6 pr-3 font-medium">{t("Shipment")}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t("Supplier")}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t("Route")}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t("ETA")}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t("Stage")}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t("Schedule")}</th>
                  <th scope="col" className="py-2.5 pl-3 pr-6 font-medium">{t("Exceptions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((row) => (
                  <tr
                    key={row.shipmentId}
                    data-import={row.shipmentId}
                    className="group relative transition-colors focus-within:bg-teal-soft/50 hover:bg-teal-soft/50"
                  >
                    <th scope="row" className="whitespace-nowrap py-3.5 pl-6 pr-3 font-normal">
                      {/* Stretched link: the whole row is the click target. */}
                      <Link
                        href={row.href}
                        className="font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                      >
                        <ImportId id={row.shipmentId} />
                      </Link>
                      <span className="block text-xs text-ink-faint">{row.orderId}</span>
                    </th>
                    <td className="px-3 py-3.5 text-ink">
                      {row.supplier}
                      <span className="block text-xs text-ink-faint">{row.product}</span>
                    </td>
                    <td className="px-3 py-3.5 text-ink-muted">
                      <RouteLabel route={row.route} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-ink">{formatDayMonth(row.eta)}</td>
                    <td className="px-3 py-3.5 text-ink-muted">{t(shipmentStatusLabel(row.stage))}</td>
                    <td className="px-3 py-3.5">
                      <ScheduleBadge status={row.scheduleStatus} />
                    </td>
                    <td className="py-3.5 pl-3 pr-6 text-ink-muted">
                      <span className="flex items-center justify-between gap-2">
                        {exceptionsText(row, t)}
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
            {shown.map((row) => (
              <li key={row.shipmentId} data-import-card={row.shipmentId}>
                <Link
                  href={row.href}
                  className={`block h-full rounded-xl border border-line p-4 transition hover:border-teal/40 hover:bg-teal-soft/40 ${focusRing}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <ImportId id={row.shipmentId} className="block font-semibold text-ink" />
                      <span className="mt-0.5 block truncate text-sm text-ink-muted">{row.supplier}</span>
                    </span>
                    <ScheduleBadge status={row.scheduleStatus} />
                  </span>
                  <span className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <span className="col-span-2">
                      <span className="block text-xs text-ink-faint">{t("Route")}</span>
                      <RouteLabel route={row.route} className="text-ink" />
                    </span>
                    <span>
                      <span className="block text-xs text-ink-faint">{t("ETA")}</span>
                      <span className="tabular-nums text-ink">{formatDayMonth(row.eta)}</span>
                    </span>
                    <span>
                      <span className="block text-xs text-ink-faint">{t("Stage")}</span>
                      <span className="text-ink">{t(shipmentStatusLabel(row.stage))}</span>
                    </span>
                  </span>
                  <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-sm text-ink-muted">
                    <span>{exceptionsText(row, t)}</span>
                    <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-faint" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
