"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleCheck, CircleX, FileSearch, FlaskConical, Info } from "lucide-react";
import { formatDate } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import { DOCUMENT_SOURCE_LABEL, documentNextAction, isMissing } from "@/lib/importer-documents";
import {
  CUSTOMS_CASE_STATUS_LABEL,
  CUSTOMS_READINESS_LABEL,
  customsActivity,
  customsMilestones,
  DEMO_STEP_LABEL,
  NO_CUSTOMS_SYSTEM,
  nextDemoStep,
  READY_FOR_FILING_TEXT,
  type CustomsCaseView,
} from "@/lib/importer-customs";
import { stageLabel } from "@/lib/importer-shipments";
import { ImportId, Panel } from "../dashboard/dashboard-ui";
import { DocumentStatusBadge, RequirementTag, ValidityText } from "../documents/document-ui";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { supplierHref } from "../suppliers/supplier-links";
import { focusRing, secondaryButton } from "../styles";
import { simulateCustomsStep, useCustomsCases, useCustomsLoaded } from "./customs-store";
import { ChaSection, ClarificationsSection, DeclarationSection, HandoffSection } from "./customs-sections";
import {
  CUSTOMS_PROMPTS,
  CustomsNotice,
  CustomsReadinessBadge,
  CustomsStatusBadge,
  demoTag,
  historicalTag,
  StatusRecordTag,
  SUMIT_CUSTOMS_MESSAGE,
} from "./customs-ui";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;
const textLink = `inline-flex items-center gap-1 rounded text-sm font-semibold text-teal hover:underline ${focusRing}`;

export function CustomsDetail({ id }: { id: string }) {
  const cases = useCustomsCases();
  const loaded = useCustomsLoaded();
  const view = cases.find((c) => c.id === id);
  if (!view) {
    if (!loaded) return <p className="py-16 text-center text-sm text-ink-muted">Loading customs case…</p>;
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-canvas text-ink-faint">
          <FileSearch className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Customs case not found</h1>
        <p className="mt-2 text-sm text-ink-muted">
          There&apos;s no customs case <ImportId id={id} className="text-ink" /> in this browser tab. Cases you create are kept in this tab&apos;s session only.
        </p>
        <Link href={importerHref("customs")} className={`${secondaryButton} mt-6`}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to Customs
        </Link>
      </div>
    );
  }
  return <Workspace view={view} />;
}

function resultOf(v: CustomsCaseView): { title: string; detail?: string; tone: "ok" | "attention" } {
  const n = v.blockers.length;
  const items = `${n} ${n === 1 ? "item needs" : "items need"} attention`;
  switch (v.status) {
    case "preparing":
      return { title: "Handoff blocked", detail: `${items}:`, tone: "attention" };
    case "ready-for-handoff":
      return { title: `Ready for handoff to ${v.cha?.company}`, detail: "Every required item is in place. Record the handoff once the package is with the broker.", tone: "ok" };
    case "with-cha": {
      const awaiting = v.clarifications.filter((c) => c.status === "responded").length;
      if (n) return { title: `With ${v.handoff?.cha.company} — ${items}`, detail: "Resolve these before the case is Ready for Filing:", tone: "attention" };
      if (v.changedSinceHandoff.length)
        return { title: `With ${v.handoff?.cha.company}`, detail: "The package changed since the last handoff. Record an updated handoff so the broker has the current version.", tone: "attention" };
      return { title: `With ${v.handoff?.cha.company}`, detail: `Awaiting the broker on ${awaiting} answered ${awaiting === 1 ? "clarification" : "clarifications"}. Mark each resolved when the broker confirms.`, tone: "attention" };
    }
    case "clarification-required": {
      const open = v.clarifications.filter((c) => c.status === "open").length;
      return { title: `Clarification required — ${open} open`, detail: "Respond to the broker's questions below.", tone: "attention" };
    }
    case "ready-for-filing":
      return { title: "Ready for Filing", detail: READY_FOR_FILING_TEXT, tone: "ok" };
    default:
      return { title: CUSTOMS_CASE_STATUS_LABEL[v.status], detail: v.statusRecord === "demo" ? `Demo status. ${NO_CUSTOMS_SYSTEM}` : "Historical record from the customs broker.", tone: "ok" };
  }
}

function Workspace({ view }: { view: CustomsCaseView }) {
  const [message, setMessage] = useState("");
  const sh = view.shipment;
  const result = resultOf(view);
  const showBlockers = (view.status === "preparing" || view.status === "with-cha") && view.blockers.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href={importerHref("customs")} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Customs
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <ImportId id={view.id} className="text-ink-muted" />
          <span className="text-xs text-ink-faint">Shipment <ImportId id={sh.id} className="text-xs text-ink-muted" /></span>
          <CustomsStatusBadge status={view.status} />
          <StatusRecordTag view={view} />
          <CustomsReadinessBadge readiness={view.readiness} />
        </div>
        <h1 className="mt-1 break-words text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          {sh.cargo.product}
          <span className="font-semibold text-ink-muted"> from {view.supplierName}</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Port of import {sh.route.portOfDischarge} · ETA {formatDate(view.eta)} <span className="text-ink-faint">(planned)</span> · Assigned CHA: {view.cha?.company ?? "Not assigned"}
        </p>
        <nav aria-label="Related records" className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Link href={importerHref(`shipments/${sh.id}`)} className={textLink}>View Shipment</Link>
          <Link href={importerHref(`orders/${view.record.orderId}`)} className={textLink}>View Order</Link>
          <Link href={`${importerHref("documents")}?shipment=${sh.id}`} className={textLink}>View Documents</Link>
          <Link href={importerHref(`compliance/${sh.id}`)} className={textLink}>View Compliance</Link>
          <Link href={supplierHref(sh.supplierId)} className={textLink}>View Supplier</Link>
        </nav>
      </div>

      <section aria-labelledby="customs-result" className={`rounded-2xl border px-5 py-5 sm:px-6 ${result.tone === "ok" ? "border-teal/30 bg-teal-soft/50" : "border-orange/30 bg-orange-soft/40"}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Customs status · Shipment stage: {stageLabel(view.state.stage)}</p>
        <h2 id="customs-result" className="mt-1 text-xl font-semibold text-ink">{result.title}</h2>
        {result.detail && <p className="mt-1 text-sm text-ink-muted">{result.detail}</p>}
        {showBlockers && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink">
            {view.blockers.map((b) => (
              <li key={b.id}>{b.title}</li>
            ))}
          </ul>
        )}
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm font-medium text-teal">{message}</p>
      </section>

      <CustomsNotice />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ReadinessSection view={view} />
        <ChaSection view={view} onMessage={setMessage} />
      </div>

      <DeclarationSection view={view} onMessage={setMessage} />

      <DocumentsSection view={view} />

      <HandoffSection view={view} onMessage={setMessage} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ClarificationsSection view={view} onMessage={setMessage} />
        <FilingSection view={view} onMessage={setMessage} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <MilestonesSection view={view} />
        <ActivitySection view={view} />
      </div>

      <SumitAnalysisCard id="sumit-customs-case" heading="Ask SUMIT about this customs case" prompts={CUSTOMS_PROMPTS} message={SUMIT_CUSTOMS_MESSAGE} />
    </div>
  );
}

/* Section A — the same items as the shipment and compliance pages. */
function ReadinessSection({ view }: { view: CustomsCaseView }) {
  return (
    <Panel id="customs-readiness" title="Customs Readiness" description="The same items the shipment and compliance pages show.">
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
        <p className="mb-2 flex flex-wrap items-center gap-2 font-semibold text-ink">
          Result: <CustomsReadinessBadge readiness={view.readiness} />
        </p>
        <dl className="divide-y divide-line">
          {view.prep.map((item) => (
            <div key={item.id} className="flex justify-between gap-4 py-2">
              <dt className="flex items-center gap-2 text-ink-muted">
                {item.ok ? <CircleCheck aria-hidden className="size-4 shrink-0 text-teal" /> : <CircleX aria-hidden className="size-4 shrink-0 text-orange" />}
                {item.label === "Customs broker" ? "Customs Broker / CHA" : item.label === "Importer information" ? "Importer Information" : item.label === "HS code" ? "HS Code" : item.label}
              </dt>
              <dd className="min-w-0 break-words text-right text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-faint">
          {CUSTOMS_READINESS_LABEL.blocked}: a required document or the HS code is missing. {CUSTOMS_READINESS_LABEL.preparing}: other items remain. Ready for Filing also needs the handoff and every clarification resolved.
        </p>
      </div>
    </Panel>
  );
}

/* Section B — canonical documents, read live. */
function DocumentsSection({ view }: { view: CustomsCaseView }) {
  const cargoWithCarrier = !["preparing", "ready-to-ship"].includes(view.state.status);
  return (
    <Panel
      id="customs-documents"
      title="Customs Documents"
      description="Live from the Document Center. Document metadata only — no files are stored."
      action={<Link href={`${importerHref("documents")}?shipment=${view.shipment.id}`} className={`${textLink} shrink-0`}>Manage Documents</Link>}
    >
      <div className="relative mt-3 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-y border-line bg-canvas/60 text-xs text-ink-muted">
              {["Document", "Required", "Provider", "Status", "Validity", "Action"].map((h, i, all) => (
                <th key={h} scope="col" className={`py-2.5 font-medium ${i === 0 ? "pl-6 pr-3" : i === all.length - 1 ? "pl-3 pr-6" : "px-3"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {view.documents.map((d) => (
              <tr key={d.id} className="align-top">
                <th scope="row" className="py-3 pl-6 pr-3 font-normal">
                  <Link href={importerHref(`documents/${d.id}`)} className={`rounded font-medium text-ink hover:text-teal hover:underline ${focusRing}`}>{d.label}</Link>
                </th>
                <td className="px-3 py-3"><RequirementTag level={d.requirement.level} /></td>
                <td className="px-3 py-3 text-ink-muted">{DOCUMENT_SOURCE_LABEL[d.source]}</td>
                <td className="px-3 py-3"><DocumentStatusBadge status={d.status} /></td>
                <td className="px-3 py-3"><ValidityText validity={d.validity} expiryDate={d.metadata.expiryDate} /></td>
                <td className="py-3 pl-3 pr-6 text-ink">{documentNextAction(d, cargoWithCarrier)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 divide-y divide-line border-t border-line lg:hidden">
        {view.documents.map((d) => (
          <li key={d.id} className="px-5 py-3 text-sm sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={importerHref(`documents/${d.id}`)} className={`rounded font-medium text-ink hover:text-teal hover:underline ${focusRing}`}>{d.label}</Link>
              <DocumentStatusBadge status={d.status} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <RequirementTag level={d.requirement.level} /> {DOCUMENT_SOURCE_LABEL[d.source]} · <ValidityText validity={d.validity} expiryDate={d.metadata.expiryDate} />
            </p>
            <p className="mt-1 text-sm text-ink">{documentNextAction(d, cargoWithCarrier)}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* Sections G + H — Ready for Filing and demo progression. */
function FilingSection({ view, onMessage }: { view: CustomsCaseView; onMessage: (m: string) => void }) {
  const docs = view.documents.filter((d) => d.requirement.level === "required");
  const conditions: [string, boolean][] = [
    ["Mandatory customs documents complete", docs.every((d) => !isMissing(d))],
    ["Required documents not expired", !docs.some((d) => d.validity === "expired" && (d.status === "available" || d.status === "approved"))],
    ["No required document needs review", !docs.some((d) => d.status === "needs-review")],
    ["Required declaration fields complete", view.missingFields.length === 0],
    ["Customs broker assigned", !!view.cha],
    ["Handoff recorded", !!view.handoff],
    ["No changes since handoff", !!view.handoff && view.changedSinceHandoff.length === 0],
    ["No unresolved clarification", view.clarifications.every((c) => c.status === "resolved")],
  ];
  const demo = nextDemoStep(view);
  const after = !["preparing", "ready-for-handoff", "with-cha", "clarification-required", "ready-for-filing"].includes(view.status);

  return (
    <Panel id="filing" title="Ready for Filing" description="Whether the preparation package is complete for the current XimVerse workflow.">
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
        <ul className="space-y-1.5">
          {conditions.map(([label, ok]) => (
            <li key={label} className="flex items-start gap-2">
              {ok ? <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-teal" /> : <CircleX aria-hidden className="mt-0.5 size-4 shrink-0 text-orange" />}
              <span className={ok ? "text-ink" : "text-ink-muted"}>
                {label}
                <span className="sr-only">{ok ? " — met" : " — not met"}</span>
              </span>
            </li>
          ))}
        </ul>
        <p id="filing-result" className={`mt-3 rounded-lg px-3 py-2 ${view.status === "ready-for-filing" || after ? "bg-teal-soft/60 text-ink" : "bg-canvas text-ink-muted"}`}>
          {view.status === "ready-for-filing" ? (
            <>
              <span className="font-semibold text-ink">Ready for Filing.</span> {READY_FOR_FILING_TEXT}
            </>
          ) : after ? (
            <>
              <span className="font-semibold text-ink">{CUSTOMS_CASE_STATUS_LABEL[view.status]}</span> — {view.statusRecord === "demo" ? "demo status" : "historical record"}.
            </>
          ) : (
            "Not yet ready for filing."
          )}
        </p>

        <h3 className="mt-5 text-sm font-semibold text-ink">Customs progression</h3>
        <p className="mt-1 flex gap-2 text-xs text-ink-muted">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Filing, assessment and clearance happen outside XimVerse. {NO_CUSTOMS_SYSTEM}
        </p>
        {demo ? (
          <div className="mt-3">
            <button
              type="button"
              disabled={!!demo.blockedReason}
              onClick={() => onMessage(simulateCustomsStep(view, demo.step) || `${CUSTOMS_CASE_STATUS_LABEL[demo.step]} recorded (demo). ${NO_CUSTOMS_SYSTEM}`)}
              className={`${secondaryButton} h-auto min-h-10 w-full whitespace-normal py-2 sm:w-auto`}
            >
              <FlaskConical aria-hidden className="size-4 text-orange" />
              {DEMO_STEP_LABEL[demo.step]}
              {demoTag}
            </button>
            {demo.blockedReason && <p className="mt-1 text-xs text-ink-muted">{demo.blockedReason}</p>}
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-faint">
            {view.status === "cleared" ? "Customs clearance is recorded." : "Demo filing becomes available once the case is Ready for Filing."}
          </p>
        )}
      </div>
    </Panel>
  );
}

function MilestonesSection({ view }: { view: CustomsCaseView }) {
  const list = customsMilestones(view);
  return (
    <Panel id="customs-milestones" title="Milestones" description="Filed, Under Assessment and Cleared are demo or historical records only.">
      <ol className="px-5 pb-5 pt-4 sm:px-6">
        {list.map((m, i) => (
          <li key={m.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < list.length - 1 && <span aria-hidden className={`absolute left-[7px] top-5 h-full w-px ${m.at ? "bg-teal/50" : "bg-line"}`} />}
            <span aria-hidden className={`relative mt-0.5 grid size-[15px] shrink-0 place-items-center rounded-full ${m.at ? "bg-teal text-on-brand" : "border border-line bg-surface"}`}>
              {m.at && <Check className="size-2.5" strokeWidth={3} />}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className={m.at ? "text-ink" : "text-ink-faint"}>{m.label}</span>
              <span className="flex items-center gap-2 text-xs text-ink-faint">
                {m.at ? (
                  <>
                    <time dateTime={m.at}>{formatDate(m.at)}</time>
                    {m.tag === "demo" ? demoTag : m.tag === "historical" ? historicalTag : <span>Recorded</span>}
                  </>
                ) : (
                  "Not yet"
                )}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function ActivitySection({ view }: { view: CustomsCaseView }) {
  const items = customsActivity(view);
  return (
    <Panel id="customs-activity" title="Activity" description="Customs case events, customs status records and customs document events.">
      <ol className="max-h-[36rem] overflow-y-auto px-5 pb-5 pt-4 sm:px-6">
        {items.map((e, i) => (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < items.length - 1 && <span aria-hidden className="absolute left-[3.5px] top-3 h-full w-px bg-line" />}
            <span aria-hidden className={`relative mt-1.5 size-2 shrink-0 rounded-full ${e.byYou ? "bg-orange" : "bg-teal"}`} />
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="break-words font-medium text-ink">{e.text}</span>
                {e.demo && demoTag}
                {e.historical && historicalTag}
              </p>
              <p className="text-xs text-ink-faint">
                <time dateTime={e.at}>{formatDate(e.at)}</time> · {e.party}
              </p>
              {e.note && <p className="mt-0.5 break-words text-sm text-ink-muted">{e.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
