import type { Metadata } from "next";
import { ChaWorkspace } from "@/components/cha/cha-workspace";

export const metadata: Metadata = {
  title: { default: "CHA", template: "%s · CHA · Ximverse" },
  // The workspace sits behind sign-in once authentication exists.
  robots: { index: false, follow: false },
};

export default function ChaLayout({ children }: LayoutProps<"/cha">) {
  return <ChaWorkspace>{children}</ChaWorkspace>;
}
