import { T } from "@/i18n/client";

export type PillTone = "brand" | "accent" | "solid" | "neutral" | "muted";

const TONES: Record<PillTone, string> = {
  /** Teal: positive progress, e.g. shortlisted. */
  brand: "bg-teal-soft text-teal",
  /** Orange: needs attention, e.g. new or in negotiation. */
  accent: "bg-orange-soft text-orange",
  /** Filled teal: a final, successful state. */
  solid: "bg-teal text-on-brand",
  neutral: "bg-canvas text-ink-muted ring-1 ring-inset ring-line",
  muted: "bg-canvas text-ink-faint",
};

/** Small rounded status label. Callers map their own statuses to a tone; plain-text labels are translated. */
export function StatusPill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {typeof children === "string" ? <T>{children}</T> : children}
    </span>
  );
}
