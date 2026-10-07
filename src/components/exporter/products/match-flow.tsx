import { ChevronRight } from "lucide-react";

const STEPS = ["Product profile", "Buyer requirements", "Match score", "Opportunity"] as const;

/** How a product profile turns into buyer opportunities. Explanatory only. */
export function MatchFlow({ highlight = 0 }: { highlight?: number }) {
  return (
    <ol aria-label="How matching works" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      {STEPS.map((step, i) => (
        <li key={step} className="flex items-center gap-1.5">
          <span
            className={`rounded-md px-2 py-0.5 font-medium ${
              i === highlight ? "bg-teal text-on-brand" : "bg-canvas text-ink-muted ring-1 ring-inset ring-line"
            }`}
          >
            {step}
          </span>
          {i < STEPS.length - 1 && <ChevronRight aria-hidden className="size-3.5 text-ink-faint" />}
        </li>
      ))}
    </ol>
  );
}
