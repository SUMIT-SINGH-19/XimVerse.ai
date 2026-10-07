"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search, Sparkles } from "lucide-react";
import { importerHref, importerPageForPath, PLACEHOLDER_IMPORTER } from "@/lib/importer-nav";
import { focusRing } from "./styles";

const iconButton = `grid size-10 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-teal-soft hover:text-ink ${focusRing}`;

export function ImporterTopbar({
  onOpenMenu,
  menuButtonRef,
}: {
  onOpenMenu: () => void;
  menuButtonRef: React.Ref<HTMLButtonElement>;
}) {
  const page = importerPageForPath(usePathname());

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur supports-backdrop-filter:bg-surface/80">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6 lg:flex-nowrap lg:px-8">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation"
          className={`${iconButton} -ml-2 lg:hidden`}
        >
          <Menu className="size-5" aria-hidden />
        </button>

        <div className="min-w-0 flex-1 lg:flex-none lg:basis-56">
          {page?.group && (
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              {page.group}
            </p>
          )}
          <p className="truncate text-lg font-semibold tracking-tight text-ink">
            {page?.label ?? "Importer"}
          </p>
        </div>

        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="order-last w-full md:order-0 md:w-auto md:flex-1 lg:max-w-xl"
        >
          <label htmlFor="importer-search" className="sr-only">
            Search the workspace
          </label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
            />
            <input
              id="importer-search"
              type="search"
              placeholder="Search RFQs, suppliers, shipments…"
              className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
        </form>

        <div className="flex items-center gap-1 sm:gap-2 lg:ml-auto">
          <button
            type="button"
            aria-label="Ask SUMIT"
            className={`inline-flex h-10 items-center gap-2 rounded-lg bg-orange px-3 text-sm font-semibold text-on-brand shadow-sm shadow-orange/20 transition hover:brightness-95 sm:px-4 ${focusRing}`}
          >
            <Sparkles className="size-4" aria-hidden />
            <span className="hidden sm:inline">Ask SUMIT</span>
          </button>

          <Link href={importerHref("notifications")} aria-label="Notifications" className={`${iconButton} relative`}>
            <Bell className="size-5" aria-hidden />
            <span aria-hidden className="absolute right-2.5 top-2.5 size-2 rounded-full bg-orange ring-2 ring-surface" />
          </Link>

          <Link
            href={importerHref("company")}
            className={`flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-teal-soft sm:pr-2 ${focusRing}`}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal text-sm font-semibold text-on-brand">
              {PLACEHOLDER_IMPORTER.initials}
            </span>
            <span className="hidden min-w-0 text-left xl:block">
              <span className="block max-w-44 truncate text-sm font-semibold text-ink">
                {PLACEHOLDER_IMPORTER.company}
              </span>
              <span className="block text-xs text-ink-muted">{PLACEHOLDER_IMPORTER.location}</span>
            </span>
            <span className="sr-only xl:hidden">{PLACEHOLDER_IMPORTER.company}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
