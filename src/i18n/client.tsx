"use client";

import { createContext, use, useMemo } from "react";
import { DEFAULT_LOCALE, type Locale } from "./locales";
import { createTranslator, type Messages, type Translate, type TranslateVars } from "./translate";

/*
 * Client-side access to the viewer's language. The root layout passes in only
 * the current language's dictionary, so the others never reach the browser.
 */

const LocaleContext = createContext<{ locale: Locale; t: Translate }>({
  locale: DEFAULT_LOCALE,
  t: createTranslator({}),
});

export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: createTranslator(messages) }), [locale, messages]);
  return <LocaleContext value={value}>{children}</LocaleContext>;
}

export function useLocale(): Locale {
  return use(LocaleContext).locale;
}

/** Translator for client components: `const t = useT();` */
export function useT(): Translate {
  return use(LocaleContext).t;
}

/**
 * Translated text as an element, for components rendered from both server and
 * client components (where neither getT nor useT fits): `<T>Coming soon</T>`.
 */
export function T({ children, vars }: { children: string; vars?: TranslateVars }) {
  return useT()(children, vars);
}
