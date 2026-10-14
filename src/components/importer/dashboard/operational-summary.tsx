"use client";

import Link from "next/link";
import { Boxes, ClipboardList, Handshake, PackageCheck, TriangleAlert, Wallet, type LucideIcon } from "lucide-react";
import { formatDayMonth } from "@/lib/format";
import {
  ATTENTION_DEFINITION,
  UPCOMING_PAYMENTS_DEFINITION,
  type DashboardArrival,
  type DashboardSummary,
} from "@/lib/importer-dashboard";
import { importerHref } from "@/lib/importer-nav";
import { useT } from "@/i18n/client";
import { focusRing } from "../styles";

interface Metric {
  id: string;
  label: string;
  value: number;
  hint: string;
  href: string;
  icon: LucideIcon;
  attention?: boolean;
  definition?: string;
}

export function OperationalSummary({
  summary,
  arrivals,
}: {
  summary: DashboardSummary;
  arrivals: readonly DashboardArrival[];
}) {
  const t = useT();
  const next = arrivals[0];
  const metrics: Metric[] = [
    { id: "open-requirements", label: t("Open Requirements"), value: summary.openRequirements, hint: t("Submitted, not closed"), href: importerHref("rfqs"), icon: ClipboardList },
    { id: "active-negotiations", label: t("Active Negotiations"), value: summary.activeNegotiations, hint: t("Awaiting agreement"), href: importerHref("negotiations"), icon: Handshake },
    { id: "open-orders", label: t("Open Orders"), value: summary.openOrders, hint: t("Not yet completed"), href: importerHref("orders"), icon: PackageCheck },
    {
      id: "active-shipments",
      label: t("Active Shipments"),
      value: summary.activeShipments,
      hint: next ? t("Next: {place}, {date}", { place: next.port, date: formatDayMonth(next.eta) }) : t("No arrivals in the next 14 days"),
      href: importerHref("tracking"),
      icon: Boxes,
    },
    { id: "needs-attention", label: t("Needs Attention"), value: summary.needsAttention, hint: summary.needsAttention ? t("See Action Required") : t("Nothing urgent"), href: "#action-required", icon: TriangleAlert, attention: summary.needsAttention > 0, definition: ATTENTION_DEFINITION },
    { id: "upcoming-payments", label: t("Upcoming Payments"), value: summary.upcomingPayments, hint: t("Due within 14 days"), href: importerHref("payments"), icon: Wallet, definition: UPCOMING_PAYMENTS_DEFINITION },
  ];

  return (
    <section aria-label={t("Operational summary")}>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {metrics.map(({ id, label, value, hint, href, icon: Icon, attention, definition }) => (
          <li key={id} data-metric={id}>
            <Link
              href={href}
              title={definition ? t(definition) : undefined}
              className={`flex h-full items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:border-teal/40 ${focusRing}`}
            >
              <span
                aria-hidden
                className={`hidden size-9 shrink-0 place-items-center rounded-lg sm:grid ${
                  attention ? "bg-orange-soft text-orange" : "bg-teal-soft text-teal"
                }`}
              >
                <Icon className="size-4.5" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span data-value className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
                  {value}
                </span>
                <span className="text-xs font-medium text-ink-muted">{label}</span>
                <span className="mt-0.5 truncate text-xs text-ink-faint">{hint}</span>
                {definition && <span className="sr-only">{t(definition)}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
