"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavItemActive, workspaceHref, type WorkspaceNavItem as NavItem } from "@/lib/workspace-nav";
import { focusRing } from "./styles";

export function WorkspaceNavItem({
  base,
  item,
  onNavigate,
}: {
  base: string;
  item: NavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const href = workspaceHref(base, item.slug);
  const active = isNavItemActive(base, pathname, href);
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
      <span className="truncate">{item.label}</span>
      {active && <span aria-hidden className="ml-auto size-1.5 shrink-0 rounded-full bg-orange" />}
    </Link>
  );
}
