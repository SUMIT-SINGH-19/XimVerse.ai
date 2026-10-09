"use client";

import { useId } from "react";
import Link from "next/link";
import { PackageCheck } from "lucide-react";
import type { ImportRequirement } from "@/lib/import-requirements";
import { importerHref } from "@/lib/importer-nav";
import {
  agreementFor,
  currentOffer,
  formatOfferIncoterm,
  formatOfferPrice,
  isActiveNegotiation,
  negotiationStatus,
  offerValue,
  waitingOn,
} from "@/lib/importer-negotiations";
import { findSupplier } from "@/lib/importer-suppliers";
import { formatQuantity } from "@/lib/import-requirements";
import { ImportId } from "../dashboard/dashboard-ui";
import { focusRing } from "../styles";
import { NegotiationStatusBadge } from "./negotiation-ui";
import { useNegotiations } from "./negotiation-store";
import { orderForNegotiation } from "@/lib/importer-orders";
import { useOrders } from "../orders/order-store";
import { OrderAction } from "../orders/order-ui";

/** Negotiation summary for a requirement; shows the selected supplier once agreed. */
export function RequirementNegotiationCard({ requirement, className = "" }: { requirement: ImportRequirement; className?: string }) {
  const headingId = useId();
  const all = useNegotiations().filter((n) => n.requirementId === requirement.id);
  const orders = useOrders();
  if (all.length === 0) return null;
  const agreed = agreementFor(requirement.id, all);
  const active = all.filter(isActiveNegotiation);
  const order = agreed ? orderForNegotiation(agreed.id, orders) : undefined;

  return (
    <section aria-labelledby={headingId} className={`rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}>
      <h2 id={headingId} className="text-xs font-semibold uppercase tracking-[0.14em] text-orange">
        {agreed ? "Supplier Selected" : "Negotiation"}
      </h2>

      {agreed ? (
        <>
          <p className="mt-2 text-lg font-semibold text-ink">{findSupplier(agreed.supplierId)?.name}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {formatQuantity(currentOffer(agreed).quantity)} · {formatOfferPrice(currentOffer(agreed))} · {formatOfferIncoterm(currentOffer(agreed))}
          </p>
          <p className="text-sm text-ink-muted">
            {currentOffer(agreed).paymentSummary} · {currentOffer(agreed).leadTimeDays}-day lead time · {offerValue(currentOffer(agreed))}
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-teal">
            <PackageCheck aria-hidden className="size-3.5" />
            {order ? "Order Created" : "Ready for Order"}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Link href={importerHref(`negotiations/${agreed.id}`)} className={`rounded text-sm font-semibold text-teal hover:underline ${focusRing}`}>
              View agreement <ImportId id={agreed.id} className="text-xs" />
            </Link>
            <OrderAction negotiationId={agreed.id} block />
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink">
            {active.length > 0
              ? `Negotiating with ${active.length} ${active.length === 1 ? "supplier" : "suppliers"}`
              : "No active negotiations"}
            {active.some((n) => waitingOn(negotiationStatus(n)) === "you") && (
              <span className="text-orange"> · your response needed</span>
            )}
          </p>
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {all.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <Link href={importerHref(`negotiations/${n.id}`)} className={`min-w-0 rounded font-medium text-ink hover:text-teal ${focusRing}`}>
                  <span className="block truncate">{findSupplier(n.supplierId)?.name}</span>
                  <span className="block text-xs font-normal text-ink-faint">{formatOfferPrice(currentOffer(n))}</span>
                </Link>
                <NegotiationStatusBadge status={negotiationStatus(n)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
