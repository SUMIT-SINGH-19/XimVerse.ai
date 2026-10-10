import { cache } from "react";
import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE, matchAcceptLanguage, type Locale } from "./locales";
import { MESSAGES } from "./messages";
import { createTranslator, type Messages, type Translate } from "./translate";

/*
 * Server-side access to the viewer's language. Reading the cookie makes routes
 * render per request, which the workspaces will do anyway once they sit
 * behind sign-in.
 */

/** The saved choice, else the browser's preference, else English. Read once per request. */
export const getLocale = cache(async (): Promise<Locale> => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (saved && isLocale(saved)) return saved;
  return matchAcceptLanguage((await headers()).get("accept-language"));
});

export async function getMessages(): Promise<Messages> {
  return MESSAGES[await getLocale()];
}

/** Translator for async server components: `const t = await getT();` */
export async function getT(): Promise<Translate> {
  return createTranslator(await getMessages());
}
