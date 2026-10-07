import { CHA_WORKSPACE } from "@/lib/cha-nav";
import {
  filingQueue,
  shipmentById,
  snapshotDate,
  sortedActions,
  summarize,
  timelineShipments,
  workQueue,
  type ChaDashboardData,
} from "@/lib/cha-dashboard-data";
import { ActionRequired } from "./action-required";
import { ClearanceTimeline } from "./clearance-timeline";
import { ComplianceHealth } from "./compliance-health";
import { DashboardGreeting } from "./dashboard-greeting";
import { FilingQueue } from "./filing-queue";
import { OperationalSummary } from "./operational-summary";
import { RecentActivity } from "./recent-activity";
import { SumitCard } from "./sumit-card";
import { WorkQueue } from "./work-queue";

/**
 * The CHA overview: the daily command centre. Sections appear in priority
 * order in the markup (and so on phones); from xl up they are placed into a
 * main column and a rail, with the work queue spanning both.
 */
export function ChaDashboard({ data }: { data: ChaDashboardData }) {
  const { identity } = CHA_WORKSPACE;
  const summary = summarize(data);
  const today = snapshotDate(data);
  const clientOf = (id: string) => shipmentById(data, id)?.client;
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: data.timeZone,
  }).format(new Date(data.asOf));

  return (
    <div className="space-y-6">
      <DashboardGreeting
        firstName={identity.user?.split(" ")[0] ?? "there"}
        company={identity.company}
        location={identity.location}
        dateLabel={dateLabel}
        attentionCount={summary.needsAttention}
      />
      <OperationalSummary summary={summary} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ActionRequired actions={sortedActions(data)} className="xl:col-start-1 xl:row-start-1" />
        <SumitCard
          briefing={data.briefing}
          asOf={data.asOf}
          className="xl:col-start-2 xl:row-start-1"
        />
        <WorkQueue shipments={workQueue(data)} className="xl:col-span-2 xl:row-start-2" />
        <FilingQueue
          rows={filingQueue(data).map((filing) => ({ filing, client: clientOf(filing.shipmentId) }))}
          className="xl:col-start-2 xl:row-start-3"
        />
        <ClearanceTimeline
          shipments={timelineShipments(data)}
          className="xl:col-start-1 xl:row-start-3"
        />
        <ComplianceHealth
          rows={data.compliance.map((report) => ({ report, client: clientOf(report.shipmentId) }))}
          className="xl:col-start-1 xl:row-start-4"
        />
        <RecentActivity
          events={data.activity}
          today={today}
          timeZone={data.timeZone}
          className="xl:col-start-2 xl:row-start-4"
        />
      </div>
    </div>
  );
}
