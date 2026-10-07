"use client";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { FREIGHT_FORWARDER_WORKSPACE } from "@/lib/freight-forwarder-nav";

/** Freight forwarder chrome. Lives in a client module so the nav icons never cross the server boundary. */
export function FreightForwarderWorkspace({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell config={FREIGHT_FORWARDER_WORKSPACE}>{children}</WorkspaceShell>;
}
