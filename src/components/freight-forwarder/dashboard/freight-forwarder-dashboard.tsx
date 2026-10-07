import {
  departuresByCutoff,
  exceptionsBySeverity,
  rfqsByDeadline,
  shipmentsByUrgency,
  sortedActions,
  type FreightForwarderDashboardData,
} from "@/lib/freight-forwarder-dashboard-data";
import { ACTION_REQUIRED_ID, ActionRequired } from "./action-required";
import { ActiveShipments } from "./active-shipments";
import { CarrierBookings } from "./carrier-bookings";
import { ChaCoordination } from "./cha-coordination";
import { CommercialOverview } from "./commercial-overview";
import { DashboardGreeting } from "./dashboard-greeting";
import { DocumentationStatus } from "./documentation-status";
import { ExceptionsPanel } from "./exceptions-panel";
import { NewRfqs } from "./new-rfqs";
import { OperationalSummary } from "./operational-summary";
import { RecentActivity } from "./recent-activity";
import { ShipmentPipeline } from "./shipment-pipeline";
import { SumitCard } from "./sumit-card";
import { UpcomingDepartures } from "./upcoming-departures";

/** Main column plus a 22rem rail from xl up; a single column below that. */
const SPLIT = "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]";

/**
 * The freight forwarder overview. Sections appear in priority order in the
 * markup (and so on phones): what needs action, what is moving, what needs
 * quoting, what departs next, then supporting detail.
 */
export function FreightForwarderDashboard({ data }: { data: FreightForwarderDashboardData }) {
  const { asOf, timeZone } = data;

  return (
    <div className="space-y-6">
      <DashboardGreeting firstName={data.user.firstName} />
      <OperationalSummary data={data} />

      <div className={SPLIT}>
        <ActionRequired actions={sortedActions(data)} asOf={asOf} />
        <SumitCard insights={data.sumit} prioritiesHref={`#${ACTION_REQUIRED_ID}`} />
      </div>

      <ActiveShipments shipments={shipmentsByUrgency(data)} total={data.summary.activeShipments.total} />

      <NewRfqs rfqs={rfqsByDeadline(data)} total={data.summary.newRfqs.total} asOf={asOf} timeZone={timeZone} />

      <div className={SPLIT}>
        <UpcomingDepartures departures={departuresByCutoff(data)} asOf={asOf} timeZone={timeZone} />
        <ExceptionsPanel exceptions={exceptionsBySeverity(data)} asOf={asOf} />
      </div>

      <ShipmentPipeline stages={data.pipeline} />

      <div className={SPLIT}>
        <CarrierBookings bookings={data.bookings} asOf={asOf} timeZone={timeZone} />
        <DocumentationStatus documents={data.documents} />
      </div>

      <ChaCoordination updates={data.chaUpdates} asOf={asOf} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <CommercialOverview commercial={data.commercial} />
        <RecentActivity events={data.activity} asOf={asOf} />
      </div>
    </div>
  );
}
