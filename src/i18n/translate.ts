/*
 * The English text is the lookup key: t("Action Required") returns the
 * current language's version, or the English itself when there isn't one.
 * Placeholders in braces are filled from `vars`:
 *   t("{count} open", { count: 3 })
 */

/** English source text → translation. Partial by design; gaps fall back to English. */
export type Messages = Readonly<Record<string, string>>;

export type TranslateVars = Readonly<Record<string, string | number>>;

export type Translate = (text: string, vars?: TranslateVars) => string;

export function createTranslator(messages: Messages): Translate {
  return (text, vars) => {
    const template = Object.hasOwn(messages, text) ? messages[text] : text;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      Object.hasOwn(vars, name) ? String(vars[name]) : match,
    );
  };
}
