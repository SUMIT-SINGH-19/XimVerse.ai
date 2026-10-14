"use client";

import Link from "next/link";
import { FileCheck, FileClock, FileWarning, FileX, ShieldAlert, ShieldCheck, type LucideIcon } from "lucide-react";
import { READINESS_LABEL } from "@/lib/importer-compliance";
import type { DashboardHealth } from "@/lib/importer-dashboard";
import { importerHref } from "@/lib/importer-nav";
import { useT } from "@/i18n/client";
import { focusRing } from "../styles";
import { Panel } from "./dashboard-ui";

/** Required-document counts (Documents) and shipment readiness (Compliance). */
export function ComplianceHealth({ health, className = "" }: { health: DashboardHealth; className?: string }) {
  const t = useT();
  const docs: { id: string; label: string; value: number; icon: LucideIcon; tone: string }[] = [
    { id: "approved", label: "Approved", value: health.approved, icon: FileCheck, tone: "text-teal" },
    { id: "needs-review", label: "Needs review", value: health.needsReview, icon: FileClock, tone: "text-orange" },
    { id: "missing", label: "Missing", value: health.missing, icon: FileX, tone: "text-orange" },
    { id: "expired", label: "Expired", value: health.expired, icon: FileWarning, tone: "text-orange" },
  ];
  const ready: { id: string; label: string; value: number; icon: LucideIcon; tone: string }[] = [
    { id: "ready", label: READINESS_LABEL.ready, value: health.readiness.ready, icon: ShieldCheck, tone: "text-teal" },
    { id: "needs-review", label: READINESS_LABEL["needs-review"], value: health.readiness["needs-review"], icon: ShieldAlert, tone: "text-orange" },
    { id: "blocked", label: READINESS_LABEL.blocked, value: health.readiness.blocked, icon: ShieldAlert, tone: "text-orange" },
  ];
  const linkCls = `rounded-md text-sm font-semibold text-teal hover:underline ${focusRing}`;

  return (
    <Panel id="compliance-health" title="Document & Compliance Health" className={className}>
      <div className="px-5 pb-5 sm:px-6">
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
          {t("Required documents ({count})", { count: health.required })}
        </h3>
        <ul className="mt-2 space-y-2">
          {docs.map(({ id, label, value, icon: Icon, tone }) => (
            <li key={id} data-health={id} className="flex items-center gap-3 text-sm">
              <Icon aria-hidden className={`size-4 shrink-0 ${value ? tone : "text-ink-faint"}`} />
              <span className="flex-1 text-ink-muted">{t(label)}</span>
              <span className="font-semibold tabular-nums text-ink">{value}</span>
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">{t("Shipment readiness")}</h3>
        <ul className="mt-2 space-y-2">
          {ready.map(({ id, label, value, icon: Icon, tone }) => (
            <li key={id} data-readiness={id} className="flex items-center gap-3 text-sm">
              <Icon aria-hidden className={`size-4 shrink-0 ${value ? tone : "text-ink-faint"}`} />
              <span className="flex-1 text-ink-muted">{t(label)}</span>
              <span className="font-semibold tabular-nums text-ink">
                {value}
                <span className="sr-only"> {value === 1 ? t("shipment") : t("shipments")}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
          <Link href={importerHref("documents")} className={linkCls}>{t("View Documents")}</Link>
          <Link href={importerHref("compliance")} className={linkCls}>{t("View Compliance")}</Link>
        </p>
      </div>
    </Panel>
  );
}
