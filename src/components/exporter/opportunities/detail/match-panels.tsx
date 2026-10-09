import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { ProductStatusPill, ReadinessScore } from "@/components/exporter/products/product-ui";
import { exporterHref } from "@/lib/exporter-nav";
import { formatQuantity } from "@/lib/exporter-dashboard";
import type { ExporterProduct } from "@/lib/exporter-products";
import {
  CAPACITY_FIT_LABEL,
  capacityFit,
  formatOpportunityQuantity,
  type BuyerOpportunity,
  type CapacityFit,
} from "@/lib/exporter-opportunities";
import { MatchReasons, MatchScore } from "../opportunity-ui";

function Card({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-2xl border border-line bg-surface p-5">
      <h2 id={`${id}-heading`} className="text-base font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function WhyMatched({ o }: { o: BuyerOpportunity }) {
  const strengths = o.match.reasons.filter((r) => r.kind === "strength");
  const gaps = o.match.reasons.filter((r) => r.kind === "gap");
  return (
    <Card id="why" title="Why Ximverse Matched You">
      <MatchScore score={o.match.score} size="lg" />
      <p className="mt-2 text-xs text-ink-muted">
        Based on product, capacity, certifications, destination experience and commercial fit.
      </p>
      <div className="mt-4 space-y-4">
        <MatchReasons reasons={strengths} />
        {gaps.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">Potential gaps</p>
            <div className="mt-2">
              <MatchReasons reasons={gaps} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

const FIT_TONE: Record<CapacityFit, PillTone> = {
  strong: "brand",
  moderate: "brand",
  tight: "accent",
  partial: "accent",
  insufficient: "accent",
  "not-comparable": "neutral",
};

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** Requested vs available capacity. Demo arithmetic only; nothing is reserved. */
function CapacityFitView({ o, product }: { o: BuyerOpportunity; product: ExporterProduct }) {
  const r = capacityFit(o, product.supply.availableCapacity.value);
  if (r.requested === undefined) {
    return <p className="text-sm text-ink-muted">The requested unit can&apos;t be compared with capacity in MT.</p>;
  }
  const used = Math.min(100, (r.utilisation ?? 0) * 100);
  const minimum =
    o.quantity.minimumAcceptable !== undefined && o.quantity.unit === "MT"
      ? Math.min(100, (o.quantity.minimumAcceptable / r.available) * 100)
      : undefined;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">Capacity fit</p>
        <StatusPill tone={FIT_TONE[r.fit]}>{CAPACITY_FIT_LABEL[r.fit]}</StatusPill>
      </div>
      <div
        role="img"
        aria-label={`Order uses ${Math.round(used)}% of available capacity`}
        className="relative mt-3 h-3 overflow-hidden rounded-full bg-teal-soft"
      >
        <div className={`h-full rounded-full ${r.fit === "tight" || r.fit === "insufficient" || r.fit === "partial" ? "bg-orange" : "bg-teal"}`} style={{ width: `${used}%` }} />
        {minimum !== undefined && (
          <span aria-hidden className="absolute inset-y-0 w-0.5 bg-surface" style={{ left: `${minimum}%` }} />
        )}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-ink-faint">Buyer requires</dt>
          <dd className="font-semibold tabular-nums text-ink">{nf.format(r.requested)} MT</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">Available now</dt>
          <dd className="font-semibold tabular-nums text-teal">{nf.format(r.available)} MT</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">After fulfilment</dt>
          <dd className={`font-semibold tabular-nums ${(r.remaining ?? 0) < 0 ? "text-orange" : "text-ink"}`}>
            {nf.format(r.remaining ?? 0)} MT
          </dd>
        </div>
      </dl>
      {minimum !== undefined && (
        <p className="mt-2 text-xs text-ink-muted">
          Marker shows the buyer&apos;s minimum acceptable quantity ({nf.format(o.quantity.minimumAcceptable!)} MT).
        </p>
      )}
    </div>
  );
}

export function ProductMatch({ o, product }: { o: BuyerOpportunity; product?: ExporterProduct }) {
  if (!product) {
    return (
      <Card id="product-match" title="Your Product Match">
        <p className="text-sm text-ink-muted">The matched product is no longer in your catalogue.</p>
      </Card>
    );
  }
  const s = product.supply;
  return (
    <Card id="product-match" title="Your Product Match">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{product.name}</p>
          <p className="font-mono text-xs text-ink-muted">{product.productCode}</p>
        </div>
        <ProductStatusPill status={product.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-ink-faint">Product readiness</dt>
          <dd>
            <ReadinessScore score={product.readiness} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">Buyer requirement</dt>
          <dd className="font-medium text-ink">{formatOpportunityQuantity(o.quantity)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">Available capacity</dt>
          <dd className="font-semibold text-teal">{formatQuantity(s.availableCapacity)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">MOQ</dt>
          <dd className="font-medium text-ink">{formatQuantity(s.moq)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-ink-faint">Typical lead time</dt>
          <dd className="font-medium text-ink">
            {s.leadTimeDays.min}–{s.leadTimeDays.max} days
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-line pt-4">
        <CapacityFitView o={o} product={product} />
      </div>

      <Link
        href={exporterHref("products")}
        className={`mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal hover:text-ink ${focusRing}`}
      >
        Open Product Profile
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function SumitNotes({ notes }: { notes: readonly string[] }) {
  return (
    <aside aria-label="SUMIT insight" className="rounded-2xl border border-teal/15 bg-teal-soft p-5">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal">
        <Sparkles className="size-3.5 text-orange" aria-hidden />
        SUMIT insight
      </p>
      <ul className="mt-2 space-y-2">
        {notes.map((n) => (
          <li key={n} className="text-sm leading-relaxed text-ink">
            {n}
          </li>
        ))}
      </ul>
    </aside>
  );
}
