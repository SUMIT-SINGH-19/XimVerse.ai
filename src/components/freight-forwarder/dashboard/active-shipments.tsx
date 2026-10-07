import { Panel } from "@/components/workspace/panel";
import { formatDayMonth } from "@/lib/format";
import { freightForwarderHref } from "@/lib/freight-forwarder-nav";
import {
  REFERENCE_LABEL,
  SHIPMENT_HEALTH_LABEL,
  SHIPMENT_STAGES,
  stageIndex,
  stageLabel,
  type FreightShipment,
  type ShipmentHealth,
} from "@/lib/freight-forwarder-dashboard-data";
import { CtaLink, DataTable, LaneLabel, ModeBadge, RefId, WaitingOn, type Column } from "./dashboard-ui";

const HEALTH_STYLE: Record<ShipmentHealth, string> = {
  "on-track": "bg-teal-soft text-teal",
  attention: "bg-orange-soft text-orange",
  delayed: "bg-orange text-on-brand",
};

export function HealthPill({ health }: { health: ShipmentHealth }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${HEALTH_STYLE[health]}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {SHIPMENT_HEALTH_LABEL[health]}
    </span>
  );
}

/** Stage name over a segmented bar showing how far along the journey it is. */
function StageProgress({ shipment }: { shipment: FreightShipment }) {
  const index = stageIndex(shipment.stage);
  return (
    <span className="block">
      <span className="block whitespace-nowrap text-ink">{stageLabel(shipment.stage, shipment.mode)}</span>
      <span aria-hidden className="mt-1.5 flex gap-0.5">
        {SHIPMENT_STAGES.map((s, i) => (
          <span key={s.id} className={`h-1 w-2.5 rounded-full ${i <= index ? "bg-teal" : "bg-line"}`} />
        ))}
      </span>
      <span className="sr-only">
        , step {index + 1} of {SHIPMENT_STAGES.length}
      </span>
    </span>
  );
}

const COLUMNS: readonly Column<FreightShipment>[] = [
  {
    header: "Shipment",
    hideInCard: true,
    cell: (s) => (
      <>
        <RefId className="block font-semibold text-ink">{s.id}</RefId>
        <span className="block max-w-44 truncate text-xs text-ink-muted">{s.customer}</span>
      </>
    ),
  },
  {
    header: "Route",
    cell: (s) => (
      <>
        <LaneLabel lane={s.lane} className="text-ink" />
        <ModeBadge mode={s.mode} className="mt-0.5" />
      </>
    ),
  },
  {
    header: "Carrier",
    cell: (s) => (
      <>
        <span className="block text-ink">{s.carrier}</span>
        <span className="block text-xs text-ink-muted">
          <span className="sr-only">{REFERENCE_LABEL[s.mode]} </span>
          <RefId className="text-xs">{s.reference}</RefId>
        </span>
      </>
    ),
  },
  { header: "Current Stage", cell: (s) => <StageProgress shipment={s} /> },
  {
    header: "ETD / ETA",
    className: "whitespace-nowrap",
    cell: (s) => (
      <span className="block tabular-nums leading-snug">
        <span className="block text-ink">
          <span className="text-xs text-ink-faint">ETD </span>
          <time dateTime={s.etd}>{formatDayMonth(s.etd)}</time>
        </span>
        <span className="block text-ink-muted">
          <span className="text-xs text-ink-faint">ETA </span>
          <time dateTime={s.eta}>{formatDayMonth(s.eta)}</time>
        </span>
      </span>
    ),
  },
  {
    header: "Status",
    cell: (s) => (
      <span className="flex flex-col items-start gap-1">
        <HealthPill health={s.health} />
        {s.waitingOn && <WaitingOn party={s.waitingOn} />}
      </span>
    ),
  },
];

/** Every live shipment, problems first. */
export function ActiveShipments({
  shipments,
  total,
  limit = 8,
  className = "",
}: {
  shipments: readonly FreightShipment[];
  /** All active shipments, of which `shipments` are the most urgent. */
  total: number;
  limit?: number;
  className?: string;
}) {
  const shown = shipments.slice(0, limit);

  return (
    <Panel
      title="Active Shipments"
      description={`${shown.length} needing the closest watch, of ${total} active`}
      action={{ label: "All shipments", href: freightForwarderHref("shipments") }}
      className={className}
      bodyClassName="pt-4"
    >
      <DataTable
        rows={shown}
        columns={COLUMNS}
        rowKey={(s) => s.id}
        caption="Active shipments"
        cardTitle={(s) => (
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <RefId className="block font-semibold text-ink">{s.id}</RefId>
              <span className="block truncate text-xs text-ink-muted">{s.customer}</span>
            </span>
          </span>
        )}
        action={(s) => <CtaLink section="shipments" label="View Shipment" context={s.id} variant="quiet" />}
      />
    </Panel>
  );
}
