import { ArrowRight } from "lucide-react";
import type { ImportStatus, TradeRoute } from "@/lib/importer-dashboard-data";
import { IMPORT_STATUS_LABEL } from "@/lib/importer-dashboard-data";

/** A titled section of the dashboard. */
export function Panel({
  id,
  title,
  description,
  action,
  className = "",
  children,
}: {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={`rounded-2xl border border-line bg-surface ${className}`}>
      <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const STATUS_STYLE: Record<ImportStatus, string> = {
  "action-required": "bg-orange-soft text-orange",
  "pending-clarification": "border border-orange/35 text-orange",
  "on-track": "bg-teal-soft text-teal",
  "preparing-shipment": "border border-line text-ink-muted",
};

export function StatusBadge({ status }: { status: ImportStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {IMPORT_STATUS_LABEL[status]}
    </span>
  );
}

/** "Dubai → Mumbai", read by screen readers as "Dubai to Mumbai". */
export function RouteLabel({ route, className = "" }: { route: TradeRoute; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{route.origin}</span>
      <ArrowRight aria-hidden className="size-3.5 shrink-0 text-ink-faint" />
      <span className="sr-only">to</span>
      <span>{route.destination}</span>
    </span>
  );
}

export function ImportId({ id, className = "" }: { id: string; className?: string }) {
  return <span className={`font-mono text-[0.8125rem] tracking-tight ${className}`}>{id}</span>;
}
