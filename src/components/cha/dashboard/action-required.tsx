import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { chaHref } from "@/lib/cha-nav";
import type { ActionItem, ActionStatus } from "@/lib/cha-dashboard-data";
import { ActionStatusBadge, ShipmentId } from "./cha-badges";

const RAIL: Record<ActionStatus, string> = {
  critical: "bg-orange",
  urgent: "bg-orange/50",
  ready: "bg-teal",
  review: "bg-teal/40",
  "waiting-client": "bg-line",
};

/** Act-now statuses get a filled button; the rest an outline one. */
const PRIMARY: ReadonlySet<ActionStatus> = new Set(["critical", "urgent", "ready"]);

export function ActionRequired({
  actions,
  className = "",
}: {
  /** Already in priority order. */
  actions: readonly ActionItem[];
  className?: string;
}) {
  return (
    <section
      aria-labelledby="cha-action-required"
      className={`overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(11,46,48,0.04),0_8px_24px_rgba(11,46,48,0.05)] ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2 id="cha-action-required" className="text-xl font-semibold tracking-tight text-ink">
            Action Required
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">Exceptions and approvals holding up clearance.</p>
        </div>
        <span className="shrink-0 rounded-full bg-orange-soft px-2.5 py-1 text-xs font-semibold text-orange">
          {actions.length} open
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink-muted">Nothing needs your attention right now.</p>
      ) : (
        <ul className="divide-y divide-line">
          {actions.map((action) => (
            <li
              key={action.id}
              className="flex gap-4 px-5 py-3.5 transition-colors hover:bg-canvas/60 sm:px-6"
            >
              <span aria-hidden className={`w-1 shrink-0 self-stretch rounded-full ${RAIL[action.status]}`} />
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <ActionStatusBadge status={action.status} />
                    <ShipmentId id={action.shipmentId} className="font-semibold text-ink" />
                    <span className="text-ink-muted">{action.client}</span>
                  </p>
                  <p className="mt-1 font-medium text-ink">{action.issue}</p>
                </div>
                <Link
                  href={chaHref(action.destination)}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition sm:self-center ${focusRing} ${
                    PRIMARY.has(action.status)
                      ? "bg-teal text-on-brand hover:brightness-110"
                      : "border border-line text-ink hover:border-teal/40 hover:bg-teal-soft"
                  }`}
                >
                  {action.cta}
                  <span className="sr-only">: {action.issue} for {action.shipmentId}</span>
                  <ArrowRight aria-hidden className="size-3.5" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
