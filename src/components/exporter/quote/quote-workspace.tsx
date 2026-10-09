"use client";

import { useState } from "react";
import type { ProductSummary } from "@/lib/exporter-products";
import { hoursUntilDue, type BuyerOpportunity } from "@/lib/exporter-opportunities";
import { defaultQuoteForm } from "@/lib/exporter-quotations";
import { loadDraft, useIsClient, useSubmittedQuotation } from "@/lib/exporter-quotation-store";
import { QuoteForm } from "./quote-form";
import { SubmittedView } from "./submitted-view";

/**
 * Chooses what the quote route shows: the submitted quotation, a closed
 * notice, or the form (restoring a local draft). Waits for the browser so
 * stored drafts and submissions are known before rendering.
 */
export function QuoteWorkspace({
  o,
  product,
  requirementPanel,
}: {
  o: BuyerOpportunity;
  product?: ProductSummary;
  requirementPanel: React.ReactNode;
}) {
  const isClient = useIsClient();
  const submitted = useSubmittedQuotation(o.rfqId);

  if (!isClient) {
    return (
      <div className="space-y-6">
        {requirementPanel}
        <p className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-sm text-ink-muted">Loading quotation…</p>
      </div>
    );
  }
  if (submitted) return <SubmittedView q={submitted} />;

  const closed = o.status === "closed" || hoursUntilDue(o) <= 0;
  if (closed || o.status === "quoted" || !product) {
    return (
      <div className="space-y-6">
        {requirementPanel}
        <p className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-sm text-ink-muted">
          {!product
            ? "The matched product is no longer in your catalogue, so this opportunity can't be quoted."
            : o.status === "quoted"
              ? "A quotation was already submitted for this opportunity."
              : "This opportunity is closed to new quotations."}
        </p>
      </div>
    );
  }
  return <ClientForm o={o} product={product} requirementPanel={requirementPanel} />;
}

/** Mounted only in the browser, so the draft can seed initial state directly. */
function ClientForm({ o, product, requirementPanel }: { o: BuyerOpportunity; product: ProductSummary; requirementPanel: React.ReactNode }) {
  const [initial] = useState(() => {
    const draft = loadDraft(o.rfqId);
    return { values: draft ? { ...defaultQuoteForm(o, product), ...draft.values } : defaultQuoteForm(o, product), savedAt: draft?.savedAt };
  });
  return (
    <QuoteForm o={o} product={product} initialValues={initial.values} initialSavedAt={initial.savedAt} requirementPanel={requirementPanel} />
  );
}
