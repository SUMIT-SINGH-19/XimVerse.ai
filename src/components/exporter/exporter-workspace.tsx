"use client";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { EXPORTER_WORKSPACE } from "@/lib/exporter-nav";

/** Exporter chrome. Lives in a client module so the nav icons never cross the server boundary. */
export function ExporterWorkspace({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell config={EXPORTER_WORKSPACE}>{children}</WorkspaceShell>;
}
