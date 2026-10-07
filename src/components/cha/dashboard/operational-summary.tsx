import {
  CalendarCheck,
  FileClock,
  FileUp,
  Hourglass,
  MessageSquareWarning,
  Ship,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { focusRing } from "@/components/workspace/styles";
import { chaHref } from "@/lib/cha-nav";
import type { ChaSummary } from "@/lib/cha-dashboard-data";

interface Metric {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  /** Section the card opens. */
  slug: string;
  attention?: boolean;
}

function metricsFor(s: ChaSummary): Metric[] {
  return [
    {
      label: "Active Shipments",
      value: s.active,
      hint: `${s.active - s.activeImports} export · ${s.activeImports} import`,
      icon: Ship,
      slug: "shipments",
    },
    {
      label: "Awaiting Documents",
      value: s.awaitingDocuments,
      hint: "Waiting on clients",
      icon: FileClock,
      slug: "documents",
    },
    {
      label: "Ready for Filing",
      value: s.readyToFile,
      hint: s.readyForDsc ? `${s.readyForDsc} ready for DSC` : "Drafts generated",
      icon: FileUp,
      slug: "filings",
    },
    {
      label: "Customs Queries",
      value: s.customsQueries,
      hint: s.criticalQueries ? `${s.criticalQueries} critical` : "None critical",
      icon: MessageSquareWarning,
      slug: "queries",
      attention: s.criticalQueries > 0,
    },
    {
      label: "Clearance Today",
      value: s.clearanceToday,
      hint: `${s.clearedToday} already cleared`,
      icon: CalendarCheck,
      slug: "shipments",
    },
    {
      label: "Delayed / SLA Risk",
      value: s.slaRisk,
      hint: s.delayed ? `${s.delayed} delayed` : "None delayed",
      icon: Hourglass,
      slug: "shipments",
      attention: s.slaRisk > 0,
    },
  ];
}

/** Headline counts; each card opens the section it summarises. */
export function OperationalSummary({ summary }: { summary: ChaSummary }) {
  return (
    <section aria-label="Operational summary">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {metricsFor(summary).map(({ label, value, hint, icon: Icon, slug, attention }) => (
          <li key={label}>
            <Link
              href={chaHref(slug)}
              className={`group flex h-full flex-col rounded-xl border bg-surface px-4 py-3.5 transition hover:border-teal/40 hover:shadow-sm ${focusRing} ${
                attention ? "border-orange/30" : "border-line"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</span>
                <span
                  aria-hidden
                  className={`grid size-8 place-items-center rounded-lg ${
                    attention ? "bg-orange-soft text-orange" : "bg-teal-soft text-teal"
                  }`}
                >
                  <Icon className="size-4" />
                </span>
              </span>
              <span className="mt-1 text-xs font-medium text-ink-muted group-hover:text-ink">{label}</span>
              <span className={`mt-0.5 truncate text-xs ${attention ? "text-orange" : "text-ink-faint"}`}>
                {hint}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
