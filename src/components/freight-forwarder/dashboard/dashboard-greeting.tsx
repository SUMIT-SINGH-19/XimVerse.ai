"use client";

import { useState, useSyncExternalStore } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";

function greetingFor(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const noopSubscribe = () => () => {};

/** Greeting in the viewer's local time; the static HTML carries a neutral one. */
function useGreeting(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => greetingFor(new Date().getHours()),
    () => "Welcome back",
  );
}

type Pending = "quote" | "booking" | null;

const NOTICE: Record<Exclude<Pending, null>, string> = {
  quote: "Creating freight quotes from here is coming soon.",
  booking: "Raising carrier bookings from here is coming soon.",
};

/**
 * Page heading with the primary actions. Search, notifications and the
 * profile live in the workspace top bar, so they aren't repeated here.
 */
export function DashboardGreeting({ firstName }: { firstName: string }) {
  const greeting = useGreeting();
  const [pending, setPending] = useState<Pending>(null);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          {greeting}, {firstName}
        </h1>
        <p className="mt-2 text-base text-ink-muted">
          Here&apos;s what&apos;s happening across your freight operations today.
        </p>
      </div>

      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPending("booking")}
            aria-describedby={pending === "booking" ? "ff-greeting-notice" : undefined}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition hover:border-teal/40 hover:bg-teal-soft ${focusRing}`}
          >
            <CalendarPlus className="size-4" aria-hidden />
            New Booking
          </button>
          <button
            type="button"
            onClick={() => setPending("quote")}
            aria-describedby={pending === "quote" ? "ff-greeting-notice" : undefined}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-orange px-5 text-sm font-semibold text-on-brand shadow-sm shadow-orange/20 transition hover:brightness-95 ${focusRing}`}
          >
            <Plus className="size-4" aria-hidden strokeWidth={2.5} />
            Create Quote
          </button>
        </div>
        <p id="ff-greeting-notice" role="status" className="min-h-5 text-xs text-ink-muted">
          {pending && NOTICE[pending]}
        </p>
      </div>
    </div>
  );
}
