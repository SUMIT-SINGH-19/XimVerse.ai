import { BadgeCheck, CalendarClock, MapPin } from "lucide-react";
import type { WorkspaceIdentity } from "@/lib/workspace-nav";
import type { ProfileSummary as Summary } from "@/lib/exporter-company";
import { formatDate } from "@/lib/exporter-dashboard";
import { Meter } from "./profile-ui";

/** Identity, verification and completeness at the top of the profile. */
export function ProfileSummary({ identity, summary }: { identity: WorkspaceIdentity; summary: Summary }) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex min-w-0 items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-teal text-lg font-bold text-on-brand">
          {identity.initials}
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight text-ink">{identity.company}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
            {identity.badge && (
              <span className="inline-flex items-center gap-1 font-medium text-teal">
                <BadgeCheck className="size-4" aria-hidden />
                {identity.badge}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4 text-ink-faint" aria-hidden />
              {identity.location}
            </span>
          </p>
        </div>
      </div>

      <div className="w-full shrink-0 sm:w-72">
        <p className="whitespace-nowrap text-sm font-semibold text-ink">
          <span className="tabular-nums">{summary.completion}%</span> Complete
        </p>
        <Meter value={summary.completion} label="Profile completion" className="mt-2" />
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted">
          <CalendarClock className="size-3.5 text-ink-faint" aria-hidden />
          Last updated {formatDate(summary.lastUpdated)}
        </p>
      </div>
    </div>
  );
}
