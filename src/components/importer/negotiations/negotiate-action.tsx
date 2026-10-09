"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Handshake } from "lucide-react";
import { isDecisionOpen, requirementOf, supplierOf, type Quotation } from "@/lib/importer-quotations";
import { negotiationStatus, offerFromQuotation, openNegotiationFor } from "@/lib/importer-negotiations";
import { importerHref } from "@/lib/importer-nav";
import { useQuotationStatus } from "../quotations/quotation-status-store";
import { useImportRequirements } from "../rfq/requirements-store";
import { focusRing, primaryButton, secondaryButton } from "../styles";
import { Dialog, OfferFacts } from "./negotiation-ui";
import { startNegotiation, useNegotiations } from "./negotiation-store";

/**
 * Negotiate / View Negotiation / View Agreement for one quotation. Starting a
 * negotiation goes through a confirmation and never selects the supplier.
 */
export function NegotiateAction({ quote, compact = false }: { quote: Quotation; compact?: boolean }) {
  const router = useRouter();
  const negotiations = useNegotiations();
  const status = useQuotationStatus()(quote);
  const requirement = useImportRequirements().find(quote.requirementId) ?? requirementOf(quote);
  const [confirming, setConfirming] = useState(false);
  const supplier = supplierOf(quote);

  const existing = openNegotiationFor(quote.id, negotiations);
  const linkClass = compact
    ? `inline-flex items-center gap-1 rounded text-xs font-semibold text-teal hover:underline ${focusRing}`
    : `${secondaryButton} h-10 px-4`;

  if (existing) {
    const agreed = negotiationStatus(existing) === "agreed";
    return (
      <Link href={importerHref(`negotiations/${existing.id}`)} className={linkClass}>
        {agreed ? <Check aria-hidden className="size-4" /> : <Handshake aria-hidden className="size-4" />}
        {agreed ? "View Agreement" : "View Negotiation"}
      </Link>
    );
  }

  // New negotiations only while the requirement is still open for decisions.
  if (!isDecisionOpen(requirement) || status === "not-selected" || status === "selected") return null;

  const offer = offerFromQuotation(quote);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={
          compact
            ? `inline-flex items-center gap-1 rounded text-xs font-semibold text-teal hover:underline ${focusRing}`
            : `${primaryButton} h-10 px-4`
        }
      >
        <Handshake aria-hidden className="size-4" />
        {compact ? "Negotiate with this supplier" : "Negotiate"}
      </button>
      <Dialog
        id={`start-${quote.id}`}
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Start negotiation with ${supplier.name}?`}
      >
        <p className="text-sm text-ink-muted">
          The quotation&apos;s terms become the starting offer. You can then make a counter offer, or accept the terms as
          they are. Starting a negotiation does not select this supplier.
        </p>
        <div className="mt-4">
          <OfferFacts
            offer={offer}
            withValue={false}
            extra={[
              { label: "Requirement", value: `${quote.requirementId}` },
              { label: "Product", value: requirement?.product.name ?? "—" },
              { label: "Quotation", value: quote.id },
            ]}
          />
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          Negotiations are kept in this browser tab for the demo. Nothing is sent to the supplier.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setConfirming(false)} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const id = startNegotiation(quote);
              setConfirming(false);
              router.push(importerHref(`negotiations/${id}`));
            }}
            className={primaryButton}
          >
            <Handshake aria-hidden className="size-4" />
            Start Negotiation
          </button>
        </div>
      </Dialog>
    </>
  );
}
