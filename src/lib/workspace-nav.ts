import type { LucideIcon } from "lucide-react";

/*
 * Role-independent description of a workspace (importer, exporter, …): its
 * routes, navigation and the identity shown in the chrome. The components in
 * src/components/workspace/ render whatever a WorkspaceConfig describes, so a
 * new role needs a config, not a new shell.
 */

export interface WorkspaceNavItem {
  /** URL segment under the workspace base; empty for the overview itself. */
  slug: string;
  label: string;
  icon: LucideIcon;
}

export interface WorkspaceNavGroup {
  /** Section heading shown in the sidebar; omitted for ungrouped items. */
  label?: string;
  items: readonly WorkspaceNavItem[];
}

/** Who is signed in. Placeholder data until authentication exists. */
export interface WorkspaceIdentity {
  company: string;
  location: string;
  initials: string;
  user?: string;
  /** Short status shown beside the company, e.g. "Verified Exporter". */
  badge?: string;
}

export interface WorkspaceAssistant {
  /** Call to action, e.g. "Ask SUMIT". */
  label: string;
  /** Product name of the assistant, e.g. "SUMIT AI". */
  name: string;
  /** Where the assistant opens; without one the entry is a plain button. */
  href?: string;
}

export interface WorkspaceConfig {
  /** Stable key, used for element ids and accessible names. */
  key: string;
  /** Human name of the role, e.g. "Exporter". */
  roleLabel: string;
  /** Route the workspace lives under, e.g. "/exporter". */
  base: string;
  nav: readonly WorkspaceNavGroup[];
  /** Links pinned to the bottom of the sidebar. */
  footerNav: readonly WorkspaceNavItem[];
  /** Heading the footer links are grouped under in page lookups. */
  footerLabel: string;
  searchPlaceholder: string;
  identity: WorkspaceIdentity;
  assistant?: WorkspaceAssistant;
  /** Slug the topbar bell links to. */
  notificationsSlug?: string;
  /** Slug the topbar identity chip links to. */
  profileSlug?: string;
}

export interface ResolvedNavItem extends WorkspaceNavItem {
  href: string;
  /** Heading of the sidebar group it belongs to, if any. */
  group?: string;
}

export function workspaceHref(base: string, slug: string): string {
  return slug ? `${base}/${slug}` : base;
}

/** Every destination in the workspace, flattened. */
export function workspacePages(config: WorkspaceConfig): ResolvedNavItem[] {
  return [
    ...config.nav.flatMap((g) =>
      g.items.map((item) => ({ ...item, href: workspaceHref(config.base, item.slug), group: g.label })),
    ),
    ...config.footerNav.map((item) => ({
      ...item,
      href: workspaceHref(config.base, item.slug),
      group: config.footerLabel,
    })),
  ];
}

export function findWorkspacePage(config: WorkspaceConfig, slug: string): ResolvedNavItem | undefined {
  return workspacePages(config).find((p) => p.slug === slug);
}

/** Resolves the page for a pathname, matching nested paths to their section. */
export function workspacePageForPath(
  config: WorkspaceConfig,
  pathname: string,
): ResolvedNavItem | undefined {
  const rest = pathname.replace(/\/+$/, "").slice(config.base.length).replace(/^\//, "");
  return findWorkspacePage(config, rest.split("/")[0] ?? "");
}

export function isNavItemActive(base: string, pathname: string, href: string): boolean {
  if (href === base) return pathname === base;
  return pathname === href || pathname.startsWith(`${href}/`);
}
