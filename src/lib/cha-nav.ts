import {
  Bell,
  BriefcaseBusiness,
  Building2,
  Contact,
  FileStack,
  FolderOpen,
  LayoutDashboard,
  MessageSquareWarning,
  MessagesSquare,
  ScanSearch,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  findWorkspacePage,
  workspaceHref,
  workspacePages,
  type WorkspaceConfig,
} from "./workspace-nav";

export const CHA_BASE = "/cha";

/** The CHA workspace: customs clearance on behalf of importers and exporters. */
export const CHA_WORKSPACE: WorkspaceConfig = {
  key: "cha",
  roleLabel: "CHA",
  base: CHA_BASE,
  nav: [
    { items: [{ slug: "", label: "Overview", icon: LayoutDashboard }] },
    {
      label: "Clearance",
      items: [
        { slug: "shipments", label: "Shipments", icon: BriefcaseBusiness },
        { slug: "filings", label: "Filings", icon: FileStack },
        { slug: "queries", label: "Customs Queries", icon: MessageSquareWarning },
        { slug: "examinations", label: "Examinations", icon: ScanSearch },
      ],
    },
    {
      label: "Operations",
      items: [
        { slug: "documents", label: "Documents", icon: FolderOpen },
        { slug: "compliance", label: "Compliance", icon: ShieldCheck },
      ],
    },
    {
      label: "Workspace",
      items: [
        { slug: "clients", label: "Clients", icon: Contact },
        { slug: "messages", label: "Messages", icon: MessagesSquare },
        { slug: "notifications", label: "Notifications", icon: Bell },
      ],
    },
  ],
  footerLabel: "Account",
  footerNav: [
    { slug: "company", label: "Company Profile", icon: Building2 },
    { slug: "team", label: "Team", icon: Users },
    { slug: "settings", label: "Settings", icon: Settings },
  ],
  searchPlaceholder: "Search shipments, clients, SB / BE numbers…",
  // Placeholder identity until authentication exists.
  identity: {
    company: "Sahyadri Customs Services",
    location: "JNPA, Navi Mumbai",
    initials: "SC",
    user: "Rajesh Iyer",
    badge: "Licensed Customs Broker",
  },
  assistant: { label: "Ask Sumit", name: "Sumit AI" },
  notificationsSlug: "notifications",
  profileSlug: "company",
};

export const CHA_PAGES = workspacePages(CHA_WORKSPACE);

export function chaHref(slug: string): string {
  return workspaceHref(CHA_BASE, slug);
}

export function findChaPage(slug: string) {
  return findWorkspacePage(CHA_WORKSPACE, slug);
}
