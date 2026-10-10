/*
 * Languages the interface can be shown in.
 *
 * Each Indian language is a *mix* with English — Hinglish, Tanglish, Manglish
 * and so on — the way people actually talk about trade: everyday words in the
 * language's own script, while terms traders already use in English (RFQ,
 * quotation, HS code, FOB, customs) stay in English. Anything a dictionary
 * doesn't cover falls back to English, so a language can be partly translated.
 */

export const LOCALES = [
  { code: "en", nativeName: "English", mixName: "English" },
  { code: "hi", nativeName: "हिंदी", mixName: "Hinglish" },
  { code: "bn", nativeName: "বাংলা", mixName: "Banglish" },
  { code: "mr", nativeName: "मराठी", mixName: "Marathi + English" },
  { code: "te", nativeName: "తెలుగు", mixName: "Tenglish" },
  { code: "ta", nativeName: "தமிழ்", mixName: "Tanglish" },
  { code: "gu", nativeName: "ગુજરાતી", mixName: "Gujlish" },
  { code: "kn", nativeName: "ಕನ್ನಡ", mixName: "Kanglish" },
  { code: "ml", nativeName: "മലയാളം", mixName: "Manglish" },
  { code: "pa", nativeName: "ਪੰਜਾਬੀ", mixName: "Punglish" },
  { code: "or", nativeName: "ଓଡ଼ିଆ", mixName: "Odia + English" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie holding the viewer's chosen language. */
export const LOCALE_COOKIE = "locale";

const CODES = new Set<string>(LOCALES.map((l) => l.code));

export function isLocale(value: string): value is Locale {
  return CODES.has(value);
}

/**
 * First-visit guess from the browser's Accept-Language header: the highest
 * ranked language we support, by primary subtag ("ta-IN" → "ta"). A browser
 * that prefers English gets English even if it also lists an Indian language.
 */
export function matchAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { primary: tag.split("-")[0].toLowerCase(), q: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((l) => l.primary && l.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.map((l) => l.primary).find(isLocale) ?? DEFAULT_LOCALE;
}
