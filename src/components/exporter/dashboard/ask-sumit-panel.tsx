import { Sparkles } from "lucide-react";
import { AssistantButton } from "@/components/workspace/assistant-button";
import { focusRing } from "@/components/workspace/styles";
import type { WorkspaceAssistant } from "@/lib/workspace-nav";

/**
 * Entry to the SUMIT assistant with suggested questions. Nothing is wired up
 * yet: the prompts and button are presentational until the assistant exists.
 */
export function AskSumitPanel({
  assistant,
  prompts,
}: {
  assistant: WorkspaceAssistant;
  prompts: readonly string[];
}) {
  return (
    <section
      aria-labelledby="ask-sumit-heading"
      className="relative overflow-hidden rounded-2xl bg-teal p-5 text-on-brand sm:p-6"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full border-[14px] border-orange/25"
      />
      <p className="relative inline-flex items-center gap-1.5 rounded-full bg-on-brand/10 px-2.5 py-1 text-xs font-semibold">
        <Sparkles className="size-3.5 text-orange-soft" aria-hidden />
        {assistant.name}
      </p>
      <h2 id="ask-sumit-heading" className="relative mt-3 text-lg font-semibold tracking-tight">
        {assistant.label}
      </h2>
      <p className="relative mt-1 text-sm leading-relaxed text-on-brand/75">
        Your AI trade assistant for buyer opportunities, quotations, compliance and shipment workflows.
      </p>

      <ul aria-label="Suggested questions" className="relative mt-4 space-y-2">
        {prompts.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              className={`w-full rounded-lg bg-on-brand/10 px-3 py-2 text-left text-sm text-on-brand transition-colors hover:bg-on-brand/15 ${focusRing} focus-visible:ring-offset-teal`}
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>

      <AssistantButton assistant={assistant} className="relative mt-4 w-full" />
    </section>
  );
}
