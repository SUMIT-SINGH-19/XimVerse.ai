"use client";

import Link from "next/link";
import { formatTimeAgo } from "@/lib/format";
import type { DashboardActivity } from "@/lib/importer-dashboard";
import { useT } from "@/i18n/client";
import { focusRing } from "../styles";
import { ImportId, Panel } from "./dashboard-ui";

const SOURCE_DOT: Record<DashboardActivity["source"], string> = {
  Requirement: "bg-ink-faint",
  Negotiation: "bg-orange",
  Order: "bg-orange/60",
  Shipment: "bg-teal",
  Document: "bg-teal/50",
  Customs: "bg-teal",
  Payment: "bg-orange",
  "Landed Cost": "bg-ink-faint",
};

/** Latest events merged on read from each feature's own history — no separate log. */
export function RecentActivity({
  events,
  asOf,
  className = "",
}: {
  events: readonly DashboardActivity[];
  asOf: string;
  className?: string;
}) {
  const t = useT();

  return (
    <Panel id="recent-activity" title="Recent Activity" className={className}>
      {events.length === 0 ? (
        <p className="px-6 py-8 text-sm text-ink-muted">{t("No activity recorded yet.")}</p>
      ) : (
        <ol className="mt-4 px-5 pb-5 sm:px-6">
          {events.map((ev, i) => (
            <li key={ev.id} data-activity={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
              {i < events.length - 1 && <span aria-hidden className="absolute left-[3.5px] top-3 h-full w-px bg-line" />}
              <span aria-hidden className={`relative mt-1.5 size-2 shrink-0 rounded-full ${SOURCE_DOT[ev.source]}`} />
              <div className="min-w-0 flex-1">
                <Link href={ev.href} className={`rounded-sm text-sm text-ink hover:text-teal ${focusRing}`}>
                  {ev.title}
                </Link>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-faint">
                  <span>{t(ev.source)}</span>
                  <ImportId id={ev.entity} className="text-xs! text-ink-muted" />
                  <time dateTime={ev.at}>{formatTimeAgo(ev.at, asOf, t)}</time>
                  {ev.demo && <span className="rounded-full border border-orange/40 px-1.5 font-medium text-orange">{t("Demo")}</span>}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
