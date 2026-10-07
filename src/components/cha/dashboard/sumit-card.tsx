"use client";

import { useRef, useState } from "react";
import { SendHorizontal, Sparkles } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { formatTimeAgo } from "@/lib/format";
import type { BriefingItem } from "@/lib/cha-dashboard-data";

const EXAMPLE_PROMPTS = [
  "What should I work on first?",
  "Show urgent shipments",
  "Which filings are ready?",
  "Why is XIM-EXP-1042 blocked?",
];

/**
 * Sumit, the Ximverse assistant: a short briefing plus a question box. UI only
 * for now — the briefing is mock data and questions aren't sent anywhere.
 */
export function SumitCard({
  briefing,
  asOf,
  className = "",
}: {
  briefing: readonly BriefingItem[];
  asOf: string;
  className?: string;
}) {
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section
      aria-labelledby="cha-sumit"
      className={`flex flex-col rounded-2xl border border-teal/15 bg-teal-soft/60 p-5 sm:p-6 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal text-on-brand">
          <Sparkles className="size-4.5" />
        </span>
        <div>
          <h2 id="cha-sumit" className="text-base font-semibold tracking-tight text-ink">
            Sumit
          </h2>
          <p className="text-xs text-ink-muted">Your customs operations assistant</p>
        </div>
      </div>

      <p className="mt-4 text-sm font-semibold text-ink">
        Start with {briefing.length === 1 ? "this shipment" : `these ${briefing.length} shipments`}:
      </p>
      <ul className="mt-2 space-y-2">
        {briefing.map((item) => (
          <li key={item.shipmentId} className="flex gap-2 text-sm text-ink-muted">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-orange" />
            <span>
              {item.message}
              {item.at && (
                <>
                  {" "}
                  <time dateTime={item.at} className="whitespace-nowrap text-ink-faint">
                    · {formatTimeAgo(item.at, asOf)}
                  </time>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>

      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) setNotice(true);
        }}
      >
        <label htmlFor="cha-sumit-question" className="sr-only">
          Ask Sumit about your shipments
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="cha-sumit-question"
            type="text"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setNotice(false);
            }}
            placeholder="Ask Sumit…"
            autoComplete="off"
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            aria-label="Ask Sumit"
            className={`grid size-10 shrink-0 place-items-center rounded-xl bg-teal text-on-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
          >
            <SendHorizontal className="size-4" aria-hidden />
          </button>
        </div>
        <p role="status" className="mt-1.5 min-h-4 text-xs text-ink-muted">
          {notice && "Sumit isn't connected yet — your question wasn't sent."}
        </p>
      </form>

      <ul aria-label="Suggested questions" className="mt-1 flex flex-wrap gap-1.5">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => {
                setQuestion(prompt);
                setNotice(false);
                inputRef.current?.focus();
              }}
              className={`rounded-full border border-line bg-surface px-2.5 py-1 text-left text-xs text-ink-muted transition hover:border-teal/40 hover:text-ink ${focusRing}`}
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
