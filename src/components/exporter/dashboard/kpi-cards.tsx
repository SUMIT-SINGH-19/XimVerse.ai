import Link from "next/link";
import { Handshake, IndianRupee, PackageCheck, Radar, ReceiptText, type LucideIcon } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { getT } from "@/i18n/server";
import { exporterHref } from "@/lib/exporter-nav";
import type { ExporterKpi } from "@/lib/exporter-dashboard";

const ICONS: Record<string, LucideIcon> = {
  opportunities: Radar,
  quotations: ReceiptText,
  deals: Handshake,
  orders: PackageCheck,
  revenue: IndianRupee,
};

export async function KpiCards({ kpis }: { kpis: readonly ExporterKpi[] }) {
  const t = await getT();

  return (
    <ul aria-label={t("Key figures")} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => {
        const Icon = ICONS[kpi.key] ?? Radar;
        return (
          <li key={kpi.key} className="last:col-span-2 sm:last:col-span-1">
            <Link
              href={exporterHref(kpi.slug)}
              className={`group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition hover:border-teal/30 hover:shadow-md ${focusRing}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-ink-muted">{t(kpi.label)}</span>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-soft text-teal">
                  <Icon className="size-4" aria-hidden />
                </span>
              </span>
              <span className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">
                {kpi.value}
              </span>
              <span className={`mt-1 text-xs font-medium ${kpi.emphasis ? "text-orange" : "text-ink-muted"}`}>
                {t(kpi.detail, kpi.detailVars)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
