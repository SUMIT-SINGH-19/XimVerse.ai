"use client";

import { useMemo } from "react";
import { buildImporterDashboard, type ImporterDashboard } from "@/lib/importer-dashboard";
import { useReportData } from "../reports/report-data";
import { describeEvent } from "../shipments/shipment-ui";

/*
 * The overview's single input: the same live canonical bundle Reports and
 * Trade Insights read, so the dashboard updates with every session change and
 * never keeps its own copy of operational data.
 */
export function useImporterDashboard(): ImporterDashboard {
  const data = useReportData();
  return useMemo(() => buildImporterDashboard(data, { describeShipmentEvent: describeEvent }), [data]);
}
