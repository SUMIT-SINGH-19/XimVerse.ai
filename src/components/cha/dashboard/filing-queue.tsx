import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Panel } from "@/components/workspace/panel";
import { focusRing } from "@/components/workspace/styles";
import { chaHref } from "@/lib/cha-nav";
import {
  FILING_KIND_LABEL,
  FILING_WORKFLOW,
  filingStep,
  type Filing,
  type FilingOwner,
} from "@/lib/cha-dashboard-data";
import { ShipmentId } from "./cha-badges";

const FILINGS_HREF = chaHref("filings");

const OWNER: Record<FilingOwner, { label: string; text: string; current: string }> = {
  cha: { label: "With you", text: "text-orange", current: "bg-orange" },
  client: { label: "With client", text: "text-ink-muted", current: "bg-ink-faint" },
  customs: { label: "With customs", text: "text-teal", current: "bg-teal/60" },
  done: { label: "Complete", text: "text-teal", current: "bg-teal" },
};

/** Seven-segment bar: done steps teal, the current one coloured by whose turn it is. */
function WorkflowBar({ index, owner }: { index: number; owner: FilingOwner }) {
  return (
    <span aria-hidden className="flex gap-0.5">
      {FILING_WORKFLOW.map((step, i) => (
        <span
          key={step.id}
          className={`h-1.5 flex-1 rounded-full ${
            i < index ? "bg-teal" : i === index ? OWNER[owner].current : "bg-line"
          }`}
        />
      ))}
    </span>
  );
}

export interface FilingRow {
  filing: Filing;
  client?: string;
}

/** Customs filings moving through Draft → … → ACK. */
export function FilingQueue({ rows, className = "" }: { rows: readonly FilingRow[]; className?: string }) {
  return (
    <Panel
      title="Filing Queue"
      description="Shipping Bills, Bills of Entry and responses in progress."
      action={{ label: "Filings", href: FILINGS_HREF }}
      className={className}
      bodyClassName="pb-2 pt-3"
    >
      <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 px-5 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-faint sm:px-6">
        {FILING_WORKFLOW.map((step, i) => (
          <span key={step.id} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden className="size-3" />}
            {step.label}
          </span>
        ))}
      </p>

      <ul className="mt-2 divide-y divide-line">
        {rows.map(({ filing, client }) => {
          const step = filingStep(filing.status);
          const owner = OWNER[step.owner];
          const actionable = step.owner === "cha";
          return (
            <li key={filing.id} className="px-5 py-3 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{FILING_KIND_LABEL[filing.kind]}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    <ShipmentId id={filing.shipmentId} className="text-xs!" />
                    {client && ` · ${client}`}
                  </p>
                </div>
                {actionable ? (
                  <Link
                    href={FILINGS_HREF}
                    className={`inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-lg bg-teal px-3 text-xs font-semibold text-on-brand transition hover:brightness-110 ${focusRing}`}
                  >
                    {filing.nextAction}
                    <span className="sr-only">
                      {" "}
                      — {FILING_KIND_LABEL[filing.kind]} for {filing.shipmentId}
                    </span>
                  </Link>
                ) : (
                  <span className="shrink-0 whitespace-nowrap pt-0.5 text-xs text-ink-faint">
                    {filing.nextAction}
                  </span>
                )}
              </div>
              <div className="mt-2.5">
                <WorkflowBar index={step.index} owner={step.owner} />
                <p className="mt-1.5 flex justify-between gap-2 text-xs">
                  <span className="font-medium text-ink">
                    {step.label}
                    <span className="font-normal text-ink-faint">
                      {" "}
                      · step {step.index + 1} of {FILING_WORKFLOW.length}
                    </span>
                  </span>
                  <span className={`font-medium ${owner.text}`}>{owner.label}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
