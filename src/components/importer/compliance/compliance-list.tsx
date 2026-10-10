"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { importerHref } from "@/lib/importer-nav";
import { shipmentState, stageLabel } from "@/lib/importer-shipments";
import { findSupplier } from "@/lib/importer-suppliers";
import { ImportId } from "../dashboard/dashboard-ui";
import { useDocuments } from "../documents/document-store";
import { ImporterPageHeader } from "../importer-page-header";
import { useOrders } from "../orders/order-store";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { useShipments } from "../shipments/shipment-store";
import { useCustomsCases } from "../customs/customs-store";
import { focusRing } from "../styles";
import { assess, Disclaimer, ReadinessBadge } from "./compliance-ui";

export const COMPLIANCE_PROMPTS = [
  "Why is this shipment blocked?",
  "What is missing before customs preparation?",
  "Which required documents need attention?",
  "What data is inconsistent?",
  "Which certificates were requested in the original requirement?",
];

export function ComplianceList() {
  const shipments = useShipments();
  const documents = useDocuments();
  const orders = useOrders();
  const customsCases = useCustomsCases();

  const rows = shipments
    .map((sh) => {
      const a = assess(sh, documents, orders, customsCases);
      const required = a.documents.filter((d) => d.requirement.level === "required");
      return {
        sh,
        st: shipmentState(sh),
        a,
        supplier: findSupplier(sh.supplierId)?.name ?? sh.supplierId,
        requiredDone: required.filter((d) => d.complete).length,
        requiredTotal: required.length,
        blocking: a.issues.filter((i) => i.severity === "blocking").length,
        review: a.issues.filter((i) => i.severity === "review").length,
      };
    })
    .sort((x, y) => x.sh.id.localeCompare(y.sh.id));

  const summary = [
    { label: "Ready", value: rows.filter((r) => r.a.readiness === "ready").length },
    { label: "Needs Review", value: rows.filter((r) => r.a.readiness === "needs-review").length },
    { label: "Blocked", value: rows.filter((r) => r.a.readiness === "blocked").length },
    { label: "Missing Documents", value: rows.reduce((n, r) => n + r.a.missingRequired.length, 0) },
  ];

  return (
    <div className="space-y-6">
      <ImporterPageHeader title="Compliance" description="Review document and trade-readiness issues across your import shipments." />
      <Disclaimer />

      <section aria-label="Compliance summary">
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-4">
          {summary.map((s, i) => (
            <div key={s.label} className={`flex flex-col border-line px-4 py-3 ${i % 2 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}>
              <dt className="text-xs font-medium text-ink-muted">{s.label}</dt>
              <dd className="order-first text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-faint">Missing Documents counts required documents not yet provided for each shipment&apos;s current stage.</p>
      </section>

      <section aria-labelledby="compliance-heading" className="rounded-2xl border border-line bg-surface">
        <h2 id="compliance-heading" className="px-5 pt-5 text-base font-semibold text-ink sm:px-6">Shipments</h2>
        {rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-ink-muted">No shipments yet.</p>
        ) : (
          <>
            <div className="relative mt-4 hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[60rem] text-left text-sm">
                <thead>
                  <tr className="border-y border-line bg-canvas/60 text-xs text-ink-muted">
                    {["Shipment", "Supplier", "Product", "Destination", "Stage", "Required documents", "Issues", "Readiness"].map((h, i, all) => (
                      <th key={h} scope="col" className={`py-2.5 font-medium ${i === 0 ? "pl-6 pr-3" : i === all.length - 1 ? "pl-3 pr-6" : "px-3"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.sh.id} className="group relative transition-colors hover:bg-teal-soft/50 focus-within:bg-teal-soft/50">
                      <th scope="row" className="whitespace-nowrap py-3.5 pl-6 pr-3 font-normal">
                        <Link
                          href={importerHref(`compliance/${r.sh.id}`)}
                          className="font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-orange group-hover:text-teal"
                        >
                          <ImportId id={r.sh.id} />
                        </Link>
                      </th>
                      <td className="px-3 py-3.5 text-ink">{r.supplier}</td>
                      <td className="px-3 py-3.5 text-ink">{r.sh.cargo.product}</td>
                      <td className="px-3 py-3.5 text-ink-muted">{r.sh.route.portOfDischarge}</td>
                      <td className="px-3 py-3.5 text-ink-muted">{stageLabel(r.st.stage)}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-ink">{r.requiredDone} of {r.requiredTotal} complete</td>
                      <td className="px-3 py-3.5 text-ink-muted">{r.blocking} blocking · {r.review} review</td>
                      <td className="py-3.5 pl-3 pr-6"><ReadinessBadge readiness={r.a.readiness} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-2 sm:p-5 xl:hidden">
              {rows.map((r) => (
                <li key={r.sh.id}>
                  <Link href={importerHref(`compliance/${r.sh.id}`)} className={`block h-full rounded-xl border border-line p-4 transition hover:border-teal/40 hover:bg-teal-soft/40 ${focusRing}`}>
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <ImportId id={r.sh.id} className="block text-ink-muted" />
                        <span className="mt-0.5 block break-words font-semibold text-ink">{r.sh.cargo.product}</span>
                        <span className="block break-words text-sm text-ink-muted">{r.supplier}</span>
                      </span>
                      <ReadinessBadge readiness={r.a.readiness} />
                    </span>
                    <span className="mt-3 block text-sm text-ink">{r.a.summary}</span>
                    <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-muted">
                      {stageLabel(r.st.stage)} · {r.requiredDone} of {r.requiredTotal} required complete
                      <ArrowRight aria-hidden className="size-4 shrink-0" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <SumitAnalysisCard id="sumit-compliance" heading="Ask SUMIT about compliance readiness" prompts={COMPLIANCE_PROMPTS} message="SUMIT compliance intelligence will be connected later. Nothing was analysed, and SUMIT does not give legal advice." />
    </div>
  );
}
