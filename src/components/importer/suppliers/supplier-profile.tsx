import Link from "next/link";
import { ArrowLeft, CircleAlert, CircleCheck, Clock, Info, Minus, Plus } from "lucide-react";
import { formatQuantity, paymentTermLabel } from "@/lib/import-requirements";
import { importerHref } from "@/lib/importer-nav";
import { quotationsFromSupplier } from "@/lib/importer-quotations";
import {
  CREDENTIAL_STATUS_LABEL,
  DEMO_DISCLAIMER,
  leadTimeRange,
  PROFILE_STATUS_LABEL,
  SUPPLIER_TYPE_LABEL,
  yearsInBusiness,
  type CredentialStatus,
  type Supplier,
} from "@/lib/importer-suppliers";
import { Panel } from "../dashboard/dashboard-ui";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { FactList } from "../rfq/requirement-sections";
import { focusRing, primaryButton, secondaryButton } from "../styles";
import { SupplierActivity } from "./supplier-activity";
import { supplierQuotationsHref } from "./supplier-links";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;

export function SupplierProfile({ supplier: s }: { supplier: Supplier }) {
  const quoteCount = quotationsFromSupplier(s.id).length;
  const [leadMin, leadMax] = leadTimeRange(s);

  return (
    <div className="space-y-6">
      <div>
        <Link href={importerHref("suppliers")} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Suppliers
        </Link>

        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">{s.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {s.city}, {s.country} · {SUPPLIER_TYPE_LABEL[s.type]} · Est. {s.established} ({yearsInBusiness(s)} years in
              business)
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-faint/60 px-2.5 py-0.5 font-medium text-ink-muted">
                <CircleAlert aria-hidden className="size-3.5" />
                Demo supplier · {PROFILE_STATUS_LABEL[s.profileStatus]}
              </span>
              <span className="inline-flex items-center gap-2 text-ink-muted">
                Profile completeness {s.profileCompleteness}%
                <span aria-hidden className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full bg-teal" style={{ width: `${s.profileCompleteness}%` }} />
                </span>
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href={importerHref("rfqs/new")} className={primaryButton}>
              <Plus aria-hidden className="size-4" strokeWidth={2.5} />
              Create Requirement
            </Link>
            {quoteCount > 0 && (
              <Link href={supplierQuotationsHref(s.id)} className={secondaryButton}>
                View Quotations
              </Link>
            )}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs text-ink-faint">Product categories</dt>
            <dd className="mt-0.5 text-sm text-ink">{s.categories.join(", ")}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-ink-faint">Export markets</dt>
            <dd className="mt-0.5 text-sm text-ink">{s.markets.regions.join(", ")}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-ink-faint">Certifications (declared)</dt>
            <dd className="mt-0.5 text-sm text-ink">
              {s.certifications.length ? s.certifications.map((c) => c.name).join(", ") : "None declared"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Section id="overview" title="Company Overview">
            <FactList
              facts={[
                { label: "Legal name", value: s.legalName },
                { label: "Supplier type", value: SUPPLIER_TYPE_LABEL[s.type] },
                { label: "Headquarters", value: `${s.city}, ${s.country}` },
                { label: "Established", value: `${s.established} (${yearsInBusiness(s)} years)` },
                { label: "Employees", value: s.employees },
                { label: "Export experience", value: `${s.yearsExporting} years` },
                { label: "Primary business", value: s.primaryBusiness, wide: true },
                { label: "Languages", value: s.languages.join(", ") },
              ]}
            />
          </Section>

          <Section id="products" title="Products" note="Supplier-declared catalogue (demo). HS codes are illustrative.">
            <ul className="divide-y divide-line">
              {s.products.map((p) => (
                <li key={p.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="break-words font-semibold text-ink">{p.name}</h3>
                    <span className="text-xs text-ink-faint">{p.category}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{p.specification}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    <SmallFact label="Origin" value={p.origin} />
                    <SmallFact label="MOQ" value={formatQuantity(p.moq)} />
                    <SmallFact label="Lead time" value={`${p.leadTimeDays[0]}–${p.leadTimeDays[1]} days`} />
                    <SmallFact label="HS code" value={p.hsCode ?? "—"} />
                    <SmallFact label="Packaging" value={p.packaging} wide />
                  </dl>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="markets" title="Markets & Trade Capability">
            <FactList
              facts={[
                { label: "Destination regions", value: s.markets.regions.join(", ") },
                { label: "Export markets", value: s.markets.countries.join(", ") },
                { label: "Ports of loading", value: s.capability.portsOfLoading.join(", ") },
                { label: "Incoterms offered", value: s.capability.incoterms.join(", ") },
                { label: "Currencies accepted", value: s.capability.currencies.join(", ") },
              ]}
            />
          </Section>

          <Section id="quality" title="Certifications & Quality" note="Supplier-declared information. Not independently verified by XimVerse.">
            {s.certifications.length === 0 ? (
              <p className="text-sm text-ink-muted">No certifications have been declared.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {s.certifications.map((c) => (
                  <li key={c.name} className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink">
                    {c.name}
                    {c.scope && <span className="text-ink-faint"> · {c.scope}</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5">
              <FactList
                facts={[
                  { label: "Quality control approach", value: s.quality.approach, wide: true },
                  { label: "Inspection availability", value: s.quality.inspection, wide: true },
                ]}
              />
            </div>
          </Section>

          <Section id="commercial" title="Commercial Capability">
            <FactList
              facts={[
                {
                  label: "Minimum order quantities",
                  value: s.products.map((p) => `${p.name}: ${formatQuantity(p.moq)}`).join("\n"),
                  wide: true,
                },
                { label: "Production / export capacity", value: s.capability.annualCapacity },
                { label: "Typical order size", value: s.capability.typicalOrder },
                { label: "Typical lead time", value: `${leadMin}–${leadMax} days, depending on product` },
                { label: "Payment terms accepted", value: s.capability.paymentTerms.map(paymentTermLabel).join(", ") },
                { label: "Private label / custom packaging", value: s.capability.privateLabel ? "Offered" : "Not offered" },
              ]}
            />
          </Section>
        </div>

        <div className="space-y-6">
          <SupplierActivity supplierId={s.id} />

          <Panel id="credentials" title="Documents & Credentials">
            <div className="px-5 pb-5 pt-3 sm:px-6">
              <ul className="divide-y divide-line">
                {s.credentials.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-ink">{c.name}</span>
                    <CredentialBadge status={c.status} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex gap-2 text-xs text-ink-muted">
                <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                Declared by the supplier. Nothing here has been checked by XimVerse or any authority.
              </p>
            </div>
          </Panel>

          <p className="flex gap-2 rounded-xl bg-canvas px-4 py-3 text-xs text-ink-muted">
            <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {DEMO_DISCLAIMER}
          </p>

          <SumitAnalysisCard
            id="sumit-supplier"
            heading="Ask SUMIT about this supplier"
            prompts={[
              "What products can this supplier provide?",
              "Which of my requirements match this supplier?",
              "Compare this supplier's quotations.",
              "What certifications has the supplier declared?",
              "Which markets does this supplier export to?",
            ]}
            message="SUMIT supplier intelligence will be connected later. Nothing was analysed."
          />
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <Panel id={`supplier-${id}`} title={title} description={note}>
      <div className="px-5 pb-6 pt-4 sm:px-6">{children}</div>
    </Panel>
  );
}

function SmallFact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-4" : undefined}>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="break-words text-ink">{value}</dd>
    </div>
  );
}

const CREDENTIAL_ICON: Record<CredentialStatus, { Icon: typeof CircleCheck; className: string }> = {
  declared: { Icon: CircleCheck, className: "text-teal" },
  "available-on-request": { Icon: Clock, className: "text-ink-muted" },
  "not-provided": { Icon: Minus, className: "text-ink-faint" },
};

function CredentialBadge({ status }: { status: CredentialStatus }) {
  const { Icon, className } = CREDENTIAL_ICON[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs ${status === "declared" ? "text-ink" : "text-ink-muted"}`}>
      <Icon aria-hidden className={`size-3.5 ${className}`} />
      {CREDENTIAL_STATUS_LABEL[status]}
    </span>
  );
}
