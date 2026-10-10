"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/i18n/client";

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const noSubscription = () => () => {};

/**
 * Time-of-day greeting in the viewer's own timezone. The page is prerendered,
 * so the server renders a neutral greeting and the browser fills in the real one.
 */
export function Greeting() {
  const t = useT();
  const greeting = t(useSyncExternalStore(noSubscription, greetingForNow, () => "Welcome back"));

  return (
    <p className="text-sm text-ink-muted">
      <span className="font-semibold text-ink">{greeting}</span>
      <span aria-hidden className="mx-2 text-ink-faint">·</span>
      {t("Here's what's happening with your export business today.")}
    </p>
  );
}
