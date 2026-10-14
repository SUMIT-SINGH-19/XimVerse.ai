"use client";

import Link from "next/link";
import { formatDayMonth, formatDaysAhead } from "@/lib/format";
import { UPCOMING_WINDOW_DAYS, type DashboardArrival } from "@/lib/importer-dashboard";
import { useT } from "@/i18n/client";
import { focusRing } from "../styles";
import { ImportId, Panel, RouteLabel } from "./dashboard-ui";

/** Not-yet-arrived shipments with an ETA in the next 14 days; overdue ETAs are Action Required items instead. */
export function UpcomingArrivals({
  arrivals,
  className = "",
}: {
  arrivals: readonly DashboardArrival[];
  className?: string;
}) {
  const t = useT();

  return (
    <Panel
      id="upcoming-arrivals"
      title="Upcoming Arrivals"
      description={t("Latest ETAs in the next {days} days", { days: UPCOMING_WINDOW_DAYS })}
      className={className}
    >
      {arrivals.length === 0 ? (
        <p className="px-6 py-8 text-sm text-ink-muted">{t("No arrivals expected in the next 14 days.")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line px-5 pb-2 sm:px-6">
          {arrivals.map((a) => {
            const [day, month] = formatDayMonth(a.eta).split(" ");
            return (
              <li key={a.shipmentId} data-arrival={a.shipmentId}>
                <Link href={a.href} className={`flex gap-4 rounded-lg py-3 ${focusRing}`}>
                  <time
                    dateTime={a.eta}
                    className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-canvas py-1.5 leading-none"
                  >
                    <span className="text-lg font-semibold tabular-nums text-ink">{day}</span>
                    <span className="mt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-ink-muted">{month}</span>
                  </time>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <RouteLabel route={{ origin: a.port, destination: a.destination }} className="min-w-0 text-sm font-semibold text-ink" />
                      <span className="shrink-0 text-xs text-ink-faint">{formatDaysAhead(a.daysRemaining, t)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-muted">
                      <ImportId id={a.shipmentId} className="text-xs!" /> · {a.supplier}
                    </span>
                    <span data-schedule className={`mt-1 block text-xs font-medium ${a.delayDays ? "text-orange" : "text-teal"}`}>
                      {t(a.scheduleLabel)}
                      {a.delayDays > 0 && ` +${t(a.delayDays === 1 ? "{count} day" : "{count} days", { count: a.delayDays })}`}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
