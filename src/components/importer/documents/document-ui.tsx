"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  DOCUMENT_STATUS_LABEL,
  REQUIREMENT_LEVEL_LABEL,
  VALIDITY_LABEL,
  type DocumentMetadata,
  type DocumentStatus,
  type RequirementLevel,
  type ValidityState,
} from "@/lib/importer-documents";
import { TextArea, TextField } from "../rfq/form-fields";
import { ghostButton, primaryButton } from "../styles";

const STATUS_STYLE: Record<DocumentStatus, string> = {
  "not-started": "border border-line text-ink-muted",
  requested: "border border-orange/40 text-orange",
  draft: "border border-dashed border-orange/50 text-orange",
  available: "bg-teal-soft text-teal",
  "needs-review": "bg-orange-soft text-orange",
  approved: "bg-teal text-on-brand",
  "not-required": "bg-line/60 text-ink-muted",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {status === "approved" ? <Check aria-hidden className="size-3" strokeWidth={3} /> : <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {DOCUMENT_STATUS_LABEL[status]}
    </span>
  );
}

export function ValidityText({ validity, expiryDate }: { validity: ValidityState; expiryDate?: string }) {
  const tone = validity === "expired" ? "font-semibold text-orange" : validity === "expiring-soon" ? "font-medium text-orange" : "text-ink-muted";
  return (
    <span className={`whitespace-nowrap text-sm ${tone}`}>
      {VALIDITY_LABEL[validity]}
      {expiryDate && validity !== "no-expiry" ? <span className="font-normal text-ink-faint"> · {expiryDate}</span> : null}
    </span>
  );
}

export function RequirementTag({ level }: { level: RequirementLevel }) {
  return (
    <span className={`whitespace-nowrap rounded border px-1.5 text-xs ${level === "required" ? "border-ink-faint/50 font-medium text-ink" : "border-line text-ink-muted"}`}>
      {REQUIREMENT_LEVEL_LABEL[level]}
    </span>
  );
}

type MetaValues = Required<{ [K in keyof DocumentMetadata]: string }>;

function toValues(m: DocumentMetadata): MetaValues {
  return {
    displayName: m.displayName ?? "",
    filename: m.filename ?? "",
    number: m.number ?? "",
    issuer: m.issuer ?? "",
    issueDate: m.issueDate ?? "",
    expiryDate: m.expiryDate ?? "",
    country: m.country ?? "",
    notes: m.notes ?? "",
  };
}

function validate(v: MetaValues): Partial<Record<keyof MetaValues, string>> {
  const e: Partial<Record<keyof MetaValues, string>> = {};
  for (const k of ["displayName", "filename", "number", "issuer", "country"] as const) {
    if (v[k].length > 120) e[k] = "Keep this under 120 characters.";
  }
  if (v.filename && /[\\/:*?"<>|]/.test(v.filename)) e.filename = "Use a plain filename without path characters.";
  if (v.notes.length > 500) e.notes = "Keep notes under 500 characters.";
  if (v.issueDate && v.expiryDate && v.expiryDate < v.issueDate) e.expiryDate = "Expiry date can't be before the issue date.";
  return e;
}

/** Metadata form. Declared values only — no file is uploaded or stored. Escape cancels. */
export function MetadataForm({
  id,
  initial,
  submitLabel,
  heading,
  demo,
  onSubmit,
  onCancel,
}: {
  id: string;
  initial: DocumentMetadata;
  submitLabel: string;
  heading: string;
  demo?: boolean;
  onSubmit: (metadata: DocumentMetadata) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<MetaValues>(() => toValues(initial));
  const [showErrors, setShowErrors] = useState(false);
  const errors = validate(values);
  const visible = showErrors ? errors : {};
  const set = (k: keyof MetaValues, v: string) => setValues((x) => ({ ...x, [k]: v }));

  return (
    <form
      noValidate
      aria-labelledby={`${id}-heading`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (Object.keys(errors).length) {
          setShowErrors(true);
          const first = Object.keys(errors)[0];
          requestAnimationFrame(() => document.getElementById(`${id}-${first}`)?.focus());
          return;
        }
        const out: DocumentMetadata = {};
        for (const [k, v] of Object.entries(values)) out[k as keyof DocumentMetadata] = v.trim();
        onSubmit(out);
      }}
      className="space-y-4 rounded-xl border border-line p-4 sm:p-5"
    >
      <div>
        <h3 id={`${id}-heading`} className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          {heading}
          {demo && <span className="rounded-full border border-orange/40 px-1.5 text-xs font-medium text-orange">Demo</span>}
        </h3>
        <p className="mt-1 text-sm text-ink-muted">
          {demo ? "Demo only — no document file is uploaded or stored. " : ""}Document metadata only — no file is stored.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id={`${id}-number`} label="Document number" value={values.number} onChange={(v) => set("number", v)} error={visible.number} />
        <TextField id={`${id}-issuer`} label="Issuer" value={values.issuer} onChange={(v) => set("issuer", v)} error={visible.issuer} />
        <TextField id={`${id}-issueDate`} label="Issue date" type="date" value={values.issueDate} onChange={(v) => set("issueDate", v)} error={visible.issueDate} />
        <TextField id={`${id}-expiryDate`} label="Expiry date" type="date" value={values.expiryDate} onChange={(v) => set("expiryDate", v)} error={visible.expiryDate} />
        <TextField id={`${id}-country`} label="Country of issue" value={values.country} onChange={(v) => set("country", v)} error={visible.country} />
        <TextField id={`${id}-filename`} label="Declared filename" value={values.filename} onChange={(v) => set("filename", v)} error={visible.filename} hint="A name for reference only. No file is uploaded." />
        <TextField id={`${id}-displayName`} label="Display name" className="sm:col-span-2" value={values.displayName} onChange={(v) => set("displayName", v)} error={visible.displayName} />
        <TextArea id={`${id}-notes`} label="Notes" rows={2} className="sm:col-span-2" value={values.notes} onChange={(v) => set("notes", v)} error={visible.notes} />
      </div>
      {showErrors && Object.keys(errors).length > 0 && <p role="alert" className="text-sm font-medium text-orange">Fix the highlighted fields to continue.</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className={ghostButton}>Cancel</button>
        <button type="submit" className={primaryButton}>{submitLabel}</button>
      </div>
    </form>
  );
}
