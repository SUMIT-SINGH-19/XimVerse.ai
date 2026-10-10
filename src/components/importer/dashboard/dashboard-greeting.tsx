"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useT } from "@/i18n/client";
import { importerHref } from "@/lib/importer-nav";
import { primaryButton } from "../styles";

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

export function DashboardGreeting() {
  const t = useT();
  const greeting = t(useGreeting());

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">{greeting}</h1>
        <p className="mt-2 text-base text-ink-muted">
          {t("Here's what needs your attention across your imports.")}
        </p>
      </div>

      <Link href={importerHref("rfqs/new")} className={`${primaryButton} self-start sm:self-auto`}>
        <Plus className="size-4" aria-hidden strokeWidth={2.5} />
        {t("New Import Requirement")}
      </Link>
    </div>
  );
}
