import { FileCheck2, Globe2, Ship, Truck, type LucideIcon } from "lucide-react";

export type RoleSlug = "exporter" | "importer" | "cha" | "freight-forwarder";

export interface Role {
  slug: RoleSlug;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Where "Continue" leads; roles without a workspace yet have none. */
  href?: string;
}

/** The four stakeholders shown on the role-selection screen, in display order. */
export const ROLES: readonly Role[] = [
  {
    slug: "exporter",
    title: "Exporter",
    description: "Sell goods abroad and manage shipments, buyers and export documents.",
    icon: Ship,
    href: "/exporter",
  },
  {
    slug: "importer",
    title: "Importer",
    description: "Buy from overseas suppliers and track inbound cargo through clearance.",
    icon: Globe2,
    href: "/importer",
  },
  {
    slug: "cha",
    title: "CHA – Customs House Agent",
    description: "File customs entries and clear consignments on behalf of your clients.",
    icon: FileCheck2,
    href: "/cha",
  },
  {
    slug: "freight-forwarder",
    title: "Freight Forwarder",
    description: "Quote, book and move cargo across sea, air and road for shippers.",
    icon: Truck,
    href: "/freight-forwarder",
  },
];
