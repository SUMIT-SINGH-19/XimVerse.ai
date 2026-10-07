import { Boxes, CalendarClock, Stamp, TriangleAlert, type LucideIcon } from "lucide-react";
import { formatDayMonth } from "@/lib/format";
import {
  activeImportCount,
  arrivingWithin,
  IMPORT_STAGES,
  type ImporterDashboardData,
} from "@/lib/importer-dashboard-data";

interface Metric {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  attention?: boolean;
}

function metricsFor(data: ImporterDashboardData): Metric[] {
  const arriving = arrivingWithin(data, 7);
  const stagesInUse = IMPORT_STAGES.filter((s) => s.id !== "delivered" && data.pipeline[s.id] > 0);
  const highPriority = data.actions.filter((a) => a.priority === "high").length;

  return [
    {
      label: "Active Imports",
      value: activeImportCount(data),
      hint: `Across ${stagesInUse.length} stages`,
      icon: Boxes,
    },
    {
      label: "Arriving This Week",
      value: arriving.length,
      hint: arriving[0]
        ? `Next: ${arriving[0].route.destination}, ${formatDayMonth(arriving[0].eta)}`
        : "Nothing due",
      icon: CalendarClock,
    },
    {
      label: "Customs Pending",
      value: data.pipeline.customs,
      hint: "Awaiting clearance",
      icon: Stamp,
    },
    {
      label: "Actions Required",
      value: data.actions.length,
      hint: highPriority ? `${highPriority} high priority` : "None urgent",
      icon: TriangleAlert,
      attention: data.actions.length > 0,
    },
  ];
}

export function OperationalSummary({ data }: { data: ImporterDashboardData }) {
  return (
    <section aria-label="Operational summary">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metricsFor(data).map(({ label, value, hint, icon: Icon, attention }) => (
          <div
            key={label}
            className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5"
          >
            <span
              aria-hidden
              className={`hidden size-9 shrink-0 place-items-center rounded-lg sm:grid ${
                attention ? "bg-orange-soft text-orange" : "bg-teal-soft text-teal"
              }`}
            >
              <Icon className="size-4.5" />
            </span>
            <div className="flex min-w-0 flex-col">
              <dt className="text-xs font-medium text-ink-muted">{label}</dt>
              <dd className="order-first text-2xl font-semibold tabular-nums tracking-tight text-ink">
                {value}
              </dd>
              <dd className="mt-0.5 truncate text-xs text-ink-faint">{hint}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
