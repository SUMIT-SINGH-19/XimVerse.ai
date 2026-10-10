"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/client";
import type { WorkspaceConfig } from "@/lib/workspace-nav";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { WorkspaceTopbar } from "./workspace-topbar";
import { focusRing } from "./styles";

/**
 * Frame of a role workspace: a persistent sidebar on large screens, a slide-in
 * drawer below that, and the top bar above the page content.
 *
 * The config holds icon components, which can't cross from a server component
 * into this one, so render the shell from a client module that imports the
 * config directly (see components/exporter/exporter-workspace.tsx).
 */
export function WorkspaceShell({
  config,
  topbarActions,
  children,
}: {
  config: WorkspaceConfig;
  topbarActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const menuButton = menuButtonRef.current;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    // The drawer is only for small screens; drop it if the viewport grows.
    const desktop = window.matchMedia("(min-width: 64rem)");
    const onResize = () => desktop.matches && setMenuOpen(false);

    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onResize);
      menuButton?.focus();
    };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-line bg-surface lg:block">
        <WorkspaceSidebar config={config} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            aria-hidden
            onClick={close}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] motion-safe:animate-fade-in"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("Navigation")}
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-2xl motion-safe:animate-drawer-in"
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              aria-label={t("Close navigation")}
              className={`absolute right-3 top-4 z-10 grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-teal-soft hover:text-ink ${focusRing}`}
            >
              <X className="size-5" aria-hidden />
            </button>
            <WorkspaceSidebar config={config} onNavigate={close} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopbar
          config={config}
          actions={topbarActions}
          onOpenMenu={() => setMenuOpen(true)}
          menuButtonRef={menuButtonRef}
        />
        <main id={`${config.key}-main`} className="flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
