import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Panel } from "@/components/workspace/panel";
import { focusRing } from "@/components/workspace/styles";
import { exporterHref } from "@/lib/exporter-nav";
import type { ActionItem } from "@/lib/exporter-dashboard";

export function ActionRequiredPanel({ items }: { items: readonly ActionItem[] }) {
  return (
    <Panel title="Action Required" bodyClassName="px-3 pb-3 pt-3">
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={exporterHref(item.slug)}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-canvas ${focusRing}`}
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold tabular-nums ${
                  item.urgent ? "bg-orange-soft text-orange" : "bg-teal-soft text-teal"
                }`}
              >
                {item.count}
              </span>
              <span className="min-w-0 flex-1 text-sm text-ink">{item.label}</span>
              <ChevronRight className="size-4 shrink-0 text-ink-faint group-hover:text-teal" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
