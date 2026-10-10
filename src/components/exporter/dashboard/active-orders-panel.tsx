import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/workspace/panel";
import { getT } from "@/i18n/server";
import { exporterHref } from "@/lib/exporter-nav";
import type { ActiveOrder } from "@/lib/exporter-dashboard";

export async function ActiveOrdersPanel({ orders }: { orders: readonly ActiveOrder[] }) {
  const t = await getT();

  return (
    <Panel title="Active Orders" action={{ label: "View all", href: exporterHref("orders") }}>
      <ul className="divide-y divide-line">
        {orders.map((order) => (
          <li key={order.orderId} className="py-3.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="font-mono text-xs text-ink-muted"><a href={exporterHref(`orders/${order.orderId}`)} className="hover:text-teal">{order.orderId}</a></p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
                  {order.product}
                  <ArrowRight className="size-3.5 text-ink-faint" aria-label={t("to")} />
                  {order.destinationCountry}
                </p>
              </div>
              <p className="text-sm text-ink-muted">
                <span className="font-medium text-ink">{t(order.stage)}</span>
                <span className="ml-2 font-semibold tabular-nums text-teal">{order.progress}%</span>
              </p>
            </div>
            <div
              role="progressbar"
              aria-label={t("{id} progress", { id: order.orderId })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={order.progress}
              aria-valuetext={`${order.progress}% · ${t(order.stage)}`}
              className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-teal-soft"
            >
              <div className="h-full rounded-full bg-teal" style={{ width: `${order.progress}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
