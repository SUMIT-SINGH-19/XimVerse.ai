"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { focusRing } from "../styles";

const PROMPTS = [
  "Compare the commercial terms",
  "Which quotations differ from my requirement?",
  "Which suppliers offer CIF?",
  "What are the major risks in these offers?",
  "Normalize these quotations for comparison",
];

/** Placeholder for SUMIT analysis. UI only: nothing is analysed or generated. */
export function SumitAnalysisCard({
  heading = "Ask SUMIT to analyze these offers",
  prompts = PROMPTS,
  message = "SUMIT quotation analysis will be connected later. Nothing was analysed.",
  id = "sumit-analysis",
  className = "",
}: {
  heading?: string;
  prompts?: readonly string[];
  message?: string;
  id?: string;
  className?: string;
}) {
  const [asked, setAsked] = useState(false);

  return (
    <section aria-labelledby={id} className={`rounded-2xl border border-teal/15 bg-teal-soft/50 p-5 ${className}`}>
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden className="size-4 text-teal" />
        <h2 id={id} className="text-sm font-semibold text-ink">
          {heading}
        </h2>
      </div>
      <ul aria-label="Example questions" className="mt-3 flex flex-wrap gap-2">
        {prompts.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => setAsked(true)}
              className={`rounded-full border border-line bg-surface px-3 py-1.5 text-left text-xs text-ink-muted transition hover:border-teal/40 hover:text-ink ${focusRing}`}
            >
              {p}
            </button>
          </li>
        ))}
      </ul>
      <p role="status" className="mt-3 text-xs text-ink-muted">
        {asked ? message : ""}
      </p>
    </section>
  );
}
