import Link from "next/link";
import { ArrowRight, Plane, Ship, Truck, type LucideIcon } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { freightForwarderHref } from "@/lib/freight-forwarder-nav";
import {
  MODE_LABEL,
  STAKEHOLDER_LABEL,
  type Lane,
  type Stakeholder,
  type TransportMode,
} from "@/lib/freight-forwarder-dashboard-data";

/* ------------------------------------------------------------------------ */
/* Formatting                                                                */
/* ------------------------------------------------------------------------ */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** 142000 → "₹1,42,000". */
export function formatInr(amount: number): string {
  return inr.format(amount);
}

/** 840000 → "₹8.4L", 25000000 → "₹2.5Cr". */
export function formatInrCompact(amount: number): string {
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (amount >= 1e7) return `₹${trim(amount / 1e7)}Cr`;
  if (amount >= 1e5) return `₹${trim(amount / 1e5)}L`;
  return formatInr(amount);
}

/** "8 Oct · 6:00 PM" in the given time zone. */
export function formatClock(at: string, timeZone: string): string {
  const date = new Date(at);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(date);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone })
    .format(date)
    // Some ICU versions use a narrow no-break space before AM/PM.
    .replace(/\s/g, " ");
  return `${day} · ${time}`;
}

export function minutesUntil(at: string, asOf: string): number {
  return Math.round((Date.parse(at) - Date.parse(asOf)) / 60_000);
}

/** 135 → "2h 15m", 1620 → "1d 3h". */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "Overdue";
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/* ------------------------------------------------------------------------ */
/* Small display pieces                                                      */
/* ------------------------------------------------------------------------ */

const MODE_ICON: Record<TransportMode, LucideIcon> = { ocean: Ship, air: Plane, road: Truck };

export function ModeBadge({ mode, className = "" }: { mode: TransportMode; className?: string }) {
  const Icon = MODE_ICON[mode];
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-ink-muted ${className}`}>
      <Icon aria-hidden className="size-3.5 text-teal" />
      {MODE_LABEL[mode]}
    </span>
  );
}

/** "Kochi → Rotterdam", read by screen readers as "Kochi to Rotterdam". */
export function LaneLabel({ lane, className = "" }: { lane: Lane; className?: string }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 ${className}`}>
      <span>{lane.origin}</span>
      <ArrowRight aria-hidden className="size-3.5 shrink-0 text-ink-faint" />
      <span className="sr-only">to</span>
      <span>{lane.destination}</span>
    </span>
  );
}

/** Monospace shipment / RFQ / booking reference. */
export function RefId({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`whitespace-nowrap font-mono text-[0.8125rem] tracking-tight ${className}`}>{children}</span>;
}

/** Who a step is waiting on; the forwarder's own items stand out. */
export function WaitingOn({ party }: { party: Stakeholder }) {
  const yours = party === "forwarder";
  return (
    <span className={`text-xs ${yours ? "font-semibold text-orange" : "text-ink-muted"}`}>
      <span className="text-ink-faint">Waiting on </span>
      {yours ? "you" : STAKEHOLDER_LABEL[party]}
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Calls to action                                                           */
/* ------------------------------------------------------------------------ */

export type CtaVariant = "primary" | "secondary" | "quiet";

const CTA_STYLE: Record<CtaVariant, string> = {
  primary: "h-9 px-4 bg-teal text-on-brand hover:brightness-110",
  secondary: "h-9 px-4 border border-line text-ink hover:border-teal/40 hover:bg-teal-soft",
  quiet: "h-8 px-2 text-teal hover:bg-teal-soft hover:text-ink",
};

export function ctaClass(variant: CtaVariant = "secondary", className = "") {
  return `inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition ${focusRing} ${CTA_STYLE[variant]} ${className}`;
}

/**
 * Link to a workspace section. `context` names what the action applies to, for
 * screen readers that list links out of context ("Track XMV-1041").
 */
export function CtaLink({
  section,
  label,
  context,
  variant = "secondary",
  className = "",
}: {
  section: string;
  label: string;
  context?: string;
  variant?: CtaVariant;
  className?: string;
}) {
  return (
    <Link href={freightForwarderHref(section)} className={ctaClass(variant, className)}>
      {label}
      {context && <span className="sr-only"> {context}</span>}
    </Link>
  );
}

/** An action with no backend yet: rendered, focusable, does nothing. */
export function CtaButton({
  label,
  context,
  variant = "secondary",
  className = "",
}: {
  label: string;
  context?: string;
  variant?: CtaVariant;
  className?: string;
}) {
  return (
    <button type="button" className={ctaClass(variant, className)}>
      {label}
      {context && <span className="sr-only"> {context}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/* Responsive table                                                          */
/* ------------------------------------------------------------------------ */

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Classes for the column's cells in table layout. */
  className?: string;
  /** Leave out of the stacked cards, e.g. because the card header shows it. */
  hideInCard?: boolean;
}

const BREAKPOINT = {
  lg: { table: "hidden lg:block", cards: "lg:hidden" },
  xl: { table: "hidden xl:block", cards: "xl:hidden" },
  "2xl": { table: "hidden 2xl:block", cards: "2xl:hidden" },
} as const;

/**
 * A table on wide screens and a list of cards below that. The first column is
 * the row header. `action` renders in a trailing column / the card footer.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  cardTitle,
  action,
  wideFrom = "xl",
}: {
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T) => string;
  /** Accessible name of the table. */
  caption: string;
  cardTitle: (row: T) => React.ReactNode;
  action?: (row: T) => React.ReactNode;
  wideFrom?: keyof typeof BREAKPOINT;
}) {
  const [first, ...rest] = columns;
  const bp = BREAKPOINT[wideFrom];

  return (
    <>
      <div className={`${bp.table} overflow-x-auto pb-2`}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-y border-line bg-canvas/60 text-xs text-ink-muted">
              <th scope="col" className={`py-2.5 pl-6 pr-3 font-medium ${first.className ?? ""}`}>
                {first.header}
              </th>
              {rest.map((col) => (
                <th key={col.header} scope="col" className={`px-3 py-2.5 font-medium ${col.className ?? ""}`}>
                  {col.header}
                </th>
              ))}
              {action && (
                <th scope="col" className="py-2.5 pl-3 pr-6 text-right font-medium">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="align-top transition-colors hover:bg-canvas/60">
                <th scope="row" className={`py-3.5 pl-6 pr-3 font-normal ${first.className ?? ""}`}>
                  {first.cell(row)}
                </th>
                {rest.map((col) => (
                  <td key={col.header} className={`px-3 py-3.5 ${col.className ?? ""}`}>
                    {col.cell(row)}
                  </td>
                ))}
                {action && <td className="py-3 pl-3 pr-6 text-right">{action(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label={caption} className={`${bp.cards} grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2 sm:px-6`}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="flex flex-col rounded-xl border border-line p-4">
            <div>{cardTitle(row)}</div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {columns
                .filter((col) => !col.hideInCard)
                .map((col) => (
                  <div key={col.header} className="min-w-0">
                    <dt className="text-xs text-ink-faint">{col.header}</dt>
                    <dd className="mt-0.5 text-ink">{col.cell(row)}</dd>
                  </div>
                ))}
            </dl>
            {action && (
              <div className="mt-auto pt-3">
                <div className="flex justify-end border-t border-line pt-3">{action(row)}</div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
