"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleAlert, Lock, Ship } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import { findQuotation } from "@/lib/importer-quotations";
import { formatOrderQuantity } from "@/lib/importer-orders";
import { findSupplier } from "@/lib/importer-suppliers";
import { modeLabel, PACKAGE_TYPES, shipmentEligibility, TRANSPORT_MODES, type PackageType, type TransportMode } from "@/lib/importer-shipments";
import { ImportId } from "../dashboard/dashboard-ui";
import { useOrders, useOrdersLoaded } from "../orders/order-store";
import { Checkbox, FormSection, SelectField, TextArea, TextField } from "../rfq/form-fields";
import { todayISO } from "../rfq/requirement-form-model";
import { useImportRequirements } from "../rfq/requirements-store";
import { focusRing, ghostButton, primaryButton, secondaryButton } from "../styles";
import { createShipment, useShipments } from "./shipment-store";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;

interface Values {
  mode: TransportMode;
  origin: string;
  portOfLoading: string;
  portOfDischarge: string;
  finalDelivery: string;
  transshipmentAllowed: boolean;
  packages: string;
  packageType: PackageType;
  grossWeight: string;
  netWeight: string;
  weightUnit: "kg" | "MT";
  volumeCbm: string;
  packagingDescription: string;
  readyDate: string;
  etd: string;
  eta: string;
  freightForwarder: string;
  customsBroker: string;
  carrier: string;
}
type Errors = Partial<Record<keyof Values, string>>;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function guessPackageType(packaging = ""): PackageType {
  const p = packaging.toLowerCase();
  if (p.includes("flexitank") || p.includes("container")) return "Containers";
  if (p.includes("bag")) return "Bags";
  if (p.includes("pallet")) return "Pallets";
  if (p.includes("carton")) return "Cartons";
  if (p.includes("drum")) return "Drums";
  return "Other";
}

const positive = (v: string) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) > 0;

function validate(v: Values): Errors {
  const e: Errors = {};
  for (const k of ["origin", "portOfLoading", "portOfDischarge", "finalDelivery"] as const) {
    if (!v[k].trim()) e[k] = "Required.";
    else if (v[k].length > 120) e[k] = "Keep this under 120 characters.";
  }
  if (!/^\d+$/.test(v.packages.trim()) || Number(v.packages) < 1) e.packages = "Enter a whole number of packages (1 or more).";
  if (!positive(v.grossWeight)) e.grossWeight = "Gross weight must be greater than 0.";
  if (!positive(v.netWeight)) e.netWeight = "Net weight must be greater than 0.";
  else if (positive(v.grossWeight) && Number(v.netWeight) > Number(v.grossWeight)) e.netWeight = "Net weight can't exceed gross weight.";
  if (v.volumeCbm.trim() && !positive(v.volumeCbm)) e.volumeCbm = "Volume must be greater than 0, or leave it blank.";
  if (v.packagingDescription.length > 200) e.packagingDescription = "Keep this under 200 characters.";
  if (!v.readyDate) e.readyDate = "Choose the planned ready date.";
  if (!v.etd) e.etd = "Choose the planned ETD.";
  else if (v.readyDate && v.etd < v.readyDate) e.etd = "ETD can't be before the ready date.";
  if (!v.eta) e.eta = "Choose the planned ETA.";
  else if (v.etd && v.eta < v.etd) e.eta = "ETA can't be before the ETD.";
  for (const k of ["freightForwarder", "customsBroker", "carrier"] as const) {
    if (v[k].length > 80) e[k] = "Keep this under 80 characters.";
  }
  return e;
}

export function CreateShipment({ orderId }: { orderId: string }) {
  const orders = useOrders();
  const ordersLoaded = useOrdersLoaded();
  const shipments = useShipments();
  const order = orders.find((o) => o.id === orderId);
  const [createdId, setCreatedId] = useState<string | null>(null);

  if (createdId) return <p className="py-16 text-center text-sm text-ink-muted">Shipment {createdId} created. Opening…</p>;
  if (!order && !ordersLoaded) return <p className="py-16 text-center text-sm text-ink-muted">Loading order…</p>;

  const eligibility = shipmentEligibility(order, shipments);
  if (!eligibility.ok) {
    const copy = {
      "not-found": { title: "Order not found", body: "There's no order with this ID in this browser tab." },
      "shipment-exists": { title: "A shipment already exists for this order", body: "Each order has one shipment for now. Partial shipments are not supported yet." },
      cancelled: { title: "This order was cancelled", body: "Cancelled orders can't be shipped." },
      "not-confirmed": { title: "Supplier confirmation is still pending", body: "A shipment can be created once the supplier has confirmed the order." },
      "not-eligible-status": { title: "This order can't be shipped", body: "Shipments can be created for Confirmed or Pre-Shipment orders." },
    }[eligibility.reason];
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-orange-soft text-orange">
          <CircleAlert className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">{copy.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{copy.body}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          {eligibility.shipment && (
            <Link href={importerHref(`shipments/${eligibility.shipment.id}`)} className={primaryButton}>
              View Shipment <ImportId id={eligibility.shipment.id} className="text-xs" />
            </Link>
          )}
          {order && <Link href={importerHref(`orders/${order.id}`)} className={secondaryButton}>View Order</Link>}
          <Link href={importerHref("shipments")} className={secondaryButton}>Shipments</Link>
        </div>
      </div>
    );
  }
  return <ShipmentForm orderId={order!.id} onCreated={setCreatedId} />;
}

function ShipmentForm({ orderId, onCreated }: { orderId: string; onCreated: (id: string) => void }) {
  const router = useRouter();
  const order = useOrders().find((o) => o.id === orderId)!;
  const requirement = useImportRequirements().find(order.requirementId)!;
  const supplier = findSupplier(order.supplierId)!;
  const quote = findQuotation(order.quotationId);
  const t = order.terms;

  const [values, setValues] = useState<Values>(() => {
    const today = todayISO();
    const leadReady = addDays(order.purchaseOrder.issueDate, t.leadTimeDays);
    const readyDate = leadReady > today ? leadReady : today;
    const etd = addDays(readyDate, 3);
    const arrivalTerm = !["EXW", "FCA", "FOB"].includes(t.incoterm);
    return {
      mode: (quote?.delivery.mode.toLowerCase() as TransportMode) ?? "sea",
      origin: `${supplier.city}, ${supplier.country}`,
      portOfLoading: quote?.delivery.portOfLoading ?? "",
      portOfDischarge: arrivalTerm ? t.namedPlace : requirement.delivery.destinationLocation.split(",")[0],
      finalDelivery: order.purchaseOrder.deliveryAddress.split("\n").slice(-2).join(", "),
      transshipmentAllowed: true,
      packages: "",
      packageType: guessPackageType(t.packaging),
      grossWeight: "",
      netWeight: "",
      weightUnit: "kg",
      volumeCbm: "",
      packagingDescription: t.packaging ?? "",
      readyDate,
      etd,
      eta: addDays(etd, quote?.delivery.transitDays ?? 14),
      freightForwarder: "",
      customsBroker: "",
      carrier: "",
    };
  });
  const [step, setStep] = useState<"details" | "review">("details");
  const [showErrors, setShowErrors] = useState(false);
  const [failed, setFailed] = useState(false);
  const errors = validate(values);
  const visible = showErrors ? errors : {};
  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((x) => ({ ...x, [k]: v }));

  const create = () => {
    const id = createShipment(order, requirement, {
      route: {
        mode: values.mode,
        origin: values.origin.trim(),
        portOfLoading: values.portOfLoading.trim(),
        portOfDischarge: values.portOfDischarge.trim(),
        finalDelivery: values.finalDelivery.trim(),
        transshipmentAllowed: values.transshipmentAllowed,
      },
      cargo: {
        product: t.productName,
        quantity: t.quantity,
        packages: Number(values.packages),
        packageType: values.packageType,
        grossWeight: Number(values.grossWeight),
        netWeight: Number(values.netWeight),
        weightUnit: values.weightUnit,
        volumeCbm: values.volumeCbm.trim() ? Number(values.volumeCbm) : undefined,
        packagingDescription: values.packagingDescription.trim(),
      },
      schedule: { readyDate: values.readyDate, etd: values.etd, eta: values.eta },
      parties: {
        freightForwarder: values.freightForwarder.trim() || undefined,
        customsBroker: values.customsBroker.trim() || undefined,
        carrier: values.carrier.trim() || undefined,
      },
    });
    if (!id) return setFailed(true);
    onCreated(id);
    router.push(importerHref(`shipments/${id}`));
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href={importerHref(`orders/${order.id}`)} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to order
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">{step === "details" ? "Create Shipment" : "Review Shipment"}</h1>
        <p className="mt-2 max-w-2xl text-base text-ink-muted">
          {step === "details"
            ? "Order details are filled in for you. Add the route, cargo, planned dates and logistics parties."
            : "Check the shipment plan before creating it. Dates are planned dates — no carrier or tracking system is connected."}
        </p>
      </div>

      <section aria-labelledby="order-source" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="order-source" className="flex items-center gap-2 text-base font-semibold text-ink">
            <Lock aria-hidden className="size-4 text-ink-faint" />
            Order source
          </h2>
          <Link href={importerHref(`orders/${order.id}`)} className={`rounded text-sm font-semibold text-teal hover:underline ${focusRing}`}>View Order</Link>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Order", order.id],
            ["PO number", order.purchaseOrder.number],
            ["Supplier", supplier.name],
            ["Product", t.productName],
            ["Ordered quantity", formatOrderQuantity(t)],
            ["Incoterm", t.incoterm],
            ["Named place", t.namedPlace],
            ["Required by", formatDate(order.purchaseOrder.requiredBy)],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-ink-faint">{k}</dt>
              <dd className="break-words text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {step === "details" ? (
        <form
          noValidate
          aria-label="Shipment details"
          onSubmit={(e) => {
            e.preventDefault();
            if (Object.keys(errors).length) {
              setShowErrors(true);
              const first = Object.keys(errors)[0];
              requestAnimationFrame(() => document.getElementById(`sh-${first}`)?.focus());
              return;
            }
            setStep("review");
            window.scrollTo({ top: 0 });
          }}
          className="space-y-8 rounded-2xl border border-line bg-surface p-5 sm:p-8"
        >
          <FormSection title="Transport & route">
            <SelectField id="sh-mode" label="Transport mode" required value={values.mode} onChange={(v) => set("mode", v as TransportMode)} options={TRANSPORT_MODES.map((m) => ({ value: m.id, label: m.label }))} emptyLabel={null} />
            <TextField id="sh-origin" label="Origin city / location" required value={values.origin} onChange={(v) => set("origin", v)} error={visible.origin} />
            <TextField id="sh-portOfLoading" label="Port / airport of loading" required value={values.portOfLoading} onChange={(v) => set("portOfLoading", v)} error={visible.portOfLoading} />
            <TextField id="sh-portOfDischarge" label="Port / airport of discharge" required value={values.portOfDischarge} onChange={(v) => set("portOfDischarge", v)} error={visible.portOfDischarge} />
            <TextField id="sh-finalDelivery" label="Final delivery location" required className="sm:col-span-2" value={values.finalDelivery} onChange={(v) => set("finalDelivery", v)} error={visible.finalDelivery} />
            <Checkbox id="sh-transshipment" label="Transshipment allowed" checked={values.transshipmentAllowed} onChange={(v) => set("transshipmentAllowed", v)} />
          </FormSection>

          <FormSection title="Cargo" description="Shipping quantity is the full order quantity. Partial shipments are not supported yet.">
            <div className="sm:col-span-2 grid grid-cols-1 gap-3 rounded-xl bg-canvas px-4 py-3 text-sm sm:grid-cols-2">
              <p><span className="text-ink-faint">Product: </span><span className="text-ink">{t.productName}</span></p>
              <p><span className="text-ink-faint">Shipping quantity: </span><span className="font-medium text-ink">{formatOrderQuantity(t)}</span> <span className="text-xs text-ink-faint">(read-only)</span></p>
            </div>
            <TextField id="sh-packages" label="Number of packages" required inputMode="numeric" value={values.packages} onChange={(v) => set("packages", v)} error={visible.packages} />
            <SelectField id="sh-packageType" label="Package type" required value={values.packageType} onChange={(v) => set("packageType", v as PackageType)} options={PACKAGE_TYPES.map((p) => ({ value: p, label: p }))} emptyLabel={null} />
            <TextField id="sh-grossWeight" label="Gross weight" required type="number" inputMode="decimal" min="0" value={values.grossWeight} onChange={(v) => set("grossWeight", v)} error={visible.grossWeight} />
            <TextField id="sh-netWeight" label="Net weight" required type="number" inputMode="decimal" min="0" value={values.netWeight} onChange={(v) => set("netWeight", v)} error={visible.netWeight} />
            <SelectField id="sh-weightUnit" label="Weight unit" required value={values.weightUnit} onChange={(v) => set("weightUnit", v as "kg" | "MT")} options={[{ value: "kg", label: "kg" }, { value: "MT", label: "MT" }]} emptyLabel={null} />
            <TextField id="sh-volumeCbm" label="Volume (CBM)" type="number" inputMode="decimal" min="0" value={values.volumeCbm} onChange={(v) => set("volumeCbm", v)} error={visible.volumeCbm} />
            <TextArea id="sh-packagingDescription" label="Packaging description" rows={2} className="sm:col-span-2" value={values.packagingDescription} onChange={(v) => set("packagingDescription", v)} error={visible.packagingDescription} />
          </FormSection>

          <FormSection title="Schedule" description="Planned dates. Ready date ≤ ETD ≤ ETA.">
            <TextField id="sh-readyDate" label="Planned ready date" required type="date" value={values.readyDate} onChange={(v) => set("readyDate", v)} error={visible.readyDate} />
            <TextField id="sh-etd" label="Planned ETD" required type="date" value={values.etd} onChange={(v) => set("etd", v)} error={visible.etd} />
            <TextField id="sh-eta" label="Planned ETA" required type="date" value={values.eta} onChange={(v) => set("eta", v)} error={visible.eta} hint={`Order required by ${formatDate(order.purchaseOrder.requiredBy)}.`} />
          </FormSection>

          <FormSection title="Logistics parties" description="Optional, free text for now. Leave blank if not assigned yet.">
            <TextField id="sh-freightForwarder" label="Freight forwarder" value={values.freightForwarder} onChange={(v) => set("freightForwarder", v)} error={visible.freightForwarder} placeholder="Not assigned" />
            <TextField id="sh-customsBroker" label="Customs broker / CHA" value={values.customsBroker} onChange={(v) => set("customsBroker", v)} error={visible.customsBroker} placeholder="Not assigned" />
            <TextField id="sh-carrier" label="Carrier / shipping line" value={values.carrier} onChange={(v) => set("carrier", v)} error={visible.carrier} placeholder="Not assigned" />
          </FormSection>

          {showErrors && Object.keys(errors).length > 0 && <p role="alert" className="text-sm font-medium text-orange">Fix the highlighted fields to continue.</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Link href={importerHref(`orders/${order.id}`)} className={ghostButton}>Cancel</Link>
            <button type="submit" className={primaryButton}>Review Shipment</button>
          </div>
        </form>
      ) : (
        <section aria-labelledby="review-shipment" className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-5 sm:p-8">
          <h2 id="review-shipment" className="sr-only">Review</h2>
          <dl className="divide-y divide-line rounded-xl border border-line">
            {[
              ["Order", order.id],
              ["Supplier", supplier.name],
              ["Product", t.productName],
              ["Quantity", formatOrderQuantity(t)],
              ["Mode", modeLabel(values.mode)],
              ["Origin", values.origin],
              ["Port of loading", values.portOfLoading],
              ["Port of discharge", values.portOfDischarge],
              ["Final destination", values.finalDelivery],
              ["Packages", `${values.packages} ${values.packageType.toLowerCase()}`],
              ["Ready date", formatDate(values.readyDate)],
              ["ETD", formatDate(values.etd)],
              ["ETA", formatDate(values.eta)],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="break-words text-right font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-ink-faint">The shipment is kept in this browser tab for the demo. Nothing is sent to carriers, forwarders or customs.</p>
          {failed && <p role="alert" className="mt-3 text-sm font-medium text-orange">This shipment could not be created — a shipment may already exist for this order.</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setStep("details")} className={secondaryButton}>
              <ArrowLeft aria-hidden className="size-4" />
              Back
            </button>
            <button type="button" onClick={create} className={primaryButton}>
              <Ship aria-hidden className="size-4" />
              Create Shipment
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
