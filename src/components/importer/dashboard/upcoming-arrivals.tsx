import { formatDayMonth, formatDaysAhead } from "@/lib/format";
import { daysFromAsOf, type ActiveImport } from "@/lib/importer-dashboard-data";
import { getT } from "@/i18n/server";
import { ImportId, Panel, RouteLabel, StatusBadge } from "./dashboard-ui";

export async function UpcomingArrivals({
  arrivals,
  asOf,
  className = "",
}: {
  arrivals: readonly ActiveImport[];
  asOf: string;
  className?: string;
}) {
  const t = await getT();

  return (
    <Panel id="upcoming-arrivals" title="Upcoming Arrivals" className={className}>
      {arrivals.length === 0 ? (
        <p className="px-6 py-8 text-sm text-ink-muted">{t("No arrivals scheduled.")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line px-5 pb-2 sm:px-6">
          {arrivals.map((imp) => {
            const [day, month] = formatDayMonth(imp.eta).split(" ");
            return (
              <li key={imp.id} className="flex gap-4 py-3">
                <time
                  dateTime={imp.eta}
                  className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-canvas py-1.5 leading-none"
                >
                  <span className="text-lg font-semibold tabular-nums text-ink">{day}</span>
                  <span className="mt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-ink-muted">
                    {month}
                  </span>
                </time>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <RouteLabel route={imp.route} className="text-sm font-semibold text-ink" />
                    <span className="shrink-0 text-xs text-ink-faint">
                      {formatDaysAhead(daysFromAsOf(asOf, imp.eta), t)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    <ImportId id={imp.id} className="text-xs!" /> · {imp.supplier}
                  </p>
                  <div className="mt-1.5">
                    <StatusBadge status={imp.status} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
