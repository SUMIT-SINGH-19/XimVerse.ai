import type { Metadata } from "next";
import { ExporterWorkspace } from "@/components/exporter/exporter-workspace";

export const metadata: Metadata = {
  title: { default: "Exporter", template: "%s · Exporter · Ximverse" },
  // The workspace sits behind sign-in once authentication exists.
  robots: { index: false, follow: false },
};

export default function ExporterLayout({ children }: LayoutProps<"/exporter">) {
  return <ExporterWorkspace>{children}</ExporterWorkspace>;
}
