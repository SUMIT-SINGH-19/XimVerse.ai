"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, FileSearch, Lock, Pencil, XCircle } from "lucide-react";
import { formatDate, formatTimeAgo } from "@/lib/format";
import { formatQuantity, MOCK_NOW, type ImportRequirement } from "@/lib/import-requirements";
import { importerHref } from "@/lib/importer-nav";
import { ImportId, Panel } from "../dashboard/dashboard-ui";
import { focusRing, primaryButton, secondaryButton } from "../styles";
import { RequirementStatusBadge } from "./requirement-status-badge";
import {
  AttachmentList,
  commercialFacts,
  deliveryFacts,
  FactList,
  qualityFacts,
  supplierFacts,
} from "./requirement-sections";
import { useImportRequirements } from "./requirements-store";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;

export function RequirementDetail({ id }: { id: string }) {
  const requirement = useImportRequirements().find(id);
  if (!requirement) return <RequirementNotFound id={id} />;
  return <Detail r={requirement} />;
}

function Detail({ r }: { r: ImportRequirement }) {
  const [notice, setNotice] = useState("");
  const placeholder = (action: string) => () => setNotice(`${action} is coming soon.`);

  return (
    <div className="space-y-6">
      <div>
        <Link href={importerHref("rfqs")} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Import Requirements
        </Link>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <ImportId id={r.id} className="text-ink-muted" />
              <RequirementStatusBadge status={r.status} />
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">{r.product.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {formatQuantity(r.quantity)} · {r.delivery.destinationLocation} · Required by{" "}
              {formatDate(r.delivery.requiredBy)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={placeholder("Editing requirements")} className={`${secondaryButton} h-10 px-4`}>
              <Pencil aria-hidden className="size-4" />
              Edit
            </button>
            <button type="button" onClick={placeholder("Duplicating requirements")} className={`${secondaryButton} h-10 px-4`}>
              <Copy aria-hidden className="size-4" />
              Duplicate
            </button>
            {r.status !== "closed" && (
              <button
                type="button"
                onClick={placeholder("Closing requirements")}
                className={`${secondaryButton} h-10 px-4 hover:border-orange/40 hover:bg-orange-soft hover:text-orange`}
              >
                <XCircle aria-hidden className="size-4" />
                Close Requirement
              </button>
            )}
          </div>
        </div>
        <p role="status" className="mt-2 min-h-5 text-sm text-ink-muted lg:text-right">
          {notice}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {/* On narrow screens quotations come first; from xl they sit in the rail. */}
          <Quotations r={r} headingId="quotations-top" className="xl:hidden" />
          <Section id="overview" title="Overview">
            <FactList
              facts={[
                { label: "Category", value: r.product.category },
                { label: "Quantity", value: formatQuantity(r.quantity) },
                ...deliveryFacts(r),
                { label: "Created", value: formatDate(r.createdAt) },
                { label: "Last updated", value: formatTimeAgo(r.updatedAt, MOCK_NOW) },
              ]}
            />
          </Section>
          <Section id="specification" title="Product Specification">
            <FactList
              facts={[
                { label: "Specification", value: r.product.specification, wide: true },
                { label: "HS Code", value: r.product.hsCode },
                {
                  label: "Minimum acceptable quantity",
                  value:
                    r.quantity.minimumAcceptable &&
                    formatQuantity({ amount: r.quantity.minimumAcceptable, unit: r.quantity.unit }),
                },
              ]}
            />
          </Section>
          <Section id="commercial" title="Commercial Terms">
            <FactList facts={commercialFacts(r)} />
          </Section>
          <Section id="quality" title="Quality & Compliance">
            <FactList facts={qualityFacts(r)} />
          </Section>
          <Section id="supplier" title="Supplier Preferences">
            <FactList
              facts={[
                ...supplierFacts(r),
                { label: "Additional notes (may be shared with suppliers)", value: r.additionalNotes, wide: true },
              ]}
            />
          </Section>
          <Section id="attachments" title="Attachments">
            <AttachmentList attachments={r.attachments} />
          </Section>
        </div>

        <div className="space-y-6">
          <Quotations r={r} headingId="quotations" className="hidden xl:block" />
          {r.internalNotes && (
            <section aria-labelledby="internal-notes" className="rounded-2xl border border-dashed border-line bg-surface p-5">
              <h2 id="internal-notes" className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Lock aria-hidden className="size-3.5 text-ink-faint" />
                Private internal notes
              </h2>
              <p className="mt-0.5 text-xs text-ink-faint">Visible to your organisation only.</p>
              <p className="mt-3 whitespace-pre-line text-sm text-ink">{r.internalNotes}</p>
            </section>
          )}
          <Panel id="activity" title="Activity">
            <ol className="mt-4 px-5 pb-5 sm:px-6">
              {r.activity.map((ev, i) => (
                <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < r.activity.length - 1 && (
                    <span aria-hidden className="absolute left-[3.5px] top-3 h-full w-px bg-line" />
                  )}
                  <span aria-hidden className="relative mt-1.5 size-2 shrink-0 rounded-full bg-teal/60" />
                  <div>
                    <p className="text-sm text-ink">{ev.message}</p>
                    <time dateTime={ev.at} className="text-xs text-ink-faint">
                      {formatTimeAgo(ev.at, MOCK_NOW)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Panel id={`section-${id}`} title={title}>
      <div className="px-5 pb-6 pt-4 sm:px-6">{children}</div>
    </Panel>
  );
}

function Quotations({ r, headingId, className = "" }: { r: ImportRequirement; headingId: string; className?: string }) {
  const count = r.quotationCount;
  const message =
    r.status === "draft"
      ? "This requirement is still a draft. Quotations can arrive once it's published."
      : r.status === "ready"
        ? "Supplier matching and distribution will be connected in a later step."
        : null;

  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(11,46,48,0.04),0_8px_24px_rgba(11,46,48,0.05)] sm:p-6 ${className}`}
    >
      <h2 id={headingId} className="text-xs font-semibold uppercase tracking-[0.14em] text-orange">
        Quotations
      </h2>
      {count > 0 ? (
        <>
          <p className="mt-2 text-ink">
            <span className="text-3xl font-semibold tabular-nums tracking-tight">{count}</span>{" "}
            <span className="text-sm text-ink-muted">{count === 1 ? "quotation" : "quotations"} received</span>
          </p>
          <Link href={importerHref("quotations")} className={`${primaryButton} mt-4 w-full`}>
            View Quotations
          </Link>
        </>
      ) : (
        <>
          <p className="mt-2 font-semibold text-ink">No quotations received yet.</p>
          {message && <p className="mt-1 text-sm text-ink-muted">{message}</p>}
        </>
      )}
    </section>
  );
}

function RequirementNotFound({ id }: { id: string }) {
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-canvas text-ink-faint">
        <FileSearch className="size-6" />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Requirement not found</h1>
      <p className="mt-2 text-sm text-ink-muted">
        There&apos;s no requirement <ImportId id={id} className="text-ink" />. Requirements created in this session
        are kept in this browser tab only, so they disappear when the page is reloaded.
      </p>
      <Link href={importerHref("rfqs")} className={`${secondaryButton} mt-6`}>
        <ArrowLeft aria-hidden className="size-4" />
        Back to Requirements
      </Link>
    </div>
  );
}
