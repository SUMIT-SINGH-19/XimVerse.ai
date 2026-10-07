import type { Metadata } from "next";
import { ImporterShell } from "@/components/importer/importer-shell";
import { ImportRequirementsProvider } from "@/components/importer/rfq/requirements-store";

export const metadata: Metadata = {
  title: { default: "Importer", template: "%s · Importer · Ximverse" },
  // The workspace sits behind sign-in once authentication exists.
  robots: { index: false, follow: false },
};

export default function ImporterLayout({ children }: LayoutProps<"/importer">) {
  return (
    <ImporterShell>
      <ImportRequirementsProvider>{children}</ImportRequirementsProvider>
    </ImporterShell>
  );
}
