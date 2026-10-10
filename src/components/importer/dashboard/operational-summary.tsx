import { Boxes, CalendarClock, Stamp, TriangleAlert, type LucideIcon } from "lucide-react";
import { formatDayMonth } from "@/lib/format";
import {
  activeImportCount,
  arrivingWithin,
  IMPORT_STAGES,
  type ImporterDashboardData,
} from "@/lib/importer-dashboard-data";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n/translate";

interface Metric {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  attention?: boolean;
}

function metricsFor(data: ImporterDashboardData, t: Translate): Metric[] {
  const arriving = arrivingWithin(data, 7);
  const stagesInUse = IMPORT_STAGES.filter((s) => s.id !== "delivered" && data.pipeline[s.id] > 0);
  const highPriority = data.actions.filter((a) => a.priority === "high").length;

  return [
    {
      label: t("Active Imports"),
      value: activeImportCount(data),
      hint: t("Across {count} stages", { count: stagesInUse.length }),
      icon: Boxes,
    },
    {
      label: t("Arriving This Week"),
      value: arriving.length,
      hint: arriving[0]
        ? t("Next: {place}, {date}", { place: arriving[0].route.destination, date: formatDayMonth(arriving[0].eta) })
        : t("Nothing due"),
      icon: CalendarClock,
    },
    {
      label: t("Customs Pending"),
      value: data.pipeline.customs,
      hint: t("Awaiting clearance"),
      icon: Stamp,
    },
    {
      label: t("Actions Required"),
      value: data.actions.length,
      hint: highPriority ? t("{count} high priority", { count: highPriority }) : t("None urgent"),
      icon: TriangleAlert,
      attention: data.actions.length > 0,
    },
  ];
}

export async function OperationalSummary({ data }: { data: ImporterDashboardData }) {
  const t = await getT();

  return (
    <section aria-label={t("Operational summary")}>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metricsFor(data, t).map(({ label, value, hint, icon: Icon, attention }) => (
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
