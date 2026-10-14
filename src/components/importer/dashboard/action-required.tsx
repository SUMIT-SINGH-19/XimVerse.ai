"use client";

import { useState } from "react";
import Link from "next/link";
import type { DashboardAction } from "@/lib/importer-dashboard";
import { useT } from "@/i18n/client";
import { focusRing } from "../styles";
import { ImportId } from "./dashboard-ui";

const SHOWN = 5;

/** Rail colour by fixed priority band: pressing (1–4), action (5–7), lower (8+). */
function band(priority: number) {
  if (priority <= 4) return { label: "High priority", text: "text-orange", rail: "bg-orange" };
  if (priority <= 7) return { label: "Action needed", text: "text-teal", rail: "bg-teal/60" };
  return { label: "Lower priority", text: "text-ink-faint", rail: "bg-line" };
}

export function ActionRequired({
  actions,
  className = "",
}: {
  actions: readonly DashboardAction[];
  className?: string;
}) {
  const t = useT();
  const [all, setAll] = useState(false);
  const shown = all ? actions : actions.slice(0, SHOWN);

  return (
    <section
      aria-labelledby="action-required"
      className={`overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(11,46,48,0.04),0_8px_24px_rgba(11,46,48,0.05)] ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
        <div>
          <h2 id="action-required" className="scroll-mt-24 text-xl font-semibold tracking-tight text-ink">
            {t("Action Required")}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {t("Ordered by fixed priority rules from Tracking, Payments, Customs, Compliance, Documents and Landed Cost.")}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-orange-soft px-2.5 py-1 text-xs font-semibold text-orange">
          {t("{count} open", { count: actions.length })}
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink-muted">
          {t("No operational issues need attention in your recorded imports.")}
        </p>
      ) : (
        <>
          <ul id="action-list" className="divide-y divide-line">
            {shown.map((action) => {
              const p = band(action.priority);
              return (
                <li
                  key={action.id}
                  data-action={action.id}
                  className="flex gap-4 px-5 py-4 transition-colors hover:bg-canvas/60 sm:px-6"
                >
                  <span aria-hidden className={`w-1 shrink-0 self-stretch rounded-full ${p.rail}`} />
                  <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 text-xs">
                        <span className={`font-semibold uppercase tracking-[0.08em] ${p.text}`}>{t(p.label)}</span>
                        <span aria-hidden className="text-ink-faint">·</span>
                        <span data-source className="font-medium text-ink-muted">{t(action.source)}</span>
                        <span aria-hidden className="text-ink-faint">·</span>
                        <ImportId id={action.entityId} className="text-ink-muted" />
                        <span aria-hidden className="text-ink-faint">·</span>
                        <span className="text-ink-muted">{t(action.status)}</span>
                      </p>
                      <p className="mt-1 font-semibold text-ink">{action.title}</p>
                      <p className="mt-1 break-words text-sm text-ink-muted">{action.reason}</p>
                    </div>
                    <Link
                      href={action.cta.href}
                      className={`inline-flex h-9 shrink-0 items-center self-start whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition sm:self-center ${focusRing} ${
                        action.priority <= 4
                          ? "bg-teal text-on-brand hover:brightness-110"
                          : "border border-line text-ink hover:border-teal/40 hover:bg-teal-soft"
                      }`}
                    >
                      {t(action.cta.label)}
                      <span className="sr-only"> — {action.title}</span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          {actions.length > SHOWN && (
            <div className="border-t border-line px-5 py-3 sm:px-6">
              <button
                type="button"
                aria-expanded={all}
                aria-controls="action-list"
                onClick={() => setAll((v) => !v)}
                className={`rounded-md text-sm font-semibold text-teal hover:underline ${focusRing}`}
              >
                {all ? t("Show top {count}", { count: SHOWN }) : t("View all {count} actions", { count: actions.length })}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
