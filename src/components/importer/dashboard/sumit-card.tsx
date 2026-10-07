"use client";

import { useRef, useState } from "react";
import { SendHorizontal, Sparkles } from "lucide-react";
import { focusRing } from "../styles";

const EXAMPLE_PROMPTS = [
  "Which imports need my attention?",
  "What documents are missing?",
  "What's arriving this week?",
  "Which shipments are waiting on customs?",
];

/**
 * Entry point to SUMIT, the importer's assistant. UI only for now: nothing is
 * sent anywhere, and submitting says so.
 */
export function SumitCard({ className = "" }: { className?: string }) {
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section
      aria-labelledby="ask-sumit"
      className={`rounded-2xl border border-teal/15 bg-teal-soft/60 p-5 sm:p-6 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal text-on-brand">
          <Sparkles className="size-4.5" />
        </span>
        <div>
          <h2 id="ask-sumit" className="text-base font-semibold tracking-tight text-ink">
            Ask SUMIT
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Get answers across your imports, documents, compliance and logistics.
          </p>
        </div>
      </div>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) setNotice(true);
        }}
      >
        <label htmlFor="sumit-question" className="sr-only">
          Ask SUMIT about your imports
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="sumit-question"
            type="text"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setNotice(false);
            }}
            placeholder="Ask about your imports..."
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            aria-label="Send question"
            className={`grid size-11 shrink-0 place-items-center rounded-xl bg-teal text-on-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
          >
            <SendHorizontal className="size-4.5" aria-hidden />
          </button>
        </div>
        <p role="status" className="mt-2 min-h-4 text-xs text-ink-muted">
          {notice && "SUMIT isn't connected yet — your question wasn't sent."}
        </p>
      </form>

      <ul aria-label="Example questions" className="mt-1 flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => {
                setQuestion(prompt);
                setNotice(false);
                inputRef.current?.focus();
              }}
              className={`rounded-full border border-line bg-surface px-3 py-1.5 text-left text-xs text-ink-muted transition hover:border-teal/40 hover:text-ink ${focusRing}`}
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
