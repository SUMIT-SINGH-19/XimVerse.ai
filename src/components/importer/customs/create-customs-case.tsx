"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleAlert, FileSearch, Info } from "lucide-react";
import { formatDate } from "@/lib/format";
import { formatQuantity } from "@/lib/import-requirements";
import { importerHref } from "@/lib/importer-nav";
import { customsCaseForShipment, customsCaseView, customsEligibility, FIELD_SOURCE_LABEL, PREPARATION_ONLY, type DeclarationFieldId } from "@/lib/importer-customs";
import { modeLabel, shipmentState, stageLabel } from "@/lib/importer-shipments";
import { findSupplier } from "@/lib/importer-suppliers";
import { ImportId, Panel } from "../dashboard/dashboard-ui";
import { useDocuments } from "../documents/document-store";
import { useOrders } from "../orders/order-store";
import { useImportRequirements } from "../rfq/requirements-store";
import { useShipments, useShipmentsLoaded } from "../shipments/shipment-store";
import { focusRing, primaryButton, secondaryButton } from "../styles";
import { createCustomsCase, useCustomsCaseRecords } from "./customs-store";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;

const INITIAL_FIELDS: { id: DeclarationFieldId; label?: string }[] = [
  { id: "importerName", label: "Importer" },
  { id: "supplierName", label: "Supplier" },
  { id: "countryOfOrigin" },
  { id: "hsCode" },
  { id: "productDescription" },
  { id: "quantity" },
  { id: "unit" },
  { id: "invoiceValue", label: "Commercial Value" },
  { id: "currency" },
  { id: "incoterm" },
  { id: "portOfImport" },
  { id: "transportMode" },
];

export function CreateCustomsCase({ shipmentId }: { shipmentId: string }) {
  const shipments = useShipments();
  const loaded = useShipmentsLoaded();
  const records = useCustomsCaseRecords();
  const documents = useDocuments();
  const orders = useOrders();
  const { find: findRequirement } = useImportRequirements();
  const router = useRouter();
  const [message, setMessage] = useState("");

  const header = (
    <div>
      <Link href={importerHref("customs")} className={backLink}>
        <ArrowLeft aria-hidden className="size-4" />
        Customs
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">Prepare Customs</h1>
    </div>
  );

  if (!shipmentId) {
    const open = shipments.filter((s) => !customsCaseForShipment(s.id, records));
    return (
      <div className="space-y-6">
        {header}
        <Panel id="choose-shipment" title="Choose a shipment" description="Each shipment has at most one customs case. Preparation can start before the shipment arrives.">
          {open.length === 0 ? (
            <p className="px-5 pb-5 pt-3 text-sm text-ink-muted sm:px-6">Every shipment already has a customs case.</p>
          ) : (
            <ul className="divide-y divide-line px-5 pb-3 pt-1 sm:px-6">
              {open.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <ImportId id={s.id} className="text-ink-muted" />
                    <span className="block font-medium text-ink">{s.cargo.product} · {findSupplier(s.supplierId)?.name ?? s.supplierId}</span>
                    <span className="block text-xs text-ink-faint">{s.route.portOfDischarge} · {stageLabel(shipmentState(s).stage)}</span>
                  </span>
                  <Link href={`${importerHref("customs/new")}?shipment=${s.id}`} className={`${secondaryButton} h-9 px-3`}>
                    Prepare Customs<span className="sr-only"> for {s.id}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    );
  }

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
        <Link href={importerHref("customs")} className={`${secondaryButton} mt-6`}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to Customs
        </Link>
      </div>
    );
  }

  const order = orders.find((o) => o.id === sh.orderId);
  const eligibility = customsEligibility(sh, records, order, !!findRequirement(sh.requirementId));
  const st = shipmentState(sh);
  const supplier = findSupplier(sh.supplierId);
  // Preview with the same derivation the case will use; nothing is stored yet.
  const preview = customsCaseView(
    { id: "CUS-PREVIEW", shipmentId: sh.id, orderId: sh.orderId, requirementId: sh.requirementId, supplierId: sh.supplierId, createdAt: st.updatedAt, events: [] },
    shipments,
    documents,
    orders,
  )!;

  const source: [string, string][] = [
    ["Shipment", sh.id],
    ["Order", sh.orderId],
    ["Supplier", supplier?.name ?? sh.supplierId],
    ["Product", sh.cargo.product],
    ["Quantity", formatQuantity(sh.cargo.quantity)],
    ["Mode", modeLabel(sh.route.mode)],
    ["Port of Loading", sh.route.portOfLoading],
    ["Port of Discharge", sh.route.portOfDischarge],
    ["Destination", sh.route.finalDelivery],
    ["ETA", formatDate(st.schedule.eta)],
    ["Incoterm", order ? `${order.terms.incoterm} ${order.terms.namedPlace}` : sh.incoterm],
  ];

  return (
    <div className="space-y-6">
      {header}
      <p className="-mt-3 max-w-2xl text-base text-ink-muted">
        Review what XimVerse already knows about shipment <ImportId id={sh.id} className="text-ink" />. Nothing needs re-entering; missing values can be added in the case.
      </p>

      {!eligibility.ok && (
        <div role="status" className="flex flex-col gap-3 rounded-2xl border border-orange/30 bg-orange-soft/40 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex gap-2 text-ink">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-orange" />
            {eligibility.reason === "case-exists"
              ? "A customs case already exists for this shipment."
              : eligibility.reason === "cancelled"
                ? "The order for this shipment was cancelled, so customs can't be prepared."
                : "The order, supplier or requirement for this shipment can't be found."}
          </p>
          {eligibility.reason === "case-exists" && eligibility.caseId && (
            <Link href={importerHref(`customs/${eligibility.caseId}`)} className={`${primaryButton} h-10`}>
              View Customs Case
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel id="source-summary" title="Source Summary" description="Read-only. From the shipment and its order.">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 pb-5 pt-3 sm:grid-cols-2 sm:px-6">
            {source.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-medium text-ink-faint">{k}</dt>
                <dd className="mt-0.5 break-words text-sm text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel id="initial-customs" title="Initial Customs Information" description="Filled from existing records. Missing values are not invented.">
          <dl className="divide-y divide-line px-5 pb-3 pt-1 sm:px-6">
            {INITIAL_FIELDS.map(({ id, label }) => {
              const f = preview.fields.find((x) => x.id === id)!;
              return (
                <div key={id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
                  <dt className="text-ink-muted">{label ?? f.label}</dt>
                  <dd className="min-w-0 break-words text-right">
                    {f.value ? <span className="text-ink">{f.value}</span> : <span className="font-medium text-orange">{id === "hsCode" ? "HS Code required." : "Not provided"}</span>}
                    {f.source && <span className="ml-2 text-xs text-ink-faint">{FIELD_SOURCE_LABEL[f.source]}</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Panel>
      </div>

      <section aria-labelledby="create-case" className="rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
        <h2 id="create-case" className="text-base font-semibold text-ink">Create the customs case</h2>
        <p className="mt-1 flex gap-2 text-sm text-ink-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {PREPARATION_ONLY} The case references the shipment, order, supplier and documents; it does not copy them.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!eligibility.ok}
            onClick={() => {
              const { id, created } = createCustomsCase(sh);
              setMessage(created ? "Customs case created." : "A customs case already exists for this shipment.");
              router.push(importerHref(`customs/${id}`));
            }}
            className={primaryButton}
          >
            Create Customs Case
          </button>
          <Link href={importerHref(`shipments/${sh.id}`)} className={secondaryButton}>Back to Shipment</Link>
        </div>
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-teal">{message}</p>
      </section>
    </div>
  );
}
