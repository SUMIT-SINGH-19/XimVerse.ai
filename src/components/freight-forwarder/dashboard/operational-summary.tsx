import {
  CalendarCheck,
  IndianRupee,
  Inbox,
  Navigation,
  Ship,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  openExceptionCount,
  type FreightForwarderDashboardData,
} from "@/lib/freight-forwarder-dashboard-data";
import { formatInrCompact } from "./dashboard-ui";

interface Metric {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  attention?: boolean;
}

function metricsFor(data: FreightForwarderDashboardData): Metric[] {
  const { activeShipments, newRfqs, confirmedBookings, inTransit } = data.summary;
  const { byMode } = activeShipments;
  const exceptions = openExceptionCount(data);

  return [
    {
      label: "Active Shipments",
      value: String(activeShipments.total),
      hint: `${byMode.ocean} ocean · ${byMode.air} air · ${byMode.road} road`,
      icon: Ship,
    },
    {
      label: "New RFQs",
      value: String(newRfqs.total),
      hint: newRfqs.dueToday ? `${newRfqs.dueToday} require response today` : "None due today",
      icon: Inbox,
      attention: newRfqs.dueToday > 0,
    },
    {
      label: "Confirmed Bookings",
      value: String(confirmedBookings.total),
      hint: `${confirmedBookings.departingThisWeek} departing this week`,
      icon: CalendarCheck,
    },
    {
      label: "In Transit",
      value: String(inTransit.total),
      hint: `Across ${inTransit.lanes} trade lanes`,
      icon: Navigation,
    },
    {
      label: "Exceptions",
      value: String(exceptions),
      hint: exceptions ? "Requires attention" : "All clear",
      icon: TriangleAlert,
      attention: exceptions > 0,
    },
    {
      label: "Revenue",
      value: formatInrCompact(data.commercial.revenueConfirmed),
      hint: "Confirmed this month",
      icon: IndianRupee,
    },
  ];
}

export function OperationalSummary({ data }: { data: FreightForwarderDashboardData }) {
  return (
    <section aria-label="Operational summary">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metricsFor(data).map(({ label, value, hint, icon: Icon, attention }) => (
          <div key={label} className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
            <span
              aria-hidden
              className={`hidden size-9 shrink-0 place-items-center rounded-lg sm:grid xl:hidden 2xl:grid ${
                attention ? "bg-orange-soft text-orange" : "bg-teal-soft text-teal"
              }`}
            >
              <Icon className="size-4.5" />
            </span>
            <div className="flex min-w-0 flex-col">
              <dt className="text-xs font-medium text-ink-muted">{label}</dt>
              <dd className="order-first text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</dd>
              <dd className={`mt-0.5 text-xs ${attention ? "text-orange" : "text-ink-faint"}`}>{hint}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
