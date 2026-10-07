"use client";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { CHA_WORKSPACE } from "@/lib/cha-nav";

/** CHA chrome. Lives in a client module so the nav icons never cross the server boundary. */
export function ChaWorkspace({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell config={CHA_WORKSPACE}>{children}</WorkspaceShell>;
}
