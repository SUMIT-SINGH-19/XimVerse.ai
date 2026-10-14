import { ArrowRight } from "lucide-react";
import { T } from "@/i18n/client";

export interface TradeRoute {
  origin: string;
  destination: string;
}

/** A titled section of the dashboard. Translates its title and description. */
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
            <T>{title}</T>
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-ink-muted">
              <T>{description}</T>
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** "Dubai → Mumbai", read by screen readers as "Dubai to Mumbai". */
export function RouteLabel({ route, className = "" }: { route: TradeRoute; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{route.origin}</span>
      <ArrowRight aria-hidden className="size-3.5 shrink-0 text-ink-faint" />
      <span className="sr-only">
        <T>to</T>
      </span>
      <span>{route.destination}</span>
    </span>
  );
}

export function ImportId({ id, className = "" }: { id: string; className?: string }) {
  return <span className={`font-mono text-[0.8125rem] tracking-tight ${className}`}>{id}</span>;
}
