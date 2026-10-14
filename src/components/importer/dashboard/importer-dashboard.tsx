"use client";

import { ActionRequired } from "./action-required";
import { ActiveImports } from "./active-imports";
import { ComplianceHealth } from "./compliance-health";
import { DashboardGreeting } from "./dashboard-greeting";
import { ImportJourney } from "./import-journey";
import { OperationalSummary } from "./operational-summary";
import { RecentActivity } from "./recent-activity";
import { SumitCard } from "./sumit-card";
import { UpcomingArrivals } from "./upcoming-arrivals";
import { useImporterDashboard } from "./use-dashboard";

/**
 * The importer overview. Sections appear in priority order in the markup (and
 * so on phones); from xl up they are placed into a main column and a rail.
 * Every section is derived from the canonical records — see lib/importer-dashboard.
 */
export function ImporterDashboard() {
  const data = useImporterDashboard();

  return (
    <div className="space-y-6">
      <DashboardGreeting />
      <OperationalSummary summary={data.summary} arrivals={data.arrivals} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ActionRequired
          actions={data.actions}
          className="md:col-span-2 xl:col-span-1 xl:col-start-1 xl:row-start-1"
        />
        <ActiveImports imports={data.activeImports} className="md:col-span-2 xl:row-start-2" />
        <ImportJourney journey={data.journey} className="md:col-span-2 xl:row-start-3" />
        <div className="grid grid-cols-1 content-start gap-6 md:col-span-2 md:grid-cols-2 xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:grid-cols-1">
          <UpcomingArrivals arrivals={data.arrivals} />
          <ComplianceHealth health={data.health} />
        </div>
        <SumitCard className="xl:col-start-1 xl:row-start-4" />
        <RecentActivity events={data.activity} asOf={data.asOf} className="xl:col-start-2 xl:row-start-4" />
      </div>
    </div>
  );
}
