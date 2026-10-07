import { Panel } from "@/components/workspace/panel";
import { StatusPill, type PillTone } from "@/components/workspace/status-pill";
import { formatTimeAgo } from "@/lib/format";
import { freightForwarderHref } from "@/lib/freight-forwarder-nav";
import {
  BOOKING_STATUS_LABEL,
  type BookingStatus,
  type CarrierBooking,
} from "@/lib/freight-forwarder-dashboard-data";
import { DataTable, RefId, formatClock, type Column } from "./dashboard-ui";

const STATUS_TONE: Record<BookingStatus, PillTone> = {
  confirmed: "brand",
  pending: "neutral",
  "space-requested": "muted",
  "rolled-over": "accent",
  "equipment-pending": "accent",
};

function columns(asOf: string, timeZone: string): Column<CarrierBooking>[] {
  return [
    {
      header: "Carrier",
      hideInCard: true,
      cell: (b) => (
        <>
          <span className="block font-semibold text-ink">{b.carrier}</span>
          <RefId className="block text-xs text-ink-muted">{b.bookingNumber}</RefId>
        </>
      ),
    },
    {
      header: "Shipment · Vessel / Flight",
      cell: (b) => (
        <>
          <RefId className="block text-ink">{b.shipmentId}</RefId>
          <span className="block text-xs text-ink-muted">{b.voyage}</span>
        </>
      ),
    },
    { header: "Equipment", className: "whitespace-nowrap", cell: (b) => b.equipment },
    {
      header: "Cut-off",
      className: "whitespace-nowrap",
      cell: (b) => (
        <time dateTime={b.cutoff} className="tabular-nums">
          {formatClock(b.cutoff, timeZone)}
        </time>
      ),
    },
    {
      header: "Status · Confirmation",
      cell: (b) => (
        <span className="flex flex-col items-start gap-1">
          <StatusPill tone={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</StatusPill>
          {b.confirmedAt ? (
            <span className="whitespace-nowrap text-xs text-ink-muted">
              Confirmed · <time dateTime={b.confirmedAt}>{formatTimeAgo(b.confirmedAt, asOf)}</time>
            </span>
          ) : (
            <span className="whitespace-nowrap text-xs text-ink-faint">Awaiting carrier</span>
          )}
        </span>
      ),
    },
  ];
}

/** Space and equipment held with shipping lines and airlines. */
export function CarrierBookings({
  bookings,
  asOf,
  timeZone,
  className = "",
}: {
  bookings: readonly CarrierBooking[];
  asOf: string;
  timeZone: string;
  className?: string;
}) {
  return (
    <Panel
      title="Carrier Bookings"
      description="Space, equipment and cut-offs with your carriers."
      action={{ label: "Bookings", href: freightForwarderHref("bookings") }}
      className={className}
      bodyClassName="pt-4"
    >
      <DataTable
        rows={bookings}
        columns={columns(asOf, timeZone)}
        rowKey={(b) => b.id}
        caption="Carrier bookings"
        cardTitle={(b) => (
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-semibold text-ink">{b.carrier}</span>
              <RefId className="block text-xs text-ink-muted">{b.bookingNumber}</RefId>
            </span>
          </span>
        )}
      />
    </Panel>
  );
}
