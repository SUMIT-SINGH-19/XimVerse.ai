"use client";

import Link from "next/link";
import { formatDate } from "@/lib/format";
import { importerHref } from "@/lib/importer-nav";
import {
  formatIncoterm,
  formatUnitPrice,
  quotationsFromSupplier,
  requirementOf,
} from "@/lib/importer-quotations";
import { ImportId, Panel } from "../dashboard/dashboard-ui";
import { QuotationStatusBadge } from "../quotations/quotation-ui";
import { useQuotationStatus } from "../quotations/quotation-status-store";
import { focusRing } from "../styles";
import { formatOrderValue, orderStatus } from "@/lib/importer-orders";
import { useOrders } from "../orders/order-store";
import { OrderStatusBadge } from "../orders/order-ui";
import { shipmentState } from "@/lib/importer-shipments";
import { useShipments } from "../shipments/shipment-store";
import { ShipmentStatusBadge } from "../shipments/shipment-ui";

/** The importer's quotation history with a supplier, derived from the quotation data. */
export function SupplierActivity({ supplierId }: { supplierId: string }) {
  const statusOf = useQuotationStatus();
  const quotes = quotationsFromSupplier(supplierId);
  const shipments = useShipments().filter((s) => s.supplierId === supplierId);
  const orders = useOrders()
    .filter((o) => o.supplierId === supplierId)
    .toSorted((a, b) => b.purchaseOrder.issueDate.localeCompare(a.purchaseOrder.issueDate));
  const requirements = [...new Map(quotes.map((q) => [q.requirementId, requirementOf(q)])).entries()];

  return (
    <Panel id="activity" title="Your activity with this supplier">
      <div className="px-5 pb-5 pt-3 sm:px-6">
        {quotes.length === 0 ? (
          <p className="text-sm text-ink-muted">No quotation history with this supplier yet.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-faint">Quotations</dt>
                <dd className="text-lg font-semibold tabular-nums text-ink">{quotes.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Latest</dt>
                <dd className="text-ink">{formatDate(quotes[0].receivedAt)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-ink-faint">Related requirements</dt>
                <dd className="text-ink">
                  {requirements.map(([id, r], i) => (
                    <span key={id}>
                      {i > 0 && ", "}
                      <Link href={importerHref(`rfqs/${id}`)} className={`rounded text-teal hover:underline ${focusRing}`}>
                        <ImportId id={id} /> · {r?.product.name}
                      </Link>
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {quotes.map((q) => (
                <li key={q.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={importerHref(`quotations/${q.id}`)}
                      className={`rounded font-semibold text-ink hover:text-teal ${focusRing}`}
                    >
                      <ImportId id={q.id} />
                    </Link>
                    <QuotationStatusBadge status={statusOf(q)} />
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {requirementOf(q)?.product.name} · <ImportId id={q.requirementId} className="text-xs" />
                  </p>
                  <p className="mt-0.5 text-sm text-ink">
                    {formatUnitPrice(q)} <span className="text-ink-muted">· {formatIncoterm(q)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">Received {formatDate(q.receivedAt)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        {orders.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Orders</h3>
            <ul className="mt-2 divide-y divide-line">
              {orders.map((o) => (
                <li key={o.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={importerHref(`orders/${o.id}`)} className={`rounded font-semibold text-ink hover:text-teal ${focusRing}`}>
                      <ImportId id={o.id} />
                    </Link>
                    <OrderStatusBadge status={orderStatus(o)} />
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{o.terms.productName}</p>
                  <p className="mt-0.5 text-sm text-ink">{formatOrderValue(o.terms)}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">Ordered {formatDate(o.purchaseOrder.issueDate)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {shipments.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Shipments</h3>
            <ul className="mt-2 divide-y divide-line">
              {shipments.map((s) => {
                const st = shipmentState(s);
                return (
                  <li key={s.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={importerHref(`shipments/${s.id}`)} className={`rounded font-semibold text-ink hover:text-teal ${focusRing}`}>
                        <ImportId id={s.id} />
                      </Link>
                      <ShipmentStatusBadge status={st.status} />
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">{s.cargo.product}</p>
                    <p className="mt-0.5 text-sm text-ink">{s.route.portOfLoading} → {s.route.portOfDischarge}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">ETA {formatDate(st.schedule.eta)} (planned)</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
