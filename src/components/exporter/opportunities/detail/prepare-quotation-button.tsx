"use client";

import Link from "next/link";
import { FileSignature, FileCheck2 } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { exporterHref } from "@/lib/exporter-nav";
import { useSubmittedQuotation } from "@/lib/exporter-quotation-store";

/**
 * Starts (or reopens) the quotation for this opportunity. Switches to
 * "View Submitted Quotation" once one is stored locally.
 */
export function PrepareQuotationButton({ rfqId, block = false }: { rfqId: string; block?: boolean }) {
  const submitted = useSubmittedQuotation(rfqId);
  const Icon = submitted ? FileCheck2 : FileSignature;

  return (
    <Link
      href={exporterHref(`opportunities/${rfqId}/quote`)}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition ${focusRing} ${block ? "w-full" : ""} ${
        submitted
          ? "border border-teal bg-teal-soft text-teal hover:bg-teal hover:text-on-brand"
          : "bg-orange text-on-brand shadow-sm shadow-orange/20 hover:brightness-95"
      }`}
    >
      <Icon className="size-4" aria-hidden />
      {submitted ? `View Quotation ${submitted.id}` : "Prepare Quotation"}
    </Link>
  );
}
