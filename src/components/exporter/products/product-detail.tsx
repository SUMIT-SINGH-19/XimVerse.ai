"use client";

import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Lock, Pencil, Tag, X } from "lucide-react";
import { focusRing, iconButton } from "@/components/workspace/styles";
import { Chips, Field, FieldGrid, VerificationPill } from "@/components/exporter/company/profile-ui";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDate, formatQuantity } from "@/lib/exporter-dashboard";
import { companyCertification, receivesMatches, type ExporterProduct, type InternalPriceBand } from "@/lib/exporter-products";
import { DetailHeading, ProductStatusPill, ReadinessScore } from "./product-ui";
import { MatchFlow } from "./match-flow";

function formatPriceBand({ min, max, currency, unit }: InternalPriceBand): string {
  const money = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  return `${money.format(min)}–${money.format(max)} / ${unit}`;
}

function Block({ children }: { children: React.ReactNode }) {
  return <section className="space-y-4 border-t border-line px-5 py-5 first:border-t-0 sm:px-6">{children}</section>;
}

/** Full profile of one product, shown inside the drawer. */
export function ProductDetail({ product: p, onClose }: { product: ExporterProduct; onClose: () => void }) {
  const { supply, packaging, commercial, markets } = p;
  const categoryPath = [p.sector, p.category, p.subcategory].filter(Boolean).join(" → ");

  return (
    <>
      <header className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-ink-muted [overflow-wrap:anywhere]">{p.productCode}</p>
          <h2 id="product-detail-title" className="mt-0.5 text-xl font-bold tracking-tight text-ink">
            {p.name}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <ProductStatusPill status={p.status} />
            <ReadinessScore score={p.readiness} />
            <span className="text-xs text-ink-faint">Updated {formatDate(p.updatedOn)}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close product details" className={`${iconButton} -mr-2`}>
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {p.demo && (
          <p className="mx-5 mt-5 rounded-xl bg-orange-soft px-4 py-3 text-sm text-ink sm:mx-6">
            Demo product — exists only in this browser tab and is not saved.
          </p>
        )}
        {!receivesMatches(p.status) && (
          <p className="mx-5 mt-5 rounded-xl bg-canvas px-4 py-3 text-sm text-ink-muted sm:mx-6">
            {p.status === "paused" ? "Paused" : "Draft"} products don&apos;t receive new buyer matches.
          </p>
        )}

        <Block>
          <DetailHeading letter="A">Product Identity</DetailHeading>
          <FieldGrid>
            <Field label="Product">{p.name}</Field>
            <Field label="Category">{categoryPath}</Field>
            <Field label="HS Code">
              <span className="font-mono">{p.hsCode}</span>
            </Field>
            <Field label="Origin">{p.origin}</Field>
            <Field label="Internal Code">
              <span className="font-mono">{p.productCode}</span>
            </Field>
          </FieldGrid>
        </Block>

        <Block>
          <DetailHeading letter="B">Product Specifications</DetailHeading>
          {p.specifications.length ? (
            <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
              {p.specifications.map((s) => (
                <div
                  key={s.label}
                  className="flex items-baseline justify-between gap-3 bg-surface px-4 py-2.5 text-sm sm:last:odd:col-span-2"
                >
                  <dt className="text-ink-muted">{s.label}</dt>
                  <dd className="text-right font-medium text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-ink-faint">No specifications added yet.</p>
          )}
        </Block>

        <Block>
          <DetailHeading letter="C">Supply Capability</DetailHeading>
          <FieldGrid>
            <Field label="Production Capacity">{formatQuantity(supply.monthlyProductionCapacity)} / month</Field>
            <Field label="Export Capacity">{formatQuantity(supply.monthlyExportCapacity)} / month</Field>
            <Field label="Currently Available">
              <span className="font-semibold text-teal">{formatQuantity(supply.availableCapacity)}</span>
            </Field>
            <Field label="MOQ">{formatQuantity(supply.moq)}</Field>
            <Field label="Maximum Single Order">{supply.maxSingleOrder ? formatQuantity(supply.maxSingleOrder) : "—"}</Field>
            <Field label="Lead Time">
              {supply.leadTimeDays.min}–{supply.leadTimeDays.max} days
            </Field>
          </FieldGrid>
        </Block>

        <Block>
          <DetailHeading letter="D">Packaging</DetailHeading>
          {packaging ? (
            <FieldGrid>
              <Field label="Packaging Options" wide>
                <Chips items={packaging.options.map((o) => o.label)} />
              </Field>
              {packaging.material && <Field label="Bag Material">{packaging.material}</Field>}
              <Field label="Private Label">{packaging.privateLabel ? "Available" : "Not available"}</Field>
              {packaging.palletisation && <Field label="Palletisation">{packaging.palletisation}</Field>}
              <Field label="Container Loading">
                <ul className="space-y-0.5">
                  {packaging.containerLoads.map((c) => (
                    <li key={c.container}>
                      {c.container} container: <span className="font-medium">{c.load}</span>
                    </li>
                  ))}
                </ul>
              </Field>
            </FieldGrid>
          ) : (
            <p className="text-sm text-ink-faint">No packaging options added yet.</p>
          )}
        </Block>

        <Block>
          <DetailHeading letter="E">Certifications</DetailHeading>
          <p className="text-sm text-ink-muted">
            Company certifications that apply to this product. Manage the certificates themselves in{" "}
            <Link href={exporterHref("company")} className={`font-semibold text-teal hover:text-ink ${focusRing}`}>
              Company Profile
            </Link>
            .
          </p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {p.certifications.map((pc) => {
              const cert = companyCertification(pc.certificationKey);
              if (!cert) return null;
              return (
                <li key={pc.certificationKey} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="min-w-0 text-sm">
                    <span className="font-medium text-ink">{cert.name}</span>
                    {pc.note && <span className="ml-2 text-xs text-ink-muted">{pc.note}</span>}
                  </span>
                  <VerificationPill status={cert.status} />
                </li>
              );
            })}
          </ul>
        </Block>

        <Block>
          <DetailHeading letter="F">Market Experience</DetailHeading>
          <FieldGrid>
            <Field label="Shipped To" wide>
              {markets.experienced.length ? <Chips items={markets.experienced} tone="brand" /> : "—"}
            </Field>
            <Field label="Preferred / Target Markets" wide>
              {markets.target.length ? <Chips items={markets.target} tone="outline" /> : "—"}
            </Field>
          </FieldGrid>
        </Block>

        <Block>
          <DetailHeading letter="G">Commercial Capability</DetailHeading>
          <FieldGrid>
            <Field label="Quote Currencies">
              <Chips items={commercial.quoteCurrencies} />
            </Field>
            <Field label="Supported Incoterms">
              <Chips items={commercial.incoterms} />
            </Field>
            <Field label="Payment Terms Supported" wide>
              <Chips items={commercial.paymentTerms} />
            </Field>
          </FieldGrid>
          {commercial.internalPriceBand && (
            <div className="rounded-xl border border-dashed border-line bg-canvas px-4 py-3">
              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
                <Lock className="size-3.5" aria-hidden />
                Indicative internal price band
                <span className="rounded-md bg-ink px-1.5 py-0.5 text-[0.625rem] tracking-[0.1em] text-surface">
                  PRIVATE — not visible to buyers
                </span>
              </p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-ink">
                {formatPriceBand(commercial.internalPriceBand)}
              </p>
            </div>
          )}
          <p className="flex items-start gap-2 text-sm text-ink-muted">
            <Tag className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
            Final pricing is generated per buyer RFQ based on quantity, destination, Incoterm, packaging and
            commercial terms.
          </p>
        </Block>
        <Block>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <DetailHeading letter="H">RFQ Match Readiness</DetailHeading>
            <ReadinessScore score={p.readiness} wide />
          </div>
          <p className="text-sm text-ink-muted">
            More complete product profiles improve Ximverse&apos;s ability to match relevant buyer requirements.
          </p>
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {p.readinessItems.map((item) => (
              <li key={item.key} className="flex items-start gap-2 text-sm">
                {item.done ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-label="Done" />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-label="To do" />
                )}
                <span className={item.done ? "text-ink-muted" : "font-medium text-ink"}>{item.label}</span>
              </li>
            ))}
          </ul>
          <MatchFlow />
        </Block>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 sm:px-6">
        <Link
          href={exporterHref("opportunities")}
          className={`inline-flex items-center gap-1 text-sm font-semibold text-teal hover:text-ink ${focusRing}`}
        >
          Matching opportunities
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <button
          type="button"
          title="Editing arrives once products are saved to your account"
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-teal transition-colors hover:border-teal hover:bg-teal-soft ${focusRing}`}
        >
          <Pencil className="size-3.5" aria-hidden />
          Edit Product
        </button>
      </footer>
    </>
  );
}
