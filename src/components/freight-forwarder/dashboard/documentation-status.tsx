import { Panel } from "@/components/workspace/panel";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { freightForwarderHref } from "@/lib/freight-forwarder-nav";
import {
  DOCUMENT_LABEL,
  DOCUMENT_STATE_LABEL,
  type DocumentState,
  type DocumentationOverview,
} from "@/lib/freight-forwarder-dashboard-data";
import { RefId } from "./dashboard-ui";

const STATE_TONE: Record<DocumentState, PillTone> = {
  ready: "solid",
  generated: "brand",
  "under-review": "neutral",
  "pending-exporter": "neutral",
  "pending-cha": "neutral",
  "pending-carrier": "neutral",
  issue: "accent",
};

const TOTALS = [
  { key: "ready", label: "Ready", bar: "bg-teal", text: "text-ink" },
  { key: "pending", label: "Pending", bar: "bg-orange/45", text: "text-ink" },
  { key: "issues", label: "Issues", bar: "bg-orange", text: "text-orange" },
] as const;

/** Shipping documents across active shipments, with the ones holding things up. */
export function DocumentationStatus({
  documents,
  className = "",
}: {
  documents: DocumentationOverview;
  className?: string;
}) {
  const { totals, priority } = documents;
  const all = totals.ready + totals.pending + totals.issues;

  return (
    <Panel
      title="Documentation Status"
      description="Across all active shipments."
      action={{ label: "Documents", href: freightForwarderHref("documents") }}
      className={className}
    >
      <div aria-hidden className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-line">
        {TOTALS.map((t) => (
          <span key={t.key} className={t.bar} style={{ width: `${all ? (totals[t.key] / all) * 100 : 0}%` }} />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {TOTALS.map((t) => (
          <div key={t.key}>
            <dt className="text-xs text-ink-muted">{t.label}</dt>
            <dd className={`order-first text-xl font-semibold tabular-nums ${t.text}`}>{totals[t.key]}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Priority</h3>
      <ul className="mt-1 divide-y divide-line">
        {priority.map((doc) => (
          <li key={doc.id} className="flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-ink">{DOCUMENT_LABEL[doc.document]}</p>
              <p className="text-xs text-ink-muted">
                <RefId className="text-xs">{doc.shipmentId}</RefId>
                {doc.note && <> · {doc.note}</>}
              </p>
            </div>
            <StatusPill tone={STATE_TONE[doc.state]}>{DOCUMENT_STATE_LABEL[doc.state]}</StatusPill>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
