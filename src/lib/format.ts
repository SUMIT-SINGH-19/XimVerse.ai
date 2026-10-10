import { createTranslator, type Translate } from "@/i18n/translate";

/*
 * Display formatting shared across the app. Dates are formatted in UTC with a
 * fixed locale so server and client render identical text. Relative phrases
 * take an optional translator (getT / useT) and default to English.
 */

const english = createTranslator({});

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "2026-10-14" → "14 Oct". */
export function formatDayMonth(date: string): string {
  return dayMonth.format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

const fullDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-11-30" → "30 Nov 2026". */
export function formatDate(date: string): string {
  return fullDate.format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

/** "in 7 days", "tomorrow", "today". */
export function formatDaysAhead(days: number, t: Translate = english): string {
  if (days <= 0) return t("today");
  if (days === 1) return t("tomorrow");
  return t("in {days} days", { days });
}

/** How long before `now` an event happened: "12 min ago", "2 hr ago", "Yesterday". */
export function formatTimeAgo(at: string, now: string, t: Translate = english): string {
  const minutes = Math.floor((Date.parse(now) - Date.parse(at)) / 60_000);
  if (minutes < 1) return t("Just now");
  if (minutes < 60) return t("{minutes} min ago", { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{hours} hr ago", { hours });
  if (hours < 48) return t("Yesterday");
  return formatDayMonth(at);
}
