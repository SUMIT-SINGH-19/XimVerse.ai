/** Class strings shared by importer components (server and client alike). */

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export const primaryButton = `inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange px-5 text-sm font-semibold text-on-brand shadow-sm shadow-orange/20 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const secondaryButton = `inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink transition hover:border-teal/40 hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const ghostButton = `inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink-muted transition hover:bg-teal-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
