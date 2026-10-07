import { Pencil } from "lucide-react";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { focusRing } from "@/components/workspace/styles";
import { VERIFICATION_STATUS_LABEL, type Certification } from "@/lib/exporter-company";

/*
 * Building blocks of the company profile page. Exporter-only for now; promote
 * to components/workspace/ if the importer profile turns out to need them too.
 */

/**
 * Profiles aren't saved anywhere yet, so Edit is presentational: it shows
 * where editing will live without pretending to save.
 */
export function EditButton({ section }: { section: string }) {
  return (
    <button
      type="button"
      title="Editing arrives once profiles are saved to your account"
      aria-label={`Edit ${section}`}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-teal transition-colors hover:border-teal hover:bg-teal-soft ${focusRing}`}
    >
      <Pencil className="size-3.5" aria-hidden />
      Edit
    </button>
  );
}

/** A titled card on the profile page, addressable by `id` for in-page links. */
export function ProfileSection({
  id,
  title,
  description,
  aside,
  editable = true,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  /** Header content beside the title, before the Edit button. */
  aside?: React.ReactNode;
  editable?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-24 rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(11,46,48,0.04)]"
    >
      <div className="flex items-start gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-heading`} className="text-base font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 max-w-2xl text-sm text-ink-muted">{description}</p>}
        </div>
        {(aside || editable) && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {aside}
            {editable && <EditButton section={title} />}
          </div>
        )}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

/** Two-column definition grid for label / value pairs. */
export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{children}</dl>;
}

export function Field({
  label,
  children,
  wide = false,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  /** Span both columns. */
  wide?: boolean;
  hint?: string;
}) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-faint">{label}</dt>
      <dd className="mt-1.5 text-sm text-ink [overflow-wrap:anywhere]">{children}</dd>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export function Chips({
  items,
  tone = "neutral",
}: {
  items: readonly string[];
  tone?: "neutral" | "brand" | "outline";
}) {
  const toneClass = {
    neutral: "bg-canvas text-ink ring-1 ring-inset ring-line",
    brand: "bg-teal-soft text-teal",
    outline: "border border-dashed border-line text-ink-muted",
  }[tone];

  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item} className={`max-w-full rounded-lg px-2.5 py-1 text-sm font-medium ${toneClass}`}>
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Horizontal bar for a 0–100 value. */
export function Meter({
  value,
  label,
  className = "",
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={`h-1.5 overflow-hidden rounded-full bg-teal-soft ${className}`}
    >
      <div className="h-full rounded-full bg-teal" style={{ width: `${value}%` }} />
    </div>
  );
}

const STATUS_TONE: Record<Certification["status"], PillTone> = {
  verified: "brand",
  pending: "accent",
  "not-added": "muted",
  expired: "accent",
  "per-shipment": "neutral",
};

export function VerificationPill({ status }: { status: Certification["status"] }) {
  const label = status === "per-shipment" ? "Per shipment" : VERIFICATION_STATUS_LABEL[status];
  return (
    <StatusPill tone={STATUS_TONE[status]}>
      {status === "verified" && <span aria-hidden className="size-1.5 rounded-full bg-teal" />}
      {label}
    </StatusPill>
  );
}
