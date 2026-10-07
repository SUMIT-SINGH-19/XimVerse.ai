import { Panel } from "@/components/workspace/panel";
import { freightForwarderHref } from "@/lib/freight-forwarder-nav";
import { readiness, type UpcomingDeparture } from "@/lib/freight-forwarder-dashboard-data";
import {
  CtaLink,
  LaneLabel,
  ModeBadge,
  RefId,
  formatClock,
  formatDuration,
  minutesUntil,
} from "./dashboard-ui";

function Readiness({ departure }: { departure: UpcomingDeparture }) {
  const percent = readiness(departure);
  const ready = percent === 100;
  const { pending } = departure.checklist;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-ink-faint">Readiness</span>
        <span className={`font-semibold tabular-nums ${percent < 80 ? "text-orange" : "text-ink"}`}>{percent}%</span>
      </div>
      <div
        role="meter"
        aria-label={`Readiness for ${departure.shipmentId}`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"
      >
        <span
          className={`block h-full rounded-full ${ready ? "bg-teal" : percent < 80 ? "bg-orange" : "bg-teal/70"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {pending.length > 0 && (
        <p className="mt-1.5 truncate text-xs text-ink-muted" title={pending.join(", ")}>
          <span className="text-ink-faint">Open: </span>
          {pending.join(", ")}
        </p>
      )}
    </div>
  );
}

/** Sailings and flights coming up, nearest carrier cut-off first. */
export function UpcomingDepartures({
  departures,
  asOf,
  timeZone,
  className = "",
}: {
  departures: readonly UpcomingDeparture[];
  asOf: string;
  timeZone: string;
  className?: string;
}) {
  return (
    <Panel
      title="Upcoming Departures"
      description="Cut-offs and readiness for the next sailings and flights."
      action={{ label: "All bookings", href: freightForwarderHref("bookings") }}
      className={className}
      bodyClassName="px-5 pb-5 pt-3 sm:px-6"
    >
      <ul className="divide-y divide-line">
        {departures.map((d) => {
          const toCutoff = minutesUntil(d.cutoff, asOf);
          const tight = toCutoff <= 24 * 60;
          return (
            <li
              key={d.shipmentId}
              className="grid gap-x-6 gap-y-3 py-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2">
                  <RefId className="font-semibold text-ink">{d.shipmentId}</RefId>
                  <ModeBadge mode={d.mode} />
                </p>
                <LaneLabel lane={d.lane} className="mt-0.5 text-sm text-ink" />
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {d.carrier} · {d.voyage}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-faint">
                  {d.exporter} · {d.equipment}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 text-sm md:grid-cols-1 md:gap-y-1.5">
                <div>
                  <dt className="text-xs text-ink-faint">Cut-off</dt>
                  <dd className={`tabular-nums ${tight ? "font-semibold text-orange" : "text-ink"}`}>
                    <time dateTime={d.cutoff}>{formatClock(d.cutoff, timeZone)}</time>
                    {tight && (
                      <span className="block text-xs font-normal">
                        {toCutoff > 0 ? `in ${formatDuration(toCutoff)}` : "Passed"}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">ETD</dt>
                  <dd className="tabular-nums text-ink">
                    <time dateTime={d.etd}>{formatClock(d.etd, timeZone)}</time>
                  </dd>
                </div>
              </dl>

              <Readiness departure={d} />

              <CtaLink
                section="documents"
                label="View Checklist"
                context={d.shipmentId}
                className="justify-self-start md:justify-self-end"
              />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
