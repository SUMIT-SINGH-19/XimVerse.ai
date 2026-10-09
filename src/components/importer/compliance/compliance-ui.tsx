"use client";

import { CircleAlert, CircleCheck, Info, OctagonAlert } from "lucide-react";
import type { Order } from "@/lib/importer-orders";
import { assessShipment, COMPLIANCE_DISCLAIMER, READINESS_LABEL, SEVERITY_LABEL, type ComplianceAssessment, type IssueSeverity, type Readiness } from "@/lib/importer-compliance";
import { shipmentState, type Shipment } from "@/lib/importer-shipments";
import type { TradeDocument } from "@/lib/importer-documents";

const READINESS_STYLE: Record<Readiness, { cls: string; Icon: typeof Info }> = {
  ready: { cls: "bg-teal-soft text-teal", Icon: CircleCheck },
  "needs-review": { cls: "border border-orange/40 text-orange", Icon: CircleAlert },
  blocked: { cls: "bg-orange-soft text-orange", Icon: OctagonAlert },
};

export function ReadinessBadge({ readiness }: { readiness: Readiness }) {
  const { cls, Icon } = READINESS_STYLE[readiness];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <Icon aria-hidden className="size-3.5" />
      {READINESS_LABEL[readiness]}
    </span>
  );
}

const SEVERITY_STYLE: Record<IssueSeverity, { cls: string; Icon: typeof Info }> = {
  blocking: { cls: "text-orange", Icon: OctagonAlert },
  review: { cls: "text-orange", Icon: CircleAlert },
  information: { cls: "text-ink-muted", Icon: Info },
};

export function SeverityLabel({ severity }: { severity: IssueSeverity }) {
  const { cls, Icon } = SEVERITY_STYLE[severity];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] ${cls}`}>
      <Icon aria-hidden className="size-3.5" />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export function Disclaimer() {
  return (
    <p className="flex gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      {COMPLIANCE_DISCLAIMER}
    </p>
  );
}

/** Assessment for one shipment from the shared stores' current values. */
export function assess(shipment: Shipment, documents: readonly TradeDocument[], orders: readonly Order[]): ComplianceAssessment {
  const order = orders.find((o) => o.id === shipment.orderId);
  return assessShipment({
    shipment,
    state: shipmentState(shipment),
    documents,
    order,
    supplierConfirmed: !!order?.events.some((e) => e.type === "supplier-confirmed"),
  });
}
