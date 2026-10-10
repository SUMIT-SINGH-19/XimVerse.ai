"use client";

import { useState } from "react";
import Link from "next/link";
import { Circle, CircleCheck, Clock, Lock } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { input, textarea } from "@/components/exporter/quote/form-ui";
import { DocumentStatusPill } from "@/components/exporter/orders/order-ui";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDate } from "@/lib/exporter-dashboard";
import { formatDateTime, UNIT_SHORT } from "@/lib/exporter-opportunities";
import type { CounterpartyAccess } from "@/lib/exporter-deals";
import type { ExporterOrder, OrderState } from "@/lib/exporter-orders";
import {
  addBooking,
  advanceShippingBill,
  advanceTransportDocument,
  assignCarrier,
  assignCha,
  assignForwarder,
  markInstructionsReady,
  recordMilestone,
  shareDossier,
  updateCargo,
  updateContainer,
  updateCustoms,
  updateInstructions,
  updateSchedule,
  updateVessel,
  type ActionResult,
} from "@/lib/exporter-shipment-store";
import {
  containerComplete,
  CONTAINER_TYPES,
  counterpartyLine,
  CUSTOMS_QUERY_LABEL,
  formatShortDate,
  freightTerms,
  INSTRUCTIONS_STATUS_LABEL,
  isActiveShipment,
  mainCarriageBy,
  PHYSICAL_MILESTONES,
  SHIPMENT_STATUS_LABEL,
  shipmentMilestones,
  shipmentState,
  SHIPPER,
  SHIPPING_BILL_STEPS,
  shippingBillIndex,
  TRANSPORT_DOCUMENT_STEPS,
  TRANSPORT_MODE_LABEL,
  transportDocumentIndex,
  transportDocumentName,
  usesContainers,
  type ContainerType,
  type CustomsQueryStatus,
  type ExporterShipment,
  type PhysicalMilestone,
  type ShipmentEvent,
  type ShipmentState,
} from "@/lib/exporter-shipments";
import { DemoTag, ShipmentStatusPill, Stepper } from "./shipment-ui";

/** Everything a section needs about one shipment. */
export interface ShipmentCtx {
  sh: ExporterShipment;
  st: ShipmentState;
  order: ExporterOrder;
  os: OrderState;
  /** Every shipment, for the order's other allocations. */
  all: readonly ExporterShipment[];
  access: CounterpartyAccess | undefined;
}

const btn = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink transition-colors hover:border-teal hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:bg-transparent ${focusRing}`;
const btnPrimary = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-orange px-3 text-sm font-semibold text-on-brand shadow-sm shadow-orange/20 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
const field = `${input} h-9 min-w-0 flex-1`;

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

type Flash = { ok: boolean; text: string } | null;

/** Per-section result line for the last action. */
function useFlash() {
  const [flash, setFlash] = useState<Flash>(null);
  const act = (r: ActionResult, success: string) => {
    setFlash(r.ok ? { ok: true, text: success } : { ok: false, text: r.reason });
    return r.ok;
  };
  return { flash, act };
}

function FlashLine({ flash }: { flash: Flash }) {
  return (
    <p role="status" className={flash ? `mt-3 rounded-lg px-3 py-2 text-sm text-ink ${flash.ok ? "bg-teal-soft" : "bg-orange-soft"}` : ""}>
      {flash?.text}
    </p>
  );
}

export function Card({ id, title, aside, children }: { id?: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-24 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id ? `${id}-title` : undefined} className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Label + state on the left, controls on the right (stacked on phones). */
function ControlRow({ label, state, done, demo, children }: { label: string; state: string; done: boolean; demo?: boolean; children?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className={`text-xs [overflow-wrap:anywhere] ${done ? "text-teal" : "text-orange"}`}>
          {state} {demo && done && <DemoTag />}
        </p>
      </div>
      {children && <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

function Facts({ items }: { items: readonly [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="bg-surface px-4 py-2.5">
          <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-faint">{label}</dt>
          <dd className="mt-0.5 text-sm text-ink [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

/** Drops blank values so a save never clears what's already recorded. */
function compact<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;
}

const when = (at: string) => (at.length === 10 ? formatDate(at) : formatDateTime(at));
const kg = (n?: number) => (n ? `${n.toLocaleString("en-US")} kg` : "—");

// ---------------------------------------------------------------------------
// 1. Cargo & allocation
// ---------------------------------------------------------------------------

export function CargoSection({ c }: { c: ShipmentCtx }) {
  const { sh, st, order, os, all } = c;
  const t = order.terms;
  const unit = UNIT_SHORT[sh.allocation.unit];
  const q = os.quantities;
  const { flash, act } = useFlash();
  const locked = shippingBillIndex(st.shippingBill) >= shippingBillIndex("filed");
  const editable = isActiveShipment(st.status) && !locked;
  const [f, setF] = useState({
    packages: st.cargo.packages?.toString() ?? "",
    packageType: st.cargo.packageType ?? "",
    net: st.cargo.netWeightKg?.toString() ?? "",
    gross: st.cargo.grossWeightKg?.toString() ?? "",
    marks: st.cargo.marks ?? "",
    packaging: st.cargo.packagingDescription ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const others = all.filter((x) => x.orderId === sh.orderId && x.id !== sh.id);
  const partial = sh.allocation.quantity < q.ordered;
  const save = () =>
    act(
      updateCargo(
        sh.id,
        compact({
          packages: num(f.packages),
          packageType: f.packageType.trim(),
          netWeightKg: num(f.net),
          grossWeightKg: num(f.gross),
          marks: f.marks.trim(),
          packagingDescription: f.packaging.trim(),
        }),
      ),
      "Cargo details saved.",
    );

  return (
    <Card
      id="cargo"
      title="Cargo & Allocation"
      aside={
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${partial ? "bg-orange-soft text-orange" : "bg-teal-soft text-teal"}`}>
          {partial ? "Partial Shipment" : "Full Order"}
        </span>
      }
    >
      <Facts
        items={[
          ["Product", <>{t.productName}<span className="block text-xs text-ink-muted">{t.specification}{t.hsCode ? ` · HS ${t.hsCode}` : ""}</span></>],
          ["This shipment", <span key="q" className="font-semibold tabular-nums">{sh.allocation.quantity.toLocaleString("en-US")} {unit}</span>],
          ["From order", <Link key="o" href={exporterHref(`orders/${order.id}`)} className={`font-mono text-teal hover:text-ink ${focusRing}`}>{order.id}</Link>],
          ["Agreed packaging", t.packaging ?? "—"],
        ]}
      />

      <h3 className="mt-5 text-sm font-semibold text-ink">Order allocation</h3>
      <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        {([
          ["Ordered", q.ordered],
          ["Produced", q.produced],
          ["Allocated", q.allocated],
          ["Available", q.available],
          ["Shipped", q.shipped],
          ["Delivered", q.delivered],
        ] as [string, number][]).map(([label, value]) => (
          <div key={label} className="bg-surface px-3 py-2.5">
            <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-faint">{label}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-ink">{value.toLocaleString("en-US")} {unit}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-ink-muted">
        This shipment carries <span className="font-semibold text-ink">{sh.allocation.quantity.toLocaleString("en-US")} of {q.ordered.toLocaleString("en-US")} {unit}</span> ({Math.round((sh.allocation.quantity / q.ordered) * 100)}% of the order).
        The order&apos;s quantity and terms never change here.
      </p>
      {others.length > 0 && (
        <ul aria-label="Other shipments on this order" className="mt-3 divide-y divide-line rounded-xl border border-line">
          {others.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
              <Link href={exporterHref(`shipments/${x.id}`)} className={`font-mono text-sm text-teal hover:text-ink ${focusRing}`}>{x.id}</Link>
              <span className="text-sm tabular-nums text-ink">{x.allocation.quantity.toLocaleString("en-US")} {unit}</span>
              <ShipmentStatusPill status={shipmentState(x).status} />
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-5 text-sm font-semibold text-ink">Cargo details</h3>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {([
          ["packages", "Number of packages", "decimal"],
          ["packageType", "Package type", "text"],
          ["net", "Net weight (kg)", "decimal"],
          ["gross", "Gross weight (kg)", "decimal"],
          ["marks", "Marks & numbers", "text"],
          ["packaging", "Packaging description", "text"],
        ] as [keyof typeof f, string, "decimal" | "text"][]).map(([k, label, mode]) => (
          <label key={k} className="min-w-0 text-sm font-medium text-ink">
            {label}
            <input value={f[k]} onChange={set(k)} inputMode={mode} disabled={!editable} className={`${input} mt-1.5`} />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={!editable} className={btn}>Save Cargo Details</button>
        {locked && <span className="inline-flex items-center gap-1 text-xs text-ink-muted"><Lock className="size-3.5" aria-hidden />Locked — the Shipping Bill is filed (demo)</span>}
      </div>
      <FlashLine flash={flash} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 2. Containers (FCL only)
// ---------------------------------------------------------------------------

export function ContainerSection({ c }: { c: ShipmentCtx }) {
  const { sh, st } = c;
  const { flash, act } = useFlash();
  const locked = Boolean(st.milestones.loaded || st.milestones.departed);
  const editable = isActiveShipment(st.status) && !locked;
  const [f, setF] = useState({ type: st.container.type ?? "", count: st.container.count?.toString() ?? "", numbers: st.container.numbers ?? "", seals: st.container.seals ?? "" });
  const complete = containerComplete(st);
  const save = () =>
    act(
      updateContainer(sh.id, compact({ type: (f.type || undefined) as ContainerType | undefined, count: num(f.count), numbers: f.numbers.trim(), seals: f.seals.trim() })),
      "Container details saved.",
    );

  return (
    <Card id="containers" title="Containers" aside={<span className={`text-xs font-semibold ${complete ? "text-teal" : "text-orange"}`}>{complete ? "Complete" : "Incomplete"}</span>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-medium text-ink">
          Container type
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} disabled={!editable} className={`${input} mt-1.5`}>
            <option value="">Select…</option>
            {CONTAINER_TYPES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium text-ink">
          Container count
          <input value={f.count} onChange={(e) => setF({ ...f, count: e.target.value })} inputMode="numeric" disabled={!editable} className={`${input} mt-1.5`} />
        </label>
        <label className="min-w-0 text-sm font-medium text-ink">
          Container numbers
          <input value={f.numbers} onChange={(e) => setF({ ...f, numbers: e.target.value })} placeholder="Comma-separated" disabled={!editable} className={`${input} mt-1.5`} />
        </label>
        <label className="min-w-0 text-sm font-medium text-ink">
          Seal numbers
          <input value={f.seals} onChange={(e) => setF({ ...f, seals: e.target.value })} placeholder="Comma-separated" disabled={!editable} className={`${input} mt-1.5`} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={!editable} className={btn}>Save Containers</button>
        {locked && <span className="inline-flex items-center gap-1 text-xs text-ink-muted"><Lock className="size-3.5" aria-hidden />Locked — cargo is loaded</span>}
      </div>
      <p className="mt-2 text-xs text-ink-faint">{sh.route.shipmentType} {TRANSPORT_MODE_LABEL[sh.route.mode].toLowerCase()} shipment. Container and seal numbers usually arrive at stuffing.</p>
      <FlashLine flash={flash} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 3. Freight
// ---------------------------------------------------------------------------

export function FreightSection({ c }: { c: ShipmentCtx }) {
  const { sh, st, order } = c;
  const t = order.terms;
  const { flash, act } = useFlash();
  const departed = Boolean(st.milestones.departed);
  const editable = isActiveShipment(st.status) && !departed;
  const [forwarder, setForwarder] = useState(st.forwarder ?? "");
  const [carrier, setCarrier] = useState(st.carrier ?? "");
  const [booking, setBooking] = useState(st.bookingReference ?? "");
  const [etd, setEtd] = useState(st.schedule.etd ?? "");
  const [eta, setEta] = useState(st.schedule.eta ?? "");
  const [vessel, setVessel] = useState({ name: st.vessel.name ?? "", voyage: st.vessel.voyage ?? "", trackingReference: st.vessel.trackingReference ?? "" });
  const carrierWord = sh.route.mode === "air" ? "Airline" : sh.route.mode === "sea" ? "Shipping line" : "Carrier";
  const by = mainCarriageBy(t.incoterm);

  return (
    <Card id="freight" title="Freight">
      <Facts
        items={[
          ["Mode", `${TRANSPORT_MODE_LABEL[sh.route.mode]}${sh.route.shipmentType ? ` · ${sh.route.shipmentType}` : ""}`],
          ["Route", `${sh.route.portOfLoading} → ${sh.route.portOfDischarge}`],
          ["Origin", sh.route.origin],
          ["Final destination", sh.route.finalDelivery],
          ["Main carriage", by === "exporter" ? `Arranged by you (${t.incoterm})` : `Buyer's side arranges (${t.incoterm}) — record the nominated forwarder`],
          ["Freight terms", freightTerms(t.incoterm)],
          ...(usesContainers(sh.route) ? [] : ([["Containers", sh.route.mode === "air" ? "Not applicable — air cargo" : sh.route.shipmentType === "LCL" ? "Not applicable — LCL is consolidated by the forwarder" : "Not applicable"]] as [string, string][])),
        ]}
      />
      <div className="mt-2 divide-y divide-line">
        <ControlRow label="Forwarder" state={st.forwarder ? `Assigned — ${st.forwarder}` : "Not Assigned"} done={Boolean(st.forwarder)}>
          <input aria-label="Forwarder name" value={forwarder} onChange={(e) => setForwarder(e.target.value)} placeholder="Forwarder name" disabled={!editable} className={field} />
          <button type="button" disabled={!editable} onClick={() => act(assignForwarder(sh.id, forwarder), "Forwarder assigned.")} className={btn}>{st.forwarder ? "Change" : "Assign"}</button>
        </ControlRow>
        <ControlRow label={carrierWord} state={st.carrier ? `Assigned — ${st.carrier}` : "Not Assigned"} done={Boolean(st.carrier)}>
          <input aria-label={`${carrierWord} name`} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder={`${carrierWord} name`} disabled={!editable} className={field} />
          <button type="button" disabled={!editable} onClick={() => act(assignCarrier(sh.id, carrier), `${carrierWord} assigned.`)} className={btn}>{st.carrier ? "Change" : "Assign"}</button>
        </ControlRow>
        <ControlRow label="Booking reference" state={st.bookingReference ?? (st.forwarder ? "Missing" : "Needs a forwarder first")} done={Boolean(st.bookingReference)}>
          <input aria-label="Booking reference" value={booking} onChange={(e) => setBooking(e.target.value)} placeholder="As given by the forwarder" disabled={!editable || !st.forwarder} className={field} />
          <button type="button" disabled={!editable || !st.forwarder} onClick={() => act(addBooking(sh.id, booking), "Booking reference saved.")} className={btn}>Save</button>
        </ControlRow>
        <ControlRow
          label="ETD / ETA"
          state={st.schedule.etd || st.schedule.eta ? `ETD ${st.schedule.etd ? formatShortDate(st.schedule.etd) : "—"} · ETA ${st.schedule.eta ? formatShortDate(st.schedule.eta) : "—"}` : "Not set"}
          done={Boolean(st.schedule.etd && st.schedule.eta)}
        >
          <label className="flex min-w-0 flex-1 flex-col text-xs text-ink-muted">
            ETD
            <input type="date" value={etd} onChange={(e) => setEtd(e.target.value)} disabled={!editable} className={`${input} mt-1 h-9`} />
          </label>
          <label className="flex min-w-0 flex-1 flex-col text-xs text-ink-muted">
            ETA
            <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} disabled={!isActiveShipment(st.status)} className={`${input} mt-1 h-9`} />
          </label>
          <button
            type="button"
            disabled={!isActiveShipment(st.status)}
            onClick={() => act(updateSchedule(sh.id, etd !== (st.schedule.etd ?? "") ? etd : undefined, eta !== (st.schedule.eta ?? "") ? eta : undefined), "Schedule saved.")}
            className={`${btn} self-end`}
          >
            Save Schedule
          </button>
        </ControlRow>
        <ControlRow
          label="Vessel / tracking"
          state={st.vessel.name || st.vessel.trackingReference ? [st.vessel.name, st.vessel.voyage, st.vessel.trackingReference].filter(Boolean).join(" · ") : "Not recorded"}
          done={Boolean(st.vessel.name)}
        >
          <input aria-label={sh.route.mode === "air" ? "Flight" : "Vessel"} value={vessel.name} onChange={(e) => setVessel({ ...vessel, name: e.target.value })} placeholder={sh.route.mode === "air" ? "Flight" : "Vessel"} disabled={!isActiveShipment(st.status)} className={field} />
          <input aria-label="Voyage" value={vessel.voyage} onChange={(e) => setVessel({ ...vessel, voyage: e.target.value })} placeholder="Voyage" disabled={!isActiveShipment(st.status)} className={`${field} max-w-28`} />
          <input aria-label="Tracking reference" value={vessel.trackingReference} onChange={(e) => setVessel({ ...vessel, trackingReference: e.target.value })} placeholder="Tracking ref" disabled={!isActiveShipment(st.status)} className={field} />
          <button type="button" disabled={!isActiveShipment(st.status)} onClick={() => act(updateVessel(sh.id, vessel), "Vessel and tracking saved.")} className={btn}>Save</button>
        </ControlRow>
      </div>
      <p className="mt-2 text-xs text-ink-faint">No booking is placed with any forwarder or carrier — these are references you record (demo).{departed && " Freight details are locked after departure."}</p>
      <FlashLine flash={flash} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 4. Shipping instructions
// ---------------------------------------------------------------------------

export function InstructionsSection({ c }: { c: ShipmentCtx }) {
  const { sh, st, order, access } = c;
  const t = order.terms;
  const { flash, act } = useFlash();
  const editable = isActiveShipment(st.status) && !st.milestones.departed;
  const suggested = [t.productName, t.hsCode ? `HS ${t.hsCode}` : "", t.packaging ? `in ${t.packaging.replace(/\.$/, "")}` : ""].filter(Boolean).join(", ");
  const [description, setDescription] = useState(st.instructions.productDescription ?? suggested);
  const [bl, setBl] = useState(st.instructions.blInstructions ?? "");
  const [special, setSpecial] = useState(st.instructions.specialInstructions ?? "");
  const dirty = description !== (st.instructions.productDescription ?? "") || bl !== (st.instructions.blInstructions ?? "") || special !== (st.instructions.specialInstructions ?? "");
  const draft = () => updateInstructions(sh.id, { productDescription: description.trim(), blInstructions: bl.trim(), specialInstructions: special.trim() });
  const markReady = () => {
    if (dirty && !act(draft(), "Saved.")) return;
    act(markInstructionsReady(sh.id), "Shipping Instructions marked ready.");
  };
  const protectedParty = (
    <span className="inline-flex items-start gap-1.5 text-ink-muted">
      <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden />
      {counterpartyLine(access)}
    </span>
  );
  const status = st.instructionsStatus;

  return (
    <Card
      id="instructions"
      title="Shipping Instructions"
      aside={<span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status === "ready" ? "bg-teal-soft text-teal" : "bg-orange-soft text-orange"}`}>{INSTRUCTIONS_STATUS_LABEL[status]}</span>}
    >
      <Facts
        items={[
          ["Shipper", SHIPPER],
          ["Consignee", protectedParty],
          ["Notify party", protectedParty],
          ["Packages", st.cargo.packages ? `${st.cargo.packages.toLocaleString("en-US")} ${st.cargo.packageType ?? ""}`.trim() : "—"],
          ["Net / gross weight", `${kg(st.cargo.netWeightKg)} / ${kg(st.cargo.grossWeightKg)}`],
          ["Marks & numbers", st.cargo.marks ?? "—"],
          ["Port of loading", sh.route.portOfLoading],
          ["Port of discharge", sh.route.portOfDischarge],
          ["Freight terms", freightTerms(t.incoterm)],
          ["Containers", usesContainers(sh.route) ? (st.container.numbers ?? "Not yet assigned") : "Not applicable"],
        ]}
      />
      <div className="mt-4 grid grid-cols-1 gap-3">
        <label className="text-sm font-medium text-ink">
          Product description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!editable} rows={2} className={`${textarea} mt-1.5`} />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-medium text-ink">
            BL instructions
            <textarea value={bl} onChange={(e) => setBl(e.target.value)} disabled={!editable} rows={2} placeholder="e.g. To order of the LC issuing bank" className={`${textarea} mt-1.5`} />
          </label>
          <label className="min-w-0 text-sm font-medium text-ink">
            Special instructions
            <textarea value={special} onChange={(e) => setSpecial(e.target.value)} disabled={!editable} rows={2} className={`${textarea} mt-1.5`} />
          </label>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={!editable || !dirty} onClick={() => act(draft(), "Shipping Instructions saved as draft.")} className={btn}>Save Draft</button>
        <button type="button" disabled={!editable || (status === "ready" && !dirty)} onClick={markReady} className={btnPrimary}>Mark Ready</button>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Buyer identity is {access === "approved" || access === "shared" ? "shared through Ximverse" : "protected"}: consignee and notify details are never stored here. Packages, weights and ports come from this shipment&apos;s records.
      </p>
      <FlashLine flash={flash} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 5. Export clearance (CHA / customs handoff — demo)
// ---------------------------------------------------------------------------

export function ClearanceSection({ c }: { c: ShipmentCtx }) {
  const { sh, st } = c;
  const { flash, act } = useFlash();
  const live = isActiveShipment(st.status);
  const [cha, setCha] = useState(st.cha ?? "");
  const sb = shippingBillIndex(st.shippingBill);
  const next = SHIPPING_BILL_STEPS[sb + 1];
  const leo = st.shippingBill === "leo-received";
  const queryWindow = sb >= shippingBillIndex("filed") && !leo;
  const filed = sb >= shippingBillIndex("filed");

  return (
    <Card id="customs" title="Export Clearance" aside={<DemoTag />}>
      <p className="-mt-1 mb-2 text-sm text-ink-muted">Hand-off to your CHA. Every state here is recorded by hand — Ximverse is not connected to ICEGATE.</p>
      <div className="divide-y divide-line">
        <ControlRow label="CHA" state={st.cha ? `Assigned — ${st.cha}` : "Not Assigned"} done={Boolean(st.cha)}>
          <input aria-label="CHA name" value={cha} onChange={(e) => setCha(e.target.value)} placeholder="Customs broker (CHA)" disabled={!live || filed} className={field} />
          <button type="button" disabled={!live || filed} onClick={() => act(assignCha(sh.id, cha), "CHA assigned.")} className={btn}>{st.cha ? "Change" : "Assign"}</button>
        </ControlRow>
        <ControlRow label="Dossier" state={st.dossierShared ? "Shared with the CHA" : "Not Shared"} done={st.dossierShared}>
          <button type="button" disabled={!live || !st.cha || st.dossierShared} onClick={() => act(shareDossier(sh.id), "Dossier shared with the CHA (demo).")} className={btn}>Share Dossier</button>
          <span className="text-xs text-ink-faint">References the order&apos;s invoice, packing list and certificates plus this shipment&apos;s instructions, cargo and containers — nothing is copied.</span>
        </ControlRow>
        <div className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">Shipping Bill <DemoTag /></p>
            {next && live && (
              <button type="button" onClick={() => act(advanceShippingBill(sh.id), `Shipping Bill: ${next.label} (demo).`)} className={btn}>
                Mark “{next.label}”
              </button>
            )}
          </div>
          <div className="mt-2"><Stepper steps={SHIPPING_BILL_STEPS} current={st.shippingBill} /></div>
          {Object.keys(st.shippingBillAt).length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
              {SHIPPING_BILL_STEPS.filter((s) => st.shippingBillAt[s.id]).map((s) => (
                <li key={s.id}>{s.label}: {formatDateTime(st.shippingBillAt[s.id]!)}</li>
              ))}
            </ul>
          )}
        </div>
        <ControlRow label="Customs" state={CUSTOMS_QUERY_LABEL[st.customs]} done={st.customs === "no-query" || st.customs === "cleared"} demo>
          <select
            aria-label="Customs status"
            value={st.customs}
            disabled={!live || !queryWindow}
            onChange={(e) => act(updateCustoms(sh.id, e.target.value as CustomsQueryStatus), `Customs: ${CUSTOMS_QUERY_LABEL[e.target.value as CustomsQueryStatus]} (demo).`)}
            className={`${input} h-9 w-auto`}
          >
            {(Object.keys(CUSTOMS_QUERY_LABEL) as CustomsQueryStatus[]).map((k) => <option key={k} value={k}>{CUSTOMS_QUERY_LABEL[k]}</option>)}
          </select>
          {!queryWindow && <span className="text-xs text-ink-faint">{leo ? "Cleared with LEO" : "Applies after filing"}</span>}
        </ControlRow>
        <ControlRow label="LEO" state={leo ? `Received — ${formatDateTime(st.shippingBillAt["leo-received"]!)}` : "Pending"} done={leo} demo />
      </div>
      <p className="mt-2 text-xs text-ink-faint">Demo states only: nothing is filed on ICEGATE, and no customs acknowledgement or Let Export Order is issued by Ximverse.</p>
      <FlashLine flash={flash} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 6. BL / AWB
// ---------------------------------------------------------------------------

export function TransportDocumentSection({ c }: { c: ShipmentCtx }) {
  const { sh, st } = c;
  const { flash, act } = useFlash();
  const name = transportDocumentName(sh.route.mode);
  const next = TRANSPORT_DOCUMENT_STEPS[transportDocumentIndex(st.transportDocument) + 1];
  return (
    <Card id="transport-document" title={name} aside={<DemoTag />}>
      <Stepper steps={TRANSPORT_DOCUMENT_STEPS} current={st.transportDocument} />
      {next && isActiveShipment(st.status) && (
        <button type="button" onClick={() => act(advanceTransportDocument(sh.id), `${name}: ${next.label} (demo).`)} className={`${btn} mt-3`}>
          Mark “{next.label}”
        </button>
      )}
      <p className="mt-2 text-xs text-ink-faint">No {name} is generated here. Statuses record what the carrier or forwarder reports — demo only. Separate from the Shipping Bill.</p>
      <FlashLine flash={flash} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 7. Documents — order references plus shipment records
// ---------------------------------------------------------------------------

export function DocumentsSection({ c }: { c: ShipmentCtx }) {
  const { sh, st, order, os } = c;
  const sb = shippingBillIndex(st.shippingBill);
  const orderDocs = os.documents.filter((d) => d.status !== "not-required");
  const prepared = (s: string) => s === "ready" || s === "verified";
  const records = [
    { key: "si", label: "Shipping Instructions", value: INSTRUCTIONS_STATUS_LABEL[st.instructionsStatus], done: st.instructionsStatus === "ready", demo: false },
    { key: "sb", label: "Shipping Bill", value: SHIPPING_BILL_STEPS[sb].label, done: sb >= shippingBillIndex("filed"), demo: true },
    { key: "ack", label: "Customs acknowledgement", value: sb >= shippingBillIndex("acknowledged") ? "Received" : "Pending", done: sb >= shippingBillIndex("acknowledged"), demo: true },
    { key: "leo", label: "LEO", value: st.shippingBill === "leo-received" ? "Received" : "Pending", done: st.shippingBill === "leo-received", demo: true },
    { key: "td", label: transportDocumentName(sh.route.mode), value: TRANSPORT_DOCUMENT_STEPS[transportDocumentIndex(st.transportDocument)].label, done: st.transportDocument === "final-issued", demo: true },
    ...(usesContainers(sh.route) ? [{ key: "containers", label: "Container details", value: containerComplete(st) ? "Complete" : "Incomplete", done: containerComplete(st), demo: false }] : []),
  ];
  const remaining = orderDocs.filter((d) => !prepared(d.status)).length + records.filter((r) => !r.done).length;

  return (
    <Card id="documents" title="Documents" aside={<span className={`text-xs font-semibold ${remaining ? "text-orange" : "text-teal"}`}>{remaining ? `${remaining} remaining` : "All complete"}</span>}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">Order documents</h3>
            <Link href={exporterHref(`orders/${order.id}`)} className={`text-xs font-semibold text-teal hover:text-ink ${focusRing}`}>Manage on {order.id}</Link>
          </div>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {orderDocs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 text-ink">{d.label}</span>
                <DocumentStatusPill status={d.status} />
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-ink-faint">Referenced live from the order — one record, shared by all its shipments.</p>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Shipment records</h3>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {records.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 text-ink">{r.label}</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${r.done ? "text-teal" : "text-orange"}`}>
                  {r.value}
                  {r.demo && <DemoTag />}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-ink-faint">
            Company credentials (IEC, GSTIN, APEDA, FSSAI) stay in{" "}
            <Link href={exporterHref("company")} className="font-semibold text-teal hover:text-ink">Company Profile</Link>.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 8. Milestones & tracking
// ---------------------------------------------------------------------------

const MILESTONE_LABEL = Object.fromEntries(PHYSICAL_MILESTONES.map((m) => [m.id, m.label])) as Record<PhysicalMilestone, string>;

/** Milestones that can plausibly be recorded next, in order. */
function nextMilestones(sh: ExporterShipment, st: ShipmentState): PhysicalMilestone[] {
  const m = st.milestones;
  const sea = sh.route.mode === "sea";
  const out: PhysicalMilestone[] = [];
  if (!m.departed) {
    if (usesContainers(sh.route) && !m.stuffed && !m.loaded) out.push("stuffed");
    if (!m["gate-in"] && !m.loaded) out.push("gate-in");
    if (!m.loaded && (!sea || m["gate-in"])) out.push("loaded");
    if (!sea || m.loaded) out.push("departed");
  } else if (!m.arrived) {
    out.push("arrived");
  } else {
    if (!m.clearance) out.push("clearance");
    out.push("delivered");
  }
  return out;
}

function whereNow(sh: ExporterShipment, st: ShipmentState): string {
  const m = st.milestones;
  const facility = sh.events.find((e) => e.type === "milestone" && e.milestone === "gate-in")?.note;
  if (st.status === "cancelled") return "Cancelled — no cargo movement";
  if (m.delivered) return `Delivered to ${sh.route.finalDelivery}`;
  if (m.clearance) return `In destination clearance at ${sh.route.portOfDischarge}`;
  if (m.arrived) return `Arrived at ${sh.route.portOfDischarge}`;
  if (m.departed) return `In transit ${sh.route.portOfLoading} → ${sh.route.portOfDischarge}${st.schedule.eta ? ` · ETA ${formatShortDate(st.schedule.eta)}` : ""}`;
  if (m.loaded) return `Loaded at ${sh.route.portOfLoading} · awaiting departure`;
  if (m["gate-in"]) return `Gated in at ${facility ?? sh.route.portOfLoading}`;
  if (m.stuffed) return `Stuffed · moving to ${sh.route.portOfLoading}`;
  return `At origin — ${sh.route.origin}`;
}

export function TrackingSection({ c }: { c: ShipmentCtx }) {
  const { sh, st, os } = c;
  const { flash, act } = useFlash();
  const [facility, setFacility] = useState("");
  const rows = shipmentMilestones(sh, st, os);
  const options = isActiveShipment(st.status) ? nextMilestones(sh, st) : [];
  const leo = st.shippingBill === "leo-received";
  const needsLeo = (m: PhysicalMilestone) => (m === "loaded" || m === "departed") && !leo;
  const record = (m: PhysicalMilestone) => {
    if (act(recordMilestone(sh.id, m, m === "gate-in" || m === "stuffed" ? facility : undefined), `${MILESTONE_LABEL[m]} recorded (demo).`)) setFacility("");
  };
  const tracking: [string, string][] = [
    [sh.route.mode === "air" ? "Airline" : "Carrier", st.carrier ?? "—"],
    [sh.route.mode === "air" ? "Flight" : "Vessel", st.vessel.name ?? "—"],
    ["Voyage", st.vessel.voyage ?? "—"],
    ["Container", usesContainers(sh.route) ? (st.container.numbers ?? "—") : "Not applicable"],
    ["Tracking reference", st.vessel.trackingReference ?? st.bookingReference ?? "—"],
    ["ETD", st.schedule.etd ? formatDate(st.schedule.etd) : "—"],
    ["ATD", st.schedule.atd ? formatDate(st.schedule.atd) : "—"],
    ["ETA", st.schedule.eta ? formatDate(st.schedule.eta) : "—"],
    ["ATA", st.schedule.ata ? formatDate(st.schedule.ata) : "—"],
  ];

  return (
    <Card id="tracking" title="Milestones & Tracking" aside={<DemoTag />}>
      <p className="rounded-xl bg-canvas px-4 py-3 text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-faint">Where the cargo is now</span>
        <span className="mt-0.5 block font-medium text-ink">{whereNow(sh, st)}</span>
        <span className="block text-xs text-ink-muted">{SHIPMENT_STATUS_LABEL[st.status]}</span>
      </p>
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ol aria-label="Shipment milestones" className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="flex items-start gap-2.5 text-sm">
              {r.at ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-label="Completed" /> : r.expected ? <Clock className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-label="Planned" /> : <Circle className="mt-0.5 size-4 shrink-0 text-line" aria-label="Pending" />}
              <span className="min-w-0 flex-1">
                <span className={r.at ? "font-medium text-ink" : "text-ink-muted"}>{r.label}</span> {r.demo && r.at && <DemoTag />}
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums text-ink-faint">{r.at ? when(r.at) : r.expected ? `Expected ${formatShortDate(r.expected)}` : "—"}</span>
            </li>
          ))}
        </ol>
        <div className="min-w-0">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {tracking.map(([l, v]) => (
              <div key={l} className="min-w-0">
                <dt className="text-xs text-ink-faint">{l}</dt>
                <dd className="text-ink [overflow-wrap:anywhere]">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-ink-faint">Demo tracking — no carrier, airline or AIS feed is connected.</p>
          {options.length > 0 && (
            <div className="mt-4 rounded-xl border border-line p-3">
              <p className="text-sm font-medium text-ink">Record a milestone</p>
              {(options.includes("gate-in") || options.includes("stuffed")) && (
                <input aria-label="Facility (ICD / CFS / terminal)" value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="Facility — ICD / CFS / terminal (optional)" className={`${input} mt-2 h-9`} />
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {options.map((m) => (
                  <button key={m} type="button" onClick={() => record(m)} disabled={needsLeo(m)} title={needsLeo(m) ? "LEO is required first" : undefined} className={btn}>
                    {MILESTONE_LABEL[m]}
                  </button>
                ))}
              </div>
              {options.some(needsLeo) && <p className="mt-1.5 text-xs text-ink-faint">Loading and departure need LEO (demo) first.</p>}
            </div>
          )}
        </div>
      </div>
      <FlashLine flash={flash} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

const BY_LABEL: Record<ShipmentEvent["by"], string> = {
  supplier: "You",
  "freight-forwarder": "Forwarder",
  carrier: "Carrier",
  "customs-broker": "CHA",
  system: "System",
};

function eventText(e: ShipmentEvent, sh: ExporterShipment): string {
  const unit = UNIT_SHORT[sh.allocation.unit];
  switch (e.type) {
    case "created":
      return `Shipment created — ${sh.allocation.quantity.toLocaleString("en-US")} ${unit} allocated from ${sh.orderId}`;
    case "forwarder-assigned":
      return `Forwarder assigned: ${e.party}`;
    case "carrier-assigned":
      return `${sh.route.mode === "air" ? "Airline" : "Carrier"} assigned: ${e.party}`;
    case "booking-added":
      return `Booking reference added: ${e.bookingReference}`;
    case "schedule-updated":
      return `Schedule updated${e.schedule?.etd ? ` — ETD ${formatShortDate(e.schedule.etd)}` : ""}${e.schedule?.eta ? ` — ETA ${formatShortDate(e.schedule.eta)}` : ""}`;
    case "cargo-updated":
      return "Cargo details updated";
    case "container-updated":
      return `Container details updated${e.container?.numbers ? ` — ${e.container.numbers}` : ""}`;
    case "vessel-updated":
      return `Vessel / tracking updated${e.vessel?.name ? ` — ${e.vessel.name}${e.vessel.voyage ? ` ${e.vessel.voyage}` : ""}` : ""}`;
    case "instructions-updated":
      return "Shipping Instructions updated (draft)";
    case "instructions-ready":
      return "Shipping Instructions marked ready";
    case "cha-assigned":
      return `CHA assigned: ${e.party}`;
    case "dossier-shared":
      return "Dossier shared with the CHA";
    case "shipping-bill-updated":
      return e.shippingBill === "leo-received" ? "LEO recorded" : `Shipping Bill: ${SHIPPING_BILL_STEPS[shippingBillIndex(e.shippingBill ?? "not-started")].label}`;
    case "customs-updated":
      return `Customs: ${e.customs ? CUSTOMS_QUERY_LABEL[e.customs] : ""}`;
    case "transport-document-updated":
      return `${transportDocumentName(sh.route.mode)}: ${TRANSPORT_DOCUMENT_STEPS[transportDocumentIndex(e.transportDocument ?? "not-available")].label}`;
    case "milestone":
      return e.milestone ? MILESTONE_LABEL[e.milestone] : "Milestone";
    case "cancelled":
      return "Shipment cancelled — allocation released to the order";
  }
}

const OFFICIAL: ReadonlySet<ShipmentEvent["type"]> = new Set(["shipping-bill-updated", "customs-updated", "transport-document-updated"]);

export function HistorySection({ c }: { c: ShipmentCtx }) {
  const { sh } = c;
  return (
    <Card title="Activity History" aside={<span className="text-xs text-ink-faint">Append-only · demo records</span>}>
      <ol className="relative space-y-3 pl-5 before:absolute before:inset-y-1 before:left-[0.3125rem] before:w-px before:bg-line">
        {sh.events.map((e) => (
          <li key={e.id} className="relative text-sm">
            <span aria-hidden className={`absolute -left-5 top-1.5 size-2.5 rounded-full ${e.type === "cancelled" ? "bg-orange" : "bg-teal"}`} />
            <span className="text-ink">{eventText(e, sh)}</span> {OFFICIAL.has(e.type) && <DemoTag />}
            {e.note && <span className="ml-1 text-ink-muted">— {e.note}</span>}
            <span className="block text-xs text-ink-faint">{formatDateTime(e.at)} · {BY_LABEL[e.by]}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
