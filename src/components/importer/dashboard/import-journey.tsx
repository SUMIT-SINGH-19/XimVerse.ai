"use client";

import Link from "next/link";
import type { DashboardJourney, JourneyState } from "@/lib/importer-dashboard";
import { useT } from "@/i18n/client";
import { focusRing } from "../styles";
import { ImportId, Panel } from "./dashboard-ui";

const DOT: Record<JourneyState, string> = {
  complete: "border-teal bg-teal",
  current: "border-teal bg-surface",
  attention: "border-orange bg-orange",
  upcoming: "border-line bg-surface",
};

const STATE_LABEL: Record<JourneyState, string> = {
  complete: "Complete",
  current: "In progress",
  attention: "Needs attention",
  upcoming: "Not started",
};

/** One representative import followed across its stages, each from its owning feature. */
export function ImportJourney({ journey, className = "" }: { journey?: DashboardJourney; className?: string }) {
  const t = useT();

  return (
    <Panel
      id="import-journey"
      title="Import Journey"
      description="One import followed from sourcing to payment."
      className={className}
    >
      {!journey ? (
        <p className="px-6 py-8 text-sm text-ink-muted">
          {t("No active order yet. The journey appears once a supplier is selected and an order is created.")}
        </p>
      ) : (
        <div className="px-5 pb-6 sm:px-6">
          <p data-journey={journey.shipmentId ?? journey.orderId} className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
            {journey.shipmentId && <ImportId id={journey.shipmentId} className="font-semibold text-ink" />}
            <ImportId id={journey.orderId} className={journey.shipmentId ? "" : "font-semibold text-ink"} />
            <span aria-hidden>·</span>
            <span>{journey.supplier}</span>
            <span aria-hidden>·</span>
            <span>{journey.product}</span>
          </p>
          <p className="mt-1 text-xs text-ink-faint">{t(journey.basis)}</p>
          <ol className="mt-5 grid md:grid-cols-7">
            {journey.stages.map((stage, i) => {
              const last = i === journey.stages.length - 1;
              return (
                <li
                  key={stage.id}
                  data-stage={stage.id}
                  data-state={stage.state}
                  className="relative flex items-start gap-3 py-2 md:flex-col md:gap-0 md:py-0 md:pr-3"
                >
                  {!last && (
                    <span
                      aria-hidden
                      className="absolute left-[5px] top-4 h-full w-px bg-line md:left-3 md:top-[5px] md:h-px md:w-full"
                    />
                  )}
                  <span aria-hidden className={`relative z-10 mt-1 size-[11px] shrink-0 rounded-full border-2 md:mt-0 ${DOT[stage.state]}`} />
                  <Link href={stage.href} className={`min-w-0 flex-1 rounded-md md:mt-3 ${focusRing}`}>
                    <span className="block text-sm font-semibold text-ink hover:text-teal">{t(stage.label)}</span>
                    <span className={`block text-xs ${stage.state === "attention" ? "text-orange" : "text-ink-faint"}`}>
                      {t(STATE_LABEL[stage.state])}
                    </span>
                    <span className="block break-words text-xs text-ink-muted">{t(stage.detail)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Panel>
  );
}
