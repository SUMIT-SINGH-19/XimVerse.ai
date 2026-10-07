import {
  activeImportCount,
  upcomingArrivals,
  type ImporterDashboardData,
} from "@/lib/importer-dashboard-data";
import { ActionRequired } from "./action-required";
import { ActiveImports } from "./active-imports";
import { ComplianceHealth } from "./compliance-health";
import { DashboardGreeting } from "./dashboard-greeting";
import { ImportJourney } from "./import-journey";
import { OperationalSummary } from "./operational-summary";
import { RecentActivity } from "./recent-activity";
import { SumitCard } from "./sumit-card";
import { UpcomingArrivals } from "./upcoming-arrivals";

/**
 * The importer overview. Sections appear in priority order in the markup (and
 * so on phones); from xl up they are placed into a main column and a rail.
 */
export function ImporterDashboard({ data }: { data: ImporterDashboardData }) {
  return (
    <div className="space-y-6">
      <DashboardGreeting />
      <OperationalSummary data={data} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ActionRequired
          actions={data.actions}
          className="md:col-span-2 xl:col-span-1 xl:col-start-1 xl:row-start-1"
        />
        <ActiveImports
          imports={data.recentImports}
          total={activeImportCount(data)}
          className="md:col-span-2 xl:row-start-2"
        />
        <ImportJourney pipeline={data.pipeline} className="md:col-span-2 xl:row-start-3" />
        <div className="grid grid-cols-1 content-start gap-6 md:col-span-2 md:grid-cols-2 xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:grid-cols-1">
          <UpcomingArrivals arrivals={upcomingArrivals(data)} asOf={data.asOf} />
          <ComplianceHealth items={data.compliance} />
        </div>
        <SumitCard className="xl:col-start-1 xl:row-start-4" />
        <RecentActivity
          events={data.activity}
          asOf={data.asOf}
          className="xl:col-start-2 xl:row-start-4"
        />
      </div>
    </div>
  );
}
