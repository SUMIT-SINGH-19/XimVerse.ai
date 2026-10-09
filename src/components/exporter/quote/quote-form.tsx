"use client";

import { useMemo, useState } from "react";
import { CircleAlert, CircleCheck, CircleX, Lock } from "lucide-react";
import { Modal } from "@/components/exporter/products/modal";
import { StatusPill } from "@/components/workspace/status-pill";
import { formatDate, formatQuantity } from "@/lib/exporter-dashboard";
import type { ProductSummary } from "@/lib/exporter-products";
import {
  credentialStatus,
  formatOpportunityQuantity,
  PAYMENT_TERM_LABEL,
  UNIT_SHORT,
  type BuyerOpportunity,
} from "@/lib/exporter-opportunities";
import {
  availableInBuyerUnit,
  buildQuotation,
  COMPLIANCE_RESPONSE_LABEL,
  COST_COVERAGE_LABEL,
  daysBetween,
  defaultCoverage,
  formatMoney,
  nextDemoQuotationId,
  PAYMENT_TERMS,
  QUOTE_CURRENCIES,
  QUOTE_INCOTERMS,
  quoteDeviations,
  quoteErrors,
  quoteReadiness,
  quoteTotals,
  SEVERITY_ORDER,
  SHIPMENT_MODES,
  validUntil,
  type ComplianceResponse,
  type CostCoverage,
  type DeviationField,
  type QuoteField,
  type QuoteFormValues,
} from "@/lib/exporter-quotations";
import { clearDraft, loadQuotations, saveDraft, storeQuotation } from "@/lib/exporter-quotation-store";
import { BuyerAsked, FormField, InlineDeviations, input, invalidProps, QuoteSection, textarea } from "./form-ui";
import { QuoteSummary, MobileSubmitBar } from "./quote-summary";
import { QuoteReview } from "./quote-review";

const COVERAGES = Object.keys(COST_COVERAGE_LABEL) as CostCoverage[];
const RESPONSES = Object.keys(COMPLIANCE_RESPONSE_LABEL) as ComplianceResponse[];

const CREDENTIAL = {
  available: { label: "Available", icon: CircleCheck, className: "text-teal" },
  pending: { label: "Pending", icon: CircleAlert, className: "text-orange" },
  missing: { label: "Missing", icon: CircleX, className: "text-orange" },
} as const;

/**
 * The exporter's commercial response to one opportunity. Everything the buyer
 * already stated is shown locked; only the offer is editable. State is local;
 * drafts and submissions persist to this browser only.
 */
export function QuoteForm({
  o,
  product,
  initialValues,
  initialSavedAt,
  requirementPanel,
}: {
  o: BuyerOpportunity;
  product: ProductSummary;
  initialValues: QuoteFormValues;
  initialSavedAt?: string;
  /** Read-only buyer requirement, rendered by the server. */
  requirementPanel: React.ReactNode;
}) {
  const [v, setValues] = useState(initialValues);
  const [showErrors, setShowErrors] = useState(false);
  const [savedAt, setSavedAt] = useState(initialSavedAt);
  const [dirty, setDirty] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const errors = useMemo(() => quoteErrors(v, o, product), [v, o, product]);
  const deviations = useMemo(
    () => quoteDeviations(v, o).toSorted((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
    [v, o],
  );
  const readiness = useMemo(() => quoteReadiness(v, o, errors), [v, o, errors]);
  const totals = quoteTotals(v);
  const expiry = validUntil(v);
  const available = availableInBuyerUnit(o, product);
  const unit = UNIT_SHORT[o.quantity.unit];
  const errorCount = Object.keys(errors).length;
  const blocking = deviations.filter((d) => d.severity === "blocking").length;

  const set = <K extends QuoteField>(key: K, value: QuoteFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const err = (key: QuoteField) => (showErrors ? errors[key] : undefined);
  const devs = (...fields: DeviationField[]) => deviations.filter((d) => fields.includes(d.field));

  const save = () => {
    const at = new Date().toISOString();
    const ok = saveDraft(o.rfqId, v, at);
    setSaveFailed(!ok);
    if (ok) {
      setSavedAt(at);
      setDirty(false);
    }
  };

  const requestSubmit = () => {
    setShowErrors(true);
    if (errorCount === 0 && blocking === 0) setReviewing(true);
  };

  const confirmSubmit = () => {
    const now = new Date().toISOString();
    const quotation = buildQuotation(v, o, product, { id: nextDemoQuotationId(loadQuotations()), now });
    if (storeQuotation(quotation)) clearDraft(o.rfqId);
    // The workspace swaps to the submitted view when the store updates.
  };

  const remaining = totals.quantity !== undefined && available !== undefined ? available - totals.quantity : undefined;
  const deliveryBuffer = v.deliveryDate ? daysBetween(v.deliveryDate, o.delivery.requiredBy) : undefined;

  return (
    <div className="grid grid-cols-1 gap-6 pb-24 xl:grid-cols-3 xl:pb-0">
      <div className="min-w-0 space-y-6 xl:col-span-2">
        {requirementPanel}

        {/* 1 ------------------------------------------------------------ */}
        <QuoteSection n={1} title="Quoted Product" description="Matched from your catalogue. Switching products isn't available for this RFQ.">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-canvas p-4">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{product.name}</p>
              <p className="font-mono text-xs text-ink-muted">{product.productCode}</p>
            </div>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs text-ink-faint">Available</dt>
                <dd className="font-semibold text-teal">{formatQuantity(product.supply.availableCapacity)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">MOQ</dt>
                <dd className="font-medium text-ink">{formatQuantity(product.supply.moq)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Origin</dt>
                <dd className="font-medium text-ink">{product.origin.split(",").at(-1)?.trim()}</dd>
              </div>
            </dl>
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-ink">Does this product meet the buyer&apos;s specification?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["as-requested", "Yes, as specified"],
                  ["differs", "Differs — I'll explain in notes"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    v.specification === value ? "border-teal bg-teal-soft text-ink" : "border-line text-ink-muted hover:border-teal/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="specification"
                    value={value}
                    checked={v.specification === value}
                    onChange={() => set("specification", value)}
                    className="accent-teal"
                  />
                  {label}
                </label>
              ))}
            </div>
            {err("specification") && <p className="mt-1 text-xs font-medium text-orange">{err("specification")}</p>}
          </fieldset>
          <InlineDeviations items={devs("specification")} />
        </QuoteSection>

        {/* 2 ------------------------------------------------------------ */}
        <QuoteSection n={2} title="Quantity Offer">
          <BuyerAsked>
            {formatOpportunityQuantity(o.quantity)}
            {o.quantity.minimumAcceptable !== undefined &&
              ` · minimum acceptable ${o.quantity.minimumAcceptable.toLocaleString("en-US")} ${unit}`}
          </BuyerAsked>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="quantity" label="Quoted Quantity" error={err("quantity")} className="sm:col-span-2">
              <input
                id="quantity"
                inputMode="decimal"
                value={v.quantity}
                onChange={(e) => set("quantity", e.target.value)}
                className={input}
                {...invalidProps("quantity", err("quantity"))}
              />
            </FormField>
            <FormField id="unit" label="Unit" hint="Fixed to the buyer's unit.">
              <input id="unit" value={unit} disabled className={input} />
            </FormField>
          </div>
          {available !== undefined && (
            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
              <div className="bg-surface px-4 py-2.5">
                <dt className="text-xs text-ink-faint">Available</dt>
                <dd className="font-semibold tabular-nums text-ink">{available.toLocaleString("en-US")} {unit}</dd>
              </div>
              <div className="bg-surface px-4 py-2.5">
                <dt className="text-xs text-ink-faint">This quotation</dt>
                <dd className="font-semibold tabular-nums text-ink">{totals.quantity?.toLocaleString("en-US") ?? "—"} {unit}</dd>
              </div>
              <div className="bg-surface px-4 py-2.5">
                <dt className="text-xs text-ink-faint">After allocation</dt>
                <dd className={`font-semibold tabular-nums ${remaining !== undefined && remaining < 0 ? "text-orange" : "text-teal"}`}>
                  {remaining !== undefined ? `${remaining.toLocaleString("en-US")} ${unit}` : "—"}
                </dd>
              </div>
            </dl>
          )}
          <p className="text-xs text-ink-faint">Planning figure only — your catalogue capacity isn&apos;t reserved or reduced.</p>
          <InlineDeviations items={devs("quantity")} />
        </QuoteSection>

        {/* 3 ------------------------------------------------------------ */}
        <QuoteSection n={3} title="Price" description="Your commercial price for the Incoterm below. Costs and margins stay private.">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="currency" label="Currency">
              <select id="currency" value={v.currency} onChange={(e) => set("currency", e.target.value as QuoteFormValues["currency"])} className={input}>
                {QUOTE_CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </FormField>
            <FormField id="unitPrice" label="Unit Price" error={err("unitPrice")}>
              <input
                id="unitPrice"
                inputMode="decimal"
                placeholder="e.g. 1080"
                value={v.unitPrice}
                onChange={(e) => set("unitPrice", e.target.value)}
                className={`${input} tabular-nums`}
                {...invalidProps("unitPrice", err("unitPrice"))}
              />
            </FormField>
            <FormField id="pricingUnit" label="Pricing Unit">
              <input id="pricingUnit" value={`per ${unit}`} disabled className={input} />
            </FormField>
          </div>
          <dl className="space-y-1.5 rounded-xl bg-canvas px-4 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Quoted quantity</dt>
              <dd className="tabular-nums text-ink">{totals.quantity !== undefined ? `${totals.quantity.toLocaleString("en-US")} ${unit}` : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Unit price</dt>
              <dd className="tabular-nums text-ink">{totals.unitMinor !== undefined ? `${formatMoney(totals.unitMinor, v.currency)} / ${unit}` : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-1.5">
              <dt className="font-semibold text-ink">Product value</dt>
              <dd className="font-bold tabular-nums text-ink">{totals.totalMinor !== undefined ? formatMoney(totals.totalMinor, v.currency) : "—"}</dd>
            </div>
          </dl>
          <InlineDeviations items={devs("currency")} />
        </QuoteSection>

        {/* 4 ------------------------------------------------------------ */}
        <QuoteSection n={4} title="Incoterm & Logistics">
          {o.delivery.incoterm && (
            <BuyerAsked>
              {o.delivery.incoterm.term} {o.delivery.incoterm.namedPlace}
            </BuyerAsked>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="incoterm" label="Incoterm">
              <select
                id="incoterm"
                value={v.incoterm}
                onChange={(e) => {
                  const term = e.target.value as QuoteFormValues["incoterm"];
                  setValues((prev) => ({ ...prev, incoterm: term, ...defaultCoverage(term) }));
                  setDirty(true);
                }}
                className={input}
              >
                {QUOTE_INCOTERMS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </FormField>
            <FormField id="namedPlace" label="Named Place" error={err("namedPlace")}>
              <input id="namedPlace" value={v.namedPlace} onChange={(e) => set("namedPlace", e.target.value)} className={input} {...invalidProps("namedPlace", err("namedPlace"))} />
            </FormField>
            <FormField id="portOfLoading" label="Port of Loading" error={err("portOfLoading")}>
              <input id="portOfLoading" value={v.portOfLoading} onChange={(e) => set("portOfLoading", e.target.value)} className={input} {...invalidProps("portOfLoading", err("portOfLoading"))} />
            </FormField>
            <FormField id="mode" label="Shipment Mode">
              <select id="mode" value={v.mode} onChange={(e) => set("mode", e.target.value as QuoteFormValues["mode"])} className={input}>
                {SHIPMENT_MODES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </FormField>
            <FormField id="freight" label="Freight">
              <select id="freight" value={v.freight} onChange={(e) => set("freight", e.target.value as CostCoverage)} className={input}>
                {COVERAGES.map((c) => (
                  <option key={c} value={c}>{COST_COVERAGE_LABEL[c]}</option>
                ))}
              </select>
            </FormField>
            <FormField id="insurance" label="Insurance">
              <select id="insurance" value={v.insurance} onChange={(e) => set("insurance", e.target.value as CostCoverage)} className={input}>
                {COVERAGES.map((c) => (
                  <option key={c} value={c}>{COST_COVERAGE_LABEL[c]}</option>
                ))}
              </select>
            </FormField>
          </div>
          <p className="text-xs text-ink-faint">
            Freight and insurance defaults follow the Incoterm. You don&apos;t need to break out their cost — the buyer sees your
            all-in unit price.
          </p>
          <InlineDeviations items={devs("incoterm", "coverage")} />
        </QuoteSection>

        {/* 5 ------------------------------------------------------------ */}
        <QuoteSection n={5} title="Delivery & Lead Time">
          <BuyerAsked>Delivery by {formatDate(o.delivery.requiredBy)}</BuyerAsked>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="leadTimeDays" label="Preparation Lead Time (days)" error={err("leadTimeDays")}>
              <input id="leadTimeDays" inputMode="numeric" value={v.leadTimeDays} onChange={(e) => set("leadTimeDays", e.target.value)} className={input} {...invalidProps("leadTimeDays", err("leadTimeDays"))} />
            </FormField>
            <FormField id="dispatchDate" label="Earliest Dispatch" error={err("dispatchDate")}>
              <input id="dispatchDate" type="date" value={v.dispatchDate} onChange={(e) => set("dispatchDate", e.target.value)} className={input} {...invalidProps("dispatchDate", err("dispatchDate"))} />
            </FormField>
            <FormField id="deliveryDate" label="Estimated Delivery" error={err("deliveryDate")}>
              <input id="deliveryDate" type="date" value={v.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} className={input} {...invalidProps("deliveryDate", err("deliveryDate"))} />
            </FormField>
          </div>
          {deliveryBuffer !== undefined && deliveryBuffer >= 0 && (
            <p className="flex items-center gap-2 text-sm font-medium text-teal">
              <CircleCheck className="size-4" aria-hidden />
              Meets requested delivery ({deliveryBuffer} {deliveryBuffer === 1 ? "day" : "days"} buffer)
            </p>
          )}
          <InlineDeviations items={devs("delivery")} />
        </QuoteSection>

        {/* 6 ------------------------------------------------------------ */}
        <QuoteSection n={6} title="Packaging">
          {o.quality.packaging && <BuyerAsked>{o.quality.packaging}</BuyerAsked>}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={v.packagingAsRequested} onChange={(e) => set("packagingAsRequested", e.target.checked)} className="size-4 accent-teal" />
            Offer the requested packaging
          </label>
          {!v.packagingAsRequested && (
            <FormField id="packaging" label="Packaging Offered" error={err("packaging")}>
              <textarea id="packaging" value={v.packaging} onChange={(e) => set("packaging", e.target.value)} className={textarea} {...invalidProps("packaging", err("packaging"))} />
            </FormField>
          )}
          <FormField id="privateLabel" label="Private Label" hint={o.extendedTerms?.privateLabel ? "The buyer requires private label." : undefined}>
            <select id="privateLabel" value={v.privateLabel} onChange={(e) => set("privateLabel", e.target.value as QuoteFormValues["privateLabel"])} className={`${input} sm:max-w-xs`}>
              <option value="">Not specified</option>
              <option value="available">Available</option>
              <option value="not-available">Not available</option>
            </select>
          </FormField>
          <InlineDeviations items={devs("packaging", "private-label")} />
        </QuoteSection>

        {/* 7 ------------------------------------------------------------ */}
        <QuoteSection n={7} title="Payment Terms">
          {o.commercial.paymentTerms && (
            <BuyerAsked>{o.commercial.paymentNotes ?? PAYMENT_TERM_LABEL[o.commercial.paymentTerms]}</BuyerAsked>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="paymentTerm" label="Payment Term" error={err("paymentTerm")} className="sm:col-span-2">
              <select id="paymentTerm" value={v.paymentTerm} onChange={(e) => set("paymentTerm", e.target.value as QuoteFormValues["paymentTerm"])} className={input} {...invalidProps("paymentTerm", err("paymentTerm"))}>
                <option value="">Choose…</option>
                {PAYMENT_TERMS.map((t) => (
                  <option key={t} value={t}>{PAYMENT_TERM_LABEL[t]}</option>
                ))}
              </select>
            </FormField>
            <FormField id="advancePercent" label="Advance (%)" error={err("advancePercent")}>
              <input id="advancePercent" inputMode="numeric" value={v.advancePercent} onChange={(e) => set("advancePercent", e.target.value)} className={input} {...invalidProps("advancePercent", err("advancePercent"))} />
            </FormField>
          </div>
          <FormField id="paymentNotes" label="Payment Notes" hint="Shared with the buyer.">
            <input id="paymentNotes" value={v.paymentNotes} onChange={(e) => set("paymentNotes", e.target.value)} className={input} />
          </FormField>
          <InlineDeviations items={devs("payment")} />
        </QuoteSection>

        {/* 8 ------------------------------------------------------------ */}
        <QuoteSection n={8} title="Quote Validity">
          <div className="grid items-end gap-4 sm:grid-cols-3">
            <FormField
              id="validityDays"
              label="Validity (days)"
              error={err("validityDays")}
              hint={o.extendedTerms?.quoteValidityDays ? `Buyer asked for ${o.extendedTerms.quoteValidityDays} days.` : undefined}
            >
              <input id="validityDays" inputMode="numeric" value={v.validityDays} onChange={(e) => set("validityDays", e.target.value)} className={input} {...invalidProps("validityDays", err("validityDays"))} />
            </FormField>
            <p className="pb-2.5 text-sm text-ink sm:col-span-2">
              {expiry ? (
                <>
                  Valid until <span className="font-semibold">{formatDate(expiry)}</span>
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
          <InlineDeviations items={devs("validity")} />
        </QuoteSection>

        {/* 9 ------------------------------------------------------------ */}
        <QuoteSection n={9} title="Compliance Confirmation" description="No uploads here — confirm what you can provide for this shipment.">
          {o.compliance.standingCredentials.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Standing credentials (from Company Profile)</p>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {o.compliance.standingCredentials.map((c) => {
                  const s = CREDENTIAL[credentialStatus(c)];
                  const Icon = s.icon;
                  return (
                    <li key={c.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="font-medium text-ink">{c.name}</span>
                      <span className={`inline-flex items-center gap-1 font-semibold ${s.className}`}>
                        <Icon className="size-4" aria-hidden />
                        {s.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {o.compliance.shipmentDocuments.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Shipment documents</p>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {o.compliance.shipmentDocuments.map((d) => (
                  <li key={d.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span className="min-w-0 text-sm">
                      <span className="font-medium text-ink">{d.name}</span>
                      {d.note && <span className="block text-xs text-ink-muted">{d.note}</span>}
                    </span>
                    <select
                      aria-label={`${d.name} response`}
                      value={v.documents[d.name] ?? ""}
                      onChange={(e) => set("documents", { ...v.documents, [d.name]: e.target.value as ComplianceResponse | "" })}
                      className={`${input} h-9 w-auto`}
                    >
                      <option value="">Choose…</option>
                      {RESPONSES.map((r) => (
                        <option key={r} value={r}>{COMPLIANCE_RESPONSE_LABEL[r]}</option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
              {err("documents") && <p className="mt-1 text-xs font-medium text-orange">{err("documents")}</p>}
            </div>
          )}
          {o.quality.inspection && (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" checked={v.inspectionAccepted} onChange={(e) => set("inspectionAccepted", e.target.checked)} className="mt-0.5 size-4 accent-teal" />
              <span>
                Accept the buyer&apos;s inspection: <span className="text-ink-muted">{o.quality.inspection}</span>
              </span>
            </label>
          )}
          <InlineDeviations items={devs("compliance", "inspection", "credential")} />
        </QuoteSection>

        {/* 10 ----------------------------------------------------------- */}
        <QuoteSection n={10} title="Notes">
          <FormField id="buyerNotes" label="Commercial Notes to Buyer" hint="Shared with the buyer through Ximverse.">
            <textarea
              id="buyerNotes"
              placeholder="e.g. Price based on 25 kg PP bags and shipment in one lot."
              value={v.buyerNotes}
              onChange={(e) => set("buyerNotes", e.target.value)}
              className={textarea}
            />
          </FormField>
          <div className="rounded-xl border border-dashed border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="internalNote" className="text-sm font-medium text-ink">
                Internal Note
              </label>
              <StatusPill tone="neutral">
                <Lock className="size-3" aria-hidden />
                PRIVATE — not shared with buyer
              </StatusPill>
            </div>
            <textarea id="internalNote" value={v.internalNote} onChange={(e) => set("internalNote", e.target.value)} className={`${textarea} mt-2`} />
          </div>
        </QuoteSection>
      </div>

      <div className="min-w-0">
        <div className="space-y-4 xl:sticky xl:top-24">
          <QuoteSummary
            o={o}
            v={v}
            totals={totals}
            expiry={expiry}
            deviations={deviations}
            readiness={readiness}
            errorCount={showErrors ? errorCount : 0}
            savedAt={savedAt}
            dirty={dirty}
            saveFailed={saveFailed}
            onSave={save}
            onSubmit={requestSubmit}
          />
        </div>
      </div>

      <MobileSubmitBar v={v} totals={totals} onSubmit={requestSubmit} />

      <Modal open={reviewing} onClose={() => setReviewing(false)} labelledBy="quote-review-title">
        <QuoteReview
          o={o}
          v={v}
          totals={totals}
          expiry={expiry}
          deviations={deviations}
          onCancel={() => setReviewing(false)}
          onConfirm={confirmSubmit}
        />
      </Modal>
    </div>
  );
}
