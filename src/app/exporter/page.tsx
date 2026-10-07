import type { Metadata } from "next";
import { PageHeader } from "@/components/workspace/page-header";
import { Greeting } from "@/components/exporter/dashboard/greeting";
import { CompanyCard } from "@/components/exporter/dashboard/company-card";
import { KpiCards } from "@/components/exporter/dashboard/kpi-cards";
import { OpportunitiesPanel } from "@/components/exporter/dashboard/opportunities-panel";
import { RecentQuotationsPanel } from "@/components/exporter/dashboard/recent-quotations-panel";
import { ActiveOrdersPanel } from "@/components/exporter/dashboard/active-orders-panel";
import { ActionRequiredPanel } from "@/components/exporter/dashboard/action-required-panel";
import { AskSumitPanel } from "@/components/exporter/dashboard/ask-sumit-panel";
import { EXPORTER_WORKSPACE } from "@/lib/exporter-nav";
import {
  ACTION_ITEMS,
  ACTIVE_ORDERS,
  BUYER_OPPORTUNITIES,
  EXPORTER_KPIS,
  RECENT_QUOTATIONS,
  SUMIT_PROMPTS,
} from "@/lib/exporter-dashboard";

export const metadata: Metadata = { title: "Overview" };

export default function ExporterOverviewPage() {
  const { identity, assistant } = EXPORTER_WORKSPACE;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Greeting />
        <PageHeader
          title="Exporter Dashboard"
          description="Manage buyer opportunities, quotations, orders and export operations."
          aside={<CompanyCard identity={identity} />}
        />
      </div>

      <KpiCards kpis={EXPORTER_KPIS} />

      <OpportunitiesPanel opportunities={BUYER_OPPORTUNITIES} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <RecentQuotationsPanel quotations={RECENT_QUOTATIONS} />
          <ActiveOrdersPanel orders={ACTIVE_ORDERS} />
        </div>
        <div className="min-w-0 space-y-6">
          <ActionRequiredPanel items={ACTION_ITEMS} />
          {assistant && <AskSumitPanel assistant={assistant} prompts={SUMIT_PROMPTS} />}
        </div>
      </div>
    </div>
  );
}
