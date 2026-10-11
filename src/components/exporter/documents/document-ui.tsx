"use client";

import { useMemo } from "react";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { useExporterDeals } from "@/lib/exporter-deal-store";
import { useExporterOrders } from "@/lib/exporter-order-store";
import { useExporterShipments } from "@/lib/exporter-shipment-store";
import { buildDocumentIndex, DOCUMENT_STATUS_DISPLAY, type DocumentItem, type DocumentSources, type DocumentStatus } from "@/lib/exporter-documents";

const TONE: Record<DocumentStatus, PillTone> = {
  "not-started": "muted",
  requested: "neutral",
  preparing: "neutral",
  ready: "brand",
  "needs-review": "accent",
  approved: "solid",
  filed: "brand",
  acknowledged: "brand",
  issued: "solid",
  blocked: "accent",
  expired: "accent",
  "not-required": "muted",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <StatusPill tone={TONE[status]}>{DOCUMENT_STATUS_DISPLAY[status]}</StatusPill>;
}

/** The index, re-derived whenever an owner (order, shipment, deal) changes. No document state of its own. */
export function useDocumentIndex(): { index: DocumentItem[]; src: DocumentSources } {
  const orders = useExporterOrders();
  const shipments = useExporterShipments();
  const deals = useExporterDeals();
  return useMemo(() => {
    const src = { orders, shipments, deals };
    return { index: buildDocumentIndex(src), src };
  }, [orders, shipments, deals]);
}

export function criticality(d: DocumentItem): string {
  if (d.ownerType === "company") return "Company credential";
  if (d.ownerType === "shipment") return d.customsCritical ? "Shipment critical · Customs" : "Shipment critical";
  return d.customsCritical ? "Pre-shipment · Customs-critical" : "Pre-shipment";
}
