import { BadgeCheck, MapPin } from "lucide-react";
import type { WorkspaceIdentity } from "@/lib/workspace-nav";

/** The signed-in exporter's company, shown beside the dashboard title. */
export function CompanyCard({ identity }: { identity: WorkspaceIdentity }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal text-sm font-semibold text-on-brand">
        {identity.initials}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{identity.company}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5 text-ink-faint" aria-hidden />
            {identity.location}
          </span>
          {identity.badge && (
            <span className="inline-flex items-center gap-1 font-medium text-teal">
              <BadgeCheck className="size-3.5" aria-hidden />
              {identity.badge}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
