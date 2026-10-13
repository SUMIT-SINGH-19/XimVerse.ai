"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import { COST_STATUS_LABEL } from "@/lib/importer-landed-cost";
import { orderStatus, orderStatusLabel, orderValue } from "@/lib/importer-orders";
import { WORKSPACE_STATUS_LABEL } from "@/lib/importer-payments";
import { READINESS_LABEL } from "@/lib/importer-compliance";
import {
  buildImporterReport,
  filterReportData,
  formatAverageDays,
  formatByCurrency,
  formatMoney,
  NO_FILTERS,
  type ReportFilters,
} from "@/lib/importer-reports";
import { SCHEDULE_STATUS_LABEL } from "@/lib/importer-tracking";
import { findSupplier } from "@/lib/importer-suppliers";
import { ImporterPageHeader } from "../importer-page-header";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { focusRing } from "../styles";
import { useReportData } from "./report-data";
import { Bars, effectiveFilters, ExportCsv, Metric, MetricGrid, ReportFilterBar, Table, type FilterField } from "./report-ui";

const TABS = [
  { id: "overview", label: "Overview", fields: ["date", "supplierId", "product", "category", "country", "currency"] },
  { id: "sourcing", label: "Sourcing", fields: ["date", "supplierId", "product", "category", "requirementId"] },
  { id: "suppliers", label: "Suppliers", fields: ["date", "supplierId", "country", "product"] },
  { id: "orders", label: "Orders", fields: ["date", "supplierId", "product", "category", "country", "orderStatus", "currency"] },
  { id: "shipments", label: "Shipments", fields: ["date", "supplierId", "product", "shipmentStage"] },
  { id: "compliance", label: "Compliance", fields: ["supplierId", "product", "shipmentStage"] },
  { id: "customs", label: "Customs", fields: ["supplierId", "product", "shipmentStage"] },
  { id: "landed-cost", label: "Landed Cost", fields: ["supplierId", "product", "currency"] },
  { id: "payments", label: "Payments", fields: ["supplierId", "product", "orderStatus", "currency"] },
] as const satisfies readonly { id: string; label: string; fields: readonly FilterField[] }[];
type TabId = (typeof TABS)[number]["id"];

export const REPORT_PROMPTS = [
  "Summarize sourcing performance.",
  "Which suppliers received the most orders?",
  "Where are shipment delays occurring?",
  "What is driving landed cost?",
  "How much supplier payment remains?",
];

const link = `rounded font-medium text-ink hover:text-teal hover:underline ${focusRing}`;
const supplierName = (id: string) => findSupplier(id)?.name ?? id;

function Section({ id, title, description, action, children }: { id: string; title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

const Sub = ({ children }: { children: React.ReactNode }) => <h3 className="text-sm font-semibold text-ink">{children}</h3>;

export function ReportsWorkspace() {
  const data = useReportData();
  const [tab, setTab] = useState<TabId>("overview");
  const [filters, setFilters] = useState<ReportFilters>(NO_FILTERS);
  const fields = TABS.find((t) => t.id === tab)!.fields;
  const appliedKey = JSON.stringify(effectiveFilters(filters, fields));
  const report = useMemo(() => buildImporterReport(data, JSON.parse(appliedKey) as ReportFilters), [data, appliedKey]);
  const scoped = useMemo(() => filterReportData(data, JSON.parse(appliedKey) as ReportFilters), [data, appliedKey]);

  return (
    <div className="space-y-6">
      <ImporterPageHeader title="Reports" description="Analyze sourcing, orders, shipments and import operations." />
      <p className="flex gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        Reports are calculated from records in your XimVerse workspace, including changes made in this session. Money is shown per currency and never converted.
      </p>

      <div role="tablist" aria-label="Report sections" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              const i = TABS.findIndex((x) => x.id === tab);
              const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : -1;
              if (next >= 0) {
                e.preventDefault();
                setTab(TABS[next].id);
                requestAnimationFrame(() => document.getElementById(`tab-${TABS[next].id}`)?.focus());
              }
            }}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === t.id ? "bg-teal text-on-brand" : "text-ink-muted hover:bg-teal-soft hover:text-ink"} ${focusRing}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ReportFilterBar data={data} filters={filters} onChange={setFilters} fields={fields} />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-6">
        {tab === "overview" && <Overview r={report} />}
        {tab === "sourcing" && <Sourcing r={report} scoped={scoped} />}
        {tab === "suppliers" && <Suppliers r={report} />}
        {tab === "orders" && <Orders r={report} scoped={scoped} />}
        {tab === "shipments" && <Shipments r={report} scoped={scoped} />}
        {tab === "compliance" && <Compliance r={report} />}
        {tab === "customs" && <Customs r={report} />}
        {tab === "landed-cost" && <LandedCost r={report} />}
        {tab === "payments" && <Payments r={report} />}
      </div>

      <SumitAnalysisCard id="sumit-reports" heading="Ask SUMIT about these reports" prompts={REPORT_PROMPTS} message="SUMIT reporting intelligence will be connected later. Nothing was analysed." />
    </div>
  );
}

type R = ReturnType<typeof buildImporterReport>;
type Scoped = ReturnType<typeof filterReportData>;

/* ---------------- Overview + Operational Health ---------------- */
function Overview({ r }: { r: R }) {
  const o = r.overview;
  return (
    <>
      <Section id="overview-metrics" title="Overview">
        <MetricGrid label="Overview metrics">
          <Metric label="Requirements" value={o.requirements} href={importerHref("rfqs")} />
          <Metric label="Quotations Received" value={o.quotations} href={importerHref("quotations")} />
          <Metric label="Suppliers Engaged" value={o.suppliersEngaged} href={importerHref("suppliers")} />
          <Metric label="Orders" value={o.orders} href={importerHref("orders")} />
          <Metric label="Active Shipments" value={o.activeShipments} href={importerHref("shipments")} />
          <Metric label="Delivered Shipments" value={o.deliveredShipments} href={importerHref("shipments")} />
          <Metric label="Open Exceptions" value={o.openExceptions} href={importerHref("tracking")} />
          <Metric label="Customs Cases" value={o.customsCases} href={importerHref("customs")} />
          <Metric label="Outstanding Supplier Payments" value={formatByCurrency(o.outstandingPayments)} href={importerHref("payments")} hint="Per currency" />
        </MetricGrid>
      </Section>
      <Section id="operational-health" title="Operational Health" description="One row per active order. Each value comes from its own workspace; follow the links to act.">
        <div className="hidden lg:block">
          <Table
            caption="Operational health"
            minWidth="70rem"
            headers={["Order", "Supplier", "Shipment", "Current Stage", "Documents", "Compliance", "Customs", "Tracking Exceptions", "Landed Cost", "Payment Status", "Next Action"]}
            rows={r.operational.map((x) => [
              <Link key="o" href={importerHref(`orders/${x.orderId}`)} className={link}>{x.orderId}</Link>,
              x.supplier,
              x.shipmentId ? <Link key="s" href={importerHref(`tracking/${x.shipmentId}`)} className={link}>{x.shipmentId}</Link> : "—",
              x.stage,
              x.shipmentId ? <Link key="d" href={`${importerHref("documents")}?shipment=${x.shipmentId}`} className={link}>{x.documents}</Link> : x.documents,
              x.compliance ? <Link key="c" href={importerHref(`compliance/${x.shipmentId}`)} className={link}>{READINESS_LABEL[x.compliance]}</Link> : "—",
              x.customs,
              x.trackingExceptions,
              <Link key="l" href={importerHref(`landed-cost/${x.orderId}`)} className={link}>{COST_STATUS_LABEL[x.landedCost]}</Link>,
              <Link key="p" href={importerHref(`payments/${x.orderId}`)} className={link}>{WORKSPACE_STATUS_LABEL[x.paymentStatus as keyof typeof WORKSPACE_STATUS_LABEL]}</Link>,
              x.nextAction,
            ])}
          />
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden" aria-label="Operational health">
          {r.operational.map((x) => (
            <li key={x.orderId} className="rounded-xl border border-line p-4 text-sm" data-health={x.orderId}>
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={importerHref(`orders/${x.orderId}`)} className={`${link} font-semibold`}>{x.orderId}</Link>
                <span className="text-xs text-ink-muted">{x.supplier}</span>
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {[
                  ["Shipment", x.shipmentId ?? "—"],
                  ["Stage", x.stage],
                  ["Documents", x.documents],
                  ["Compliance", x.compliance ? READINESS_LABEL[x.compliance] : "—"],
                  ["Customs", x.customs],
                  ["Exceptions", String(x.trackingExceptions)],
                  ["Landed cost", COST_STATUS_LABEL[x.landedCost]],
                  ["Payment", WORKSPACE_STATUS_LABEL[x.paymentStatus as keyof typeof WORKSPACE_STATUS_LABEL]],
                ].map(([k, v]) => (
                  <div key={k}><dt className="text-ink-faint">{k}</dt><dd className="text-ink">{v}</dd></div>
                ))}
              </dl>
              <p className="mt-2 text-ink">Next: {x.nextAction}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/* ---------------- Sourcing ---------------- */
function Sourcing({ r, scoped }: { r: R; scoped: Scoped }) {
  const s = r.sourcing;
  const rows = scoped.requirements.map((q) => {
    const quotes = scoped.quotations.filter((x) => x.requirementId === q.id).length;
    const order = scoped.orders.find((o) => o.requirementId === q.id);
    return [q.id, q.product.name, q.status, quotes, scoped.negotiations.filter((n) => n.requirementId === q.id).length, q.selection ? supplierName(q.selection.supplierId) : "", order?.id ?? ""];
  });
  return (
    <Section id="sourcing" title="Sourcing Performance" action={<ExportCsv report="sourcing" headers={["Requirement", "Product", "Status", "Quotations", "Negotiations", "Selected Supplier", "Order"]} rows={rows} />}>
      <MetricGrid label="Sourcing metrics">
        <Metric label="Requirements Created" value={s.requirements} href={importerHref("rfqs")} />
        <Metric label="Requirements with Quotations" value={s.withQuotations} />
        <Metric label="Total Quotations" value={s.totalQuotations} href={importerHref("quotations")} />
        <Metric label="Average Quotations per Requirement" value={s.avgQuotations ?? "—"} hint={`${s.totalQuotations} quotations ÷ ${s.requirements} requirements`} />
        <Metric label="Requirements in Negotiation" value={s.inNegotiation} href={importerHref("negotiations")} />
        <Metric label="Supplier Selected" value={s.supplierSelected} />
        <Metric label="Ready for Order" value={s.readyForOrder} />
        <Metric label="Orders Created" value={s.ordersCreated} href={importerHref("orders")} />
        <Metric label="Shortlisted Quotations" value={s.shortlisted} />
        <Metric label="Selected Quotations" value={s.selected} />
      </MetricGrid>
      <div>
        <Sub>Sourcing funnel</Sub>
        <Bars label="Sourcing funnel" items={s.funnel.map((f) => ({ key: f.key, label: f.label, value: f.count }))} />
      </div>
      <div>
        <Sub>Quotations per requirement</Sub>
        <Bars label="Quotations per requirement" items={[{ key: "0", label: "0 quotations", value: s.quotationDistribution.none }, { key: "1", label: "1 quotation", value: s.quotationDistribution.one }, { key: "2", label: "2+ quotations", value: s.quotationDistribution.twoPlus }]} />
      </div>
      <div>
        <Sub>Sourcing cycle time</Sub>
        <ul className="mt-2 divide-y divide-line text-sm" id="sourcing-cycle">
          {s.cycle.map((c) => <li key={c.label} className="flex flex-wrap justify-between gap-2 py-1.5"><span className="text-ink-muted">{c.label}</span><span className="text-ink">{formatAverageDays(c.avg)}</span></li>)}
        </ul>
      </div>
      <div>
        <Sub>Negotiations</Sub>
        <MetricGrid label="Negotiation metrics">
          <Metric label="Negotiations Started" value={s.negotiations.started} href={importerHref("negotiations")} />
          <Metric label="Agreements Reached" value={s.negotiations.agreed} />
          <Metric label="Withdrawn" value={s.negotiations.withdrawn} />
          <Metric label="Closed — Another Supplier Selected" value={s.negotiations.closedAnotherSelected} />
          <Metric label="Average Revisions per Negotiation" value={s.negotiations.avgRevisions ?? "—"} hint="Counter offers + supplier revisions" />
        </MetricGrid>
      </div>
      <div>
        <Sub>Negotiated Price Change</Sub>
        <p className="text-xs text-ink-faint">Original quotation vs agreed unit price, only where currency, unit and Incoterm match.</p>
        <Table
          caption="Negotiated price change"
          headers={["Negotiation", "Requirement", "Supplier", "Quoted", "Agreed", "Difference", "% Difference"]}
          rows={s.priceChanges.map((p) => [
            p.negotiationId,
            <Link key="r" href={importerHref(`rfqs/${p.requirementId}`)} className={link}>{p.requirementId}</Link>,
            supplierName(p.supplierId),
            p.comparable ? `${formatMoney(p.quoted!, p.currency!)} / ${p.unit}` : "—",
            p.comparable ? `${formatMoney(p.agreed!, p.currency!)} / ${p.unit}` : "—",
            p.comparable ? `${p.difference! > 0 ? "+" : p.difference! < 0 ? "−" : ""}${formatMoney(Math.abs(p.difference!), p.currency!)}` : `Not comparable — ${p.reason}`,
            p.comparable ? `${p.percent! > 0 ? "+" : ""}${p.percent}%` : "—",
          ])}
        />
      </div>
    </Section>
  );
}

/* ---------------- Suppliers ---------------- */
function Suppliers({ r }: { r: R }) {
  const [sort, setSort] = useState<"name" | "orders" | "quotations" | "rate">("name");
  const rows = [...r.suppliers].sort((a, b) => (sort === "orders" ? b.orders - a.orders : sort === "quotations" ? b.quotations - a.quotations : sort === "rate" ? (b.selectionRate ?? -1) - (a.selectionRate ?? -1) : 0) || a.name.localeCompare(b.name));
  return (
    <Section
      id="suppliers-report"
      title="Supplier Performance"
      description="Selection rate = selected quotations ÷ quotations received from the supplier. Delivery figures are factual shipment states, not a reliability score."
      action={<ExportCsv report="supplier-performance" headers={["Supplier", "Country", "Quotations", "Selected", "Selection Rate %", "Negotiations", "Agreements", "Orders", "Order Value", "Active Shipments", "Delivered", "Delayed", "On Schedule", "Avg Quoted Lead Time (days)"]} rows={rows.map((s) => [s.name, s.country, s.quotations, s.selectedQuotations, s.selectionRate ?? "", s.negotiations, s.agreements, s.orders, formatByCurrency(s.orderValue), s.activeShipments, s.deliveredShipments, s.delayedShipments, s.onScheduleShipments, s.avgLeadTimeDays ?? ""])} />}
    >
      <label className="block max-w-xs">
        <span className="mb-1 block text-xs font-medium text-ink-muted">Sort suppliers by</span>
        <select id="supplier-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink">
          <option value="name">Name</option>
          <option value="orders">Orders (most first)</option>
          <option value="quotations">Quotations submitted (most first)</option>
          <option value="rate">Selection rate (highest first)</option>
        </select>
      </label>
      <Table
        caption="Supplier performance"
        minWidth="68rem"
        headers={["Supplier", "Quotations Submitted", "Negotiations", "Agreements Won", "Orders", "Order Value by Currency", "Active Shipments", "Delivered", "Delayed", "On Schedule", "Avg Quoted Lead Time", "Quotation Selection Rate"]}
        rows={rows.map((s) => [
          <Link key="s" href={importerHref(`suppliers/${s.supplierId}`)} className={link} data-supplier={s.supplierId}>{s.name}</Link>,
          s.quotations,
          s.negotiations,
          s.agreements,
          s.orders,
          formatByCurrency(s.orderValue),
          s.activeShipments,
          s.deliveredShipments,
          s.delayedShipments,
          s.onScheduleShipments,
          s.avgLeadTimeDays !== undefined ? `${s.avgLeadTimeDays} days` : "—",
          s.selectionRate !== undefined ? `${s.selectionRate}% (${s.selectedQuotations} ÷ ${s.quotations})` : "—",
        ])}
      />
    </Section>
  );
}

/* ---------------- Orders ---------------- */
function Orders({ r, scoped }: { r: R; scoped: Scoped }) {
  const o = r.orders;
  const rows = scoped.orders.map((x) => [x.id, x.purchaseOrder.number, supplierName(x.supplierId), x.terms.productName, orderStatusLabel(orderStatus(x)), x.terms.incoterm, x.terms.currency, orderValue(x.terms).toFixed(2), x.createdAt.slice(0, 10)]);
  const dim = (list: R["orders"]["bySupplier"]) => list.map((g) => [g.label, g.count, formatByCurrency(g.value)]);
  return (
    <Section id="orders-report" title="Order & Spend Analysis" description="Order values are grouped by currency; different currencies are never added together." action={<ExportCsv report="orders" headers={["Order", "PO", "Supplier", "Product", "Status", "Incoterm", "Currency", "Order Value", "Created"]} rows={rows} />}>
      <MetricGrid label="Order metrics">
        <Metric label="Total Orders" value={o.total} href={importerHref("orders")} />
        {o.valueByCurrency.map((v) => <Metric key={v.currency} id={`value-${v.currency}`} label={`Order Value (${v.currency})`} value={formatMoney(v.total, v.currency)} hint={`Average ${formatMoney(v.average, v.currency)} over ${v.count} orders`} />)}
      </MetricGrid>
      <div>
        <Sub>Orders by status</Sub>
        <Bars label="Orders by status" items={o.byStatus.map((s) => ({ key: s.status, label: s.label, value: s.count }))} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div><Sub>By supplier</Sub><Table caption="Orders by supplier" minWidth="24rem" headers={["Supplier", "Orders", "Value by Currency"]} rows={dim(o.bySupplier)} /></div>
        <div><Sub>By product</Sub><Table caption="Orders by product" minWidth="24rem" headers={["Product", "Orders", "Value by Currency"]} rows={dim(o.byProduct)} /></div>
        <div><Sub>By supplier country</Sub><Table caption="Orders by country" minWidth="24rem" headers={["Country", "Orders", "Value by Currency"]} rows={dim(o.byCountry)} /></div>
        <div><Sub>By Incoterm</Sub><Table caption="Orders by Incoterm" minWidth="24rem" headers={["Incoterm", "Orders", "Value by Currency"]} rows={dim(o.byIncoterm)} /></div>
      </div>
    </Section>
  );
}

/* ---------------- Shipments (Tracking owns "delayed") ---------------- */
function Shipments({ r, scoped }: { r: R; scoped: Scoped }) {
  const s = r.shipments;
  const rows = scoped.tracking.map((t) => [t.shipment.id, t.supplierName, `${t.shipment.route.portOfLoading} -> ${t.shipment.route.portOfDischarge}`, t.state.status, SCHEDULE_STATUS_LABEL[t.schedule.status], t.schedule.baseline.eta, t.schedule.current.eta, t.schedule.etaDelayDays, t.open.length]);
  return (
    <Section id="shipments-report" title="Shipment Performance" description="Delay and schedule status come from Tracking." action={<ExportCsv report="shipments" headers={["Shipment", "Supplier", "Route", "Status", "Schedule", "Planned ETA", "Current ETA", "ETA Shift (days)", "Open Exceptions"]} rows={rows} />}>
      <MetricGrid label="Shipment metrics">
        <Metric label="Total Shipments" value={s.total} href={importerHref("shipments")} />
        <Metric label="Active" value={s.active} />
        <Metric label="In Transit" value={s.inTransit} />
        <Metric label="At Customs" value={s.atCustoms} />
        <Metric label="Delivered" value={s.delivered} />
        <Metric label="Delayed" value={s.delayed} href={importerHref("tracking")} />
        <Metric label="On Schedule" value={s.onSchedule} />
        <Metric label="Average Schedule Shift" value={s.avgEtaShiftDays.value !== undefined ? `${s.avgEtaShiftDays.value > 0 ? "+" : ""}${s.avgEtaShiftDays.value} days` : "Not enough data"} hint="Current ETA − planned ETA" />
      </MetricGrid>
      <div>
        <Sub>Delays</Sub>
        <Table
          caption="Delayed shipments"
          minWidth="52rem"
          headers={["Shipment", "Supplier", "Route", "Planned ETA", "Current ETA", "Delay", "Current Stage", "Open Exceptions"]}
          rows={s.delays.map((x) => [<Link key="t" href={importerHref(`tracking/${x.shipmentId}`)} className={link}>{x.shipmentId}</Link>, x.supplier, x.route, formatDate(x.plannedEta), formatDate(x.currentEta), `${x.overdue ? "Overdue " : "+"}${x.delayDays} ${x.delayDays === 1 ? "day" : "days"}`, x.stage, x.openExceptions])}
        />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div><Sub>By destination</Sub><Bars label="Shipments by destination" items={s.byDestination.map((x) => ({ key: x.key, label: x.key, value: x.count }))} /></div>
        <div><Sub>By port of discharge</Sub><Bars label="Shipments by port of discharge" items={s.byPort.map((x) => ({ key: x.key, label: x.key, value: x.count }))} /></div>
        <div><Sub>By transport mode</Sub><Bars label="Shipments by transport mode" items={s.byMode.map((x) => ({ key: x.key, label: x.key, value: x.count }))} /></div>
      </div>
      <div>
        <Sub>Shipment status</Sub>
        <Bars label="Shipments by stage" items={s.byStage.map((x) => ({ key: x.key, label: x.label, value: x.count }))} />
      </div>
      <div>
        <Sub>Shipment cycle time</Sub>
        <ul className="mt-2 divide-y divide-line text-sm" id="shipment-cycle">
          {s.cycle.map((c) => <li key={c.label} className="flex flex-wrap justify-between gap-2 py-1.5"><span className="text-ink-muted">{c.label}</span><span className="text-ink">{formatAverageDays(c.avg)}</span></li>)}
        </ul>
      </div>
    </Section>
  );
}

/* ---------------- Documents & compliance ---------------- */
function Compliance({ r }: { r: R }) {
  const d = r.documents;
  return (
    <Section id="compliance-report" title="Document & Compliance Health" description="From the Document Center and the Compliance assessment. Readiness is for the current workflow stage, not a legal determination.">
      <MetricGrid label="Document metrics">
        <Metric label="Required Documents" value={d.required} href={importerHref("documents")} />
        <Metric label="Approved for Workflow" value={d.approved} />
        <Metric label="Missing Required" value={d.missing} />
        <Metric label="Needs Review" value={d.needsReview} />
        <Metric label="Expired" value={d.expired} />
        <Metric label="Expiring Soon" value={d.expiringSoon} hint="Within 30 days" />
      </MetricGrid>
      <div>
        <Sub>Document types</Sub>
        <Table caption="Required documents by type" headers={["Document", "Required", "Complete", "Missing", "Needs Review"]} rows={d.byType.map((t) => [t.group, t.required, t.complete, t.missing, t.needsReview])} />
      </div>
      <div>
        <Sub>Compliance readiness (shipments)</Sub>
        <Bars label="Compliance readiness" items={(["ready", "needs-review", "blocked"] as const).map((k) => ({ key: k, label: READINESS_LABEL[k], value: d.compliance[k], href: importerHref("compliance") }))} />
      </div>
    </Section>
  );
}

/* ---------------- Customs ---------------- */
function Customs({ r }: { r: R }) {
  const c = r.customs;
  return (
    <Section id="customs-report" title="Customs Operations" description="Case states from the Customs workspace. CHA figures are factual counts, not a ranking.">
      <MetricGrid label="Customs metrics">
        <Metric label="Customs Cases" value={c.cases} href={importerHref("customs")} />
        {c.byStatus.filter((s) => s.status !== "filed" && s.status !== "under-assessment").map((s) => (
          <Metric key={s.status} label={s.status === "cleared" ? "Cleared — Historical / Demo" : s.label} value={s.count} />
        ))}
      </MetricGrid>
      <div>
        <Sub>Customs bottlenecks</Sub>
        <Bars label="Customs bottlenecks" items={c.blockers.map((b) => ({ key: b.key, label: b.label, value: b.count }))} />
      </div>
      <div>
        <Sub>CHA activity</Sub>
        <MetricGrid label="CHA activity">
          <Metric label="Cases Assigned" value={c.cha.assigned} />
          <Metric label="Cases with Clarifications" value={c.cha.withClarifications} />
          <Metric label="Cases Ready for Filing" value={c.cha.readyForFiling} />
          <Metric label="Historical Cleared Cases" value={c.cha.historicalCleared} />
        </MetricGrid>
      </div>
    </Section>
  );
}

/* ---------------- Landed cost ---------------- */
function LandedCost({ r }: { r: R }) {
  const l = r.landedCost;
  return (
    <Section id="landed-report" title="Landed Cost Analysis" description="Planning estimates from the Landed Cost workspace, in each sheet's calculation currency.">
      <MetricGrid label="Landed cost metrics">
        <Metric label="Cost Sheets" value={l.sheets} href={importerHref("landed-cost")} />
        <Metric label="Estimate Complete" value={l.byStatus.complete} />
        <Metric label="Partial Estimate" value={l.byStatus.partial} />
        <Metric label="Needs Input" value={l.byStatus["needs-input"]} href={importerHref("landed-cost")} />
      </MetricGrid>
      <div>
        <Sub>Estimates</Sub>
        <Table
          caption="Landed cost estimates"
          minWidth="52rem"
          headers={["Order", "Status", "Commercial Cost", "Logistics", "Duties & Taxes", "Other", "Estimated Landed Cost", "Per Unit"]}
          rows={l.estimates.map((e) => [
            <Link key="l" href={importerHref(`landed-cost/${e.orderId}`)} className={link}>{e.orderId}</Link>,
            COST_STATUS_LABEL[e.status],
            formatMoney(e.commercial, e.currency),
            formatMoney(e.logistics, e.currency),
            formatMoney(e.duties, e.currency),
            formatMoney(e.other, e.currency),
            e.total !== undefined ? formatMoney(e.total, e.currency) : "Not calculated",
            e.perUnit !== undefined ? `${formatMoney(e.perUnit, e.currency)} / ${e.unit}` : "—",
          ])}
        />
      </div>
      <div>
        <Sub>Cost drivers (complete estimates, per currency)</Sub>
        {l.drivers.length === 0 ? <p className="text-sm text-ink-muted">No complete estimates in the selected data.</p> : l.drivers.map((d) => (
          <div key={d.currency} className="mt-2">
            <p className="text-xs font-semibold text-ink-muted">{d.currency} · total {formatMoney(d.total, d.currency)}</p>
            <Bars label={`Cost drivers ${d.currency}`} items={d.parts.map((p) => ({ key: p.key, label: p.label, value: p.amount, display: `${formatMoney(p.amount, d.currency)} · ${d.total ? ((p.amount / d.total) * 100).toFixed(1) : "0"}%` }))} />
          </div>
        ))}
      </div>
      <div>
        <Sub>Variance from saved snapshots</Sub>
        {l.variance.length === 0 ? <p className="text-sm text-ink-muted" id="variance-empty">No saved snapshots to compare. Save a snapshot on a cost sheet to track changes.</p> : (
          <Table caption="Landed cost variance" headers={["Order", "Baseline", "Latest", "Change"]} rows={l.variance.map((v) => [v.orderId, `${formatMoney(v.baseline, v.currency)} (${v.baselineLabel})`, formatMoney(v.latest, v.currency), `${v.change >= 0 ? "+" : "−"}${formatMoney(Math.abs(v.change), v.currency)}`])} />
        )}
      </div>
    </Section>
  );
}

/* ---------------- Payments ---------------- */
function Payments({ r }: { r: R }) {
  const p = r.payments;
  return (
    <Section id="payments-report" title="Payment Exposure" description="Supplier payment obligations from the Payments workspace, grouped by currency." action={<ExportCsv report="payments" headers={["Order", "Supplier", "Currency", "Order Value", "Recorded", "Remaining", "Next Due", "Status"]} rows={p.exposure.map((x) => [x.orderId, x.supplier, x.currency, x.orderValue.toFixed(2), x.recorded.toFixed(2), x.remaining.toFixed(2), x.nextDue ?? "", WORKSPACE_STATUS_LABEL[x.status as keyof typeof WORKSPACE_STATUS_LABEL]])} />}>
      <Table caption="Payment totals by currency" headers={["Currency", "Supplier Order Value", "Scheduled Payments", "Payment Recorded", "Remaining"]} rows={p.byCurrency.map((c) => [c.currency, formatMoney(c.orderValue, c.currency), formatMoney(c.scheduled, c.currency), formatMoney(c.recorded, c.currency), formatMoney(c.remaining, c.currency)])} />
      <MetricGrid label="Payment obligations">
        <Metric label="Upcoming / Ready" value={p.obligations.upcoming} href={importerHref("payments")} />
        <Metric label="Due" value={p.obligations.due} />
        <Metric label="Overdue" value={p.obligations.overdue} href={importerHref("payments")} />
        <Metric label="Awaiting Documents" value={p.obligations.awaitingDocuments} />
        <Metric label="Payment Recorded" value={p.obligations.recorded} />
      </MetricGrid>
      <div>
        <Sub>Exposure by order</Sub>
        <Table
          caption="Payment exposure"
          minWidth="48rem"
          headers={["Order", "Supplier", "Currency", "Order Value", "Recorded", "Remaining", "Next Due", "Status"]}
          rows={p.exposure.map((x) => [<Link key="p" href={importerHref(`payments/${x.orderId}`)} className={link}>{x.orderId}</Link>, x.supplier, x.currency, formatMoney(x.orderValue, x.currency), formatMoney(x.recorded, x.currency), formatMoney(x.remaining, x.currency), x.nextDue ? formatDate(x.nextDue) : "—", WORKSPACE_STATUS_LABEL[x.status as keyof typeof WORKSPACE_STATUS_LABEL]])}
        />
      </div>
      <div>
        <Sub>Trade finance</Sub>
        <MetricGrid label="Trade finance">
          <Metric label="LC Required" value={p.finance.lcRequired} />
          <Metric label="LC Not Started" value={p.finance.lcNotStarted} />
          <Metric label="LC Issued — Recorded Externally" value={p.finance.lcIssued} />
          <Metric label="LC Expiring Soon" value={p.finance.lcExpiringSoon} />
          <Metric label="Finance Planning" value={p.finance.financePlanning} />
          <Metric label="Ready to Approach Provider" value={p.finance.readyToApproach} hint="Internal checklist only" />
        </MetricGrid>
      </div>
    </Section>
  );
}
