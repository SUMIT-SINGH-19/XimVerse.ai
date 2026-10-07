import Link from "next/link";
import { Sparkles } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { freightForwarderHref } from "@/lib/freight-forwarder-nav";
import type { Severity, SUMITInsight } from "@/lib/freight-forwarder-dashboard-data";
import { RefId } from "./dashboard-ui";

const DOT: Record<Severity, string> = {
  critical: "bg-orange",
  warning: "bg-orange/50",
  info: "bg-teal",
};

/**
 * SUMIT's read of the day: the few things that matter most, each tied to a
 * shipment or RFQ. The insights are mock data until SUMIT is connected.
 */
export function SumitCard({
  insights,
  prioritiesHref,
  className = "",
}: {
  insights: readonly SUMITInsight[];
  /** Where "Review Priorities" jumps to, e.g. the Action Required section. */
  prioritiesHref: string;
  className?: string;
}) {
  const count = insights.length;

  return (
    <section
      aria-labelledby="ff-sumit"
      className={`flex flex-col rounded-2xl border border-teal/15 bg-teal-soft/60 p-5 sm:p-6 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal text-on-brand">
          <Sparkles className="size-4.5" />
        </span>
        <div>
          <h2 id="ff-sumit" className="text-base font-semibold tracking-tight text-ink">
            SUMIT
          </h2>
          <p className="text-sm text-ink-muted">Freight Operations Intelligence</p>
        </div>
      </div>

      <p className="mt-4 text-lg font-semibold tracking-tight text-ink">
        {count
          ? `${count} ${count === 1 ? "priority needs" : "priorities need"} your attention.`
          : "Nothing unusual across your shipments."}
      </p>

      {count > 0 && (
        <ul className="mt-3 space-y-3">
          {insights.map((item) => (
            <li key={item.id} className="flex gap-2.5 text-sm">
              <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[item.severity]}`} />
              <p className="text-ink-muted">
                <RefId className="font-semibold text-ink">{item.reference}</RefId> {item.message}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Link
          href={prioritiesHref}
          className={`inline-flex h-9 items-center rounded-lg bg-teal px-4 text-sm font-semibold text-on-brand transition hover:brightness-110 ${focusRing}`}
        >
          Review Priorities
        </Link>
        <Link
          href={freightForwarderHref("sumit")}
          className={`inline-flex h-9 items-center rounded-lg border border-teal/25 bg-surface px-4 text-sm font-semibold text-teal transition hover:bg-teal-soft ${focusRing}`}
        >
          Ask SUMIT
        </Link>
      </div>
    </section>
  );
}
