import { T } from "@/i18n/client";

/** Heading block at the top of a workspace page. Translates the text it is given. */
export function PageHeader({
  title,
  description,
  eyebrow,
  aside,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  /** Content aligned to the right of the heading on wide screens. */
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange"><T>{eyebrow}</T></p>
        )}
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl"><T>{title}</T></h1>
        {description && (
          <p className="mt-2 max-w-2xl text-base text-ink-muted">
            <T>{description}</T>
          </p>
        )}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

/** Stand-in for a section whose feature hasn't been built yet. */
export function ComingSoon({
  title,
  group,
  workspaceLabel,
}: {
  title: string;
  group?: string;
  /** e.g. "exporter", completing "This part of the … workspace". */
  workspaceLabel: string;
}) {
  return (
    <>
      <PageHeader title={title} eyebrow={group} />
      <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-orange-soft px-3 py-1 text-sm font-medium text-orange">
          <span aria-hidden className="size-1.5 rounded-full bg-orange" />
          <T>Coming soon</T>
        </span>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted">
          <T vars={{ workspace: workspaceLabel }}>{"This part of the {workspace} workspace is on the way."}</T>
        </p>
      </div>
    </>
  );
}
