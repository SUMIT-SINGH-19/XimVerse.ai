import { CircleCheck, CircleX } from "lucide-react";
import { Panel } from "@/components/workspace/panel";
import { chaHref } from "@/lib/cha-nav";
import {
  COMPLIANCE_CHECK_LABEL,
  complianceScore,
  type ComplianceReport,
} from "@/lib/cha-dashboard-data";
import { ShipmentId } from "./cha-badges";

export interface ComplianceRow {
  report: ComplianceReport;
  client?: string;
}

/** Readiness of each shipment's data and documents, as validated by Sumit. */
export function ComplianceHealth({
  rows,
  className = "",
}: {
  rows: readonly ComplianceRow[];
  className?: string;
}) {
  return (
    <Panel
      title="Compliance Health"
      description="Sumit's checks on invoices, registrations, schemes and container data."
      action={{ label: "Compliance", href: chaHref("compliance") }}
      className={className}
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ report, client }) => {
          const score = complianceScore(report);
          const ready = score.issues.length === 0;
          return (
            <li key={report.shipmentId} className="rounded-xl border border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <ShipmentId id={report.shipmentId} className="block font-semibold text-ink" />
                  {client && <p className="truncate text-xs text-ink-muted">{client}</p>}
                </div>
                <p className={`shrink-0 text-right text-sm font-semibold ${ready ? "text-teal" : "text-ink"}`}>
                  {ready ? "100% Ready" : `${score.percent}% Complete`}
                </p>
              </div>

              <div
                role="progressbar"
                aria-label={`${report.shipmentId} readiness`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score.percent}
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
              >
                <div
                  className={`h-full rounded-full ${ready ? "bg-teal" : "bg-orange"}`}
                  style={{ width: `${score.percent}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-ink-faint">
                {score.passed} of {score.total} checks passed
                {!ready && (
                  <span className="font-medium text-orange">
                    {" "}
                    · {score.issues.length} {score.issues.length === 1 ? "issue" : "issues"} remaining
                  </span>
                )}
              </p>

              {ready ? (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-teal">
                  <CircleCheck aria-hidden className="size-4 shrink-0" />
                  All documents validated
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {score.issues.map((c) => (
                    <li key={c.check} className="flex items-start gap-1.5 text-sm">
                      <CircleX aria-hidden className="mt-0.5 size-4 shrink-0 text-orange" />
                      <span className="min-w-0">
                        <span className="text-ink">{c.issue}</span>
                        <span className="block text-xs text-ink-faint">{COMPLIANCE_CHECK_LABEL[c.check]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
