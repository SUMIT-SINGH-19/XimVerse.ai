"use client";

import { useState } from "react";
import { Bookmark, CircleSlash, Info, RotateCcw } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import type { OpportunityStatus } from "@/lib/exporter-opportunities";
import { useSubmittedQuotation } from "@/lib/exporter-quotation-store";
import { OpportunityStatusPill } from "../opportunity-ui";
import { PrepareQuotationButton } from "./prepare-quotation-button";

type LocalDecision = "saved" | "declined";

const secondary = `inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink-muted transition-colors hover:border-teal hover:bg-teal-soft hover:text-ink ${focusRing}`;

/**
 * The exporter's call on this opportunity. Save / Not Interested only change
 * this panel's local state — nothing is sent to Ximverse yet.
 */
export function DecisionPanel({ rfqId, status: datasetStatus }: { rfqId: string; status: OpportunityStatus }) {
  const [decision, setDecision] = useState<LocalDecision | null>(null);
  // A quotation submitted in this browser moves the opportunity to Quotation Submitted locally.
  const submitted = useSubmittedQuotation(rfqId);
  const status: OpportunityStatus = submitted ? "quoted" : datasetStatus;
  const actionable = status !== "quoted" && status !== "closed";

  return (
    <section aria-labelledby="decision-heading" className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="decision-heading" className="text-base font-semibold tracking-tight text-ink">
          Your Decision
        </h2>
        <OpportunityStatusPill status={status} />
      </div>

      {!actionable ? (
        <>
        <p className="mt-3 text-sm text-ink-muted">
          {submitted
            ? `Quotation ${submitted.id} submitted — demo, stored in this browser only.`
            : status === "quoted"
              ? "You've submitted a quotation for this opportunity. Track it under My Quotations."
              : "This opportunity is closed to new quotations."}
        </p>
        {submitted && (
          <div className="mt-3">
            <PrepareQuotationButton rfqId={rfqId} block />
          </div>
        )}
        </>
      ) : decision ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm font-medium text-ink">
            {decision === "saved" ? "Saved for later." : "Marked as not interested."}
          </p>
          <button type="button" onClick={() => setDecision(null)} className={`${secondary} flex-none`}>
            <RotateCcw className="size-4" aria-hidden />
            Undo
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <PrepareQuotationButton rfqId={rfqId} block />
          <div className="flex gap-2">
            <button type="button" onClick={() => setDecision("saved")} className={secondary}>
              <Bookmark className="size-4" aria-hidden />
              Save for Later
            </button>
            <button type="button" onClick={() => setDecision("declined")} className={secondary}>
              <CircleSlash className="size-4" aria-hidden />
              Not Interested
            </button>
          </div>
        </div>
      )}

      {actionable && (
        <p className="mt-4 flex items-start gap-1.5 text-xs text-ink-faint">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Demo: Save and Not Interested apply on this screen only and aren&apos;t sent to Ximverse.
        </p>
      )}
    </section>
  );
}
