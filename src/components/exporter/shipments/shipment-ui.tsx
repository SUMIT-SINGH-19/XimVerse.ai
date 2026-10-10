import { Check, CircleAlert, CircleCheck } from "lucide-react";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { SHIPMENT_STATUS_LABEL, type ReadinessItem, type ShipmentStatus } from "@/lib/exporter-shipments";

const TONE: Record<ShipmentStatus, PillTone> = {
  preparing: "accent",
  "freight-setup": "accent",
  "customs-preparation": "neutral",
  "ready-to-ship": "brand",
  "at-origin": "brand",
  loaded: "brand",
  "in-transit": "solid",
  arrived: "solid",
  delivered: "muted",
  cancelled: "muted",
};

export function ShipmentStatusPill({ status }: { status: ShipmentStatus }) {
  return <StatusPill tone={TONE[status]}>{SHIPMENT_STATUS_LABEL[status]}</StatusPill>;
}

export function DemoTag() {
  return (
    <span className="rounded-full border border-orange/40 px-1.5 text-[0.6875rem] font-medium text-orange" title="Recorded by hand in this demo — no external system">
      Demo
    </span>
  );
}

/** A labelled 0–100 bar. */
export function Meter({ value, label }: { value: number; label: string }) {
  return (
    <span className="block">
      <span className="mb-1 flex justify-between text-xs text-ink-muted">
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-ink">{value}%</span>
      </span>
      <span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="block h-1.5 w-full overflow-hidden rounded-full bg-teal-soft">
        <span className={`block h-full rounded-full ${value === 100 ? "bg-teal" : value >= 50 ? "bg-teal/80" : "bg-orange"}`} style={{ width: `${value}%` }} />
      </span>
    </span>
  );
}

export function ReadinessList({ items }: { items: readonly ReadinessItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.key} className="flex items-start gap-2 text-sm">
          {r.done ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-label="Done" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-label="Pending" />}
          <span className="min-w-0">
            <span className={r.done ? "text-ink-muted" : "font-medium text-ink"}>{r.label}</span>
            {r.detail && <span className="block text-xs text-ink-muted [overflow-wrap:anywhere]">{r.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Horizontal step indicator for forward-only workflows (shipping bill, BL / AWB). */
export function Stepper({ steps, current }: { steps: readonly { id: string; label: string }[]; current: string }) {
  const index = steps.findIndex((s) => s.id === current);
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs">
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-center gap-1.5">
          <span
            aria-current={i === index ? "step" : undefined}
            className={`rounded-md px-2 py-0.5 font-medium ${i === index ? "bg-teal text-on-brand" : i < index ? "bg-teal-soft text-teal" : "bg-canvas text-ink-faint ring-1 ring-inset ring-line"}`}
          >
            {i < index && <Check className="mr-0.5 inline size-3" aria-hidden />}
            {s.label}
          </span>
          {i < steps.length - 1 && <span aria-hidden className="text-ink-faint">→</span>}
        </li>
      ))}
    </ol>
  );
}
