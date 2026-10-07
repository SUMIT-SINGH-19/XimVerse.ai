import {
  Bell,
  Building2,
  Calculator,
  ChartColumn,
  Container,
  Factory,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Lightbulb,
  MapPinned,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  Ship,
  Stamp,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const IMPORTER_BASE = "/importer";

export interface ImporterNavItem {
  /** URL segment under /importer; empty for the overview itself. */
  slug: string;
  label: string;
  icon: LucideIcon;
}

export interface ImporterNavGroup {
  /** Section heading shown in the sidebar; omitted for ungrouped items. */
  label?: string;
  items: readonly ImporterNavItem[];
}

/** Main navigation of the importer workspace, in sidebar order. */
export const IMPORTER_NAV: readonly ImporterNavGroup[] = [
  { items: [{ slug: "", label: "Overview", icon: LayoutDashboard }] },
  {
    label: "Trade",
    items: [
      { slug: "rfqs", label: "RFQs", icon: FileText },
      { slug: "quotations", label: "Quotations", icon: ReceiptText },
      { slug: "orders", label: "Orders", icon: Package },
      { slug: "shipments", label: "Shipments", icon: Ship },
    ],
  },
  {
    label: "Network",
    items: [
      { slug: "suppliers", label: "Suppliers", icon: Factory },
      { slug: "customs-brokers", label: "Customs Brokers", icon: Stamp },
      { slug: "freight-forwarders", label: "Freight Forwarders", icon: Container },
      { slug: "logistics-partners", label: "Logistics Partners", icon: Truck },
    ],
  },
  {
    label: "Operations",
    items: [
      { slug: "documents", label: "Documents", icon: FolderOpen },
      { slug: "compliance", label: "Compliance", icon: ShieldCheck },
      { slug: "customs", label: "Customs", icon: Building2 },
      { slug: "tracking", label: "Tracking", icon: MapPinned },
    ],
  },
  {
    label: "Finance",
    items: [
      { slug: "landed-cost", label: "Landed Cost", icon: Calculator },
      { slug: "payments", label: "Payments", icon: Wallet },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { slug: "reports", label: "Reports", icon: ChartColumn },
      { slug: "trade-insights", label: "Trade Insights", icon: Lightbulb },
    ],
  },
];

/** Account-level links pinned to the bottom of the sidebar. */
export const IMPORTER_FOOTER_NAV: readonly ImporterNavItem[] = [
  { slug: "notifications", label: "Notifications", icon: Bell },
  { slug: "company", label: "Company", icon: Building2 },
  { slug: "team", label: "Team", icon: Users },
  { slug: "settings", label: "Settings", icon: Settings },
];

export interface ResolvedNavItem extends ImporterNavItem {
  href: string;
  /** Heading of the sidebar group it belongs to, if any. */
  group?: string;
}

export function importerHref(slug: string): string {
  return slug ? `${IMPORTER_BASE}/${slug}` : IMPORTER_BASE;
}

/** Every destination in the workspace, flattened. */
export const IMPORTER_PAGES: readonly ResolvedNavItem[] = [
  ...IMPORTER_NAV.flatMap((g) =>
    g.items.map((item) => ({ ...item, href: importerHref(item.slug), group: g.label })),
  ),
  ...IMPORTER_FOOTER_NAV.map((item) => ({ ...item, href: importerHref(item.slug), group: "Account" })),
];

export function findImporterPage(slug: string): ResolvedNavItem | undefined {
  return IMPORTER_PAGES.find((p) => p.slug === slug);
}

/** Resolves the page for a pathname, matching nested paths to their section. */
export function importerPageForPath(pathname: string): ResolvedNavItem | undefined {
  const rest = pathname.replace(/\/+$/, "").slice(IMPORTER_BASE.length).replace(/^\//, "");
  return findImporterPage(rest.split("/")[0] ?? "");
}

/**
 * Placeholder identity until authentication exists. Replace with the signed-in
 * organisation once there is a backend.
 */
export const PLACEHOLDER_IMPORTER = {
  company: "Meridian Imports Pvt. Ltd.",
  location: "Mumbai, India",
  user: "Demo User",
  initials: "MI",
} as const;
