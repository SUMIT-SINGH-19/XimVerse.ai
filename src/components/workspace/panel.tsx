import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { focusRing } from "./styles";

/** A titled card section on a workspace page, with an optional "view all" link. */
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const headingId = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(11,46,48,0.04)] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className={`inline-flex items-center gap-1 rounded-md text-sm font-semibold text-teal hover:text-ink ${focusRing}`}
          >
            {action.label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      <div className={bodyClassName || "px-5 pb-5 pt-4 sm:px-6"}>{children}</div>
    </section>
  );
}
