"use client";

import Link from "next/link";
import { ArrowLeft, CircleCheck, CircleX, FileSearch } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import { CUSTOMS_STATUS_LABEL, modeLabel, shipmentState, stageLabel } from "@/lib/importer-shipments";
import { DOCUMENT_SOURCE_LABEL, documentNextAction } from "@/lib/importer-documents";
import { findSupplier } from "@/lib/importer-suppliers";
import { ImportId, Panel } from "../dashboard/dashboard-ui";
import { DocumentStatusBadge, RequirementTag, ValidityText } from "../documents/document-ui";
import { useDocuments, useDocumentsLoaded } from "../documents/document-store";
import { useOrders } from "../orders/order-store";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { useShipments } from "../shipments/shipment-store";
import { customsCaseForShipment } from "@/lib/importer-customs";
import { useCustomsCases } from "../customs/customs-store";
import { CustomsStatusBadge } from "../customs/customs-ui";
import { ReadinessStatusBadge, ShipmentStatusBadge } from "../shipments/shipment-ui";
import { focusRing, secondaryButton } from "../styles";
import { COMPLIANCE_PROMPTS } from "./compliance-list";
import { assess, Disclaimer, ReadinessBadge, SeverityLabel } from "./compliance-ui";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;
const textLink = `inline-flex items-center gap-1 rounded text-sm font-semibold text-teal hover:underline ${focusRing}`;

export function ComplianceDetail({ shipmentId }: { shipmentId: string }) {
  const shipments = useShipments();
  const documents = useDocuments();
  const orders = useOrders();
  const customsCases = useCustomsCases();
  const loaded = useDocumentsLoaded();
  const sh = shipments.find((s) => s.id === shipmentId);

  if (!sh) {
    if (!loaded) return <p className="py-16 text-center text-sm text-ink-muted">Loading shipment…</p>;
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-canvas text-ink-faint">
          <FileSearch className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Shipment not found</h1>
        <p className="mt-2 text-sm text-ink-muted">There&apos;s no shipment <ImportId id={shipmentId} className="text-ink" /> in this browser tab.</p>
        <Link href={importerHref("compliance")} className={`${secondaryButton} mt-6`}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to Compliance
        </Link>
      </div>
    );
  }

  const st = shipmentState(sh);
  const a = assess(sh, documents, orders, customsCases);
  const customsCase = customsCaseForShipment(sh.id, customsCases);
  const supplier = findSupplier(sh.supplierId);
  const cargoWithCarrier = !["preparing", "ready-to-ship"].includes(st.status);
  const reasons = a.issues.filter((i) => i.severity !== "information");

  return (
    <div className="space-y-6">
      <div>
        <Link href={importerHref("compliance")} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Compliance
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ImportId id={sh.id} className="text-ink-muted" />
          <span className="text-xs text-ink-faint">Order <ImportId id={sh.orderId} className="text-xs text-ink-muted" /></span>
          <ShipmentStatusBadge status={st.status} />
          <ReadinessBadge readiness={a.readiness} />
        </div>
        <h1 className="mt-1 break-words text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          {sh.cargo.product}
          <span className="font-semibold text-ink-muted"> from {supplier?.name ?? sh.supplierId}</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {sh.route.portOfLoading} → {sh.route.portOfDischarge} · {modeLabel(sh.route.mode)} · Stage: {stageLabel(st.stage)}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Link href={importerHref(`shipments/${sh.id}`)} className={textLink}>View Shipment</Link>
          <Link href={`${importerHref("documents")}?shipment=${sh.id}`} className={textLink}>Manage Documents</Link>
          {customsCase ? (
            <Link href={importerHref(`customs/${customsCase.id}`)} className={textLink}>View Customs Case</Link>
          ) : (
            <Link href={`${importerHref("customs/new")}?shipment=${sh.id}`} className={textLink}>Prepare Customs</Link>
          )}
        </div>
      </div>

      <section aria-labelledby="readiness-result" className={`rounded-2xl border px-5 py-5 sm:px-6 ${a.readiness === "ready" ? "border-teal/30 bg-teal-soft/50" : "border-orange/30 bg-orange-soft/40"}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{a.stageGoal}</p>
        <h2 id="readiness-result" className="mt-1 text-xl font-semibold text-ink">{a.summary}</h2>
        {reasons.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No issues detected for the current workflow.</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {reasons.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline gap-x-2">
                <SeverityLabel severity={i.severity} />
                <span className="text-ink">{i.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Disclaimer />

      <Panel id="matrix" title="Required Document Matrix" description="Documents for this shipment, why each is needed, and what to do next.">
        <div className="relative mt-3 hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr className="border-y border-line bg-canvas/60 text-xs text-ink-muted">
                {["Requirement", "Document", "Why needed", "Provider", "Status", "Validity", "Action"].map((h, i, all) => (
                  <th key={h} scope="col" className={`py-2.5 font-medium ${i === 0 ? "pl-6 pr-3" : i === all.length - 1 ? "pl-3 pr-6" : "px-3"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {a.documents.map((d) => (
                <tr key={d.id} className="align-top">
                  <td className="py-3 pl-6 pr-3"><RequirementTag level={d.requirement.level} /></td>
                  <th scope="row" className="px-3 py-3 font-normal">
                    <Link href={importerHref(`documents/${d.id}`)} className={`rounded font-medium text-ink hover:text-teal hover:underline ${focusRing}`}>{d.label}</Link>
                  </th>
                  <td className="px-3 py-3 text-ink-muted">{d.requirement.reason}</td>
                  <td className="px-3 py-3 text-ink-muted">{DOCUMENT_SOURCE_LABEL[d.source]}</td>
                  <td className="px-3 py-3"><DocumentStatusBadge status={d.status} /></td>
                  <td className="px-3 py-3"><ValidityText validity={d.validity} expiryDate={d.metadata.expiryDate} /></td>
                  <td className="py-3 pl-3 pr-6 text-ink">{documentNextAction(d, cargoWithCarrier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 divide-y divide-line border-t border-line lg:hidden">
          {a.documents.map((d) => (
            <li key={d.id} className="px-5 py-3 text-sm sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={importerHref(`documents/${d.id}`)} className={`rounded font-medium text-ink hover:text-teal hover:underline ${focusRing}`}>{d.label}</Link>
                <DocumentStatusBadge status={d.status} />
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <RequirementTag level={d.requirement.level} /> {DOCUMENT_SOURCE_LABEL[d.source]} · <ValidityText validity={d.validity} expiryDate={d.metadata.expiryDate} />
              </p>
              <p className="mt-1 text-xs text-ink-muted">{d.requirement.reason}</p>
              <p className="mt-1 text-sm text-ink">{documentNextAction(d, cargoWithCarrier)}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel id="issues" title="Issues" description="Derived from recorded data only.">
          {a.issues.length === 0 ? (
            <p className="px-5 pb-5 pt-3 text-sm text-ink-muted sm:px-6">No issues detected for the current workflow.</p>
          ) : (
            <ul className="divide-y divide-line px-5 pb-3 pt-1 sm:px-6">
              {a.issues.map((i) => (
                <li key={i.id} className="py-3 text-sm">
                  <SeverityLabel severity={i.severity} />
                  <p className="mt-1 font-medium text-ink">
                    {i.documentId ? (
                      <Link href={importerHref(`documents/${i.documentId}`)} className={`rounded hover:text-teal hover:underline ${focusRing}`}>{i.title}</Link>
                    ) : (
                      i.title
                    )}
                  </p>
                  <p className="text-ink-muted">{i.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel id="consistency" title="Data Consistency" description="Structured checks between the shipment, its order and its documents.">
          <ul className="divide-y divide-line px-5 pb-3 pt-1 sm:px-6">
            {a.consistency.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-2.5 text-sm">
                {c.ok ? <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-teal" /> : <CircleX aria-hidden className="mt-0.5 size-4 shrink-0 text-orange" />}
                <span className="min-w-0">
                  <span className="block text-ink">
                    {c.label} <span className="sr-only">—</span>
                    <span className={`ml-1 text-xs font-semibold ${c.ok ? "text-teal" : "text-orange"}`}>{c.ok ? "Pass" : "Check"}</span>
                  </span>
                  <span className="block break-words text-xs text-ink-muted">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel id="compliance-preshipment" title="Pre-Shipment Readiness" description="The same checklist the shipment uses.">
          <ul className="divide-y divide-line px-5 pb-3 pt-1 sm:px-6">
            {a.checklist.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
                <span className="text-ink">
                  {item.label}
                  {item.requiredForReady && <span className="ml-2 rounded border border-line px-1.5 text-xs text-ink-muted">Required</span>}
                </span>
                <ReadinessStatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel id="customs-prep" title="Customs Preparation" description="Readiness only. No customs filing is made from XimVerse.">
          <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
            <p className="mb-2 font-semibold text-ink">
              Result: {CUSTOMS_STATUS_LABEL[a.customs.status]}
            </p>
            <dl className="divide-y divide-line">
              {a.customs.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4 py-2">
                  <dt className="flex items-center gap-2 text-ink-muted">
                    {item.ok ? <CircleCheck aria-hidden className="size-4 text-teal" /> : <CircleX aria-hidden className="size-4 text-orange" />}
                    {item.label}
                  </dt>
                  <dd className="min-w-0 break-words text-right text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
            {customsCase && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-ink-muted">
                Customs case
                <Link href={importerHref(`customs/${customsCase.id}`)} className={`rounded font-mono text-teal hover:underline ${focusRing}`}>{customsCase.id}</Link>
                <CustomsStatusBadge status={customsCase.status} />
              </p>
            )}
            <p className="mt-2 text-xs text-ink-faint">Planned ETA {formatDate(st.schedule.eta)}.</p>
          </div>
        </Panel>
      </div>

      <SumitAnalysisCard id="sumit-compliance-detail" heading="Ask SUMIT about compliance readiness" prompts={COMPLIANCE_PROMPTS} message="SUMIT compliance intelligence will be connected later. Nothing was analysed, and SUMIT does not give legal advice." />
    </div>
  );
}
