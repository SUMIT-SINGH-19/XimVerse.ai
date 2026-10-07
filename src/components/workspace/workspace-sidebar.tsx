import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import type { WorkspaceConfig } from "@/lib/workspace-nav";
import { WorkspaceNavItem } from "./workspace-nav-item";
import { AssistantButton } from "./assistant-button";
import { focusRing } from "./styles";

/**
 * Sidebar contents, shared by the persistent desktop rail and the mobile
 * drawer. `onNavigate` lets the drawer close itself when a link is followed.
 */
export function WorkspaceSidebar({
  config,
  onNavigate,
}: {
  config: WorkspaceConfig;
  onNavigate?: () => void;
}) {
  const { base, assistant } = config;

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <Link href={base} onClick={onNavigate} className={`inline-flex rounded-xl bg-white px-3 py-2 ${focusRing}`}>
          {/* The logo's teal lettering needs a white backdrop, even in dark mode. */}
          <Logo className="h-8! sm:h-8!" />
        </Link>
        <p className="mt-3 px-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
          {config.roleLabel} workspace
        </p>
      </div>

      <nav aria-label={config.roleLabel} className="flex-1 overflow-y-auto px-3 pb-4">
        {config.nav.map((group, i) => (
          <div key={group.label ?? i} className={i > 0 ? "mt-6" : undefined}>
            {group.label && (
              <h2 className="mb-1.5 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                {group.label}
              </h2>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.slug}>
                  <WorkspaceNavItem base={base} item={item} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {assistant && (
        <div className="px-3 pb-3">
          <div className="rounded-xl bg-teal-soft p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-teal">
              <Sparkles className="size-3.5" aria-hidden />
              {assistant.name}
            </p>
            <AssistantButton assistant={assistant} className="mt-2 w-full" />
          </div>
        </div>
      )}

      <nav aria-label={config.footerLabel} className="border-t border-line px-3 py-3">
        <ul className="space-y-0.5">
          {config.footerNav.map((item) => (
            <li key={item.slug}>
              <WorkspaceNavItem base={base} item={item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
