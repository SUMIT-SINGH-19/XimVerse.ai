"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, Bell, Menu, Search } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useT } from "@/i18n/client";
import { workspaceHref, workspacePageForPath, type WorkspaceConfig } from "@/lib/workspace-nav";
import { AssistantButton } from "./assistant-button";
import { focusRing, iconButton } from "./styles";

export function WorkspaceTopbar({
  config,
  actions,
  onOpenMenu,
  menuButtonRef,
}: {
  config: WorkspaceConfig;
  /** Role-specific controls, placed before the assistant button. */
  actions?: React.ReactNode;
  onOpenMenu: () => void;
  menuButtonRef: React.Ref<HTMLButtonElement>;
}) {
  const t = useT();
  const page = workspacePageForPath(config, usePathname());
  const { base, identity, assistant } = config;
  const searchId = `${config.key}-search`;
  const identityBody = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal text-sm font-semibold text-on-brand">
        {identity.initials}
      </span>
      <span className="hidden min-w-0 text-left 2xl:block">
        <span className="flex max-w-52 items-center gap-1 text-sm font-semibold text-ink">
          <span className="truncate">{identity.company}</span>
          {identity.badge && (
            <BadgeCheck className="size-4 shrink-0 text-teal" aria-label={t(identity.badge)} />
          )}
        </span>
        <span className="block text-xs text-ink-muted">{identity.location}</span>
      </span>
      <span className="sr-only 2xl:hidden">{identity.company}</span>
    </>
  );
  const identityClass = `flex items-center gap-3 rounded-lg p-1 sm:pr-2 ${focusRing}`;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur supports-backdrop-filter:bg-surface/80">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6 lg:px-8 xl:flex-nowrap">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onOpenMenu}
          aria-label={t("Open navigation")}
          className={`${iconButton} -ml-2 lg:hidden`}
        >
          <Menu className="size-5" aria-hidden />
        </button>

        <div className="min-w-0 flex-1 xl:flex-none xl:basis-56">
          {page?.group && (
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              {t(page.group)}
            </p>
          )}
          <p className="truncate text-lg font-semibold tracking-tight text-ink">
            {t(page?.label ?? config.roleLabel)}
          </p>
        </div>

        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="order-last w-full xl:order-0 xl:w-auto xl:flex-1 xl:max-w-xl"
        >
          <label htmlFor={searchId} className="sr-only">
            {t("Search the workspace")}
          </label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
            />
            <input
              id={searchId}
              type="search"
              placeholder={t(config.searchPlaceholder)}
              className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-teal focus:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
        </form>

        <div className="flex items-center gap-1 sm:gap-2 lg:ml-auto">
          <LanguageSwitcher compact />
          {actions}
          {assistant && <AssistantButton assistant={assistant} compact />}

          {config.notificationsSlug && (
            <Link
              href={workspaceHref(base, config.notificationsSlug)}
              aria-label={t("Notifications")}
              className={`${iconButton} relative`}
            >
              <Bell className="size-5" aria-hidden />
              <span aria-hidden className="absolute right-2.5 top-2.5 size-2 rounded-full bg-orange ring-2 ring-surface" />
            </Link>
          )}

          {config.profileSlug ? (
            <Link
              href={workspaceHref(base, config.profileSlug)}
              className={`${identityClass} transition-colors hover:bg-teal-soft`}
            >
              {identityBody}
            </Link>
          ) : (
            <div className={identityClass}>{identityBody}</div>
          )}
        </div>
      </div>
    </header>
  );
}
