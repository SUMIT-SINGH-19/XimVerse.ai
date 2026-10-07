import Link from "next/link";
import { Logo } from "@/components/logo";
import { IMPORTER_BASE, IMPORTER_FOOTER_NAV, IMPORTER_NAV } from "@/lib/importer-nav";
import { ImporterNavItem } from "./importer-nav-item";
import { focusRing } from "./styles";

/**
 * Sidebar contents, shared by the persistent desktop rail and the mobile
 * drawer. `onNavigate` lets the drawer close itself when a link is followed.
 */
export function ImporterSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <Link
          href={IMPORTER_BASE}
          onClick={onNavigate}
          className={`inline-flex rounded-xl bg-white px-3 py-2 ${focusRing}`}
        >
          {/* The logo's teal lettering needs a white backdrop, even in dark mode. */}
          <Logo className="h-8! sm:h-8!" />
        </Link>
        <p className="mt-3 px-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
          Importer workspace
        </p>
      </div>

      <nav aria-label="Importer" className="flex-1 overflow-y-auto px-3 pb-4">
        {IMPORTER_NAV.map((group, i) => (
          <div key={group.label ?? i} className={i > 0 ? "mt-6" : undefined}>
            {group.label && (
              <h2 className="mb-1.5 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                {group.label}
              </h2>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.slug}>
                  <ImporterNavItem item={item} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <nav aria-label="Account" className="border-t border-line px-3 py-3">
        <ul className="space-y-0.5">
          {IMPORTER_FOOTER_NAV.map((item) => (
            <li key={item.slug}>
              <ImporterNavItem item={item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
