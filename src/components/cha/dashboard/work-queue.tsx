"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/workspace/panel";
import { focusRing } from "@/components/workspace/styles";
import { chaHref } from "@/lib/cha-nav";
import {
  WORK_QUEUE_FILTERS,
  WORK_STAGE_LABEL,
  type Shipment,
  type WorkQueueFilter,
  type WorkStage,
} from "@/lib/cha-dashboard-data";
import { PriorityBadge, ShipmentId, ShipmentTypeTag } from "./cha-badges";

// Shipment detail pages don't exist yet; rows open the shipments section.
const SHIPMENTS_HREF = chaHref("shipments");

/** Stages where the next move belongs to someone other than the CHA. */
const WAITING_STAGES: ReadonlySet<WorkStage> = new Set(["awaiting-client", "filed", "assessment"]);

function StageLabel({ stage }: { stage: WorkStage }) {
  const tone =
    stage === "customs-query"
      ? "text-orange font-medium"
      : stage === "ready-to-file"
        ? "text-teal font-medium"
        : WAITING_STAGES.has(stage)
          ? "text-ink-muted"
          : "text-ink";
  return <span className={tone}>{WORK_STAGE_LABEL[stage]}</span>;
}

function FilterBar({
  shipments,
  active,
  onChange,
}: {
  shipments: readonly Shipment[];
  active: WorkQueueFilter;
  onChange: (f: WorkQueueFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter shipments"
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
    >
      {WORK_QUEUE_FILTERS.map((f) => {
        const count = shipments.filter(f.matches).length;
        const selected = f.id === active;
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(f.id)}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${focusRing} ${
              selected ? "bg-teal text-on-brand" : "text-ink-muted hover:bg-teal-soft hover:text-ink"
            }`}
          >
            {f.label}
            <span
              className={`rounded-md px-1.5 text-xs tabular-nums ${
                selected ? "bg-on-brand/15 text-on-brand" : "bg-canvas text-ink-faint"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The CHA's active shipments, most pressing first, with quick filters. */
export function WorkQueue({
  shipments,
  className = "",
}: {
  /** Active shipments, already in priority order. */
  shipments: readonly Shipment[];
  className?: string;
}) {
  const [filter, setFilter] = useState<WorkQueueFilter>("all");
  const matches = WORK_QUEUE_FILTERS.find((f) => f.id === filter)?.matches ?? (() => true);
  const rows = shipments.filter(matches);

  return (
    <Panel
      title="CHA Work Queue"
      description="Every active shipment and the next move on it."
      action={{ label: "All shipments", href: SHIPMENTS_HREF }}
      className={className}
      bodyClassName="pt-4"
    >
      <div className="px-5 sm:px-6">
        <FilterBar shipments={shipments} active={filter} onChange={setFilter} />
      </div>
      <p role="status" className="sr-only">
        Showing {rows.length} {rows.length === 1 ? "shipment" : "shipments"}
      </p>

      {rows.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink-muted">No shipments match this filter.</p>
      ) : (
        <>
          {/* Tablet and up: table, scrolling sideways if the column is narrow. */}
          <div className="mt-3 hidden overflow-x-auto pb-2 md:block">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-y border-line bg-canvas/60 text-xs font-medium text-ink-muted">
                  <th scope="col" className="py-2.5 pl-6 pr-3 font-medium">Shipment</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Client</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Port</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Current Stage</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Priority</th>
                  <th scope="col" className="py-2.5 pl-3 pr-6 font-medium">Next Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((s) => (
                  <tr
                    key={s.id}
                    className="group relative transition-colors focus-within:bg-teal-soft/50 hover:bg-teal-soft/50"
                  >
                    <th scope="row" className="whitespace-nowrap py-3 pl-6 pr-3 font-normal">
                      {/* Stretched link: the whole row is the click target. */}
                      <Link
                        href={SHIPMENTS_HREF}
                        className="font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                      >
                        <ShipmentId id={s.id} />
                      </Link>
                    </th>
                    <td className="max-w-48 px-3 py-3">
                      <span className="block truncate text-ink">{s.client}</span>
                      <span className="block truncate text-xs text-ink-faint">{s.cargo}</span>
                    </td>
                    <td className="px-3 py-3">
                      <ShipmentTypeTag type={s.type} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-muted">{s.port}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <StageLabel stage={s.stage} />
                    </td>
                    <td className="px-3 py-3">
                      <PriorityBadge priority={s.priority} />
                    </td>
                    <td className="py-3 pl-3 pr-6">
                      <span className="flex items-center justify-between gap-2 whitespace-nowrap font-medium text-teal">
                        {s.nextAction}
                        <ArrowRight
                          aria-hidden
                          className="size-4 shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: shipment cards */}
          <ul className="mt-3 space-y-3 px-5 pb-5 sm:px-6 md:hidden">
            {rows.map((s) => (
              <li key={s.id}>
                <Link
                  href={SHIPMENTS_HREF}
                  className={`block rounded-xl border border-line p-4 transition hover:border-teal/40 hover:bg-teal-soft/40 ${focusRing}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <ShipmentId id={s.id} className="block font-semibold text-ink" />
                      <span className="mt-0.5 block truncate text-sm text-ink-muted">{s.client}</span>
                    </span>
                    <PriorityBadge priority={s.priority} />
                  </span>
                  <span className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <span>
                      <span className="block text-xs text-ink-faint">Type</span>
                      <ShipmentTypeTag type={s.type} />
                    </span>
                    <span>
                      <span className="block text-xs text-ink-faint">Port</span>
                      <span className="text-ink">{s.port}</span>
                    </span>
                    <span className="col-span-2">
                      <span className="block text-xs text-ink-faint">Current stage</span>
                      <StageLabel stage={s.stage} />
                    </span>
                  </span>
                  <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-sm font-medium text-teal">
                    <span>
                      <span className="sr-only">Next action: </span>
                      {s.nextAction}
                    </span>
                    <ArrowRight aria-hidden className="size-4 shrink-0" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
