import { Panel } from "@/components/workspace/panel";
import { formatDayMonth } from "@/lib/format";
import type { ActivityActor, ActivityEvent } from "@/lib/cha-dashboard-data";
import { ShipmentId } from "./cha-badges";

const ACTOR: Record<ActivityActor, { dot: string; label: string }> = {
  customs: { dot: "bg-orange", label: "Customs" },
  client: { dot: "bg-teal", label: "Client" },
  team: { dot: "bg-ink-faint", label: "Your team" },
  sumit: { dot: "bg-teal/50", label: "Sumit" },
};

/** "08:42 AM" for today, "Yesterday", or "5 Oct" — in the CHA's time zone. */
function eventTime(at: string, today: string, yesterday: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(at));
  if (day === today) {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone,
    }).format(new Date(at));
  }
  if (day === yesterday) return "Yesterday";
  return formatDayMonth(day);
}

/** Latest events across shipments; will grow into the audit/activity stream. */
export function RecentActivity({
  events,
  today,
  timeZone,
  className = "",
}: {
  events: readonly ActivityEvent[];
  /** The snapshot's date in the CHA's time zone, YYYY-MM-DD. */
  today: string;
  timeZone: string;
  className?: string;
}) {
  const y = new Date(`${today}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);

  return (
    <Panel title="Recent Activity" className={className}>
      <ol>
        {events.map((ev, i) => (
          <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < events.length - 1 && (
              <span aria-hidden className="absolute left-[3.5px] top-3 h-full w-px bg-line" />
            )}
            <span aria-hidden className={`relative mt-1.5 size-2 shrink-0 rounded-full ${ACTOR[ev.actor].dot}`} />
            <div className="min-w-0 flex-1">
              <time dateTime={ev.at} className="text-xs font-medium tabular-nums text-ink-faint">
                {eventTime(ev.at, today, yesterday, timeZone)}
              </time>
              <p className="text-sm text-ink">
                {ev.message} <span className="text-ink-faint">·</span>{" "}
                <ShipmentId id={ev.shipmentId} className="text-xs! text-ink-muted" />
              </p>
              <p className="text-xs text-ink-faint">{ACTOR[ev.actor].label}</p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
