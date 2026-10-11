import type { Metadata } from "next";
import { TrackingList } from "@/components/importer/tracking/tracking-list";

export const metadata: Metadata = { title: "Tracking" };

export default function TrackingPage() {
  return <TrackingList />;
}
