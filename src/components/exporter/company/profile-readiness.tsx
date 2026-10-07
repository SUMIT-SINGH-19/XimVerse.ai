import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import type { ReadinessItem } from "@/lib/exporter-company";
import { Meter } from "./profile-ui";

export function ProfileReadiness({ completion, items }: { completion: number; items: readonly ReadinessItem[] }) {
  return (
    <section
      aria-labelledby="readiness-heading"
      className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(11,46,48,0.04)]"
    >
      <h2 id="readiness-heading" className="text-base font-semibold tracking-tight text-ink">
        Profile Readiness
      </h2>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-ink tabular-nums">{completion}%</span>
        <span className="text-sm font-medium text-ink-muted">Complete</span>
      </p>
      <Meter value={completion} label="Profile completion" className="mt-2" />
      <p className="mt-3 text-sm text-ink-muted">
        Complete your profile to improve opportunity matching and buyer trust.
      </p>

      <ul className="mt-4 space-y-0.5">
        {items.map((item) => (
          <li key={item.key}>
            <a
              href={`#${item.sectionId}`}
              className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-canvas ${focusRing}`}
            >
              {item.done ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-label="Done" />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-label="To do" />
              )}
              <span className={item.done ? "text-ink-muted" : "font-medium text-ink"}>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A single SUMIT suggestion. Static text until the assistant exists. */
export function SumitInsight({ title, insight }: { title: string; insight: string }) {
  return (
    <aside aria-label={title} className="rounded-2xl border border-teal/15 bg-teal-soft p-5">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal">
        <Sparkles className="size-3.5 text-orange" aria-hidden />
        {title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink">{insight}</p>
    </aside>
  );
}
