import { CircleAlert, Info, Lock, OctagonAlert } from "lucide-react";
import type { DeviationSeverity, QuotationDeviation } from "@/lib/exporter-quotations";

export const input =
  "h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20 aria-invalid:border-orange disabled:cursor-not-allowed disabled:opacity-60";

export const textarea = `${input} h-auto min-h-20 py-2`;

/** A numbered block of the quotation form. */
export function QuoteSection({
  n,
  title,
  description,
  children,
}: {
  n: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`q-section-${n}`} className="rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 id={`q-section-${n}`} className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          <span aria-hidden className="grid size-6 place-items-center rounded-md bg-teal-soft text-xs font-bold text-teal">
            {n}
          </span>
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      <div className="space-y-4 px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export function FormField({
  id,
  label,
  error,
  hint,
  children,
  className = "",
}: {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-orange">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

/** Buyer's value, shown beside the exporter's answer. Read-only. */
export function BuyerAsked({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-canvas px-3 py-2 text-sm text-ink-muted">
      <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden />
      <span>
        <span className="font-medium text-ink">Buyer requested:</span> {children}
      </span>
    </p>
  );
}

const SEVERITY: Record<DeviationSeverity, { icon: typeof Info; className: string; label: string }> = {
  blocking: { icon: OctagonAlert, className: "bg-orange text-on-brand", label: "Blocking" },
  warning: { icon: CircleAlert, className: "bg-orange-soft text-orange", label: "Deviation" },
  info: { icon: Info, className: "bg-canvas text-ink-muted ring-1 ring-inset ring-line", label: "Note" },
};

export function SeverityBadge({ severity }: { severity: DeviationSeverity }) {
  const s = SEVERITY[severity];
  const Icon = s.icon;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${s.className}`}>
      <Icon className="size-3" aria-hidden />
      {s.label}
    </span>
  );
}

/** Deviations for one field, shown inline under the section that causes them. */
export function InlineDeviations({ items }: { items: readonly QuotationDeviation[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm text-ink">
          <SeverityBadge severity={d.severity} />
          {d.message}
        </li>
      ))}
    </ul>
  );
}

export function invalidProps(id: string, error?: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};
}
