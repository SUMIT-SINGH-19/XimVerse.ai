import { statusLabel, type RequirementStatus } from "@/lib/import-requirements";

const STYLE: Record<RequirementStatus, string> = {
  draft: "border border-dashed border-ink-faint/60 text-ink-muted",
  ready: "border border-teal/40 text-teal",
  published: "bg-teal-soft text-teal",
  "receiving-quotes": "bg-orange-soft text-orange",
  "under-review": "border border-orange/35 text-orange",
  "supplier-selected": "bg-teal text-on-brand",
  closed: "bg-line/70 text-ink-muted",
};

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLE[status]}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}
