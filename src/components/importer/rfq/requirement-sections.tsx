import { Paperclip } from "lucide-react";
import { formatDate } from "@/lib/format";
import {
  attachmentKindLabel,
  formatPrice,
  formatQuantity,
  paymentTermLabel,
  unitShort,
  type ImportRequirement,
} from "@/lib/import-requirements";

/*
 * Read-only presentation of a requirement, shared by the review step of the
 * creation flow and the requirement detail page.
 */

export interface Fact {
  label: string;
  value?: React.ReactNode;
  /** Spans the full width of the fact grid. */
  wide?: boolean;
}

/** Definition list of label/value pairs; empty values show as "Not specified". */
export function FactList({ facts }: { facts: readonly Fact[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
      {facts.map((f) => (
        <div key={f.label} className={f.wide ? "sm:col-span-2" : undefined}>
          <dt className="text-xs font-medium text-ink-faint">{f.label}</dt>
          <dd
            className={`mt-1 whitespace-pre-line break-words text-sm ${
              isEmpty(f.value) ? "text-ink-faint" : "text-ink"
            }`}
          >
            {isEmpty(f.value) ? "Not specified" : f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function isEmpty(v: React.ReactNode): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

export function Chips({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item} className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-medium text-teal">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function productFacts(r: ImportRequirement): Fact[] {
  return [
    { label: "Product", value: r.product.name },
    { label: "Category", value: r.product.category },
    { label: "Specification", value: r.product.specification, wide: true },
    { label: "HS Code", value: r.product.hsCode },
    {
      label: "Quantity",
      value:
        formatQuantity(r.quantity) +
        (r.quantity.minimumAcceptable
          ? ` (minimum ${formatQuantity({ amount: r.quantity.minimumAcceptable, unit: r.quantity.unit })})`
          : ""),
    },
  ];
}

export function deliveryFacts(r: ImportRequirement): Fact[] {
  return [
    { label: "Destination", value: r.delivery.destinationLocation },
    { label: "Destination country", value: r.delivery.destinationCountry },
    { label: "Required by", value: formatDate(r.delivery.requiredBy) },
    { label: "Preferred Incoterm", value: r.delivery.incoterm },
  ];
}

export function commercialFacts(r: ImportRequirement): Fact[] {
  const price = r.commercial.targetPrice;
  return [
    {
      label: "Target price",
      value: price && `${formatPrice(price.amount, price.currency)} / ${unitShort(r.quantity.unit).replace(/s$/, "")}`,
    },
    { label: "Payment terms", value: r.commercial.paymentTerms && paymentTermLabel(r.commercial.paymentTerms) },
    { label: "Payment notes", value: r.commercial.paymentNotes, wide: true },
  ];
}

export function qualityFacts(r: ImportRequirement): Fact[] {
  return [
    {
      label: "Certifications requested from supplier",
      value: r.quality.certifications.length ? <Chips items={r.quality.certifications} /> : undefined,
      wide: true,
    },
    { label: "Quality / inspection", value: r.quality.inspection, wide: true },
    { label: "Packaging", value: r.quality.packaging, wide: true },
    { label: "Country of origin preference", value: r.quality.originPreference },
  ];
}

export function supplierFacts(r: ImportRequirement): Fact[] {
  const p = r.supplierPreferences;
  const types = [p.manufacturerRequired && "Manufacturer required", p.tradersAcceptable && "Exporters / traders acceptable"].filter(
    Boolean,
  ) as string[];
  return [
    { label: "Preferred countries / regions", value: p.preferredRegions },
    { label: "Supplier type", value: types.join(" · ") },
    {
      label: "Minimum experience",
      value: p.minimumExperienceYears !== undefined ? `${p.minimumExperienceYears} years` : undefined,
    },
    { label: "Supplier to invite", value: p.supplierToInvite },
  ];
}

export function notesFacts(r: ImportRequirement): Fact[] {
  return [
    { label: "Additional notes (may be shared with suppliers)", value: r.additionalNotes, wide: true },
    { label: "Private internal notes (your organisation only)", value: r.internalNotes, wide: true },
  ];
}

export function AttachmentList({ attachments }: { attachments: ImportRequirement["attachments"] }) {
  if (attachments.length === 0) return <p className="text-sm text-ink-faint">No attachments.</p>;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {attachments.map((a) => (
        <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <Paperclip aria-hidden className="size-4 shrink-0 text-ink-faint" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink">{a.name}</span>
            <span className="block text-xs text-ink-muted">
              {attachmentKindLabel(a.kind)} · {formatBytes(a.sizeBytes)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
