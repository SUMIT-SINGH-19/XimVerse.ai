import {
  Anchor,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarCheck,
  Contact,
  CreditCard,
  FileInput,
  FileStack,
  FileText,
  Inbox,
  LayoutDashboard,
  Plug,
  Radar,
  ReceiptIndianRupee,
  ReceiptText,
  Settings,
  Ship,
  ShieldCheck,
  Sparkles,
  Tags,
  Truck,
  Users,
} from "lucide-react";
import {
  findWorkspacePage,
  workspaceHref,
  workspacePages,
  type WorkspaceConfig,
} from "./workspace-nav";

export const FREIGHT_FORWARDER_BASE = "/freight-forwarder";

/** The freight forwarder workspace: quoting, booking and moving cargo for shippers. */
export const FREIGHT_FORWARDER_WORKSPACE: WorkspaceConfig = {
  key: "freight-forwarder",
  roleLabel: "Freight Forwarder",
  base: FREIGHT_FORWARDER_BASE,
  nav: [
    { items: [{ slug: "", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "Operations",
      items: [
        { slug: "rfqs", label: "RFQs", icon: Inbox },
        { slug: "quotes", label: "Quotes", icon: ReceiptText },
        { slug: "shipments", label: "Shipments", icon: Ship },
        { slug: "bookings", label: "Bookings", icon: CalendarCheck },
        { slug: "tracking", label: "Tracking", icon: Radar },
        { slug: "cargo", label: "Containers / Cargo", icon: Boxes },
      ],
    },
    {
      label: "Coordination",
      items: [
        { slug: "customers", label: "Exporters / Customers", icon: Contact },
        { slug: "cha", label: "CHA Coordination", icon: ShieldCheck },
        { slug: "carriers", label: "Carriers", icon: Anchor },
        { slug: "transporters", label: "Transporters", icon: Truck },
      ],
    },
    {
      label: "Documents",
      items: [
        { slug: "documents", label: "Shipment Documents", icon: FileStack },
        { slug: "bl-awb", label: "BL / AWB", icon: FileText },
        { slug: "document-requests", label: "Document Requests", icon: FileInput },
      ],
    },
    {
      label: "Commercial",
      items: [
        { slug: "rates", label: "Rates", icon: Tags },
        { slug: "invoices", label: "Invoices", icon: ReceiptIndianRupee },
        { slug: "payments", label: "Payments", icon: CreditCard },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { slug: "reports", label: "Reports", icon: BarChart3 },
        { slug: "sumit", label: "SUMIT", icon: Sparkles },
      ],
    },
  ],
  footerLabel: "Company",
  footerNav: [
    { slug: "company", label: "Company Profile", icon: Building2 },
    { slug: "team", label: "Team", icon: Users },
    { slug: "integrations", label: "Integrations", icon: Plug },
    { slug: "notifications", label: "Notifications", icon: Bell },
    { slug: "settings", label: "Settings", icon: Settings },
  ],
  searchPlaceholder: "Search shipments, RFQs, containers, BL / AWB…",
  // Placeholder identity until authentication exists.
  identity: {
    company: "Bluewater Freight Solutions",
    location: "Bengaluru, India",
    initials: "BF",
    user: "Rahul Menon",
    badge: "Verified Freight Forwarder",
  },
  assistant: { label: "Ask SUMIT", name: "SUMIT AI", href: `${FREIGHT_FORWARDER_BASE}/sumit` },
  notificationsSlug: "notifications",
  profileSlug: "company",
};

export const FREIGHT_FORWARDER_PAGES = workspacePages(FREIGHT_FORWARDER_WORKSPACE);

export function freightForwarderHref(slug: string): string {
  return workspaceHref(FREIGHT_FORWARDER_BASE, slug);
}

export function findFreightForwarderPage(slug: string) {
  return findWorkspacePage(FREIGHT_FORWARDER_WORKSPACE, slug);
}
