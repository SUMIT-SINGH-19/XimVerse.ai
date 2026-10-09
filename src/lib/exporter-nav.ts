import {
  BarChart3,
  Bell,
  Building2,
  FolderOpen,
  Handshake,
  LayoutDashboard,
  MessagesSquare,
  Package,
  PackageCheck,
  Radar,
  ReceiptText,
  Scale,
  Settings,
  Ship,
  Users,
} from "lucide-react";
import {
  findWorkspacePage,
  workspaceHref,
  workspacePages,
  type WorkspaceConfig,
} from "./workspace-nav";

export const EXPORTER_BASE = "/exporter";

/** The exporter workspace: supply side of the marketplace. */
export const EXPORTER_WORKSPACE: WorkspaceConfig = {
  key: "exporter",
  roleLabel: "Exporter",
  base: EXPORTER_BASE,
  nav: [
    { items: [{ slug: "", label: "Overview", icon: LayoutDashboard }] },
    {
      label: "Trade",
      items: [
        { slug: "opportunities", label: "Buyer Opportunities", icon: Radar },
        { slug: "quotations", label: "My Quotations", icon: ReceiptText },
        { slug: "negotiations", label: "Negotiations", icon: Scale },
        { slug: "deals", label: "Deals", icon: Handshake },
      ],
    },
    {
      label: "Catalogue",
      items: [{ slug: "products", label: "Products", icon: Package }],
    },
    {
      label: "Operations",
      items: [
        { slug: "orders", label: "Orders", icon: PackageCheck },
        { slug: "shipments", label: "Shipments", icon: Ship },
        { slug: "documents", label: "Documents", icon: FolderOpen },
      ],
    },
    {
      label: "Workspace",
      items: [
        { slug: "messages", label: "Messages", icon: MessagesSquare },
        { slug: "notifications", label: "Notifications", icon: Bell },
        { slug: "analytics", label: "Analytics", icon: BarChart3 },
      ],
    },
  ],
  footerLabel: "Account",
  footerNav: [
    { slug: "company", label: "Company Profile", icon: Building2 },
    { slug: "team", label: "Team", icon: Users },
    { slug: "settings", label: "Settings", icon: Settings },
  ],
  searchPlaceholder: "Search opportunities, quotations, orders…",
  // Placeholder identity until authentication exists.
  identity: {
    company: "Shree Agro Exports Pvt Ltd",
    location: "Haryana, India",
    initials: "SA",
    user: "Demo User",
    badge: "Verified Exporter",
  },
  assistant: { label: "Ask SUMIT", name: "SUMIT AI" },
  notificationsSlug: "notifications",
  profileSlug: "company",
};

export const EXPORTER_PAGES = workspacePages(EXPORTER_WORKSPACE);

export function exporterHref(slug: string): string {
  return workspaceHref(EXPORTER_BASE, slug);
}

export function findExporterPage(slug: string) {
  return findWorkspacePage(EXPORTER_WORKSPACE, slug);
}
