import { CircleAlert, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { Panel } from "@/components/workspace/panel";
import { formatTimeAgo } from "@/lib/format";
import { freightForwarderHref } from "@/lib/freight-forwarder-nav";
import {
  SEVERITY_LABEL,
  STAKEHOLDER_LABEL,
  type Severity,
  type ShipmentException,
} from "@/lib/freight-forwarder-dashboard-data";
import { CtaButton, CtaLink, RefId } from "./dashboard-ui";

const SEVERITY: Record<Severity, { icon: LucideIcon; tone: string; chip: string }> = {
  critical: { icon: CircleAlert, tone: "text-orange", chip: "bg-orange text-on-brand" },
  warning: { icon: TriangleAlert, tone: "text-orange", chip: "bg-orange-soft text-orange" },
  info: { icon: Info, tone: "text-teal", chip: "bg-teal-soft text-teal" },
};

/** Delays, schedule changes and holds, most severe first. */
export function ExceptionsPanel({
  exceptions,
  asOf,
  className = "",
}: {
  exceptions: readonly ShipmentException[];
  asOf: string;
  className?: string;
}) {
  return (
    <Panel
      title="Exceptions & Delays"
      description="What could move a departure or delivery."
      action={{ label: "All", href: freightForwarderHref("tracking") }}
      className={className}
      bodyClassName="px-5 pb-5 pt-3 sm:px-6"
    >
      {exceptions.length === 0 ? (
        <p className="py-6 text-sm text-ink-muted">No open exceptions.</p>
      ) : (
        <ul className="divide-y divide-line">
          {exceptions.map((ex) => {
            const s = SEVERITY[ex.severity];
            const Icon = s.icon;
            return (
              <li key={ex.id} className="flex gap-3 py-4">
                <Icon aria-hidden className={`mt-0.5 size-4.5 shrink-0 ${s.tone}`} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-ink">{ex.title}</span>
                    <span className={`rounded px-1.5 py-px text-[0.6875rem] font-semibold uppercase tracking-wide ${s.chip}`}>
                      {SEVERITY_LABEL[ex.severity]}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    <RefId className="text-ink">{ex.shipmentId}</RefId> · {ex.detail}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {STAKEHOLDER_LABEL[ex.stakeholder.role]}: {ex.stakeholder.name} ·{" "}
                    <time dateTime={ex.raisedAt}>{formatTimeAgo(ex.raisedAt, asOf)}</time>
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {ex.severity !== "info" && (
                      <CtaButton
                        label="Resolve"
                        context={`${ex.title}, ${ex.shipmentId}`}
                        variant={ex.severity === "critical" ? "primary" : "secondary"}
                        className="h-8! px-3!"
                      />
                    )}
                    <CtaLink section="shipments" label="View Shipment" context={ex.shipmentId} variant="quiet" />
                    <CtaButton label="Contact" context={ex.stakeholder.name} variant="quiet" />
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
