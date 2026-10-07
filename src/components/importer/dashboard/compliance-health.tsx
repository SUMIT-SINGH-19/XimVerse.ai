import { FileCheck, FileX, MessageSquareWarning, ShieldAlert, type LucideIcon } from "lucide-react";
import type { ComplianceHealthItem, HealthTone } from "@/lib/importer-dashboard-data";
import { Panel } from "./dashboard-ui";

const TONE: Record<HealthTone, { bar: string; icon: string }> = {
  complete: { bar: "bg-teal", icon: "text-teal" },
  attention: { bar: "bg-orange", icon: "text-orange" },
  review: { bar: "bg-orange/45", icon: "text-orange" },
};

const ICONS: Record<string, LucideIcon> = {
  complete: FileCheck,
  missing: FileX,
  review: ShieldAlert,
  customs: MessageSquareWarning,
};

export function ComplianceHealth({
  items,
  className = "",
}: {
  items: readonly ComplianceHealthItem[];
  className?: string;
}) {
  const total = items.reduce((sum, i) => sum + i.shipments, 0);

  return (
    <Panel id="compliance-health" title="Document & Compliance Health" className={className}>
      <div className="px-5 pb-5 sm:px-6">
        {/* Share of shipments in each state. */}
        <div aria-hidden className="mt-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-line">
          {items.map((item) => (
            <span
              key={item.id}
              className={TONE[item.tone].bar}
              style={{ width: `${(item.shipments / total) * 100}%` }}
            />
          ))}
        </div>

        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const Icon = ICONS[item.id] ?? FileCheck;
            return (
              <li key={item.id} className="flex items-center gap-3 text-sm">
                <Icon aria-hidden className={`size-4 shrink-0 ${TONE[item.tone].icon}`} />
                <span className="flex-1 text-ink-muted">{item.label}</span>
                <span className="font-semibold tabular-nums text-ink">
                  {item.shipments}
                  <span className="sr-only"> {item.shipments === 1 ? "shipment" : "shipments"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
