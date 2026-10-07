"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { focusRing } from "../styles";

const CAPABILITIES = [
  "Identify possible HS codes",
  "Improve product specifications",
  "Suggest questions for suppliers",
  "Explain Incoterms",
  "Spot information you may have missed",
];

/** Restrained pointer to SUMIT on the requirement flow. UI only for now. */
export function SumitHelpCard({ className = "" }: { className?: string }) {
  const [asked, setAsked] = useState(false);

  return (
    <section aria-labelledby="sumit-help" className={`rounded-2xl border border-teal/15 bg-teal-soft/50 p-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden className="size-4 text-teal" />
        <h2 id="sumit-help" className="text-sm font-semibold text-ink">
          Need help structuring your requirement?
        </h2>
      </div>
      <p className="mt-1 text-xs text-ink-muted">Coming soon, SUMIT will be able to:</p>
      <ul className="mt-2 space-y-1 text-xs text-ink-muted">
        {CAPABILITIES.map((c) => (
          <li key={c} className="flex gap-2">
            <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-teal/60" />
            {c}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setAsked(true)}
        className={`mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-teal/30 bg-surface px-3 text-sm font-semibold text-teal transition hover:bg-teal hover:text-on-brand ${focusRing}`}
      >
        <Sparkles aria-hidden className="size-3.5" />
        Ask SUMIT
      </button>
      <p role="status" className="mt-2 text-xs text-ink-muted">
        {asked && "SUMIT isn't connected yet."}
      </p>
    </section>
  );
}
