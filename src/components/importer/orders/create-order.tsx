"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleAlert, Lock, PackagePlus } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref, PLACEHOLDER_IMPORTER } from "@/lib/importer-nav";
import { quotationOf } from "@/lib/importer-negotiations";
import {
  formatOrderQuantity,
  formatOrderUnitPrice,
  formatOrderValue,
  nextPoNumber,
  orderEligibility,
  termsFromAgreement,
  type AgreedOrderTerms,
  type PurchaseOrder,
} from "@/lib/importer-orders";
import { findSupplier } from "@/lib/importer-suppliers";
import { ImportId } from "../dashboard/dashboard-ui";
import { useNegotiations, useNegotiationsLoaded } from "../negotiations/negotiation-store";
import { TextArea, TextField } from "../rfq/form-fields";
import { todayISO } from "../rfq/requirement-form-model";
import { useImportRequirements } from "../rfq/requirements-store";
import { focusRing, ghostButton, primaryButton, secondaryButton } from "../styles";
import { createOrder, useOrders } from "./order-store";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;

interface Values {
  poNumber: string;
  issueDate: string;
  requiredBy: string;
  buyerReference: string;
  internalReference: string;
  billingAddress: string;
  deliveryAddress: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  buyerInstructions: string;
  supplierInstructions: string;
  additionalTerms: string;
}
type Errors = Partial<Record<keyof Values, string>>;

const PO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/-]{3,29}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[+()\d\s-]{6,20}$/;

function validate(v: Values, takenPoNumbers: Set<string>): Errors {
  const e: Errors = {};
  const po = v.poNumber.trim();
  if (!po) e.poNumber = "Enter a PO number.";
  else if (!PO_PATTERN.test(po)) e.poNumber = "Use 4–30 letters, numbers, hyphens or slashes, e.g. PO-2026-0006.";
  else if (takenPoNumbers.has(po.toUpperCase())) e.poNumber = "This PO number is already used by another order.";
  if (!v.issueDate) e.issueDate = "Choose the order date.";
  if (!v.requiredBy) e.requiredBy = "Choose the date you need the goods by.";
  else if (v.issueDate && v.requiredBy < v.issueDate) e.requiredBy = "Required-by date can't be before the order date.";
  if (!v.billingAddress.trim()) e.billingAddress = "Enter the billing address.";
  if (!v.deliveryAddress.trim()) e.deliveryAddress = "Enter the delivery / consignee address.";
  if (!v.contactName.trim()) e.contactName = "Enter a contact person.";
  if (!v.contactEmail.trim()) e.contactEmail = "Enter a contact email.";
  else if (!EMAIL_PATTERN.test(v.contactEmail.trim())) e.contactEmail = "Enter a valid email address.";
  if (v.contactPhone.trim() && !PHONE_PATTERN.test(v.contactPhone.trim())) e.contactPhone = "Enter a valid phone number.";
  for (const k of ["buyerInstructions", "supplierInstructions", "additionalTerms"] as const) {
    if (v[k].length > 600) e[k] = "Keep this under 600 characters.";
  }
  return e;
}

export function CreateOrder({ negotiationId }: { negotiationId: string }) {
  const negotiations = useNegotiations();
  const loaded = useNegotiationsLoaded();
  const orders = useOrders();
  const { find } = useImportRequirements();

  const n = negotiations.find((x) => x.id === negotiationId);
  const requirement = n ? find(n.requirementId) : undefined;
  // Set once this page creates the order, so the "order exists" state isn't flashed.
  const [createdId, setCreatedId] = useState<string | null>(null);

  if (createdId) return <p className="py-16 text-center text-sm text-ink-muted">Order {createdId} created. Opening…</p>;
  if (!n && !loaded) return <p className="py-16 text-center text-sm text-ink-muted">Loading agreement…</p>;

  const eligibility = orderEligibility(n, requirement, orders);
  if (!eligibility.ok) {
    const copy = {
      "not-found": { title: "Agreement not found", body: "There's no negotiation with this ID in this browser tab." },
      "order-exists": { title: "An order already exists for this agreement", body: "Each agreement can create only one order." },
      "not-agreed": { title: "This negotiation hasn't reached agreement", body: "Accept the supplier's current offer in the negotiation before creating an order." },
      "not-selected": { title: "This agreement is not the selected supplier", body: "Orders can only be created from the agreement that selected the requirement's supplier." },
      "supplier-mismatch": { title: "Supplier doesn't match the selection", body: "The accepted quotation and the selected supplier differ, so no order can be created." },
      "invalid-terms": { title: "Agreed terms are incomplete", body: "Price and quantity must be greater than 0. Return to the negotiation to fix the terms." },
    }[eligibility.reason];
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-orange-soft text-orange">
          <CircleAlert className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">{copy.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{copy.body}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          {eligibility.order && (
            <Link href={importerHref(`orders/${eligibility.order.id}`)} className={primaryButton}>
              View Order <ImportId id={eligibility.order.id} className="text-xs" />
            </Link>
          )}
          {n && (
            <Link href={importerHref(`negotiations/${n.id}`)} className={secondaryButton}>
              Back to Negotiation
            </Link>
          )}
          <Link href={importerHref("orders")} className={secondaryButton}>Orders</Link>
        </div>
      </div>
    );
  }

  return <OrderForm negotiationId={n!.id} onCreated={setCreatedId} />;
}

function OrderForm({ negotiationId, onCreated }: { negotiationId: string; onCreated: (id: string) => void }) {
  const router = useRouter();
  const n = useNegotiations().find((x) => x.id === negotiationId)!;
  const requirement = useImportRequirements().find(n.requirementId)!;
  const orders = useOrders();
  const supplier = findSupplier(n.supplierId)!;
  const quote = quotationOf(n);
  const terms = termsFromAgreement(n, requirement)!;

  const [values, setValues] = useState<Values>(() => {
    const today = todayISO();
    return {
      poNumber: nextPoNumber(orders, new Date().getFullYear()),
      issueDate: today,
      requiredBy: requirement.delivery.requiredBy > today ? requirement.delivery.requiredBy : today,
      buyerReference: "",
      internalReference: "",
      billingAddress: PLACEHOLDER_IMPORTER.address,
      deliveryAddress: `${PLACEHOLDER_IMPORTER.company} — Consignee\n${requirement.delivery.destinationLocation}`,
      contactName: PLACEHOLDER_IMPORTER.contact.name,
      contactEmail: PLACEHOLDER_IMPORTER.contact.email,
      contactPhone: PLACEHOLDER_IMPORTER.contact.phone,
      buyerInstructions: "",
      supplierInstructions: "Quote the PO number on all shipping documents.",
      additionalTerms: "",
    };
  });
  const [step, setStep] = useState<"details" | "review">("details");
  const [showErrors, setShowErrors] = useState(false);
  const [failed, setFailed] = useState(false);
  const taken = new Set(orders.map((o) => o.purchaseOrder.number.toUpperCase()));
  const errors = validate(values, taken);
  const visible = showErrors ? errors : {};
  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((x) => ({ ...x, [k]: v }));

  const purchaseOrder = (): PurchaseOrder => ({
    number: values.poNumber.trim(),
    issueDate: values.issueDate,
    requiredBy: values.requiredBy,
    buyerReference: values.buyerReference.trim() || undefined,
    internalReference: values.internalReference.trim() || undefined,
    billingAddress: values.billingAddress.trim(),
    deliveryAddress: values.deliveryAddress.trim(),
    contact: { name: values.contactName.trim(), email: values.contactEmail.trim(), phone: values.contactPhone.trim() || undefined },
    buyerInstructions: values.buyerInstructions.trim() || undefined,
    supplierInstructions: values.supplierInstructions.trim() || undefined,
    additionalTerms: values.additionalTerms.trim() || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href={importerHref(`negotiations/${n.id}`)} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to agreement
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          {step === "details" ? "Create Order" : "Review Order"}
        </h1>
        <p className="mt-2 max-w-2xl text-base text-ink-muted">
          {step === "details"
            ? `From the agreement with ${supplier.name}. Commercial terms come from the accepted offer and can't be edited here.`
            : "Confirm the agreed commercial terms and purchase-order details before creating this order."}
        </p>
      </div>

      {step === "details" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <form
            noValidate
            aria-labelledby="po-details"
            onSubmit={(e) => {
              e.preventDefault();
              if (Object.keys(errors).length) {
                setShowErrors(true);
                const first = Object.keys(errors)[0];
                requestAnimationFrame(() => document.getElementById(`po-${first}`)?.focus());
                return;
              }
              setStep("review");
              window.scrollTo({ top: 0 });
            }}
            className="order-2 min-w-0 space-y-6 rounded-2xl border border-line bg-surface p-5 sm:p-8 xl:order-1"
          >
            <div>
              <h2 id="po-details" className="text-lg font-semibold tracking-tight text-ink">Purchase order details</h2>
              <p className="mt-1 text-sm text-ink-muted">Only order-specific information. Prefilled from your company profile.</p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField id="po-poNumber" label="PO number" required value={values.poNumber} onChange={(v) => set("poNumber", v)} error={visible.poNumber} />
              <TextField id="po-buyerReference" label="Buyer reference" value={values.buyerReference} onChange={(v) => set("buyerReference", v)} />
              <TextField id="po-issueDate" label="Order date" required type="date" value={values.issueDate} onChange={(v) => set("issueDate", v)} error={visible.issueDate} />
              <TextField id="po-requiredBy" label="Required by" required type="date" value={values.requiredBy} onChange={(v) => set("requiredBy", v)} error={visible.requiredBy} hint={`Requirement asked for ${formatDate(requirement.delivery.requiredBy)}.`} />
              <TextArea id="po-billingAddress" label="Billing address" required rows={3} value={values.billingAddress} onChange={(v) => set("billingAddress", v)} error={visible.billingAddress} />
              <TextArea id="po-deliveryAddress" label="Delivery / consignee address" required rows={3} value={values.deliveryAddress} onChange={(v) => set("deliveryAddress", v)} error={visible.deliveryAddress} />
              <TextField id="po-contactName" label="Buyer contact name" required value={values.contactName} onChange={(v) => set("contactName", v)} error={visible.contactName} />
              <TextField id="po-contactEmail" label="Buyer contact email" required value={values.contactEmail} onChange={(v) => set("contactEmail", v)} error={visible.contactEmail} />
              <TextField id="po-contactPhone" label="Buyer contact phone" value={values.contactPhone} onChange={(v) => set("contactPhone", v)} error={visible.contactPhone} />
              <TextField id="po-internalReference" label="Internal reference" value={values.internalReference} onChange={(v) => set("internalReference", v)} hint="Not printed on the purchase order." />
              <TextArea id="po-buyerInstructions" label="Buyer instructions" rows={2} className="sm:col-span-2" value={values.buyerInstructions} onChange={(v) => set("buyerInstructions", v)} error={visible.buyerInstructions} />
              <TextArea id="po-supplierInstructions" label="Supplier instructions" rows={2} className="sm:col-span-2" value={values.supplierInstructions} onChange={(v) => set("supplierInstructions", v)} error={visible.supplierInstructions} />
              <TextArea id="po-additionalTerms" label="Additional PO terms" rows={2} className="sm:col-span-2" value={values.additionalTerms} onChange={(v) => set("additionalTerms", v)} error={visible.additionalTerms} />
            </div>
            {showErrors && Object.keys(errors).length > 0 && (
              <p role="alert" className="text-sm font-medium text-orange">Fix the highlighted fields to continue.</p>
            )}
            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Link href={importerHref(`negotiations/${n.id}`)} className={ghostButton}>Cancel</Link>
              <button type="submit" className={primaryButton}>Review Order</button>
            </div>
          </form>

          <aside className="order-1 xl:order-2">
            <AgreedTermsSummary terms={terms} supplier={`${supplier.name} · ${supplier.country}`} refs={{ requirement: n.requirementId, quotation: quote.id, negotiation: n.id }} />
          </aside>
        </div>
      ) : (
        <section aria-labelledby="review-heading" className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-5 sm:p-8">
          <h2 id="review-heading" className="sr-only">Review</h2>
          <dl className="divide-y divide-line rounded-xl border border-line">
            {[
              ["Supplier", `${supplier.name} (${supplier.country})`],
              ["Product", terms.productName],
              ["Quantity", formatOrderQuantity(terms)],
              ["Unit price", formatOrderUnitPrice(terms)],
              ["Total order value", formatOrderValue(terms)],
              ["Incoterm", `${terms.incoterm} ${terms.namedPlace}`],
              ["Payment terms", terms.paymentSummary],
              ["PO number", values.poNumber.trim()],
              ["Order date", formatDate(values.issueDate)],
              ["Required by", formatDate(values.requiredBy)],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-ink-faint">
            The order keeps a fixed copy of these agreed terms. It is kept in this browser tab for the demo and is not sent to the supplier.
          </p>
          {failed && <p role="alert" className="mt-3 text-sm font-medium text-orange">This order could not be created — an order may already exist for this agreement.</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setStep("details")} className={secondaryButton}>
              <ArrowLeft aria-hidden className="size-4" />
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                const id = createOrder(n, requirement, purchaseOrder());
                if (!id) return setFailed(true);
                onCreated(id);
                router.push(importerHref(`orders/${id}`));
              }}
              className={primaryButton}
            >
              <PackagePlus aria-hidden className="size-4" />
              Create Order
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export function AgreedTermsSummary({
  terms,
  supplier,
  refs,
}: {
  terms: AgreedOrderTerms;
  supplier: string;
  refs: { requirement: string; quotation: string; negotiation: string };
}) {
  const rows: [string, React.ReactNode][] = [
    ["Supplier", supplier],
    ["Requirement", <ImportId key="r" id={refs.requirement} />],
    ["Quotation", <ImportId key="q" id={refs.quotation} />],
    ["Negotiation", <ImportId key="n" id={refs.negotiation} />],
    ["Product", terms.productName],
    ["Specification", terms.specification],
    ["Quantity", formatOrderQuantity(terms)],
    ["Unit", terms.quantity.unit],
    ["Unit price", formatOrderUnitPrice(terms)],
    ["Currency", terms.currency],
    ["Order value", formatOrderValue(terms)],
    ["Incoterm", terms.incoterm],
    ["Named place", terms.namedPlace],
    ["Payment terms", terms.paymentSummary],
    ["Lead time", `${terms.leadTimeDays} days`],
    ["Packaging", terms.packaging ?? "—"],
    ["Inspection", terms.inspection ?? "—"],
  ];
  return (
    <section aria-labelledby="agreed-summary" className="rounded-2xl border border-line bg-surface p-5 xl:sticky xl:top-24">
      <h2 id="agreed-summary" className="flex items-center gap-2 text-base font-semibold text-ink">
        <Lock aria-hidden className="size-4 text-ink-faint" />
        Agreed commercial terms
      </h2>
      <p className="mt-0.5 text-xs text-ink-muted">Read-only. Agreed {formatDate(terms.agreedAt)}. To change them, return to the negotiation.</p>
      <dl className="mt-4 divide-y divide-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="break-words text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
