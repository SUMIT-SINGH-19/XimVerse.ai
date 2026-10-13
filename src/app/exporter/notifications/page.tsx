import type { Metadata } from "next";
import { NotificationsList } from "@/components/exporter/notifications/notifications-list";

export const metadata: Metadata = { title: "Notifications" };

export default function ExporterNotificationsPage() {
  return <NotificationsList />;
}
