import type { Metadata } from "next";
import { FreightForwarderWorkspace } from "@/components/freight-forwarder/freight-forwarder-workspace";

export const metadata: Metadata = {
  title: { default: "Freight Forwarder", template: "%s · Freight Forwarder · Ximverse" },
  // The workspace sits behind sign-in once authentication exists.
  robots: { index: false, follow: false },
};

export default function FreightForwarderLayout({ children }: LayoutProps<"/freight-forwarder">) {
  return <FreightForwarderWorkspace>{children}</FreightForwarderWorkspace>;
}
