import { CircleAlert, CircleCheck, CircleX, Lock } from "lucide-react";
import { Chips, Field, FieldGrid, ProfileSection } from "@/components/exporter/company/profile-ui";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { formatDate } from "@/lib/exporter-dashboard";
import {
  credentialStatus,
  formatDateTime,
  formatIncoterm,
  formatOpportunityQuantity,
  opportunityTimeline,
  PAYMENT_TERM_LABEL,
  UNIT_SHORT,
  type BuyerOpportunity,
  type CredentialStatus,
  type ShipmentDocumentStatus,
} from "@/lib/exporter-opportunities";

/*
 * The requirement as the buyer stated it, in exporter-safe form. Fields marked
 * † come from `extendedTerms`: opportunity-level data the importer's RFQ form
 * doesn't capture yet.
 */

const EXTENDED = " †";

function ExtendedNote() {
  return <p className="mt-4 text-xs text-ink-faint">† Opportunity data — not yet captured by the buyer&apos;s RFQ form.</p>;
}

const yesNo = (v: boolean | undefined) => (v === undefined ? "—" : v ? "Yes" : "No");

// ---------------------------------------------------------------------------

export function RequirementSummary({ o }: { o: BuyerOpportunity }) {
  const facts = [
    { label: "Quantity", value: formatOpportunityQuantity(o.quantity) },
    { label: "Destination", value: o.delivery.destinationLocation },
    { label: "Incoterm", value: formatIncoterm(o.delivery) },
    { label: "Required Delivery", value: formatDate(o.delivery.requiredBy) },
    { label: "Quotation Deadline", value: formatDateTime(o.quotesDueAt) },
    { label: "Payment Preference", value: o.commercial.paymentNotes ?? (o.commercial.paymentTerms ? PAYMENT_TERM_LABEL[o.commercial.paymentTerms] : "—") },
    { label: "Buyer Market", value: `${o.buyer.region} · ${o.buyer.country}` },
    { label: "Buyer Industry", value: o.buyer.industry ?? "—" },
  ];
  return (
    <ProfileSection id="summary" title="Requirement Summary" editable={false}>
      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0 bg-surface px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-faint">{f.label}</dt>
            <dd className="mt-1 text-sm font-semibold text-ink [overflow-wrap:anywhere]">{f.value}</dd>
          </div>
        ))}
      </dl>
    </ProfileSection>
  );
}

// ---------------------------------------------------------------------------

export function ProductRequirements({ o }: { o: BuyerOpportunity }) {
  const items = o.product.specificationItems ?? [];
  return (
    <ProfileSection id="product" title="Product Requirements" editable={false}>
      <FieldGrid>
        <Field label="Product">{o.product.name}</Field>
        <Field label="Category">{o.product.category}</Field>
        <Field label="HS Code">
          <span className="font-mono">{o.product.hsCode ?? "—"}</span>
        </Field>
        <Field label="Origin Preference">{o.quality.originPreference ?? "Any"}</Field>
      </FieldGrid>

      {items.length > 0 && (
        <dl className="mt-5 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          {items.map((s) => (
            <div key={s.label} className="flex items-baseline justify-between gap-3 bg-surface px-4 py-2.5 text-sm sm:last:odd:col-span-2">
              <dt className="text-ink-muted">{s.label}</dt>
              <dd className="text-right font-medium text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <figure className="mt-5 rounded-xl bg-canvas px-4 py-3">
        <figcaption className="text-xs font-medium uppercase tracking-[0.08em] text-ink-faint">
          Buyer&apos;s specification, as written
        </figcaption>
        <blockquote className="mt-1.5 text-sm leading-relaxed text-ink">{o.product.specification}</blockquote>
      </figure>
    </ProfileSection>
  );
}

// ---------------------------------------------------------------------------

export function QuantityDelivery({ o }: { o: BuyerOpportunity }) {
  const { quantity: q, delivery: d, extendedTerms: x } = o;
  const hasExtended = x?.partialShipment !== undefined || Boolean(x?.shipmentPreference);
  return (
    <ProfileSection id="delivery" title="Quantity & Delivery" editable={false}>
      <FieldGrid>
        <Field label="Requested Quantity">{formatOpportunityQuantity(q)}</Field>
        <Field label="Minimum Acceptable">
          {q.minimumAcceptable ? `${q.minimumAcceptable.toLocaleString("en-US")} ${UNIT_SHORT[q.unit]}` : "Full quantity"}
        </Field>
        <Field label="Destination Country">{d.destinationCountry}</Field>
        <Field label="Destination Port / Location">{d.destinationLocation}</Field>
        <Field label="Incoterm">{d.incoterm?.term ?? "—"}</Field>
        <Field label="Incoterm Named Place">{d.incoterm?.namedPlace ?? "—"}</Field>
        <Field label="Required By">{formatDate(d.requiredBy)}</Field>
        {x?.partialShipment !== undefined && <Field label={`Partial Shipment Allowed${EXTENDED}`}>{yesNo(x.partialShipment)}</Field>}
        {x?.shipmentPreference && <Field label={`Shipment Preference${EXTENDED}`}>{x.shipmentPreference}</Field>}
      </FieldGrid>
      {hasExtended && <ExtendedNote />}
    </ProfileSection>
  );
}

// ---------------------------------------------------------------------------

export function PackagingQuality({ o }: { o: BuyerOpportunity }) {
  const { quality, supplierRequirements: s, extendedTerms: x } = o;
  return (
    <ProfileSection id="packaging" title="Packaging & Quality" editable={false}>
      <FieldGrid>
        <Field label="Packaging" wide>
          {quality.packaging ?? "Not specified"}
        </Field>
        {x?.privateLabel !== undefined && (
          <Field label={`Private Label${EXTENDED}`}>{x.privateLabel ? "Required" : "Not required"}</Field>
        )}
        <Field label="Inspection">{quality.inspection ?? "None requested"}</Field>
        <Field label="Origin Preference">{quality.originPreference ?? "Any"}</Field>
        <Field label="Supplier Type">
          <Chips
            items={[
              s.manufacturerRequired ? "Manufacturer required" : "Manufacturers & traders",
              ...(s.minimumExperienceYears ? [`${s.minimumExperienceYears}+ years exporting`] : []),
            ]}
          />
        </Field>
        {o.buyerNotes && (
          <Field label="Buyer Notes" wide hint="Shared by the buyer with suppliers.">
            {o.buyerNotes}
          </Field>
        )}
      </FieldGrid>
      {x?.privateLabel !== undefined && <ExtendedNote />}
    </ProfileSection>
  );
}

// ---------------------------------------------------------------------------

const CREDENTIAL: Record<CredentialStatus, { label: string; icon: typeof CircleCheck; className: string }> = {
  available: { label: "Available", icon: CircleCheck, className: "text-teal" },
  pending: { label: "Pending", icon: CircleAlert, className: "text-orange" },
  missing: { label: "Missing", icon: CircleX, className: "text-orange" },
};

const DOCUMENT: Record<ShipmentDocumentStatus, { label: string; tone: PillTone }> = {
  "per-shipment": { label: "Available per shipment", tone: "brand" },
  required: { label: "Required", tone: "neutral" },
  "needs-action": { label: "Needs action", tone: "accent" },
};

export function ComplianceRequirements({ o }: { o: BuyerOpportunity }) {
  const { standingCredentials, shipmentDocuments } = o.compliance;
  return (
    <ProfileSection
      id="compliance"
      title="Compliance Requirements"
      description="Standing credentials are checked against your Company Profile. Shipment documents are issued for this consignment."
      editable={false}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">A · Standing credentials</h3>
          {standingCredentials.length ? (
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {standingCredentials.map((c) => {
                const status = CREDENTIAL[credentialStatus(c)];
                const Icon = status.icon;
                return (
                  <li key={c.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{c.name}</span>
                      <span className="block text-xs text-ink-faint">
                        {c.source === "buyer" ? "Requested by buyer" : "Export requirement"}
                      </span>
                    </span>
                    <span className={`inline-flex shrink-0 items-center gap-1 text-sm font-semibold ${status.className}`}>
                      <Icon className="size-4" aria-hidden />
                      {status.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-faint">None required.</p>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">B · Shipment documents</h3>
          {shipmentDocuments.length ? (
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {shipmentDocuments.map((d) => (
                <li key={d.name} className="px-4 py-2.5">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{d.name}</span>
                    <StatusPill tone={DOCUMENT[d.status].tone}>{DOCUMENT[d.status].label}</StatusPill>
                  </span>
                  {d.note && <span className="mt-0.5 block text-xs text-ink-muted">{d.note}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-faint">None specified.</p>
          )}
        </div>
      </div>
    </ProfileSection>
  );
}

// ---------------------------------------------------------------------------

export function CommercialContext({ o }: { o: BuyerOpportunity }) {
  const { commercial: c, extendedTerms: x } = o;
  return (
    <ProfileSection
      id="commercial"
      title="Commercial Context"
      description="Only terms the buyer has chosen to share."
      editable={false}
    >
      <FieldGrid>
        <Field label="Payment">
          {c.paymentTerms ? PAYMENT_TERM_LABEL[c.paymentTerms] : "—"}
          {c.paymentNotes && <span className="block text-xs text-ink-muted">{c.paymentNotes}</span>}
        </Field>
        <Field label="Incoterm">{formatIncoterm(o.delivery)}</Field>
        {x?.currency && <Field label={`Currency Preference${EXTENDED}`}>{x.currency}</Field>}
        {x?.quoteValidityDays && <Field label={`Quote Validity Requested${EXTENDED}`}>{x.quoteValidityDays} days</Field>}
      </FieldGrid>
      <p className="mt-5 flex items-start gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
        <Lock className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
        The buyer&apos;s target price and budget, other exporters&apos; quotations and Ximverse&apos;s commercial
        terms are not shared with exporters.
      </p>
      {(x?.currency || x?.quoteValidityDays) && <ExtendedNote />}
    </ProfileSection>
  );
}

// ---------------------------------------------------------------------------

export function OpportunityTimeline({ o }: { o: BuyerOpportunity }) {
  const points = opportunityTimeline(o);
  return (
    <ProfileSection id="timeline" title="Timeline" editable={false}>
      <ol className="relative space-y-4 pl-6 before:absolute before:inset-y-1 before:left-[0.4375rem] before:w-px before:bg-line">
        {points.map((p) => (
          <li key={p.key} className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <span
              aria-hidden
              className={`absolute -left-6 top-1 size-3.5 rounded-full border-2 ${
                p.past ? "border-teal bg-teal" : p.key === "deadline" ? "border-orange bg-surface" : "border-line bg-surface"
              }`}
            />
            <span className={`text-sm ${p.past ? "text-ink-muted" : "font-medium text-ink"}`}>{p.label}</span>
            <span className="text-sm tabular-nums text-ink-muted">
              {p.at.length > 10 ? formatDateTime(p.at) : formatDate(p.at)}
            </span>
          </li>
        ))}
      </ol>
    </ProfileSection>
  );
}
