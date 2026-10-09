"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref, PLACEHOLDER_IMPORTER } from "@/lib/importer-nav";
import { formatOrderQuantity, formatOrderUnitPrice, formatOrderValue, orderStatus, type Order } from "@/lib/importer-orders";
import { findSupplier } from "@/lib/importer-suppliers";
import { focusRing, primaryButton } from "../styles";
import { OrderNotFound } from "./order-detail";
import { useOrders, useOrdersLoaded } from "./order-store";

export function PurchaseOrderPreview({ id }: { id: string }) {
  const orders = useOrders();
  const loaded = useOrdersLoaded();
  const order = orders.find((o) => o.id === id);
  if (!order) {
    if (!loaded) return <p className="py-16 text-center text-sm text-ink-muted">Loading purchase order…</p>;
    return <OrderNotFound id={id} />;
  }

  return (
    <div className="space-y-5 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={importerHref(`orders/${order.id}`)} className={`inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to order {order.id}
        </Link>
        <button type="button" onClick={() => window.print()} className={primaryButton}>
          <Printer aria-hidden className="size-4" />
          Print Purchase Order
        </button>
      </div>
      <p className="text-sm text-ink-muted print:hidden">
        Preview only. This purchase order has not been sent to the supplier from XimVerse.
      </p>
      <p className="text-xs text-ink-faint sm:hidden print:hidden">Scroll sideways to see the full document.</p>
      {/* The document keeps its own width; on small screens it scrolls inside this area. */}
      <div className="relative overflow-x-auto rounded-2xl border border-line bg-canvas p-3 sm:p-6 print:overflow-visible print:border-0 print:bg-white print:p-0">
        <PurchaseOrderDocument order={order} />
      </div>
    </div>
  );
}

/** A printable purchase order. Fixed light colours so it stays document-like in dark mode. */
function PurchaseOrderDocument({ order }: { order: Order }) {
  const t = order.terms;
  const po = order.purchaseOrder;
  const supplier = findSupplier(order.supplierId)!;
  const cancelled = orderStatus(order) === "cancelled";

  return (
    <article
      aria-label={`Purchase order ${po.number}`}
      className="mx-auto min-w-[40rem] max-w-[52rem] bg-white px-10 py-10 text-[13px] leading-relaxed text-[#1c2b2c] shadow-[0_1px_3px_rgba(11,46,48,0.12)] print:min-w-0 print:max-w-none print:px-0 print:py-0 print:shadow-none"
    >
      <header className="flex items-start justify-between gap-8 border-b-2 border-[#0b4547] pb-6">
        <div>
          <p className="text-lg font-bold text-[#0b4547]">{PLACEHOLDER_IMPORTER.company}</p>
          <p className="whitespace-pre-line text-[#4d5f60]">{PLACEHOLDER_IMPORTER.address}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-[0.08em] text-[#0b4547]">PURCHASE ORDER</p>
          {cancelled && <p className="mt-1 font-bold tracking-[0.1em] text-[#b0442a]">CANCELLED</p>}
          <dl className="mt-3 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-0.5 text-left">
            <dt className="text-[#6b7a7b]">PO number</dt>
            <dd className="font-semibold">{po.number}</dd>
            <dt className="text-[#6b7a7b]">Order date</dt>
            <dd>{formatDate(po.issueDate)}</dd>
            <dt className="text-[#6b7a7b]">Order ref.</dt>
            <dd>{order.id}</dd>
            {po.buyerReference && (
              <>
                <dt className="text-[#6b7a7b]">Buyer ref.</dt>
                <dd>{po.buyerReference}</dd>
              </>
            )}
          </dl>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-8 border-b border-[#e2e0da] py-6">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b4547]">Buyer</h2>
          <p className="mt-2 font-semibold">{PLACEHOLDER_IMPORTER.company}</p>
          <p className="whitespace-pre-line text-[#4d5f60]">{po.billingAddress}</p>
          <p className="mt-2">{po.contact.name}</p>
          <p className="text-[#4d5f60]">{po.contact.email}</p>
          {po.contact.phone && <p className="text-[#4d5f60]">{po.contact.phone}</p>}
        </div>
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b4547]">Supplier</h2>
          <p className="mt-2 font-semibold">{supplier.legalName}</p>
          <p className="text-[#4d5f60]">{supplier.city}, {supplier.country}</p>
        </div>
      </section>

      <section className="py-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b4547]">Order details</h2>
        <table className="mt-3 w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-[#0b4547]/40 text-[11px] uppercase tracking-[0.08em] text-[#4d5f60]">
              <th scope="col" className="py-2 pr-4 font-semibold">Product</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Quantity</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Unit price</th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">Total ({t.currency})</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#e2e0da] align-top">
              <td className="py-3 pr-4">
                <p className="font-semibold">{t.productName}</p>
                <p className="text-[#4d5f60]">{t.specification}</p>
                {t.hsCode && <p className="mt-1 text-[#6b7a7b]">HS code {t.hsCode}</p>}
                {t.packaging && <p className="text-[#6b7a7b]">Packaging: {t.packaging}</p>}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right">{formatOrderQuantity(t)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right">{formatOrderUnitPrice(t)}</td>
              <td className="whitespace-nowrap py-3 pl-3 text-right font-semibold">{formatOrderValue(t)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3} className="py-3 pr-3 text-right font-semibold text-[#4d5f60]">Total order value ({t.currency})</th>
              <td className="py-3 pl-3 text-right text-base font-bold text-[#0b4547]">{formatOrderValue(t)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="grid grid-cols-2 gap-8 border-t border-[#e2e0da] py-6">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b4547]">Commercial terms</h2>
          <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-y-1">
            <dt className="text-[#6b7a7b]">Incoterm</dt>
            <dd>{t.incoterm} (Incoterms® 2020)</dd>
            <dt className="text-[#6b7a7b]">Named place</dt>
            <dd>{t.namedPlace}</dd>
            <dt className="text-[#6b7a7b]">Payment terms</dt>
            <dd>{t.paymentSummary}</dd>
            <dt className="text-[#6b7a7b]">Lead time</dt>
            <dd>{t.leadTimeDays} days</dd>
            <dt className="text-[#6b7a7b]">Required by</dt>
            <dd>{formatDate(po.requiredBy)}</dd>
            {t.inspection && (
              <>
                <dt className="text-[#6b7a7b]">Inspection</dt>
                <dd>{t.inspection}</dd>
              </>
            )}
          </dl>
        </div>
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b4547]">Delivery</h2>
          <p className="mt-2 text-[#6b7a7b]">Delivery / consignee address</p>
          <p className="whitespace-pre-line">{po.deliveryAddress}</p>
        </div>
      </section>

      {(po.buyerInstructions || po.supplierInstructions || po.additionalTerms) && (
        <section className="space-y-3 border-t border-[#e2e0da] py-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b4547]">Instructions</h2>
          {po.buyerInstructions && <p><span className="text-[#6b7a7b]">Buyer instructions: </span>{po.buyerInstructions}</p>}
          {po.supplierInstructions && <p><span className="text-[#6b7a7b]">Supplier instructions: </span>{po.supplierInstructions}</p>}
          {po.additionalTerms && <p><span className="text-[#6b7a7b]">Additional terms: </span>{po.additionalTerms}</p>}
        </section>
      )}

      <footer className="mt-4 border-t border-[#e2e0da] pt-4 text-[11px] text-[#6b7a7b]">
        Demo purchase order generated in XimVerse. Commercial terms as agreed on {formatDate(t.agreedAt)} ({order.negotiationId}).
      </footer>
    </article>
  );
}
