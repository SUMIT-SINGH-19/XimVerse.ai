"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { ROLES, type RoleSlug } from "@/lib/roles";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

export function RolePicker() {
  const [selected, setSelected] = useState<RoleSlug | null>(null);
  const selectedRole = ROLES.find((r) => r.slug === selected);

  return (
    <div className="w-full">
      <div
        role="radiogroup"
        aria-label="Choose your role"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {ROLES.map(({ slug, title, description, icon: Icon }) => {
          const isSelected = slug === selected;
          return (
            <button
              key={slug}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(slug)}
              className={`relative flex flex-col rounded-2xl p-6 text-left transition duration-200 ${focusRing}
                ${
                  isSelected
                    ? "bg-teal text-on-brand shadow-xl shadow-teal/20"
                    : "bg-surface text-ink shadow-sm hover:-translate-y-1 hover:shadow-lg"
                }`}
            >
              <span
                className={`grid size-12 place-items-center rounded-xl transition ${
                  isSelected ? "bg-orange text-on-brand" : "bg-orange-soft text-orange"
                }`}
              >
                <Icon className="size-6" aria-hidden />
              </span>

              <span className="mt-5 block text-xl sm:mt-8 font-semibold tracking-tight">{title}</span>
              <span
                className={`mt-2 block text-sm leading-relaxed ${
                  isSelected ? "text-on-brand/75" : "text-ink-muted"
                }`}
              >
                {description}
              </span>

              <span
                aria-hidden
                className={`absolute right-5 top-5 grid size-6 place-items-center rounded-full border-2 transition ${
                  isSelected ? "border-orange bg-orange text-on-brand" : "border-line"
                }`}
              >
                {isSelected && <Check className="size-3.5" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={!selectedRole}
          className={`inline-flex h-14 items-center gap-2 rounded-xl bg-orange px-7 text-base font-semibold text-on-brand transition
            hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
        >
          {selectedRole ? `Continue as ${selectedRole.title.split(" –")[0]}` : "Continue"}
          <ArrowRight className="size-5" aria-hidden />
        </button>
        {!selectedRole && (
          <p className="text-sm text-ink-muted">Select a role to continue.</p>
        )}
      </div>
    </div>
  );
}
