"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CircleAlert, FileSearch, FlaskConical, Info, Lock } from "lucide-react";
import { formatDate } from "@/lib/format";
import { formatQuantity } from "@/lib/import-requirements";
import { importerHref, PLACEHOLDER_IMPORTER } from "@/lib/importer-nav";
import { orderStatus } from "@/lib/importer-orders";
import {
  blockingItems,
  CUSTOMS_STATUS_LABEL,
  customsStatus,
  FREIGHT_STATUS_LABEL,
  milestones,
  modeLabel,
  NEXT_STATUS,
  nextAction,
  preShipmentChecklist,
  SHIPMENT_STAGES,
  shipmentState,
  stageLabel,
  stageOf,
  type Shipment,
  type ShipmentState,
  type ShipmentStatus,
} from "@/lib/importer-shipments";
import { findSupplier } from "@/lib/importer-suppliers";
import { ImportId, Panel } from "../dashboard/dashboard-ui";
import { useOrders } from "../orders/order-store";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { supplierHref } from "../suppliers/supplier-links";
import { focusRing, ghostButton, primaryButton, secondaryButton } from "../styles";
import {
  advanceStatus,
  markCargoReady,
  simulateCustomsClearance,
  simulateFreightBooking,
  updateSchedule,
  useShipments,
  useShipmentsLoaded,
} from "./shipment-store";
import { describeEvent, eventParty, ReadinessStatusBadge, ShipmentStatusBadge } from "./shipment-ui";
import {
  DOCUMENT_SOURCE_LABEL,
  DOCUMENT_STATUS_LABEL,
  describeDocumentEvent,
  documentsForShipment,
  VALIDITY_LABEL,
  type TradeDocument,
} from "@/lib/importer-documents";
import { approveForWorkflow, issueDocument, markDocumentAvailable, requestDocument, useDocuments } from "../documents/document-store";
import { customsCaseForShipment, type CustomsCaseView } from "@/lib/importer-customs";
import { useCustomsCases } from "../customs/customs-store";
import { CUSTOMS_CASE_STATUS_LABEL } from "@/lib/importer-customs";
import { CustomsReadinessBadge } from "../customs/customs-ui";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;
const textLink = `inline-flex items-center gap-1 rounded text-sm font-semibold text-teal hover:underline ${focusRing}`;
const smallButton = `inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink transition hover:border-teal/40 hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;
const demoTag = <span className="rounded-full border border-orange/40 px-1.5 text-xs font-medium text-orange">Demo</span>;

export function ShipmentDetail({ id }: { id: string }) {
  const shipments = useShipments();
  const loaded = useShipmentsLoaded();
  const sh = shipments.find((s) => s.id === id);
  if (!sh) {
    if (!loaded) return <p className="py-16 text-center text-sm text-ink-muted">Loading shipment…</p>;
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-canvas text-ink-faint">
          <FileSearch className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Shipment not found</h1>
        <p className="mt-2 text-sm text-ink-muted">
          There&apos;s no shipment <ImportId id={id} className="text-ink" /> in this browser tab. Shipments you create are kept in this tab&apos;s session only.
        </p>
        <Link href={importerHref("shipments")} className={`${secondaryButton} mt-6`}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to Shipments
        </Link>
      </div>
    );
  }
  return <Workspace sh={sh} />;
}

function Workspace({ sh }: { sh: Shipment }) {
  const order = useOrders().find((o) => o.id === sh.orderId);
  const supplier = findSupplier(sh.supplierId)!;
  const st = shipmentState(sh);
  const supplierConfirmed = !!order?.events.some((e) => e.type === "supplier-confirmed");
  const docs = documentsForShipment(sh.id, useDocuments());
  // One shared lookup: the shipment's customs case, if any, owns broker and customs status.
  const customsCase = customsCaseForShipment(sh.id, useCustomsCases());
  const override = customsCase?.override;
  const checklist = preShipmentChecklist(sh, st, supplierConfirmed, docs, override);
  const blocking = blockingItems(checklist);
  const customs = customsStatus(sh, st, docs, override);
  const [message, setMessage] = useState("");

  const run = (fn: () => string | void, success: string) => {
    const err = fn();
    setMessage(err || success);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href={importerHref("shipments")} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Shipments
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ImportId id={sh.id} className="text-ink-muted" />
          <span className="text-xs text-ink-faint">Order <ImportId id={sh.orderId} className="text-xs text-ink-muted" /></span>
          <ShipmentStatusBadge status={st.status} />
          <span className="text-xs text-ink-faint">Stage: {stageLabel(st.stage)}</span>
        </div>
        <h1 className="mt-1 break-words text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          {sh.cargo.product}
          <span className="font-semibold text-ink-muted"> from {supplier.name}</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {modeLabel(sh.route.mode)} · ETD {formatDate(st.schedule.etd)} · ETA {formatDate(st.schedule.eta)} <span className="text-ink-faint">(planned)</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Link href={importerHref(`orders/${sh.orderId}`)} className={textLink}>View Order</Link>
          <Link href={importerHref(`rfqs/${sh.requirementId}`)} className={textLink}>View Requirement</Link>
          <Link href={supplierHref(sh.supplierId)} className={textLink}>View Supplier</Link>
          <Link href={`${importerHref("documents")}?shipment=${sh.id}`} className={textLink}>Manage Documents</Link>
          <Link href={importerHref(`compliance/${sh.id}`)} className={textLink}>View Compliance</Link>
        </div>
      </div>

      <StageStepper status={st.status} />

      <section aria-labelledby="next-action" className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-[0_1px_2px_rgba(11,46,48,0.04),0_8px_24px_rgba(11,46,48,0.05)] sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange">Next action</p>
        <h2 id="next-action" className="mt-1 text-lg font-semibold text-ink">{nextAction(sh, st, checklist, docs, override)}</h2>
        <StatusActions
          st={st}
          blockingCount={blocking.length}
          customsCleared={customs === "cleared"}
          customsCaseId={customsCase?.id}
          onAdvance={(to) => run(() => advanceStatus(sh.id, to, supplierConfirmed, docs, override), "Status updated.")}
          onCargoReady={() => run(() => markCargoReady(sh.id), "Cargo marked ready.")}
          onClear={() => run(() => simulateCustomsClearance(sh.id), "Demo customs clearance recorded.")}
        />
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-teal">{message}</p>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Panel id="overview" title="Shipment Overview">
            <div className="px-5 pb-5 pt-3 sm:px-6">
              <Facts
                rows={[
                  ["Supplier", supplier.name],
                  ["Order", sh.orderId],
                  ["PO", order?.purchaseOrder.number ?? "—"],
                  ["Product", sh.cargo.product],
                  ["Quantity", formatQuantity(sh.cargo.quantity)],
                  ["Packages", `${sh.cargo.packages.toLocaleString("en-US")} ${sh.cargo.packageType.toLowerCase()}`],
                  ["Gross weight", `${sh.cargo.grossWeight.toLocaleString("en-US")} ${sh.cargo.weightUnit}`],
                  ["Net weight", `${sh.cargo.netWeight.toLocaleString("en-US")} ${sh.cargo.weightUnit}`],
                  ["Transport mode", modeLabel(sh.route.mode)],
                  ["Incoterm", sh.incoterm],
                  ["Current stage", stageLabel(st.stage)],
                  ["Next action", nextAction(sh, st, checklist, docs, override)],
                ]}
              />
            </div>
          </Panel>

          <RouteAndSchedule sh={sh} st={st} onMessage={setMessage} />

          <Panel id="cargo" title="Cargo Details" description="Physical cargo as planned for this shipment. Commercial terms stay on the order.">
            <div className="px-5 pb-5 pt-3 sm:px-6">
              <Facts
                rows={[
                  ["Product", sh.cargo.product],
                  ["Shipping quantity", formatQuantity(sh.cargo.quantity)],
                  ["Package count", sh.cargo.packages.toLocaleString("en-US")],
                  ["Package type", sh.cargo.packageType],
                  ["Gross weight", `${sh.cargo.grossWeight.toLocaleString("en-US")} ${sh.cargo.weightUnit}`],
                  ["Net weight", `${sh.cargo.netWeight.toLocaleString("en-US")} ${sh.cargo.weightUnit}`],
                  ["Volume", sh.cargo.volumeCbm ? `${sh.cargo.volumeCbm} CBM` : "—"],
                  ["Packaging", sh.cargo.packagingDescription || "—", true],
                ]}
              />
            </div>
          </Panel>

          <Panel id="readiness" title="Pre-Shipment Readiness" description="Coordination checklist. Items marked Required must be complete before Ready to Ship.">
            <ul className="divide-y divide-line px-5 pb-3 pt-1 sm:px-6">
              {checklist.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
                  <span className="text-ink">
                    {item.label}
                    {item.requiredForReady && <span className="ml-2 rounded border border-line px-1.5 text-xs text-ink-muted">Required</span>}
                  </span>
                  <ReadinessStatusBadge status={item.status} />
                </li>
              ))}
            </ul>
            {st.status === "preparing" && (
              <p className={`mx-5 mb-5 rounded-lg px-3 py-2 text-sm sm:mx-6 ${blocking.length ? "bg-orange-soft/50 text-ink" : "bg-teal-soft/60 text-ink"}`}>
                {blocking.length
                  ? `Complete ${blocking.length} required ${blocking.length === 1 ? "item" : "items"} before marking this shipment Ready to Ship: ${blocking.map((b) => b.label).join(", ")}.`
                  : "All required items are complete. The shipment can be marked Ready to Ship."}
              </p>
            )}
          </Panel>

          <Documents sh={sh} st={st} docs={docs} onMessage={setMessage} />

          <Panel id="milestones" title="Milestones" description="Recorded milestones. Demo entries were simulated; no tracking system is connected.">
            <ol className="px-5 pb-5 pt-4 sm:px-6">
              {milestones(sh, docs).map((m, i, list) => (
                <li key={m.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < list.length - 1 && <span aria-hidden className={`absolute left-[7px] top-5 h-full w-px ${m.at ? "bg-teal/50" : "bg-line"}`} />}
                  <span
                    aria-hidden
                    className={`relative mt-0.5 grid size-[15px] shrink-0 place-items-center rounded-full ${m.at ? "bg-teal text-on-brand" : "border border-line bg-surface"}`}
                  >
                    {m.at && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className={m.at ? "text-ink" : "text-ink-faint"}>{m.label}</span>
                    <span className="flex items-center gap-2 text-xs text-ink-faint">
                      {m.at ? (
                        <>
                          <time dateTime={m.at}>{formatDate(m.at)}</time>
                          {m.demo ? demoTag : <span>Recorded</span>}
                        </>
                      ) : (
                        "Upcoming"
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel id="shipment-activity" title="Activity">
            <ol className="px-5 pb-5 pt-4 sm:px-6">
              {activityFeed(sh, docs).map((e, i, list) => (
                <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < list.length - 1 && <span aria-hidden className="absolute left-[3.5px] top-3 h-full w-px bg-line" />}
                  <span aria-hidden className={`relative mt-1.5 size-2 shrink-0 rounded-full ${e.byYou ? "bg-orange" : "bg-teal"}`} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-medium text-ink">{e.text}</span>
                      {e.demo && demoTag}
                    </p>
                    <p className="text-xs text-ink-faint">
                      <time dateTime={e.at}>{formatDate(e.at)}</time> · {e.party}
                    </p>
                    {e.note && <p className="mt-0.5 text-sm text-ink-muted">{e.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <Freight sh={sh} st={st} onMessage={setMessage} />
          <Customs sh={sh} st={st} docs={docs} customs={customs} customsCase={customsCase} />
          <SumitAnalysisCard
            id="sumit-shipment"
            heading="Ask SUMIT about this shipment"
            prompts={[
              "What is blocking this shipment?",
              "Which documents are still missing?",
              "Is this shipment ready to ship?",
              "What should happen before customs?",
              "Summarize the current shipment status.",
              "What changed in the ETA?",
            ]}
            message="SUMIT shipment intelligence will be connected later. Nothing was analysed."
          />
        </div>
      </div>
      {order && orderStatus(order) === "cancelled" && (
        <p className="text-sm text-orange">The order for this shipment was cancelled.</p>
      )}
    </div>
  );
}

function Facts({ rows }: { rows: ([string, React.ReactNode] | [string, React.ReactNode, boolean])[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
      {rows.map(([label, value, wide]) => (
        <div key={label} className={wide ? "sm:col-span-2" : undefined}>
          <dt className="text-xs font-medium text-ink-faint">{label}</dt>
          <dd className="mt-1 break-words text-sm text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StageStepper({ status }: { status: ShipmentStatus }) {
  const current = SHIPMENT_STAGES.findIndex((s) => s.id === stageOf(status));
  return (
    <section aria-labelledby="stages" className="rounded-2xl border border-line bg-surface px-5 py-4 sm:px-6">
      <h2 id="stages" className="sr-only">Shipment stages</h2>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 xl:grid-cols-8">
        {SHIPMENT_STAGES.map((stage, i) => {
          const done = i < current || status === "delivered";
          const isCurrent = i === current && status !== "delivered";
          return (
            <li key={stage.id} className="flex items-center gap-2">
              <span
                aria-hidden
                className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  done ? "bg-teal text-on-brand" : isCurrent ? "border-2 border-orange text-orange" : "border border-line text-ink-faint"
                }`}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 text-sm leading-tight">
                <span className={isCurrent ? "font-semibold text-ink" : done ? "text-ink" : "text-ink-faint"}>{stage.label}</span>
                <span className="block text-xs text-ink-faint">{done ? "Done" : isCurrent ? "Current" : "Upcoming"}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const DEMO_ACTION_LABEL: Partial<Record<ShipmentStatus, string>> = {
  "at-origin": "Simulate Cargo Handover",
  "in-transit": "Simulate Departure",
  arrived: "Simulate Arrival",
  customs: "Simulate Customs Start",
};

function StatusActions({
  st,
  blockingCount,
  customsCleared,
  customsCaseId,
  onAdvance,
  onCargoReady,
  onClear,
}: {
  st: ShipmentState;
  blockingCount: number;
  customsCleared: boolean;
  customsCaseId?: string;
  onAdvance: (to: ShipmentStatus) => void;
  onCargoReady: () => void;
  onClear: () => void;
}) {
  const next = NEXT_STATUS[st.status];
  const demoLine = (
    <p className="mt-2 flex gap-2 text-xs text-ink-muted">
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      Demo only — no carrier or tracking system is connected.
    </p>
  );
  const wrap = "h-auto min-h-11 w-full whitespace-normal py-2 sm:w-auto";

  if (st.status === "delivered") return <p className="mt-2 text-sm text-ink-muted">This shipment is complete. No further status changes are possible.</p>;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {st.status === "preparing" && (
          <>
            <button type="button" onClick={() => onAdvance("ready-to-ship")} disabled={blockingCount > 0} className={`${primaryButton} ${wrap}`}>
              Mark Ready to Ship
            </button>
            {!st.cargoReady && (
              <button type="button" onClick={onCargoReady} className={`${secondaryButton} ${wrap}`}>
                Mark Cargo Ready
              </button>
            )}
          </>
        )}
        {next && next !== "ready-to-ship" && next !== "delivered" && (
          <button type="button" onClick={() => onAdvance(next)} className={`${secondaryButton} ${wrap}`}>
            <FlaskConical aria-hidden className="size-4 text-orange" />
            {DEMO_ACTION_LABEL[next]}
            {demoTag}
          </button>
        )}
        {st.status === "customs" && !customsCleared && customsCaseId && (
          <Link href={importerHref(`customs/${customsCaseId}`)} className={`${secondaryButton} ${wrap}`}>
            Continue in Customs Case
          </Link>
        )}
        {st.status === "customs" && !customsCleared && !customsCaseId && (
          <button type="button" onClick={onClear} className={`${secondaryButton} ${wrap}`}>
            <FlaskConical aria-hidden className="size-4 text-orange" />
            Simulate Customs Clearance
            {demoTag}
          </button>
        )}
        {st.status === "customs" && (
          <button type="button" onClick={() => onAdvance("delivered")} disabled={!customsCleared} className={`${primaryButton} ${wrap}`}>
            Mark Delivered
          </button>
        )}
      </div>
      {st.status === "preparing" && blockingCount > 0 && (
        <p className="mt-2 text-sm text-orange">
          Complete {blockingCount} required {blockingCount === 1 ? "item" : "items"} before marking this shipment Ready to Ship.
        </p>
      )}
      {st.status === "customs" && !customsCleared && <p className="mt-2 text-sm text-ink-muted">Customs must be cleared before the shipment can be marked delivered.</p>}
      {st.status !== "preparing" && demoLine}
    </div>
  );
}

function RouteAndSchedule({ sh, st, onMessage }: { sh: Shipment; st: ShipmentState; onMessage: (m: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(st.schedule);
  const [error, setError] = useState("");
  const editable = ["preparing", "ready-to-ship", "at-origin", "in-transit"].includes(st.status);
  const points = [
    ["Origin", sh.route.origin],
    ["Port of loading", sh.route.portOfLoading],
    ["Port of discharge", sh.route.portOfDischarge],
    ["Final destination", sh.route.finalDelivery],
  ];
  return (
    <Panel id="route" title="Route & Schedule" description="Planned route and dates. No live tracking is connected.">
      <div className="px-5 pb-5 pt-3 sm:px-6">
        <ol className="flex flex-col gap-2 md:flex-row md:items-stretch md:gap-0">
          {points.map(([label, place], i) => (
            <li key={label} className="flex min-w-0 items-center gap-2 md:flex-1">
              <span className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2">
                <span className="block text-xs text-ink-faint">{label}</span>
                <span className="block break-words text-sm font-medium text-ink">{place}</span>
              </span>
              {i < points.length - 1 && <ArrowRight aria-hidden className="hidden size-4 shrink-0 text-ink-faint md:mx-1 md:block" />}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-ink-muted">
          {modeLabel(sh.route.mode)} · Transshipment {sh.route.transshipmentAllowed ? "allowed" : "not allowed"}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          {[
            ["Ready date", st.schedule.readyDate],
            ["ETD", st.schedule.etd],
            ["ETA", st.schedule.eta],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-ink-faint">{k}</dt>
              <dd className="text-ink">{formatDate(v)}</dd>
            </div>
          ))}
        </dl>
        {editable && !editing && (
          <button type="button" onClick={() => { setDraft(st.schedule); setEditing(true); }} className={`${smallButton} mt-4`}>
            Update planned dates
          </button>
        )}
        {editing && (
          <form
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditing(false);
                setError("");
              }
            }}
            className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-line p-4 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              const err = updateSchedule(sh.id, draft);
              if (err) return setError(err);
              setError("");
              setEditing(false);
              onMessage("Planned dates updated.");
            }}
          >
            {(["readyDate", "etd", "eta"] as const).map((k) => (
              <label key={k} className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-ink-muted">{k === "readyDate" ? "Ready date" : k.toUpperCase()}</span>
                <input
                  id={`sched-${k}`}
                  type="date"
                  required
                  value={draft[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                  className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
                />
              </label>
            ))}
            {error && <p role="alert" className="text-sm font-medium text-orange sm:col-span-3">{error}</p>}
            <div className="flex gap-2 sm:col-span-3">
              <button type="submit" className={`${primaryButton} h-10`}>Save dates</button>
              <button type="button" onClick={() => { setEditing(false); setError(""); }} className={`${ghostButton} h-10`}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}

function Documents({ sh, st, docs, onMessage }: { sh: Shipment; st: ShipmentState; docs: TradeDocument[]; onMessage: (m: string) => void }) {
  const departed = ["in-transit", "arrived", "customs", "delivered"].includes(st.status);
  const atOriginOrLater = departed || st.status === "at-origin";
  const act = (result: string | void, ok: string) => onMessage(result || ok);
  const actions = (d: TradeDocument) => {
    if (d.status === "not-required" || d.status === "approved") return null;
    const transportBlocked = d.type === "transport-document" && !atOriginOrLater;
    const provided = d.status === "available" || d.status === "needs-review";
    return (
      <div className="flex flex-wrap gap-1.5">
        {d.status === "not-started" && d.source !== "importer" && (
          <button type="button" className={smallButton} onClick={() => act(requestDocument(d, atOriginOrLater), `${d.label} marked requested.`)}>
            Mark Requested<span className="sr-only"> {d.label}</span>
          </button>
        )}
        {d.source === "importer" && !provided && (
          <button type="button" className={smallButton} onClick={() => act(issueDocument(d), `${d.label} marked issued.`)}>
            Mark Issued<span className="sr-only"> {d.label}</span>
          </button>
        )}
        {d.source !== "importer" && !provided && (
          <button
            type="button"
            className={smallButton}
            disabled={transportBlocked}
            title={transportBlocked ? "Available once cargo is with the carrier" : undefined}
            onClick={() => act(markDocumentAvailable(d, {}, atOriginOrLater), `${d.label} marked available (demo).`)}
          >
            Mark Available<span className="sr-only"> {d.label}</span> {demoTag}
          </button>
        )}
        {provided && (
          <button type="button" className={smallButton} onClick={() => act(approveForWorkflow(d), `${d.label} approved.`)}>
            Approve<span className="sr-only"> {d.label}</span>
          </button>
        )}
      </div>
    );
  };
  return (
    <Panel
      id="documents"
      title="Shipment Documents"
      description="Document states from the Document Center. Document metadata only — no files are uploaded or stored."
      action={
        <Link href={`${importerHref("documents")}?shipment=${sh.id}`} className={`${textLink} shrink-0`}>
          Manage Documents
        </Link>
      }
    >
      {docs.every((d) => d.events.length === 0) && (
        <p className="px-5 pt-2 text-sm text-ink-muted sm:px-6">Document preparation has not started yet.</p>
      )}
      <ul className="divide-y divide-line px-5 pb-3 pt-1 sm:px-6">
        {docs.map((d) => (
          <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                <Link href={importerHref(`documents/${d.id}`)} className={`rounded hover:text-teal hover:underline ${focusRing}`}>{d.label}</Link>
              </p>
              <p className="text-xs text-ink-faint">
                <span className={d.complete ? "font-medium text-teal" : "text-ink-muted"}>{DOCUMENT_STATUS_LABEL[d.status]}</span>
                {(d.validity === "expired" || d.validity === "expiring-soon") && <span className="font-medium text-orange"> · {VALIDITY_LABEL[d.validity]}</span>}
                {" · "}From {DOCUMENT_SOURCE_LABEL[d.source].toLowerCase()} · Updated {formatDate(d.updatedAt)}
              </p>
              {d.requirement.level === "not-required" && <p className="text-xs text-ink-muted">{d.requirement.reason}</p>}
            </div>
            {actions(d)}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Freight({ sh, st, onMessage }: { sh: Shipment; st: ShipmentState; onMessage: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState(`DEMO-BKG-${sh.id.slice(-4)}`);
  const [carrier, setCarrier] = useState(st.booking.carrier ?? "");
  const [error, setError] = useState("");
  const b = st.booking;
  return (
    <Panel id="freight" title="Freight Booking" description="Summary only.">
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
        {b.status === "not-started" && <p className="mb-3 text-ink-muted">Freight booking has not been arranged yet.</p>}
        <dl className="divide-y divide-line">
          {[
            ["Mode", modeLabel(sh.route.mode)],
            ["Arranged by", b.arrangedBy === "importer" ? `You (${sh.incoterm})` : `Supplier (${sh.incoterm})`],
            ["Freight forwarder", b.forwarder ?? "Not assigned"],
            ["Carrier", b.carrier ?? "Not assigned"],
            ["Booking reference", b.reference ?? "—"],
            ["Booking status", FREIGHT_STATUS_LABEL[b.status]],
            ["Port of loading", sh.route.portOfLoading],
            ["ETD", formatDate(st.schedule.etd)],
            ["ETA", formatDate(st.schedule.eta)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="min-w-0 break-words text-right text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {b.status !== "booked" && st.status === "preparing" && (
          <div className="mt-4 space-y-2">
            <button type="button" disabled className={`${secondaryButton} h-10 w-full`}>
              <Lock aria-hidden className="size-4" />
              Arrange Freight
            </button>
            <p className="text-xs text-ink-faint">Freight booking will be connected later.</p>
            {!open ? (
              <button type="button" onClick={() => setOpen(true)} className={`${smallButton} w-full justify-center`}>
                <FlaskConical aria-hidden className="size-3.5 text-orange" />
                Simulate Freight Booking {demoTag}
              </button>
            ) : (
              <form
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                }}
                className="space-y-2 rounded-xl border border-line p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reference.trim()) return setError("Enter a booking reference.");
                  simulateFreightBooking(sh.id, reference.trim(), carrier.trim());
                  setOpen(false);
                  onMessage("Demo freight booking recorded.");
                }}
              >
                <label className="block text-xs font-medium text-ink-muted" htmlFor="bk-ref">Booking reference</label>
                <input id="bk-ref" value={reference} onChange={(e) => { setReference(e.target.value); setError(""); }} className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20" />
                <label className="block text-xs font-medium text-ink-muted" htmlFor="bk-carrier">Carrier <span className="font-normal text-ink-faint">Optional</span></label>
                <input id="bk-carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20" />
                {error && <p role="alert" className="text-xs font-medium text-orange">{error}</p>}
                <p className="text-xs text-ink-faint">Demo only — no carrier or forwarder system is connected.</p>
                <div className="flex gap-2">
                  <button type="submit" className={`${primaryButton} h-9 px-3`}>Record demo booking</button>
                  <button type="button" onClick={() => setOpen(false)} className={`${ghostButton} h-9`}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

function Customs({
  sh,
  st,
  docs,
  customs,
  customsCase,
}: {
  sh: Shipment;
  st: ShipmentState;
  docs: TradeDocument[];
  customs: ReturnType<typeof customsStatus>;
  customsCase?: CustomsCaseView;
}) {
  const broker = customsCase ? customsCase.cha?.company : sh.parties.customsBroker;
  const doc = (type: TradeDocument["type"]) => docs.find((d) => d.type === type);
  const docStatus = (type: TradeDocument["type"]) => {
    const d = doc(type);
    if (!d) return "—";
    return d.validity === "expired" && !d.complete && d.status !== "not-required" ? `${DOCUMENT_STATUS_LABEL[d.status]} (expired)` : DOCUMENT_STATUS_LABEL[d.status];
  };
  const fromDemo = sh.events.some((e) => e.type === "customs-updated" && e.demo);
  const historical = !fromDemo && !!st.customsEvent;
  return (
    <Panel id="customs" title="Customs Readiness" description="Readiness summary. No customs filing is made from XimVerse.">
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
        <dl className="divide-y divide-line">
          {[
            ["CHA / customs broker", broker ?? "Not assigned"],
            ["HS code", customsCase?.override.hsCode ?? sh.hsCode ?? "—"],
            ["Importer details", `Available (${PLACEHOLDER_IMPORTER.company})`],
            ["Commercial Invoice", docStatus("commercial-invoice")],
            ["Packing List", docStatus("packing-list")],
            ["Certificate of Origin", docStatus("certificate-of-origin")],
            ["Import permit", docStatus("import-permit")],
            ["Arrival documents", docStatus("transport-document")],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="min-w-0 break-words text-right text-ink">{v}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-ink-muted">Customs status</dt>
            <dd className="flex items-center gap-2 font-medium text-ink">
              {customsCase ? CUSTOMS_CASE_STATUS_LABEL[customsCase.status] : CUSTOMS_STATUS_LABEL[customs]}
              {fromDemo && demoTag}
              {historical && <span className="text-xs font-normal text-ink-faint">Historical record</span>}
            </dd>
          </div>
        </dl>
        {!broker && (
          <p className="mt-3 flex gap-2 text-ink-muted">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-orange" />
            No customs broker has been assigned yet.
          </p>
        )}
        {customsCase ? (
          <div className="mt-3 border-t border-line pt-1">
            <dl className="divide-y divide-line">
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-ink-muted">Customs case</dt>
                <dd className="font-mono text-ink">{customsCase.id}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-ink-muted">Customs readiness</dt>
                <dd><CustomsReadinessBadge readiness={customsCase.readiness} /></dd>
              </div>
            </dl>
            <Link href={importerHref(`customs/${customsCase.id}`)} className={`${secondaryButton} mt-3 h-10 w-full`}>
              View Customs Case
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <Link href={`${importerHref("customs/new")}?shipment=${sh.id}`} className={`${secondaryButton} h-10 w-full`}>
              Prepare Customs
            </Link>
            <p className="text-xs text-ink-faint">Start customs preparation and assign a broker before arrival.</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

interface FeedItem {
  id: string;
  at: string;
  text: string;
  party: string;
  byYou: boolean;
  demo?: boolean;
  note?: string;
}

/** Shipment events plus this shipment's document events, newest first. */
function activityFeed(sh: Shipment, docs: readonly TradeDocument[]): FeedItem[] {
  const shipmentItems = sh.events.map<FeedItem>((e) => ({ id: e.id, at: e.at, text: describeEvent(e), party: eventParty(e), byYou: e.by === "importer", demo: e.demo, note: e.note }));
  const documentItems = docs.flatMap((d) =>
    d.events.map<FeedItem>((e) => ({
      id: e.id,
      at: e.at,
      text: describeDocumentEvent(e, d.label),
      party: e.by === "importer" ? "You" : e.by === "system" ? "XimVerse" : DOCUMENT_SOURCE_LABEL[e.by],
      byYou: e.by === "importer",
      demo: e.demo,
      note: e.note,
    })),
  );
  return [...shipmentItems, ...documentItems].sort((a, b) => b.at.localeCompare(a.at));
}
