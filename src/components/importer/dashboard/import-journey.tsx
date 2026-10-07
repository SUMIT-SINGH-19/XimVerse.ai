import { IMPORT_STAGES, type ImportStage } from "@/lib/importer-dashboard-data";
import { Panel } from "./dashboard-ui";

/** How many active imports sit at each stage of the import lifecycle. */
export function ImportJourney({
  pipeline,
  className = "",
}: {
  pipeline: Record<ImportStage, number>;
  className?: string;
}) {
  const busiest = Math.max(...IMPORT_STAGES.map((s) => pipeline[s.id]));

  return (
    <Panel
      id="import-journey"
      title="Import Journey"
      description="Where your active imports are right now."
      className={className}
    >
      <ol className="mt-5 grid px-5 pb-6 sm:px-6 md:grid-cols-7">
        {IMPORT_STAGES.map((stage, i) => {
          const count = pipeline[stage.id];
          const occupied = count > 0;
          const last = i === IMPORT_STAGES.length - 1;
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
                className={`relative z-10 size-[11px] shrink-0 rounded-full border-2 ${
                  occupied
                    ? count === busiest
                      ? "border-orange bg-orange"
                      : "border-teal bg-teal"
                    : "border-line bg-surface"
                }`}
              />
              <span className="flex flex-1 items-baseline justify-between gap-3 md:mt-3 md:flex-col md:items-start md:gap-0.5">
                <span className={`text-sm ${occupied ? "text-ink" : "text-ink-faint"}`}>{stage.label}</span>
                <span
                  className={`text-lg font-semibold tabular-nums leading-none md:order-first md:text-xl ${
                    occupied ? "text-ink" : "text-ink-faint"
                  }`}
                >
                  <span aria-hidden>{occupied ? count : "–"}</span>
                  <span className="sr-only">
                    {count} {count === 1 ? "import" : "imports"}
                  </span>
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
