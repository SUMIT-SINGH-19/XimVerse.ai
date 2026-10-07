import { Panel } from "@/components/workspace/panel";
import type { PipelineStage } from "@/lib/freight-forwarder-dashboard-data";

const PHASE: Record<PipelineStage["phase"], { label: string; dot: string; span: string }> = {
  commercial: { label: "Commercial", dot: "border-orange bg-orange", span: "md:col-span-3" },
  execution: { label: "Execution", dot: "border-teal bg-teal", span: "md:col-span-4" },
  done: { label: "Completed", dot: "border-teal bg-surface", span: "md:col-span-1" },
};

/** How many jobs sit at each step, from first request to delivery. */
export function ShipmentPipeline({
  stages,
  className = "",
}: {
  stages: readonly PipelineStage[];
  className?: string;
}) {
  // Phase headings, in the order the phases first appear.
  const phases = [...new Set(stages.map((s) => s.phase))];

  return (
    <Panel
      title="Operations Pipeline"
      description="From RFQ to delivery: where your jobs are right now."
      className={className}
      bodyClassName="px-5 pb-6 pt-5 sm:px-6"
    >
      <div aria-hidden className="mb-3 hidden grid-cols-8 gap-x-3 md:grid">
        {phases.map((phase) => (
          <p
            key={phase}
            className={`${PHASE[phase].span} border-b border-line pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint`}
          >
            {PHASE[phase].label}
          </p>
        ))}
      </div>

      <ol className="grid md:grid-cols-8">
        {stages.map((stage, i) => {
          const last = i === stages.length - 1;
          return (
            <li
              key={stage.id}
              className="relative flex items-center gap-3 py-2 md:flex-col md:items-start md:gap-0 md:py-0 md:pr-3"
            >
              {/* Connector: vertical on phones, horizontal from md up. */}
              {!last && (
                <span
                  aria-hidden
                  className="absolute left-[5px] top-1/2 h-full w-px translate-y-1.5 bg-line md:left-3 md:top-[5px] md:h-px md:w-full md:translate-y-0"
                />
              )}
              <span
                aria-hidden
                className={`relative z-10 size-[11px] shrink-0 rounded-full border-2 ${PHASE[stage.phase].dot}`}
              />
              <span className="flex flex-1 items-baseline justify-between gap-3 md:mt-3 md:flex-col md:items-start md:gap-0.5">
                <span className="text-sm text-ink-muted">
                  {stage.label}
                  <span className="sr-only">, {PHASE[stage.phase].label.toLowerCase()}</span>
                </span>
                <span className="text-lg font-semibold tabular-nums leading-none text-ink md:order-first md:text-2xl">
                  {stage.count}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
