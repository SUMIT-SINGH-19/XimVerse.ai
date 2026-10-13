import type { Metadata } from "next";
import { TradeInsights } from "@/components/importer/reports/trade-insights";

export const metadata: Metadata = { title: "Trade Insights" };

export default function TradeInsightsPage() {
  return <TradeInsights />;
}
