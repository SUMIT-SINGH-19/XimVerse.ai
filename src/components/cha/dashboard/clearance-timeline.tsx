import { CircleAlert } from "lucide-react";
import { Panel } from "@/components/workspace/panel";
import { chaHref } from "@/lib/cha-nav";
import { journeyFor, journeyIndex, type Shipment } from "@/lib/cha-dashboard-data";
import { ShipmentId, ShipmentTypeTag } from "./cha-badges";

/** One shipment's customs journey with its current step marked. */
function Journey({ shipment }: { shipment: Shipment }) {
  const steps = journeyFor(shipment.type);
  const current = journeyIndex(shipment);
  const blocked = Boolean(shipment.blockedReason);

  return (
    <ol className="grid grid-cols-7">
      {steps.map((step, i) => {
        const done = i < current;
        const here = i === current;
        return (
          <li key={step.id} className="relative flex flex-col items-center text-center">
            {/* Connector to the next step. */}
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={`absolute left-1/2 top-[5px] h-0.5 w-full ${done ? "bg-teal" : "bg-line"}`}
              />
            )}
            <span
              aria-hidden
              className={`relative z-10 grid size-3 place-items-center rounded-full ${
                here
                  ? blocked
                    ? "bg-orange ring-4 ring-orange/20"
                    : "bg-teal ring-4 ring-teal/20"
                  : done
                    ? "bg-teal"
                    : "border-2 border-line bg-surface"
              }`}
            />
            <span
              className={`mt-2 hidden text-[0.6875rem] leading-tight sm:block ${
                here ? `font-semibold ${blocked ? "text-orange" : "text-ink"}` : done ? "text-ink-muted" : "text-ink-faint"
              }`}
            >
              {step.label}
            </span>
            <span className="sr-only">
              {step.label}
              {here ? (blocked ? " (current, blocked)" : " (current)") : done ? " (done)" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Where today's shipments are in customs, and where they are stuck. */
export function ClearanceTimeline({
  shipments,
  className = "",
}: {
  shipments: readonly Shipment[];
  className?: string;
}) {
  return (
    <Panel
      title="Clearance Timeline"
      description="Today's clearances and anything stuck on the way."
      action={{ label: "All shipments", href: chaHref("shipments") }}
      className={className}
      bodyClassName="pb-2 pt-3"
    >
      <ul className="divide-y divide-line">
        {shipments.map((s) => {
          const steps = journeyFor(s.type);
          const current = steps[journeyIndex(s)];
          return (
            <li
              key={s.id}
              className="grid gap-x-6 gap-y-3 px-5 py-4 sm:px-6 2xl:grid-cols-[13rem_minmax(0,1fr)]"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2">
                  <ShipmentId id={s.id} className="font-semibold text-ink" />
                  <ShipmentTypeTag type={s.type} />
                </p>
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  {s.client} · {s.port}
                </p>
                {/* Phones hide the step labels, so name the current step here. */}
                <p className="mt-0.5 text-xs text-ink-faint sm:hidden">
                  At {current?.label}
                </p>
              </div>
              <div className="min-w-0">
                <Journey shipment={s} />
                {s.blockedReason && (
                  <p className="mt-2.5 flex items-start gap-1.5 text-xs font-medium text-orange">
                    <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                    <span>
                      <span className="sr-only">Blocked: </span>
                      {s.blockedReason}
                    </span>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
