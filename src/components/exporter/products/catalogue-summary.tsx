import { CircleGauge, Layers, PackageCheck, Target, Warehouse } from "lucide-react";
import type { catalogueSummary } from "@/lib/exporter-products";

type Summary = ReturnType<typeof catalogueSummary>;

const nf = new Intl.NumberFormat("en-IN");

export function CatalogueSummary({ summary }: { summary: Summary }) {
  const metrics = [
    { key: "active", label: "Active Products", value: String(summary.activeProducts), icon: Layers },
    { key: "ready", label: "RFQ-Ready Products", value: String(summary.rfqReady), icon: PackageCheck },
    { key: "capacity", label: "Monthly Supply Capacity", value: `${nf.format(summary.monthlyCapacity)} MT`, icon: Warehouse },
    { key: "available", label: "Available Capacity", value: `${nf.format(summary.availableCapacity)} MT`, icon: CircleGauge },
    {
      key: "coverage",
      label: "Matching Coverage",
      value: `${summary.matchingCoverage}%`,
      icon: Target,
      note: "How complete your product profiles are for strong RFQ matching, on average.",
    },
  ];

  return (
    <ul aria-label="Catalogue summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {metrics.map(({ key, label, value, icon: Icon, note }) => (
        <li
          key={key}
          className="flex flex-col rounded-2xl border border-line bg-surface p-4 last:col-span-2 sm:last:col-span-1"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-ink-muted">{label}</span>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-soft text-teal">
              <Icon className="size-4" aria-hidden />
            </span>
          </span>
          <span className="mt-2 text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</span>
          {note && <span className="mt-1 text-xs leading-snug text-ink-muted">{note}</span>}
        </li>
      ))}
    </ul>
  );
}
