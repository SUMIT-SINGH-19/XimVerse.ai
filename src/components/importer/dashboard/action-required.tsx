import type { ActionItem, ActionPriority } from "@/lib/importer-dashboard-data";
import { focusRing } from "../styles";
import { ImportId, RouteLabel } from "./dashboard-ui";

const PRIORITY: Record<ActionPriority, { label: string; text: string; rail: string }> = {
  high: { label: "High priority", text: "text-orange", rail: "bg-orange" },
  medium: { label: "Medium priority", text: "text-teal", rail: "bg-teal/60" },
  low: { label: "Lower priority", text: "text-ink-faint", rail: "bg-line" },
};

export function ActionRequired({
  actions,
  className = "",
}: {
  actions: readonly ActionItem[];
  className?: string;
}) {
  return (
    <section
      aria-labelledby="action-required"
      className={`overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(11,46,48,0.04),0_8px_24px_rgba(11,46,48,0.05)] ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
        <div>
          <h2 id="action-required" className="text-xl font-semibold tracking-tight text-ink">
            Action Required
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Items that may delay your imports if left unresolved.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-orange-soft px-2.5 py-1 text-xs font-semibold text-orange">
          {actions.length} open
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink-muted">
          Nothing needs your attention right now.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {actions.map((action) => {
            const p = PRIORITY[action.priority];
            return (
              <li
                key={action.id}
                className="flex gap-4 px-5 py-4 transition-colors hover:bg-canvas/60 sm:px-6"
              >
                <span aria-hidden className={`w-1 shrink-0 self-stretch rounded-full ${p.rail}`} />
                <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 text-xs">
                      <span className={`font-semibold uppercase tracking-[0.08em] ${p.text}`}>
                        {p.label}
                      </span>
                      <span aria-hidden className="text-ink-faint">
                        ·
                      </span>
                      <ImportId id={action.importId} className="text-ink-muted" />
                    </p>
                    <p className="mt-1 font-semibold text-ink">{action.issue}</p>
                    {(action.counterparty || action.route) && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                        {action.counterparty && (
                          <span>
                            <span className="text-ink-faint">{action.counterparty.role}:</span>{" "}
                            {action.counterparty.name}
                          </span>
                        )}
                        {action.route && <RouteLabel route={action.route} />}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className={`inline-flex h-9 shrink-0 items-center self-start rounded-lg px-4 text-sm font-semibold transition sm:self-center ${focusRing} ${
                      action.priority === "high"
                        ? "bg-teal text-on-brand hover:brightness-110"
                        : "border border-line text-ink hover:border-teal/40 hover:bg-teal-soft"
                    }`}
                  >
                    {action.cta}
                    <span className="sr-only">
                      {" "}
                      {action.issue} for {action.importId}
                    </span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
