"use client";

import { useMemo } from "react";
import { MOCK_QUOTATIONS } from "@/lib/importer-quotations";
import type { ReportData } from "@/lib/importer-reports";
import { useCustomsCases } from "../customs/customs-store";
import { useDocuments } from "../documents/document-store";
import { useLandedCostSheets } from "../landed-cost/landed-cost-store";
import { useNegotiations } from "../negotiations/negotiation-store";
import { useOrders } from "../orders/order-store";
import { usePaymentWorkspaces } from "../payments/payment-store";
import { useQuotationStatus } from "../quotations/quotation-status-store";
import { useImportRequirements } from "../rfq/requirements-store";
import { useShipments } from "../shipments/shipment-store";
import { useTrackingViews } from "../tracking/tracking-store";

/*
 * The analytics input: every canonical store, live, including records and
 * changes made in this browser tab. Nothing is copied; reports and insights
 * are recomputed from this bundle on every change.
 */
export function useReportData(): ReportData {
  const { requirements } = useImportRequirements();
  const statusOf = useQuotationStatus();
  const negotiations = useNegotiations();
  const orders = useOrders();
  const shipments = useShipments();
  const documents = useDocuments();
  const customsCases = useCustomsCases();
  const tracking = useTrackingViews();
  const sheets = useLandedCostSheets();
  const payments = usePaymentWorkspaces();
  return useMemo(
    () => ({
      requirements,
      quotations: MOCK_QUOTATIONS.map((q) => ({ ...q, currentStatus: statusOf(q) })),
      negotiations,
      orders,
      shipments,
      documents,
      customsCases,
      tracking,
      landedCost: sheets.map((s) => ({ orderId: s.order.id, result: s.result, snapshots: s.snapshots })),
      payments,
    }),
    [requirements, statusOf, negotiations, orders, shipments, documents, customsCases, tracking, sheets, payments],
  );
}
