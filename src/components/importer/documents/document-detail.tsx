"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileSearch, FlaskConical, Info } from "lucide-react";
import { formatDate } from "@/lib/format";
import { formatQuantity } from "@/lib/import-requirements";
import { importerHref } from "@/lib/importer-nav";
import {
  allowedDocumentActions,
  DOCUMENT_SOURCE_LABEL,
  DOCUMENT_STATUS_LABEL,
  describeDocumentEvent,
  documentNextAction,
  type TradeDocument,
} from "@/lib/importer-documents";
import { modeLabel, shipmentState, stageLabel } from "@/lib/importer-shipments";
import { findSupplier } from "@/lib/importer-suppliers";
import { ImportId, Panel } from "../dashboard/dashboard-ui";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { useShipments } from "../shipments/shipment-store";
import { ShipmentStatusBadge } from "../shipments/shipment-ui";
import { supplierHref } from "../suppliers/supplier-links";
import { focusRing, primaryButton, secondaryButton } from "../styles";
import {
  approveForWorkflow,
  issueDocument,
  markDocumentAvailable,
  markNeedsReview,
  requestDocument,
  sendForReview,
  updateDocumentMetadata,
  useDocuments,
  useDocumentsLoaded,
} from "./document-store";
import { DocumentStatusBadge, MetadataForm, RequirementTag, ValidityText } from "./document-ui";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;
const textLink = `inline-flex items-center gap-1 rounded text-sm font-semibold text-teal hover:underline ${focusRing}`;

export function DocumentDetail({ id }: { id: string }) {
  const docs = useDocuments();
  const loaded = useDocumentsLoaded();
  const doc = docs.find((d) => d.id === id);
  if (!doc) {
    if (!loaded) return <p className="py-16 text-center text-sm text-ink-muted">Loading document…</p>;
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-canvas text-ink-faint">
          <FileSearch className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Document not found</h1>
        <p className="mt-2 text-sm text-ink-muted">
          There&apos;s no document <ImportId id={id} className="text-ink" /> in this browser tab.
        </p>
        <Link href={importerHref("documents")} className={`${secondaryButton} mt-6`}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to Documents
        </Link>
      </div>
    );
  }
  return <Workspace doc={doc} />;
}

type Mode = "none" | "available" | "issue" | "metadata" | "needs-review";

function Workspace({ doc }: { doc: TradeDocument }) {
  const shipment = useShipments().find((s) => s.id === doc.shipmentId);
  const st = shipment ? shipmentState(shipment) : undefined;
  const supplier = findSupplier(doc.supplierId);
  const cargoWithCarrier = !!st && !["preparing", "ready-to-ship"].includes(st.status);
  const allowed = allowedDocumentActions(doc, cargoWithCarrier);
  const [mode, setMode] = useState<Mode>("none");
  const [reviewNote, setReviewNote] = useState("");
  const [message, setMessage] = useState("");
  const done = (result: string | void, ok: string) => {
    setMessage(result || ok);
    if (!result) setMode("none");
  };
  const m = doc.metadata;
  const show = (v?: string) => (v ? v : <span className="text-ink-faint">Not provided</span>);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`${importerHref("documents")}?shipment=${doc.shipmentId}`} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Documents
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ImportId id={doc.id} className="text-ink-muted" />
          <DocumentStatusBadge status={doc.status} />
          <RequirementTag level={doc.requirement.level} />
        </div>
        <h1 className="mt-1 break-words text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">{m.displayName || doc.label}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {doc.category} · Shipment <ImportId id={doc.shipmentId} /> · {supplier?.name ?? doc.supplierId} · From {DOCUMENT_SOURCE_LABEL[doc.source].toLowerCase()} · Updated {formatDate(doc.updatedAt)}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Link href={importerHref(`shipments/${doc.shipmentId}`)} className={textLink}>View Shipment</Link>
          <Link href={importerHref(`orders/${doc.orderId}`)} className={textLink}>View Order</Link>
          <Link href={importerHref(`rfqs/${doc.requirementId}`)} className={textLink}>View Requirement</Link>
          <Link href={supplierHref(doc.supplierId)} className={textLink}>View Supplier</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="workflow" className="rounded-2xl border border-line bg-surface px-5 py-5 shadow-[0_1px_2px_rgba(11,46,48,0.04),0_8px_24px_rgba(11,46,48,0.05)] sm:px-6">
            <h2 id="workflow" className="text-base font-semibold tracking-tight text-ink">Workflow Status</h2>
            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-faint">Requirement</dt>
                <dd className="mt-1 text-ink">{doc.requirement.level === "required" ? "Required" : doc.requirement.level === "optional" ? "Optional" : "Not Required"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Current status</dt>
                <dd className="mt-1 text-ink">{DOCUMENT_STATUS_LABEL[doc.status]}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-ink-faint">Reason</dt>
                <dd className="mt-1 text-ink">{doc.requirement.reason}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Expected provider</dt>
                <dd className="mt-1 text-ink">{DOCUMENT_SOURCE_LABEL[doc.source]}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Validity</dt>
                <dd className="mt-1"><ValidityText validity={doc.validity} expiryDate={m.expiryDate} /></dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-ink-faint">Next action</dt>
                <dd id="doc-next-action" className="mt-1 font-semibold text-ink">{documentNextAction(doc, cargoWithCarrier)}</dd>
              </div>
            </dl>
            {doc.validity === "expired" && doc.requirement.level === "required" && (doc.status === "available" || doc.status === "approved") && (
              <p className="mt-4 rounded-lg bg-orange-soft/60 px-3 py-2 text-sm text-ink">
                Expired required document — it does not count as complete for shipment readiness.
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
              {allowed.length === 0 && <p className="text-sm text-ink-muted">No action required.</p>}
              {allowed.includes("request") && (
                <button type="button" className={secondaryButton} onClick={() => done(requestDocument(doc, cargoWithCarrier), "Document requested. Recorded only — nothing was sent.")}>
                  Request Document
                </button>
              )}
              {doc.status === "requested" && doc.source !== "importer" && (
                <span className="inline-flex h-11 items-center rounded-xl border border-dashed border-line px-4 text-sm text-ink-muted">
                  Await {DOCUMENT_SOURCE_LABEL[doc.source].toLowerCase()}
                </span>
              )}
              {allowed.includes("mark-available") && (
                <button type="button" className={secondaryButton} onClick={() => setMode("available")}>
                  <FlaskConical aria-hidden className="size-4 text-orange" />
                  Mark Available
                  <span className="rounded-full border border-orange/40 px-1.5 text-xs text-orange">Demo</span>
                </button>
              )}
              {allowed.includes("issue") && (
                <button type="button" className={secondaryButton} onClick={() => setMode("issue")}>
                  Record as Issued
                </button>
              )}
              {allowed.includes("send-for-review") && (
                <button type="button" className={secondaryButton} onClick={() => done(sendForReview(doc), "Sent for review.")}>
                  Send for Review
                </button>
              )}
              {allowed.includes("approve") && (
                <button type="button" className={primaryButton} onClick={() => done(approveForWorkflow(doc), "Approved for workflow.")}>
                  Approve for Workflow
                </button>
              )}
              {allowed.includes("mark-needs-review") && (
                <button type="button" className={secondaryButton} onClick={() => setMode("needs-review")}>
                  Mark Needs Review
                </button>
              )}
              {allowed.includes("update-metadata") && (
                <button type="button" className={secondaryButton} onClick={() => setMode("metadata")}>
                  Update Metadata
                </button>
              )}
              {doc.type === "transport-document" && !cargoWithCarrier && doc.status !== "not-required" && (
                <p className="basis-full text-xs text-ink-muted">{doc.label} becomes available after cargo handover to the carrier.</p>
              )}
            </div>
            <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-teal">{message}</p>

            {mode === "available" && (
              <MetadataForm id="meta-available" heading="Mark document available" demo initial={m} submitLabel="Mark Available" onCancel={() => setMode("none")} onSubmit={(meta) => done(markDocumentAvailable(doc, meta, cargoWithCarrier), "Marked available (demo). No file was uploaded.")} />
            )}
            {mode === "issue" && (
              <MetadataForm id="meta-issue" heading="Record document as issued" initial={m} submitLabel="Record as Issued" onCancel={() => setMode("none")} onSubmit={(meta) => done(issueDocument(doc, meta), "Recorded as issued.")} />
            )}
            {mode === "metadata" && (
              <MetadataForm id="meta-edit" heading="Update metadata" initial={m} submitLabel="Save Metadata" onCancel={() => setMode("none")} onSubmit={(meta) => done(updateDocumentMetadata(doc, meta), "Metadata updated.")} />
            )}
            {mode === "needs-review" && (
              <form
                onKeyDown={(e) => {
                  if (e.key === "Escape") setMode("none");
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  done(markNeedsReview(doc, reviewNote.trim()), "Marked as needing review.");
                }}
                className="space-y-3 rounded-xl border border-line p-4"
              >
                <label htmlFor="review-note" className="block text-sm font-medium text-ink">
                  What needs review? <span className="text-xs font-normal text-ink-faint">Optional</span>
                </label>
                <input id="review-note" value={reviewNote} maxLength={300} onChange={(e) => setReviewNote(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20" />
                <div className="flex gap-2">
                  <button type="submit" className={primaryButton}>Mark Needs Review</button>
                  <button type="button" onClick={() => setMode("none")} className={secondaryButton}>Cancel</button>
                </div>
              </form>
            )}
          </section>

          <Panel id="doc-info" title="Document Information" description="Document metadata only — no file is stored.">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 px-5 pb-5 pt-3 text-sm sm:grid-cols-2 sm:px-6">
              {[
                ["Document number", show(m.number)],
                ["Issuer", show(m.issuer)],
                ["Issue date", m.issueDate ? formatDate(m.issueDate) : show()],
                ["Expiry date", m.expiryDate ? formatDate(m.expiryDate) : show()],
                ["Country of issue", show(m.country)],
                ["Declared filename", show(m.filename)],
                ["Source party", DOCUMENT_SOURCE_LABEL[doc.source]],
                ["Notes", show(m.notes)],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs text-ink-faint">{k}</dt>
                  <dd className="mt-1 break-words text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel id="doc-history" title="Document History">
            {doc.events.length === 0 ? (
              <p className="px-5 pb-5 pt-3 text-sm text-ink-muted sm:px-6">No activity recorded yet.</p>
            ) : (
              <ol className="px-5 pb-5 pt-4 sm:px-6">
                {[...doc.events].reverse().map((e, i, list) => (
                  <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < list.length - 1 && <span aria-hidden className="absolute left-[3.5px] top-3 h-full w-px bg-line" />}
                    <span aria-hidden className={`relative mt-1.5 size-2 shrink-0 rounded-full ${e.by === "importer" ? "bg-orange" : "bg-teal"}`} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span className="font-medium text-ink">{describeDocumentEvent(e, doc.label)}</span>
                        {e.demo && <span className="rounded-full border border-orange/40 px-1.5 text-xs font-medium text-orange">Demo</span>}
                      </p>
                      <p className="text-xs text-ink-faint">
                        <time dateTime={e.at}>{formatDate(e.at)}</time> · {e.by === "importer" ? "You" : e.by === "system" ? "XimVerse" : DOCUMENT_SOURCE_LABEL[e.by]}
                      </p>
                      {e.note && <p className="mt-0.5 text-sm text-ink-muted">{e.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel id="linked-shipment" title="Linked Shipment">
            <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
              {shipment && st ? (
                <dl className="divide-y divide-line">
                  {[
                    ["Shipment", <Link key="s" href={importerHref(`shipments/${shipment.id}`)} className={`rounded font-medium text-teal hover:underline ${focusRing}`}>{shipment.id}</Link>],
                    ["Order", shipment.orderId],
                    ["Product", shipment.cargo.product],
                    ["Quantity", formatQuantity(shipment.cargo.quantity)],
                    ["Route", `${shipment.route.portOfLoading} → ${shipment.route.portOfDischarge}`],
                    ["Mode", modeLabel(shipment.route.mode)],
                    ["Stage", stageLabel(st.stage)],
                    ["Status", <ShipmentStatusBadge key="b" status={st.status} />],
                    ["ETA", `${formatDate(st.schedule.eta)} (planned)`],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between gap-4 py-2">
                      <dt className="text-ink-muted">{k}</dt>
                      <dd className="min-w-0 break-words text-right text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-ink-muted">Shipment not found in this browser tab.</p>
              )}
              <p className="mt-3 flex gap-2 text-xs text-ink-faint">
                <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                Shown live from the shipment — not stored on the document.
              </p>
            </div>
          </Panel>
          <SumitAnalysisCard
            id="sumit-document"
            heading="Ask SUMIT about these documents"
            prompts={["Which required documents are missing?", "Which documents need review?", "Which documents expire soon?", "What is blocking this shipment?"]}
            message="SUMIT document intelligence will be connected later. Nothing was analysed."
          />
        </div>
      </div>
    </div>
  );
}
