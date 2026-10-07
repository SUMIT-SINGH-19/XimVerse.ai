import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { PRODUCT_STATUS_LABEL, readinessBand, type ProductStatus } from "@/lib/exporter-products";

const STATUS_TONE: Record<ProductStatus, PillTone> = {
  active: "brand",
  "needs-information": "accent",
  paused: "neutral",
  draft: "muted",
};

export function ProductStatusPill({ status }: { status: ProductStatus }) {
  return (
    <StatusPill tone={STATUS_TONE[status]}>
      {status === "active" && <span aria-hidden className="size-1.5 rounded-full bg-teal" />}
      {PRODUCT_STATUS_LABEL[status]}
    </StatusPill>
  );
}

/** Readiness percentage with a short bar; low scores read in the accent colour. */
export function ReadinessScore({ score, wide = false }: { score: number; wide?: boolean }) {
  const low = readinessBand(score) === "low";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        role="meter"
        aria-label="RFQ match readiness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        className={`h-1.5 overflow-hidden rounded-full ${low ? "bg-orange-soft" : "bg-teal-soft"} ${wide ? "w-24" : "w-10"}`}
      >
        <span
          className={`block h-full rounded-full ${low ? "bg-orange" : "bg-teal"}`}
          style={{ width: `${score}%` }}
        />
      </span>
      <span className={`text-sm font-semibold tabular-nums ${low ? "text-orange" : "text-teal"}`}>{score}%</span>
    </span>
  );
}

/** Small heading used between blocks inside the product detail. */
export function DetailHeading({ letter, children }: { letter: string; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
      <span
        aria-hidden
        className="grid size-5 place-items-center rounded-md bg-teal-soft text-[0.6875rem] font-bold text-teal"
      >
        {letter}
      </span>
      {children}
    </h3>
  );
}
