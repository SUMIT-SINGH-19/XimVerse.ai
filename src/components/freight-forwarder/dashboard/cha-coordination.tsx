import { Panel } from "@/components/workspace/panel";
import { formatTimeAgo } from "@/lib/format";
import { freightForwarderHref } from "@/lib/freight-forwarder-nav";
import type { CHAUpdate } from "@/lib/freight-forwarder-dashboard-data";
import { CtaButton, CtaLink, DataTable, RefId, WaitingOn, type Column } from "./dashboard-ui";

function columns(asOf: string): Column<CHAUpdate>[] {
  return [
    {
      header: "Shipment",
      hideInCard: true,
      cell: (u) => <RefId className="font-semibold text-ink">{u.shipmentId}</RefId>,
    },
    { header: "CHA", cell: (u) => <span className="text-ink">{u.cha}</span> },
    { header: "Customs Stage", cell: (u) => <span className="text-ink">{u.customsStage}</span> },
    {
      header: "Last Update",
      className: "whitespace-nowrap",
      cell: (u) => (
        <time dateTime={u.at} className="text-ink-muted">
          {formatTimeAgo(u.at, asOf)}
        </time>
      ),
    },
    { header: "Pending From", cell: (u) => <WaitingOn party={u.pendingFrom} /> },
  ];
}

/**
 * Where each shipment's customs work stands with its CHA. Filing is the CHA's
 * job; this shows who the next step depends on so the forwarder can chase it.
 */
export function ChaCoordination({
  updates,
  asOf,
  className = "",
}: {
  updates: readonly CHAUpdate[];
  asOf: string;
  className?: string;
}) {
  return (
    <Panel
      title="CHA Coordination"
      description="Customs progress handled by your CHA partners."
      action={{ label: "CHA Coordination", href: freightForwarderHref("cha") }}
      className={className}
      bodyClassName="pt-4"
    >
      <DataTable
        rows={updates}
        columns={columns(asOf)}
        rowKey={(u) => u.id}
        caption="CHA coordination"
        wideFrom="lg"
        cardTitle={(u) => <RefId className="font-semibold text-ink">{u.shipmentId}</RefId>}
        action={(u) =>
          u.action.kind === "track" ? (
            <CtaLink section="cha" label={u.action.label} context={u.shipmentId} variant="quiet" />
          ) : (
            <CtaButton
              label={u.action.label}
              context={u.shipmentId}
              variant={u.pendingFrom === "forwarder" ? "primary" : "secondary"}
              className="h-8! px-3!"
            />
          )
        }
      />
    </Panel>
  );
}
