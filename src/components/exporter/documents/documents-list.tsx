"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, Search, SearchX, SlidersHorizontal, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { focusRing } from "@/components/workspace/styles";
import { Select } from "@/components/exporter/products/catalogue-filters";
import { ProgressBar } from "@/components/exporter/orders/order-ui";
import { exporterHref } from "@/lib/exporter-nav";
import {
  customsDocumentReadiness,
  documentActions,
  documentInsights,
  DOCUMENT_STATUS_DISPLAY,
  isExpiringSoon,
  OWNER_TYPE_LABEL,
  workspaceReadiness,
  type DocumentItem,
  type DocumentOwnerType,
  type DocumentStage,
  type DocumentStatus,
} from "@/lib/exporter-documents";
import { isActiveShipment, shipmentState } from "@/lib/exporter-shipments";
import { DocumentStatusBadge, useDocumentIndex } from "./document-ui";

type View = "all" | "attention" | "company" | "orders" | "shipments" | "customs" | "expiring";
type Sort = "attention" | "newest" | "expiry" | "stage" | "name";

const VIEWS: { id: View; label: string; match: (d: DocumentItem) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "attention", label: "Needs Attention", match: (d) => d.attention },
  { id: "company", label: "Company Credentials", match: (d) => d.ownerType === "company" },
  { id: "orders", label: "Orders", match: (d) => d.ownerType === "order" },
  { id: "shipments", label: "Shipments", match: (d) => d.ownerType === "shipment" },
  { id: "customs", label: "Customs", match: (d) => d.customsCritical },
  { id: "expiring", label: "Expiring", match: (d) => Boolean(d.expiry) },
];

const STAGE_ORDER: Record<DocumentStage, number> = { Company: 0, "Pre-Shipment": 1, Customs: 2, Transport: 3 };
const th = "whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint first:pl-5 last:pr-4";
const td = "px-2.5 py-3 align-top first:pl-5 last:pr-4";

function Owner({ d }: { d: DocumentItem }) {
  return (
    <>
      <span className="block text-xs text-ink-faint">{OWNER_TYPE_LABEL[d.ownerType]}</span>
      {d.ownerType === "company" ? <span className="text-ink">Company</span> : <Link href={d.source.href} className={`font-mono text-xs text-teal [overflow-wrap:anywhere] hover:text-ink ${focusRing}`}>{d.ownerId}</Link>}
    </>
  );
}

function timing(d: DocumentItem): string {
  if (d.expiry) return d.expiry.label;
  if (!d.complete && d.blockedStep && d.due) return `Before ${d.blockedStep}`;
  return "—";
}

/** One derived index; every view, filter and panel is a lens over it. */
export function DocumentsList() {
  const { index, src } = useDocumentIndex();
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<DocumentOwnerType | "">("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState<DocumentStatus | "">("");
  const [stage, setStage] = useState<DocumentStage | "">("");
  const [order, setOrder] = useState("");
  const [shipment, setShipment] = useState("");
  const [destination, setDestination] = useState("");
  const [expiry, setExpiry] = useState<"" | "dated" | "soon">("");
  const [critical, setCritical] = useState<"" | "yes">("");
  const [sort, setSort] = useState<Sort>("attention");
  const [showFilters, setShowFilters] = useState(false);

  const readiness = workspaceReadiness(index, src);
  const actions = documentActions(index);
  const insights = documentInsights(index);
  const metrics = [
    { label: "Needs Attention", value: index.filter((d) => d.attention).length, alert: true },
    { label: "Expiring Soon", value: index.filter(isExpiringSoon).length, alert: true, hint: "Within 90 days" },
    { label: "Blocked", value: index.filter((d) => d.blocking).length, alert: true },
    { label: "Total Documents", value: index.length },
    { label: "Preparing", value: index.filter((d) => d.status === "preparing").length },
    { label: "Ready / Approved", value: index.filter((d) => d.complete).length },
    { label: "Shipment-Critical", value: index.filter((d) => d.ownerType === "shipment" && d.due && !d.complete).length, hint: "Open, due now" },
  ];

  const q = query.trim().toLowerCase();
  const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => Boolean(x)))].sort();
  const cmp: Record<Sort, (a: DocumentItem, b: DocumentItem) => number> = {
    attention: (a, b) => Number(b.blocking) - Number(a.blocking) || Number(b.attention) - Number(a.attention) || Number(a.complete) - Number(b.complete),
    newest: (a, b) => (b.activityAt ?? "").localeCompare(a.activityAt ?? ""),
    expiry: (a, b) => (a.expiry?.days ?? 99999) - (b.expiry?.days ?? 99999),
    stage: (a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage],
    name: (a, b) => a.title.localeCompare(b.title),
  };
  const lens = VIEWS.find((v) => v.id === view)!;
  const visible = index
    .filter(
      (d) =>
        lens.match(d) &&
        (!q || [d.title, d.id, d.orderId, d.shipmentId, d.product, d.destination].some((x) => x?.toLowerCase().includes(q))) &&
        (!owner || d.ownerType === owner) &&
        (!type || d.title === type) &&
        (!status || d.status === status) &&
        (!stage || d.stage === stage) &&
        (!order || d.orderId === order) &&
        (!shipment || d.shipmentId === shipment) &&
        (!destination || d.destination === destination) &&
        (!expiry || (expiry === "dated" ? Boolean(d.expiry) : isExpiringSoon(d))) &&
        (!critical || d.customsCritical),
    )
    .sort(cmp[sort]);

  // Customs view: per shipment, from the same index plus the shipment's own readiness rules.
  const customsShipments = src.shipments.filter((s) => isActiveShipment(shipmentState(s).status));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Operations" title="Documents" description="Track credentials, trade documents and shipment paperwork across your export operations." />

      <ul aria-label="Document summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {metrics.map((m, i) => (
          // Phones keep the four that call for action; the rest appear from sm up.
          <li key={m.label} className={`${i >= 4 ? "hidden sm:flex" : "flex"} flex-col rounded-2xl border border-line bg-surface px-3 py-2.5 sm:p-4`}>
            <span className="text-xs font-medium text-ink-muted sm:text-sm">{m.label}</span>
            <span className={`mt-0.5 text-xl font-bold tabular-nums sm:text-2xl ${m.alert && m.value > 0 ? "text-orange" : "text-ink"}`}>{m.value}</span>
            {m.hint && <span className="hidden text-[0.6875rem] text-ink-faint sm:block">{m.hint}</span>}
          </li>
        ))}
      </ul>

      <section aria-labelledby="documents-heading" className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
          <h2 id="documents-heading" className="text-base font-semibold tracking-tight text-ink">
            {lens.label} <span className="ml-1 text-sm font-normal text-ink-muted">{view === "customs" ? `${customsShipments.length} shipments` : `${visible.length} of ${index.length}`}</span>
          </h2>
          <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 rounded-lg border border-line bg-canvas px-2 text-sm text-ink focus:border-teal focus:outline-none">
              <option value="attention">Needs Attention</option>
              <option value="newest">Newest</option>
              <option value="expiry">Closest Expiry</option>
              <option value="stage">Shipment Stage</option>
              <option value="name">Document Name</option>
            </select>
          </label>
        </div>
        <div role="group" aria-label="Views" className="flex flex-wrap gap-1.5 px-4 pb-3 sm:px-6">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${view === v.id ? "bg-teal text-on-brand" : "bg-canvas text-ink-muted ring-1 ring-inset ring-line hover:text-ink"} ${focusRing}`}
            >
              {v.label} <span className="tabular-nums opacity-80">{v.id === "customs" ? customsShipments.length : index.filter(v.match).length}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 px-4 pb-3 sm:px-6">
          <span className="relative min-w-0 flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input type="search" aria-label="Search documents" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Document, DOC-, ORD-, SHP-, product…" className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-2.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20" />
          </span>
          <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink lg:hidden ${focusRing}`}>
            <SlidersHorizontal className="size-4" aria-hidden />
            Filters
          </button>
        </div>
        <div className={`${showFilters ? "grid" : "hidden"} grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 sm:px-6 lg:grid lg:grid-cols-5 2xl:grid-cols-9`}>
          <Select label="Owner type" value={owner} onChange={setOwner} options={(Object.keys(OWNER_TYPE_LABEL) as DocumentOwnerType[]).map((x) => ({ value: x, label: OWNER_TYPE_LABEL[x] }))} allLabel="All owners" />
          <Select label="Document type" value={type} onChange={setType} options={uniq(index.map((d) => d.title)).map((x) => ({ value: x, label: x }))} allLabel="All types" />
          <Select label="Status" value={status} onChange={setStatus} options={(Object.keys(DOCUMENT_STATUS_DISPLAY) as DocumentStatus[]).map((x) => ({ value: x, label: DOCUMENT_STATUS_DISPLAY[x] }))} allLabel="All statuses" />
          <Select label="Stage" value={stage} onChange={setStage} options={(Object.keys(STAGE_ORDER) as DocumentStage[]).map((x) => ({ value: x, label: x }))} allLabel="All stages" />
          <Select label="Order" value={order} onChange={setOrder} options={uniq(index.map((d) => d.orderId)).map((x) => ({ value: x, label: x }))} allLabel="All orders" />
          <Select label="Shipment" value={shipment} onChange={setShipment} options={uniq(index.map((d) => d.shipmentId)).map((x) => ({ value: x, label: x }))} allLabel="All shipments" />
          <Select label="Destination" value={destination} onChange={setDestination} options={uniq(index.map((d) => d.destination)).map((x) => ({ value: x, label: x }))} allLabel="All destinations" />
          <Select label="Expiry" value={expiry} onChange={setExpiry} options={[{ value: "dated", label: "Has expiry date" }, { value: "soon", label: "Expiring within 90 days" }]} allLabel="Any" />
          <Select label="Customs critical" value={critical} onChange={setCritical} options={[{ value: "yes", label: "Customs critical only" }]} allLabel="Any" />
        </div>

        {view === "customs" ? (
          <CustomsView index={index} src={src} shipmentIds={customsShipments.map((s) => s.id)} />
        ) : visible.length === 0 ? (
          <div className="border-t border-line px-6 py-14 text-center">
            <SearchX className="mx-auto size-8 text-ink-faint" aria-hidden />
            <p className="mt-3 font-semibold text-ink">No documents match</p>
            {view === "expiring" && <p className="mt-1 text-sm text-ink-muted">Only credentials with an expiry date on the Company Profile appear here.</p>}
          </div>
        ) : (
          <>
            <div className="relative hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[64rem] text-sm">
                <thead className="border-y border-line bg-canvas/60">
                  <tr>
                    <th scope="col" className={th}>Document</th>
                    <th scope="col" className={th}>Owner</th>
                    <th scope="col" className={th}>Transaction</th>
                    <th scope="col" className={th}>Product / Destination</th>
                    <th scope="col" className={th}>Stage</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={th}>Expiry / Timing</th>
                    <th scope="col" className={th}>Blocking?</th>
                    <th scope="col" className={th}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((d) => (
                    <tr key={d.id} className="transition-colors hover:bg-canvas/50">
                      <td className={`${td} max-w-52`}>
                        <Link href={exporterHref(`documents/${d.id}`)} className={`font-semibold text-ink hover:text-teal ${focusRing}`}>{d.title}</Link>
                        <span className="mt-0.5 block font-mono text-[0.6875rem] text-ink-faint [overflow-wrap:anywhere]">{d.id}</span>
                      </td>
                      <td className={td}><Owner d={d} /></td>
                      <td className={`${td} whitespace-nowrap font-mono text-xs text-ink-muted`}>
                        {d.orderId ?? "—"}
                        {d.shipmentId && <span className="block">{d.shipmentId}</span>}
                      </td>
                      <td className={`${td} max-w-40 text-xs`}>
                        <span className="block text-ink">{d.product ?? "—"}</span>
                        <span className="text-ink-muted">{d.destination ?? ""}</span>
                      </td>
                      <td className={`${td} whitespace-nowrap text-ink`}>{d.stage}</td>
                      <td className={td}>
                        <DocumentStatusBadge status={d.status} />
                        {d.sourceStatus !== DOCUMENT_STATUS_DISPLAY[d.status] && <span className="mt-1 block max-w-36 text-xs text-ink-muted">{d.sourceStatus}</span>}
                      </td>
                      <td className={`${td} max-w-32 text-xs ${d.expiry && d.expiry.band !== "valid" ? "font-semibold text-orange" : "text-ink-muted"}`}>{timing(d)}</td>
                      <td className={`${td} text-xs`}>{d.blocking ? <span className="font-semibold text-orange">Yes</span> : <span className="text-ink-faint">—</span>}</td>
                      <td className={`${td} max-w-44`}>
                        <p className="text-xs text-ink-muted">{d.next.text}</p>
                        <Link href={exporterHref(`documents/${d.id}`)} aria-label={`View ${d.title} ${d.id}`} className={`mt-1 inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-teal hover:border-teal hover:bg-teal-soft ${focusRing}`}>
                          View
                          <ArrowRight className="size-3" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 md:grid-cols-2 xl:hidden">
              {visible.map((d) => (
                <li key={d.id}>
                  <Link href={exporterHref(`documents/${d.id}`)} className={`flex h-full flex-col rounded-xl border border-line bg-surface p-4 hover:border-teal ${focusRing}`}>
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink">{d.title}</span>
                        <span className="block text-xs text-ink-muted [overflow-wrap:anywhere]">
                          {OWNER_TYPE_LABEL[d.ownerType]} · {d.ownerType === "company" ? "Company Profile" : d.ownerId}
                          {d.ownerType === "shipment" && d.orderId ? ` · ${d.orderId}` : ""}
                        </span>
                      </span>
                      <DocumentStatusBadge status={d.status} />
                    </span>
                    <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
                      <span>{d.stage}</span>
                      {d.expiry && <span className={d.expiry.band !== "valid" ? "font-semibold text-orange" : ""}>{d.expiry.label}</span>}
                      {d.blocking && <span className="font-semibold text-orange">Blocking</span>}
                    </span>
                    <span className={`mt-2 text-xs ${d.attention ? "text-orange" : "text-ink-muted"}`}>Next: {d.next.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section aria-labelledby="doc-readiness" className="rounded-2xl border border-line bg-surface p-5">
          <h2 id="doc-readiness" className="text-base font-semibold tracking-tight text-ink">Document Readiness</h2>
          <p className="mt-1 text-xs text-ink-faint">How complete the required documents are for each scope. Not Required items never count.</p>
          <ul className="mt-4 space-y-3">
            {([
              ["Order documents", readiness.orders, "Confirmed, active orders"],
              ["Shipment documents", readiness.shipments, "Shipments not yet departed"],
              ["Customs documentation", readiness.customs, "From each shipment's customs readiness rules"],
            ] as const).map(([label, r, hint]) => (
              <li key={label}>
                <p className="flex justify-between text-sm"><span className="text-ink">{label}</span><span className="font-semibold tabular-nums text-ink">{r.percent}%</span></p>
                <ProgressBar value={r.percent} label={`${label} readiness`} />
                <p className="mt-0.5 text-xs text-ink-faint">{r.done} of {r.required} complete · {hint}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="doc-actions" className="rounded-2xl border border-line bg-surface p-5">
          <h2 id="doc-actions" className="text-base font-semibold tracking-tight text-ink">Action Required <span className="text-sm font-normal text-ink-muted">{actions.length}</span></h2>
          {actions.length ? (
            <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
              {actions.map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className={`flex items-start gap-2 rounded-md text-sm hover:text-teal ${focusRing}`}>
                    <CircleAlert className={`mt-0.5 size-4 shrink-0 ${a.blocking ? "text-orange" : "text-ink-faint"}`} aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-mono text-xs text-ink-muted">{a.owner}</span>
                      <span className="text-ink">{a.text}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-teal">Nothing outstanding.</p>
          )}
        </section>

        <aside aria-label="SUMIT insight" className="rounded-2xl border border-teal/15 bg-teal-soft p-5">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal">
            <Sparkles className="size-3.5 text-orange" aria-hidden />
            SUMIT insight
          </p>
          <ul className="mt-2 space-y-2">
            {insights.map((x) => <li key={x} className="text-sm leading-relaxed text-ink">{x}</li>)}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">Rule-based, from Company Profile, Orders and Shipments.</p>
        </aside>
      </div>

      <p className="text-xs text-ink-faint">Read-only index: each document lives with its owner, and every change happens there. No files are stored or generated. Customs and carrier states are demo records.</p>
    </div>
  );
}

const CUSTOMS_CODES = ["INVOICE", "PACKING", "SI", "SB", "ACK", "LEO"] as const;
const CUSTOMS_LABEL: Record<(typeof CUSTOMS_CODES)[number], string> = { INVOICE: "Invoice", PACKING: "Packing List", SI: "Shipping Instructions", SB: "Shipping Bill", ACK: "Customs ACK", LEO: "LEO" };
const CERT_CODES = new Set(["COO", "PHYTO", "FUMIGATION", "HEALTH", "INSPECTION"]);

function CustomsView({ index, src, shipmentIds }: { index: readonly DocumentItem[]; src: ReturnType<typeof useDocumentIndex>["src"]; shipmentIds: string[] }) {
  if (!shipmentIds.length) return <p className="border-t border-line px-6 py-10 text-center text-sm text-ink-muted">No active shipments.</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 lg:grid-cols-2">
      {shipmentIds.map((id) => {
        const sh = src.shipments.find((s) => s.id === id)!;
        const r = customsDocumentReadiness(sh, src.orders, src.shipments);
        const own = index.filter((d) => d.shipmentId === id || (d.ownerType === "order" && d.ownerId === sh.orderId));
        const pick = (code: string) => own.find((d) => d.code === code);
        const certs = own.filter((d) => d.ownerType === "order" && CERT_CODES.has(d.code) && d.required);
        const td = own.find((d) => d.ownerType === "shipment" && d.stage === "Transport" && d.code !== "CONTAINERS");
        return (
          <li key={id} className="rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={exporterHref(`shipments/${id}#customs`)} className={`font-mono text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>{id}</Link>
              <span className="text-xs text-ink-muted">from {sh.orderId}</span>
            </div>
            {r && (
              <div className="mt-2">
                <p className="flex justify-between text-xs text-ink-muted"><span>Customs documentation readiness</span><span className="font-semibold tabular-nums text-ink">{r.percent}%</span></p>
                <ProgressBar value={r.percent} label={`${id} customs documentation readiness`} />
              </div>
            )}
            <ul className="mt-3 divide-y divide-line text-sm">
              {CUSTOMS_CODES.map((code) => {
                const d = pick(code);
                return d ? (
                  <li key={code} className="flex items-center justify-between gap-2 py-1.5">
                    <Link href={exporterHref(`documents/${d.id}`)} className={`text-ink hover:text-teal ${focusRing}`}>{CUSTOMS_LABEL[code]}</Link>
                    <DocumentStatusBadge status={d.status} />
                  </li>
                ) : null;
              })}
              {certs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-1.5">
                  <Link href={exporterHref(`documents/${d.id}`)} className={`text-ink hover:text-teal ${focusRing}`}>{d.title}</Link>
                  <DocumentStatusBadge status={d.status} />
                </li>
              ))}
              {td && (
                <li className="flex items-center justify-between gap-2 py-1.5">
                  <Link href={exporterHref(`documents/${td.id}`)} className={`text-ink hover:text-teal ${focusRing}`}>{td.title}</Link>
                  <DocumentStatusBadge status={td.status} />
                </li>
              )}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
