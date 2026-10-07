import { Panel } from "@/components/workspace/panel";
import { formatTimeAgo } from "@/lib/format";
import {
  STAKEHOLDER_LABEL,
  type FreightActivity,
  type Stakeholder,
} from "@/lib/freight-forwarder-dashboard-data";
import { RefId } from "./dashboard-ui";

const ACTOR_DOT: Record<Stakeholder, string> = {
  forwarder: "bg-ink-faint",
  exporter: "bg-teal",
  importer: "bg-teal",
  cha: "bg-teal/50",
  customs: "bg-orange",
  carrier: "bg-orange/60",
  transporter: "bg-orange/60",
};

/** Latest events across shipments; will grow into the activity stream. */
export function RecentActivity({
  events,
  asOf,
  className = "",
}: {
  events: readonly FreightActivity[];
  asOf: string;
  className?: string;
}) {
  return (
    <Panel title="Recent Activity" className={className}>
      <ol>
        {events.map((ev, i) => (
          <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < events.length - 1 && <span aria-hidden className="absolute left-[3.5px] top-3 h-full w-px bg-line" />}
            <span aria-hidden className={`relative mt-1.5 size-2 shrink-0 rounded-full ${ACTOR_DOT[ev.actor]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{ev.message}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-faint">
                <time dateTime={ev.at}>{formatTimeAgo(ev.at, asOf)}</time>
                <span>{ev.actor === "forwarder" ? "Your team" : STAKEHOLDER_LABEL[ev.actor]}</span>
                <RefId className="text-xs text-ink-muted">{ev.reference}</RefId>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
