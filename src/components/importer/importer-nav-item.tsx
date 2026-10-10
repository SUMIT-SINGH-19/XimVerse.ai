"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";
import { IMPORTER_BASE, importerHref, type ImporterNavItem as NavItem } from "@/lib/importer-nav";
import { focusRing } from "./styles";

function isActive(pathname: string, href: string): boolean {
  if (href === IMPORTER_BASE) return pathname === IMPORTER_BASE;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ImporterNavItem({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const t = useT();
  const pathname = usePathname();
  const href = importerHref(item.slug);
  const active = isActive(pathname, href);
  const Icon = item.icon;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${focusRing}
        ${active ? "bg-teal text-on-brand shadow-sm shadow-teal/20" : "text-ink-muted hover:bg-teal-soft hover:text-ink"}`}
    >
      <Icon
        aria-hidden
        className={`size-4.5 shrink-0 ${active ? "text-orange-soft" : "text-ink-faint group-hover:text-teal"}`}
      />
      <span className="truncate">{t(item.label)}</span>
      {active && (
        <span aria-hidden className="ml-auto size-1.5 shrink-0 rounded-full bg-orange" />
      )}
    </Link>
  );
}
