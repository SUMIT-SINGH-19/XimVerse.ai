import { formatTimeAgo } from "@/lib/format";
import type { ActivityActor, ActivityEvent } from "@/lib/importer-dashboard-data";
import { ImportId, Panel } from "./dashboard-ui";

const ACTOR_DOT: Record<ActivityActor, string> = {
  cha: "bg-teal",
  supplier: "bg-orange",
  carrier: "bg-teal/50",
  importer: "bg-ink-faint",
};

/** Latest events across imports; will grow into the audit/activity stream. */
export function RecentActivity({
  events,
  asOf,
  className = "",
}: {
  events: readonly ActivityEvent[];
  asOf: string;
  className?: string;
}) {
  return (
    <Panel id="recent-activity" title="Recent Activity" className={className}>
      <ol className="mt-4 px-5 pb-5 sm:px-6">
        {events.map((ev, i) => (
          <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < events.length - 1 && (
              <span aria-hidden className="absolute left-[3.5px] top-3 h-full w-px bg-line" />
            )}
            <span aria-hidden className={`relative mt-1.5 size-2 shrink-0 rounded-full ${ACTOR_DOT[ev.actor]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{ev.message}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-faint">
                <ImportId id={ev.importId} className="text-xs! text-ink-muted" />
                <time dateTime={ev.at}>{formatTimeAgo(ev.at, asOf)}</time>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
