"use client";

import { useMemo } from "react";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { useCommunications } from "@/lib/exporter-communication-store";
import { useExporterShipments } from "@/lib/exporter-shipment-store";
import {
  PRIORITY_LABEL,
  THREAD_STATUS_LABEL,
  threadContext,
  threadState,
  type Priority,
  type RefKind,
  type Thread,
  type ThreadState,
  type ThreadStatus,
} from "@/lib/exporter-communications";

export interface ThreadRow {
  t: Thread;
  s: ThreadState;
}

export function useThreadRows(): { rows: ThreadRow[]; read: Record<string, string> } {
  const { threads, read } = useCommunications();
  const shipments = useExporterShipments();
  return useMemo(
    () => ({ rows: threads.map((t) => ({ t, s: threadState(t, read[t.id], threadContext(t, shipments)) })), read }),
    [threads, read, shipments],
  );
}

const STATUS_TONE: Record<ThreadStatus, PillTone> = { open: "neutral", "action-required": "accent", "awaiting-response": "brand", resolved: "muted" };
const PRIORITY_TONE: Record<Priority, PillTone> = { normal: "muted", important: "neutral", urgent: "accent" };

export function ThreadStatusPill({ status }: { status: ThreadStatus }) {
  return <StatusPill tone={STATUS_TONE[status]}>{THREAD_STATUS_LABEL[status]}</StatusPill>;
}

export function PriorityPill({ priority }: { priority: Priority }) {
  return <StatusPill tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</StatusPill>;
}

export function refHref(kind: RefKind, id: string): string {
  const slug = { rfq: "opportunities", quotation: "quotations", negotiation: "negotiations", deal: "deals", order: "orders", shipment: "shipments", document: "documents" }[kind];
  return `/exporter/${slug}/${id}`;
}
