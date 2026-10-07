import { Eye, FileBadge2, Lock, Plus, RefreshCw, Target } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { formatDate, formatQuantity } from "@/lib/exporter-dashboard";
import type {
  BuyerMatchingProfile,
  Certification,
  CompanyInformation,
  ExportCapabilities,
  MarketsProfile,
  RegistrationRecord,
  TradePreferences,
} from "@/lib/exporter-company";
import { Chips, Field, FieldGrid, Meter, ProfileSection, VerificationPill } from "./profile-ui";

const smallButton = `inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition-colors ${focusRing}`;

// ---------------------------------------------------------------------------

export function CompanyInformationSection({ info }: { info: CompanyInformation }) {
  return (
    <ProfileSection id="company-information" title="Company Information">
      <FieldGrid>
        <Field label="Legal Company Name">{info.legalName}</Field>
        <Field label="Trade Name">{info.tradeName}</Field>
        <Field label="Business Type">{info.businessType}</Field>
        <Field label="Year Established">{info.yearEstablished}</Field>
        <Field label="Company Size">{info.companySize}</Field>
        <Field label="Head Office">{info.headOffice}</Field>
        <Field label="Manufacturing Locations" wide>
          <Chips items={info.manufacturingLocations} />
        </Field>
        <Field label="Website">{info.website}</Field>
        <Field label="Business Email">{info.businessEmail}</Field>
        <Field label="Business Phone">
          <span className="tabular-nums">{info.businessPhone}</span>
        </Field>
      </FieldGrid>
    </ProfileSection>
  );
}

// ---------------------------------------------------------------------------

export function RegistrationSection({ records }: { records: readonly RegistrationRecord[] }) {
  return (
    <ProfileSection
      id="registration"
      title="Business Registration & Export Identity"
      description="Statutory and export registrations Ximverse checks before your quotations reach buyers."
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        {records.map((r) => (
          <div
            key={r.key}
            className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-line px-4 py-3"
          >
            <div className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-faint">{r.label}</dt>
              <dd
                className={`mt-1 text-sm break-all ${
                  r.value ? (r.identifier ? "font-mono text-ink" : "font-medium text-ink") : "text-ink-faint"
                }`}
              >
                {r.value ?? "—"}
              </dd>
            </div>
            <VerificationPill status={r.status} />
          </div>
        ))}
      </dl>
    </ProfileSection>
  );
}

// ---------------------------------------------------------------------------

function Stat({ label, value, detail }: { label: string; value: string; detail?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-canvas px-4 py-3">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-ink tabular-nums">{value}</p>
      {detail && <div className="mt-1 text-xs text-ink-muted">{detail}</div>}
    </div>
  );
}

export function CapabilitiesSection({ capabilities: c }: { capabilities: ExportCapabilities }) {
  return (
    <ProfileSection
      id="capabilities"
      title="Export Capabilities"
      description="What you can supply and how fast. Used to match you with buyer requirements you can actually fulfil."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Monthly production capacity" value={formatQuantity(c.monthlyProductionCapacity)} />
        <Stat label="Monthly export capacity" value={formatQuantity(c.monthlyExportCapacity)} />
        <Stat
          label="Current export utilisation"
          value={`${c.exportUtilisation}%`}
          detail={<Meter value={c.exportUtilisation} label="Current export utilisation" className="mt-1.5" />}
        />
      </div>

      <div className="mt-6">
        <FieldGrid>
          <Field label="Primary Industry">{c.primaryIndustry}</Field>
          <Field label="Export Experience">{c.exportExperienceYears} years</Field>
          <Field label="Product Categories" wide hint="Individual products, grades and HS codes are managed under Products.">
            <Chips items={c.productCategories} tone="brand" />
          </Field>
          <Field label="Minimum Order Capability">{formatQuantity(c.minimumOrder)}</Field>
          <Field label="Typical Lead Time">
            {c.leadTimeDays.min}–{c.leadTimeDays.max} days
          </Field>
          <Field label="Annual Export Turnover">{c.annualTurnoverRange}</Field>
        </FieldGrid>
      </div>
    </ProfileSection>
  );
}

// ---------------------------------------------------------------------------

export function MarketsSection({ markets: m }: { markets: MarketsProfile }) {
  return (
    <ProfileSection id="markets" title="Markets & Export Experience">
      <FieldGrid>
        <Field label="Currently Exporting To" wide>
          <Chips items={m.currentMarkets} tone="brand" />
        </Field>
        <Field label="Target Markets" wide hint="Markets you want to grow into.">
          <Chips items={m.targetMarkets} tone="outline" />
        </Field>
        <Field label="Preferred Ports">
          <Chips items={m.preferredPorts} />
        </Field>
        <Field label="Preferred Incoterms">
          <Chips items={m.preferredIncoterms} />
        </Field>
        <Field label="Typical Shipment Modes" wide>
          <Chips items={m.shipmentModes} />
        </Field>
      </FieldGrid>
    </ProfileSection>
  );
}

// ---------------------------------------------------------------------------

export function CertificationsSection({ certifications }: { certifications: readonly Certification[] }) {
  return (
    <ProfileSection
      id="certifications"
      title="Certifications & Compliance"
      editable={false}
      aside={
        <button
          type="button"
          title="Certificate uploads are coming soon"
          className={`${smallButton} bg-teal text-on-brand hover:brightness-110`}
        >
          <Plus className="size-4" aria-hidden />
          Add Certificate
        </button>
      }
    >
      <ul className="divide-y divide-line">
        {certifications.map((cert) => (
          <li key={cert.key} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3.5 first:pt-0 last:pb-0">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-soft text-teal">
              <FileBadge2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 basis-48">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                {cert.name}
                <VerificationPill status={cert.status} />
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {cert.issuer}
                {cert.expiresOn && (
                  <>
                    <span aria-hidden className="mx-1.5 text-ink-faint">·</span>
                    Expires {formatDate(cert.expiresOn)}
                  </>
                )}
                {cert.status === "pending" && (
                  <>
                    <span aria-hidden className="mx-1.5 text-ink-faint">·</span>
                    Awaiting verification by Ximverse
                  </>
                )}
                {cert.status === "per-shipment" && (
                  <>
                    <span aria-hidden className="mx-1.5 text-ink-faint">·</span>
                    Issued for each consignment
                  </>
                )}
              </p>
            </div>
            {cert.status !== "per-shipment" && (
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label={`View ${cert.name}`}
                  className={`${smallButton} text-ink-muted hover:bg-teal-soft hover:text-ink`}
                >
                  <Eye className="size-4" aria-hidden />
                  View
                </button>
                <button
                  type="button"
                  aria-label={`Replace ${cert.name}`}
                  title="Certificate uploads are coming soon"
                  className={`${smallButton} text-ink-muted hover:bg-teal-soft hover:text-ink`}
                >
                  <RefreshCw className="size-4" aria-hidden />
                  Replace
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </ProfileSection>
  );
}

// ---------------------------------------------------------------------------

export function TradePreferencesSection({
  preferences: p,
  incoterms,
}: {
  preferences: TradePreferences;
  /** Shared with the markets section; one source of truth. */
  incoterms: readonly string[];
}) {
  return (
    <ProfileSection id="trade-preferences" title="Trade Preferences">
      <FieldGrid>
        <Field label="Preferred Currencies">
          <Chips items={p.currencies} />
        </Field>
        <Field label="Preferred Incoterms">
          <Chips items={incoterms} />
        </Field>
        <Field label="Payment Terms Accepted" wide>
          <Chips items={p.paymentTerms} />
        </Field>
        <Field label="Typical Quote Validity">{p.quoteValidityDays} days</Field>
        <Field label="Credit Terms">{p.creditTerms}</Field>
        <Field label="Minimum Margin Preference">
          <span className="inline-flex flex-wrap items-center gap-2">
            {p.minimumMargin}
            <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
              <Lock className="size-3" aria-hidden />
              Private — never shown to buyers
            </span>
          </span>
        </Field>
      </FieldGrid>
    </ProfileSection>
  );
}

// ---------------------------------------------------------------------------

export function BuyerMatchingSection({ profile: b }: { profile: BuyerMatchingProfile }) {
  const { preferredOrderSize: size } = b;

  return (
    <ProfileSection
      id="buyer-matching"
      title="Buyer Matching Profile"
      description="Ximverse uses these preferences to match your company with relevant buyer requirements."
    >
      <div className="flex flex-col gap-3 rounded-xl bg-teal-soft px-4 py-3 sm:flex-row sm:items-center">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-teal">
          <Target className="size-4" aria-hidden />
          Matching Profile Strength
        </span>
        <Meter value={b.strength} label="Matching profile strength" className="flex-1 bg-surface!" />
        <span className="text-lg font-bold tabular-nums text-teal">{b.strength}%</span>
      </div>

      <div className="mt-6">
        <FieldGrid>
          <Field label="Preferred Order Size">
            {size.min.toLocaleString("en-IN")}–{size.max.toLocaleString("en-IN")} {size.unit}
          </Field>
          <Field label="Maximum New Monthly Commitment">{formatQuantity(b.maxNewMonthlyCommitment)}</Field>
          <Field label="Preferred Buyer Regions" wide>
            <Chips items={b.preferredRegions} tone="brand" />
          </Field>
          <Field label="Preferred Destination Markets" wide>
            <Chips items={b.preferredDestinations} />
          </Field>
          <Field label="Industries Served" wide>
            <Chips items={b.industriesServed} />
          </Field>
          <Field label="Product Categories" wide>
            <Chips items={b.productCategories} />
          </Field>
          <Field label="Certification Requirements You Can Fulfil" wide>
            <Chips items={b.fulfillableCertifications} />
          </Field>
        </FieldGrid>
      </div>
    </ProfileSection>
  );
}
