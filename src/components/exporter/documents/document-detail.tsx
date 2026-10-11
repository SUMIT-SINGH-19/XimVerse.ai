"use client";

import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, CircleCheck, CircleX, Info } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDate } from "@/lib/exporter-dashboard";
import { formatDateTime } from "@/lib/exporter-opportunities";
import { DOCUMENT_STATUS_DISPLAY, OWNER_TYPE_LABEL, type DocumentItem, type DocumentSources } from "@/lib/exporter-documents";
import { useIsClient } from "@/lib/exporter-quotation-store";
import { DemoTag } from "@/components/exporter/shipments/shipment-ui";
import { criticality, DocumentStatusBadge, useDocumentIndex } from "./document-ui";

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const when = (at: string) => (at.length === 10 ? formatDate(at) : formatDateTime(at));

/** RFQ → … → Order → Shipment → Document, or Company Profile → Credential. */
function chainFor(d: DocumentItem, src: DocumentSources) {
  if (d.ownerType === "company") return [{ label: "Company Profile", id: "Company Profile", href: d.source.href }, { label: "Credential", id: d.title }];
  const order = src.orders.find((o) => o.id === d.orderId);
  const out: { label: string; id: string; href?: string }[] = [];
  if (order) {
    out.push(
      { label: "RFQ", id: order.requirementId, href: exporterHref(`opportunities/${order.requirementId}`) },
      { label: "Opportunity", id: order.opportunityId, href: exporterHref(`opportunities/${order.requirementId}`) },
      { label: "Quotation", id: order.quotationId, href: exporterHref(`quotations/${order.quotationId}`) },
      ...(order.negotiationId ? [{ label: "Negotiation", id: order.negotiationId, href: exporterHref(`negotiations/${order.negotiationId}`) }] : []),
      { label: "Deal", id: order.dealId, href: exporterHref(`deals/${order.dealId}`) },
      { label: "Order", id: order.id, href: exporterHref(`orders/${order.id}`) },
    );
  }
  if (d.shipmentId) out.push({ label: "Shipment", id: d.shipmentId, href: exporterHref(`shipments/${d.shipmentId}`) });
  out.push({ label: "Document", id: d.title });
  return out;
}

function DocumentView({ d, src, index }: { d: DocumentItem; src: DocumentSources; index: readonly DocumentItem[] }) {
  const failing = d.blockers.filter((b) => !b.done);
  const showBlockers = !d.complete && d.blockers.length > 0;
  const chain = chainFor(d, src);
  const dependsOn = d.code === "SB" ? index.filter((x) => x.ownerId === d.ownerId && ["SI", "CONTAINERS"].includes(x.code)).concat(index.filter((x) => x.ownerType === "order" && x.ownerId === d.orderId && ["INVOICE", "PACKING"].includes(x.code))) : [];
  const info: [string, React.ReactNode][] = [
    ["Document ID", <span key="id" className="font-mono text-xs [overflow-wrap:anywhere]">{d.id}</span>],
    ["Owner", d.ownerType === "company" ? "Company Profile" : `${OWNER_TYPE_LABEL[d.ownerType]} ${d.ownerId}`],
    ["Stage", d.stage],
    ["Status", `${DOCUMENT_STATUS_DISPLAY[d.status]} · source: ${d.sourceStatus}`],
    ...(d.issuer ? ([["Issuer / authority", d.issuer]] as [string, string][]) : []),
    ...(d.reference ? ([["Reference", <span key="r" className="font-mono text-xs">{d.reference}</span>]] as [string, React.ReactNode][]) : []),
    ...(d.expiresOn ? ([["Expiry date", formatDate(d.expiresOn)]] as [string, string][]) : []),
    ...(d.blockedStep && !d.complete ? ([["Needed for", d.blockedStep]] as [string, string][]) : []),
    ...d.facts,
    ["Source", d.source.label],
  ];

  return (
    <div className="space-y-6">
      <Link href={exporterHref("documents")} className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to Documents
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <DocumentStatusBadge status={d.status} />
              {d.demo && <DemoTag />}
              <span className="text-xs text-ink-muted">{criticality(d)}</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">{d.title}</h1>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div className="min-w-0"><dt className="text-xs text-ink-faint">Owner</dt><dd className="text-ink [overflow-wrap:anywhere]">{d.ownerType === "company" ? "Company" : <Link href={d.source.href} className="font-mono text-teal hover:text-ink">{d.ownerId}</Link>}</dd></div>
              {d.ownerType === "shipment" && d.orderId && <div className="min-w-0"><dt className="text-xs text-ink-faint">Order</dt><dd><Link href={exporterHref(`orders/${d.orderId}`)} className="font-mono text-teal hover:text-ink">{d.orderId}</Link></dd></div>}
              {d.product && <div className="min-w-0"><dt className="text-xs text-ink-faint">Product</dt><dd className="text-ink">{d.product}</dd></div>}
              {d.destination && <div className="min-w-0"><dt className="text-xs text-ink-faint">Destination</dt><dd className="text-ink">{d.destination}</dd></div>}
              <div className="min-w-0"><dt className="text-xs text-ink-faint">Stage</dt><dd className="text-ink">{d.stage}</dd></div>
              {d.expiry && <div className="min-w-0"><dt className="text-xs text-ink-faint">Expiry</dt><dd className={d.expiry.band === "valid" ? "text-ink" : "font-semibold text-orange"}>{d.expiry.label}</dd></div>}
            </dl>
          </div>
          <Link href={d.next.href} className={`flex items-center justify-between gap-3 self-start rounded-xl px-4 py-3 text-sm ${d.attention || d.blocking ? "bg-orange-soft" : "bg-teal-soft"} ${focusRing}`}>
            <span className="min-w-0">
              <span className={`block text-xs font-semibold uppercase tracking-[0.1em] ${d.attention || d.blocking ? "text-orange" : "text-teal"}`}>Next action</span>
              <span className="block font-medium text-ink">{d.next.text}</span>
              <span className="block text-xs text-ink-muted">Opens {d.source.label}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-ink-faint" aria-hidden />
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          {showBlockers && (
            <Card title={failing.length ? "Why blocked?" : "Prerequisites"} aside={d.blockedStep && <span className="text-xs text-ink-muted">For: {d.blockedStep}</span>}>
              <p className="-mt-1 mb-3 text-sm text-ink-muted">Read live from {d.source.label}&apos;s own rules — the same checks that page enforces.</p>
              <ul className="space-y-2">
                {d.blockers.map((b) => (
                  <li key={b.key} className="flex items-start gap-2 text-sm">
                    {b.done ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-label="Met" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-orange" aria-label="Not met" />}
                    <span className={b.done ? "text-ink-muted" : "font-medium text-ink"}>{b.done ? b.label : (b.detail ?? b.label)}</span>
                  </li>
                ))}
              </ul>
              <Link href={d.source.href} className={`mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:border-teal hover:bg-teal-soft ${focusRing}`}>
                Open {d.source.label}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Card>
          )}

          {d.code === "SB" && (
            <Card title="Dependencies" aside={<DemoTag />}>
              <div className="flex flex-col items-start gap-1 text-sm">
                <ul className="w-full space-y-1 rounded-xl border border-line p-3">
                  {dependsOn.map((x) => (
                    <li key={x.id} className="flex items-center justify-between gap-2">
                      <Link href={exporterHref(`documents/${x.id}`)} className={`text-ink hover:text-teal ${focusRing}`}>{x.title}</Link>
                      <DocumentStatusBadge status={x.status} />
                    </li>
                  ))}
                  {d.blockers.filter((b) => ["cha", "dossier", "cargo"].includes(b.key)).map((b) => (
                    <li key={b.key} className="flex items-center justify-between gap-2">
                      <span className="text-ink">{b.label}</span>
                      <span className={`text-xs font-semibold ${b.done ? "text-teal" : "text-orange"}`}>{b.done ? "Done" : "Open"}</span>
                    </li>
                  ))}
                </ul>
                {["Ready for Filing", "Filed", "Acknowledged", "LEO Received"].map((s) => {
                  const step = d.timeline.find((t) => t.label === s);
                  return (
                    <div key={s} className="flex flex-col items-start">
                      <ArrowDown className="ml-4 size-4 text-ink-faint" aria-hidden />
                      <span className={`rounded-lg px-2.5 py-1 text-sm ${step?.state === "todo" ? "bg-canvas text-ink-faint ring-1 ring-inset ring-line" : step?.state === "current" ? "bg-teal text-on-brand" : "bg-teal-soft text-teal"}`}>{s}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {d.timeline.length > 0 && (
            <Card title="Status Timeline">
              <ol className="space-y-2">
                {d.timeline.map((t) => (
                  <li key={t.label} className="flex items-start gap-2.5 text-sm">
                    <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${t.state === "todo" ? "border-2 border-line" : "bg-teal"}`} />
                    <span className={`min-w-0 flex-1 ${t.state === "current" ? "font-semibold text-ink" : t.state === "done" ? "text-ink" : "text-ink-faint"}`}>{t.label}{t.state === "current" && " — current"}</span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-faint">{t.at ? when(t.at) : t.state === "todo" ? "" : "—"}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-ink-faint">Dates appear only where the source recorded them.</p>
            </Card>
          )}

          <Card title="Document Information">
            <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
              {info.map(([l, v]) => (
                <div key={l} className="min-w-0 bg-surface px-4 py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-faint">{l}</dt>
                  <dd className="mt-0.5 text-sm text-ink [overflow-wrap:anywhere]">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Source Traceability">
            <ol className="flex flex-col items-start gap-1">
              {chain.map((c, i) => (
                <li key={`${c.label}-${c.id}`} className="flex flex-col items-start">
                  <span className="flex items-baseline gap-2">
                    <span className="w-24 text-xs text-ink-faint">{c.label}</span>
                    {c.href ? <Link href={c.href} className={`font-mono text-sm text-teal hover:text-ink ${focusRing}`}>{c.id}</Link> : <span className="text-sm font-semibold text-ink">{c.id}</span>}
                  </span>
                  {i < chain.length - 1 && <ArrowDown className="ml-26 size-3.5 text-ink-faint" aria-hidden />}
                </li>
              ))}
            </ol>
            {d.usedBy.length > 0 && (
              <p className="mt-3 text-sm text-ink-muted">
                Read by {d.usedBy.map((id, i) => <span key={id}>{i > 0 && ", "}<Link href={exporterHref(`shipments/${id}`)} className="font-mono text-teal hover:text-ink">{id}</Link></span>)} — one record, shared by all of the order&apos;s shipments.
              </p>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Why Required">
            <p className="text-sm leading-relaxed text-ink">{d.requirement}</p>
          </Card>
          <Card title="Responsibility">
            <ul className="space-y-2 text-sm">
              {d.responsibility.map((r) => (
                <li key={r.party + r.role} className="flex justify-between gap-3">
                  <span className="font-medium text-ink">{r.party}</span>
                  <span className="text-right text-ink-muted">{r.role}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-faint">Roles only — no external party has acted through Ximverse.</p>
          </Card>
          <p className="flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
            <span>Read-only view of {d.source.label}. No file is stored or generated here; change the document where it lives.{d.demo && " Customs and carrier states are demo records."}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Resolves a document from the live index (seeded or browser-created owners). */
export function DocumentById({ id }: { id: string }) {
  const isClient = useIsClient();
  const { index, src } = useDocumentIndex();
  const d = index.find((x) => x.id === id);
  if (d) return <DocumentView d={d} src={src} index={index} />;
  if (!isClient) return <p className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-sm text-ink-muted">Loading document…</p>;
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
      <p className="font-semibold text-ink">Document {id} isn&apos;t in this browser&apos;s records</p>
      <p className="mt-1 text-sm text-ink-muted">Its order or shipment may have been created in another browser.</p>
      <Link href={exporterHref("documents")} className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to Documents
      </Link>
    </div>
  );
}
