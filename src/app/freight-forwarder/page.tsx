import type { Metadata } from "next";
import { FreightForwarderDashboard } from "@/components/freight-forwarder/dashboard/freight-forwarder-dashboard";
import { getFreightForwarderDashboard } from "@/lib/freight-forwarder-dashboard-data";

export const metadata: Metadata = { title: "Dashboard" };

export default function FreightForwarderDashboardPage() {
  return <FreightForwarderDashboard data={getFreightForwarderDashboard()} />;
}
