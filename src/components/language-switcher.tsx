"use client";

import { useOptimistic, useTransition } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import { useLocale, useT } from "@/i18n/client";
import { isLocale, LOCALES } from "@/i18n/locales";

/**
 * Language picker: a native <select> laid invisibly over a compact chip, so
 * phones get their own picker and screen readers a standard control.
 */
export function LanguageSwitcher({
  compact = false,
  className = "",
}: {
  /** Show only the icon below the sm breakpoint. */
  compact?: boolean;
  className?: string;
}) {
  const t = useT();
  const [locale, setOptimisticLocale] = useOptimistic(useLocale());
  const [pending, startTransition] = useTransition();
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <label
      className={`relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-sm font-medium text-ink transition-colors hover:border-teal/40 hover:bg-teal-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-canvas ${
        pending ? "opacity-60" : ""
      } ${className}`}
    >
      <Languages className="size-4 shrink-0 text-teal" aria-hidden />
      <span aria-hidden className={compact ? "hidden sm:inline" : undefined}>
        {current.nativeName}
      </span>
      <ChevronDown className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
      <select
        value={locale}
        aria-label={t("Language")}
        onChange={(e) => {
          const next = e.target.value;
          if (!isLocale(next)) return;
          startTransition(async () => {
            setOptimisticLocale(next);
            await setLocale(next);
          });
        }}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.code === "en" ? l.nativeName : `${l.nativeName} · ${l.mixName}`}
          </option>
        ))}
      </select>
    </label>
  );
}
