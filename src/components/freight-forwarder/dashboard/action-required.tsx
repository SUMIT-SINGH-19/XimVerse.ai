import { Clock } from "lucide-react";
import {
  ACTION_KIND_LABEL,
  type FreightAction,
  type Urgency,
} from "@/lib/freight-forwarder-dashboard-data";
import { CtaLink, RefId, WaitingOn, formatDuration, minutesUntil } from "./dashboard-ui";

const URGENCY: Record<Urgency, { label: string; text: string; rail: string }> = {
  critical: { label: "Critical", text: "text-orange", rail: "bg-orange" },
  high: { label: "High", text: "text-orange", rail: "bg-orange/45" },
  medium: { label: "Medium", text: "text-teal", rail: "bg-teal/50" },
};

/** Id of the section, so other cards (SUMIT) can jump to it. */
export const ACTION_REQUIRED_ID = "ff-action-required";

function Deadline({ at, asOf }: { at: string; asOf: string }) {
  const minutes = minutesUntil(at, asOf);
  const soon = minutes <= 180;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${
        soon ? "bg-orange-soft text-orange" : "bg-canvas text-ink-muted"
      }`}
    >
      <Clock aria-hidden className="size-3.5" />
      {minutes > 0 ? `Respond within ${formatDuration(minutes)}` : "Overdue"}
    </span>
  );
}

/** The forwarder's to-do list: what is blocking a quote, booking or departure. */
export function ActionRequired({
  actions,
  asOf,
  className = "",
}: {
  /** Already sorted, most urgent first. */
  actions: readonly FreightAction[];
  asOf: string;
  className?: string;
}) {
  const titleId = `${ACTION_REQUIRED_ID}-title`;

  return (
    <section
      id={ACTION_REQUIRED_ID}
      aria-labelledby={titleId}
      className={`scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(11,46,48,0.04),0_8px_24px_rgba(11,46,48,0.05)] ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
        <div>
          <h2 id={titleId} className="text-xl font-semibold tracking-tight text-ink">
            Action Required
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Quotes, documents, bookings and exceptions waiting on a decision.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-orange-soft px-2.5 py-1 text-xs font-semibold text-orange">
          {actions.length} open
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink-muted">Nothing needs your attention right now.</p>
      ) : (
        <ul className="divide-y divide-line">
          {actions.map((action) => {
            const u = URGENCY[action.urgency];
            return (
              <li key={action.id} className="flex gap-4 px-5 py-4 transition-colors hover:bg-canvas/60 sm:px-6">
                <span aria-hidden className={`w-1 shrink-0 self-stretch rounded-full ${u.rail}`} />
                <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className={`font-semibold uppercase tracking-[0.08em] ${u.text}`}>
                        {ACTION_KIND_LABEL[action.kind]}
                      </span>
                      <span aria-hidden className="text-ink-faint">
                        ·
                      </span>
                      <RefId className="text-ink-muted">{action.reference}</RefId>
                      <span className="sr-only">, {u.label} priority</span>
                    </p>
                    <p className="mt-1 font-semibold text-ink">{action.title}</p>
                    <p className="mt-0.5 text-sm text-ink-muted">{action.detail}</p>
                    {(action.deadline || action.waitingOn) && (
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {action.deadline && <Deadline at={action.deadline} asOf={asOf} />}
                        {action.waitingOn && <WaitingOn party={action.waitingOn} />}
                      </p>
                    )}
                  </div>
                  <CtaLink
                    section={action.destination}
                    label={action.cta}
                    context={action.reference}
                    variant={action.urgency === "medium" ? "secondary" : "primary"}
                    className="self-start sm:self-center"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
