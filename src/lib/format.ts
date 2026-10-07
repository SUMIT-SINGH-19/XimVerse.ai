/*
 * Display formatting shared across the app. Dates are formatted in UTC with a
 * fixed locale so server and client render identical text.
 */

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
export function formatDaysAhead(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** How long before `now` an event happened: "12 min ago", "2 hr ago", "Yesterday". */
export function formatTimeAgo(at: string, now: string): string {
  const minutes = Math.floor((Date.parse(now) - Date.parse(at)) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  if (hours < 48) return "Yesterday";
  return formatDayMonth(at);
}
