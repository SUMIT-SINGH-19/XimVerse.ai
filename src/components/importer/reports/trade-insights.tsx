"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Eye, Info } from "lucide-react";
import { importerHref } from "@/lib/importer-nav";
import { NO_FILTERS, type ReportFilters } from "@/lib/importer-reports";
import {
  buildTradeInsights,
  CATEGORY_LABEL,
  INSIGHTS_NOTICE,
  ORDERING_NOTE,
  SEVERITY_LABEL,
  type InsightCategory,
  type InsightSeverity,
  type TradeInsight,
} from "@/lib/importer-trade-insights";
import { ImporterPageHeader } from "../importer-page-header";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { focusRing, secondaryButton } from "../styles";
import { useReportData } from "./report-data";
import { effectiveFilters, ReportFilterBar, selectClass } from "./report-ui";

const SEV: Record<InsightSeverity, { cls: string; Icon: typeof Info }> = {
  action: { cls: "bg-orange-soft text-orange", Icon: CircleAlert },
  watch: { cls: "border border-orange/40 text-orange", Icon: Eye },
  positive: { cls: "bg-teal-soft text-teal", Icon: CircleCheck },
  information: { cls: "border border-line text-ink-muted", Icon: Info },
};

function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  const { cls, Icon } = SEV[severity];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon aria-hidden className="size-3.5" />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

const PROMPTS = [
  "What needs management attention?",
  "Which workflows have the most blockers?",
  "Where is supplier concentration highest?",
  "Which costs changed most?",
  "Which payments are coming due?",
];

export function TradeInsights() {
  const data = useReportData();
  const [filters, setFilters] = useState<ReportFilters>(NO_FILTERS);
  const [category, setCategory] = useState<InsightCategory | "">("");
  const [severity, setSeverity] = useState<InsightSeverity | "">("");
  const appliedKey = JSON.stringify(effectiveFilters(filters, ["date", "supplierId", "product"]));
  const all = useMemo(() => buildTradeInsights(data, JSON.parse(appliedKey) as ReportFilters), [data, appliedKey]);
  const visible = all.filter((i) => (!category || i.category === category) && (!severity || i.severity === severity));
  const issues = visible.filter((i) => i.severity === "action" || i.severity === "watch");
  const counts = (["action", "watch", "positive", "information"] as const).map((s) => ({ s, n: all.filter((i) => i.severity === s).length }));

  return (
    <div className="space-y-6">
      <ImporterPageHeader title="Trade Insights" description="Operational insights derived from your XimVerse import activity." />
      <p className="flex gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        {INSIGHTS_NOTICE}
      </p>

      <section aria-label="Insight summary">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
          {counts.map(({ s, n }) => (
            <div key={s} className="flex flex-col bg-surface px-4 py-3">
              <dt className="text-xs font-medium text-ink-muted">{SEVERITY_LABEL[s]}</dt>
              <dd className="order-first text-xl font-semibold tabular-nums text-ink">{n}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ReportFilterBar data={data} filters={filters} onChange={setFilters} fields={["date", "supplierId", "product"]} />

      <section aria-labelledby="insights-heading" className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-4 sm:p-5">
          <h2 id="insights-heading" className="text-base font-semibold text-ink">Insights</h2>
          <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
            <label className="block">
              <span className="sr-only">Category</span>
              <select id="insight-category" value={category} onChange={(e) => setCategory(e.target.value as InsightCategory | "")} className={selectClass}>
                <option value="">All categories</option>
                {(Object.keys(CATEGORY_LABEL) as InsightCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Severity</span>
              <select id="insight-severity" value={severity} onChange={(e) => setSeverity(e.target.value as InsightSeverity | "")} className={selectClass}>
                <option value="">All severities</option>
                {(Object.keys(SEVERITY_LABEL) as InsightSeverity[]).map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-ink-muted sm:px-5">
          <p role="status">{visible.length} of {all.length} insights</p>
          <p className="text-xs text-ink-faint">{ORDERING_NOTE}</p>
        </div>
        {issues.length === 0 && <p className="border-t border-line px-5 py-4 text-sm text-ink-muted" id="no-issues">No operational issues detected in the selected data.</p>}
        <ul id="insight-list" className="space-y-3 border-t border-line p-4 sm:p-5">
          {visible.map((i) => <InsightCard key={i.id} i={i} />)}
        </ul>
      </section>

      <SumitAnalysisCard id="sumit-insights" heading="Ask SUMIT about your trade insights" prompts={PROMPTS} message="SUMIT trade intelligence will be connected later. Nothing was analysed." />
      <p className="text-xs text-ink-faint">
        Need the underlying numbers? See <Link href={importerHref("reports")} className={`rounded font-medium text-teal hover:underline ${focusRing}`}>Reports</Link>.
      </p>
    </div>
  );
}

function InsightCard({ i }: { i: TradeInsight }) {
  return (
    <li className="rounded-xl border border-line px-4 py-3" data-insight={i.id}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={i.severity} />
        <span className="text-xs text-ink-muted">{CATEGORY_LABEL[i.category]}</span>
      </div>
      <p className="mt-1.5 font-medium text-ink">{i.title}</p>
      <p className="text-sm text-ink-muted">{i.description}</p>
      <details className="mt-1.5">
        <summary className={`cursor-pointer rounded text-xs font-medium text-teal ${focusRing}`}>Evidence ({i.evidence.length})</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink-muted" data-evidence>
          {i.evidence.map((e) => <li key={e} className="break-words">{e}</li>)}
        </ul>
      </details>
      <Link href={i.action.href} className={`${secondaryButton} mt-2 h-9 px-3`}>
        {i.action.label}
        <ArrowRight aria-hidden className="size-4" />
        <span className="sr-only"> — {i.title}</span>
      </Link>
    </li>
  );
}
