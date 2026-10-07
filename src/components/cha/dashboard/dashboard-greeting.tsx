"use client";

import { useSyncExternalStore } from "react";
import { Building2, CalendarDays, MapPin, TriangleAlert } from "lucide-react";

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

export function DashboardGreeting({
  firstName,
  company,
  location,
  dateLabel,
  attentionCount,
}: {
  firstName: string;
  company: string;
  location: string;
  /** e.g. "Wednesday, 7 October 2026". */
  dateLabel: string;
  /** Shipments with an open action. */
  attentionCount: number;
}) {
  const greeting = useGreeting();

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          {greeting}, {firstName}
        </h1>
        <p className="mt-2 text-base text-ink-muted">
          Here&apos;s what needs your attention across today&apos;s customs operations.
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-muted">
          <li className="inline-flex items-center gap-1.5">
            <Building2 aria-hidden className="size-4 text-ink-faint" />
            {company}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <MapPin aria-hidden className="size-4 text-ink-faint" />
            {location}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden className="size-4 text-ink-faint" />
            {dateLabel}
          </li>
        </ul>
      </div>

      {attentionCount > 0 && (
        <p className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-orange-soft px-4 py-2.5 text-sm font-semibold text-orange lg:self-auto">
          <TriangleAlert aria-hidden className="size-4" />
          {attentionCount} {attentionCount === 1 ? "shipment requires" : "shipments require"} your
          attention today
        </p>
      )}
    </div>
  );
}
