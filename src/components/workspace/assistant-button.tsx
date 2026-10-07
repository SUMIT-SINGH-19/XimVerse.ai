import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { WorkspaceAssistant } from "@/lib/workspace-nav";
import { focusRing } from "./styles";

/**
 * Entry point to the AI assistant. It has nowhere to go until the assistant
 * exists, so without an href it renders as an inert button.
 */
export function AssistantButton({
  assistant,
  compact = false,
  className = "",
}: {
  assistant: WorkspaceAssistant;
  /** Hide the label below the sm breakpoint. */
  compact?: boolean;
  className?: string;
}) {
  const classes = `inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange px-3 text-sm font-semibold text-on-brand shadow-sm shadow-orange/20 transition hover:brightness-95 sm:px-4 ${focusRing} ${className}`;
  const content = (
    <>
      <Sparkles className="size-4" aria-hidden />
      <span className={compact ? "hidden sm:inline" : undefined}>{assistant.label}</span>
    </>
  );

  return assistant.href ? (
    <Link href={assistant.href} aria-label={assistant.label} className={classes}>
      {content}
    </Link>
  ) : (
    <button type="button" aria-label={assistant.label} className={classes}>
      {content}
    </button>
  );
}
