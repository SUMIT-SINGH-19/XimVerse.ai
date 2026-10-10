"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, Eye, FlaskConical, Info, Pencil, Send } from "lucide-react";
import { formatDate } from "@/lib/format";
import { formatPrice } from "@/lib/import-requirements";
import { importerHref, PLACEHOLDER_IMPORTER } from "@/lib/importer-nav";
import {
  canEditCase,
  canRecordClarification,
  canRecordHandoff,
  CLARIFICATION_STATUS_LABEL,
  EXAMPLE_CLARIFICATIONS,
  FIELD_SOURCE_LABEL,
  HANDOFF_CONFIRMATION,
  NO_DUTIES,
  PREPARATION_ONLY,
  validateCha,
  validateManualFields,
  type ChaAssignment,
  type CustomsCaseView,
  type DeclarationField,
  type ManualDeclarationFields,
  type ManualFieldId,
} from "@/lib/importer-customs";
import { formatOrderValue } from "@/lib/importer-orders";
import { modeLabel } from "@/lib/importer-shipments";
import { Panel } from "../dashboard/dashboard-ui";
import { Dialog } from "../negotiations/negotiation-ui";
import { focusRing, ghostButton, primaryButton, secondaryButton } from "../styles";
import { assignCha, recordClarification, recordHandoff, resolveClarification, respondToClarification, updateDeclaration } from "./customs-store";
import { demoTag } from "./customs-ui";

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 aria-[invalid=true]:border-orange";
const sourceLink = `inline-flex items-center rounded text-xs font-medium text-ink-muted underline decoration-line underline-offset-2 hover:text-teal hover:decoration-teal ${focusRing}`;
const smallButton = `inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink transition hover:border-teal/40 hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;

type Say = (message: string) => void;

function TextInput({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  optional,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  optional?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-muted">
        {label} {optional && <span className="font-normal text-ink-faint">Optional</span>}
      </label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={inputClass} />
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-ink-faint">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs font-medium text-orange">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Section C — Import Declaration Draft                                      */
/* ------------------------------------------------------------------------ */

export function DeclarationSection({ view, onMessage }: { view: CustomsCaseView; onMessage: Say }) {
  const [editing, setEditing] = useState(false);
  const editable = view.fields.filter((f) => f.manual);
  const [draft, setDraft] = useState<ManualDeclarationFields>({});
  const [errors, setErrors] = useState<Partial<Record<ManualFieldId, string>>>({});
  const shown = view.fields.filter((f) => !f.onlyIfKnown || f.value);
  const missing = view.missingFields.length;

  const open = () => {
    setDraft(Object.fromEntries(editable.map((f) => [f.manual!, view.manual[f.manual!] ?? ""])));
    setErrors({});
    setEditing(true);
  };

  return (
    <Panel id="declaration" title="Import Declaration Draft" description={view.billOfEntry ? "Bill of Entry Preparation" : "Declaration preparation for the destination broker"}>
      <div className="px-5 pb-5 pt-3 sm:px-6">
        <p className="flex gap-2 rounded-xl border border-orange/30 bg-orange-soft/40 px-4 py-3 text-sm font-semibold text-ink">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-orange" />
          {PREPARATION_ONLY}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className={`text-sm font-medium ${missing ? "text-orange" : "text-teal"}`} id="declaration-missing">
            {missing
              ? `${missing} ${missing === 1 ? "field needs" : "fields need"} attention before CHA handoff.`
              : "All required declaration fields have values."}
          </p>
          <span className="text-xs text-ink-faint">Draft version {view.declarationVersion}</span>
        </div>
        {missing > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {view.missingFields.map((f) => (
              <li key={f.id} className="rounded-full border border-orange/40 px-2 py-0.5 text-orange">{f.id === "hsCode" ? "HS Code required" : `${f.label} missing`}</li>
            ))}
          </ul>
        )}

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((f) => (
            <FieldRow key={f.id} f={f} />
          ))}
        </dl>

        {canEditCase(view) && editable.length > 0 && !editing && (
          <button type="button" onClick={open} className={`${smallButton} mt-5`}>
            <Pencil aria-hidden className="size-3.5" />
            Edit Customs Fields
          </button>
        )}
        {editing && (
          <form
            aria-labelledby="decl-edit-heading"
            noValidate
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
            }}
            onSubmit={(e) => {
              e.preventDefault();
              const errs = validateManualFields(draft);
              setErrors(errs);
              if (Object.keys(errs).length) return;
              const err = updateDeclaration(view, draft);
              if (err) return onMessage(err);
              setEditing(false);
              onMessage("Declaration draft updated.");
            }}
            className="mt-5 rounded-xl border border-line p-4"
          >
            <h3 id="decl-edit-heading" className="text-sm font-semibold text-ink">Edit customs fields</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Only customs-specific fields, or fields with no value in a source record, can be entered here. Order, shipment and document data are changed on their own pages.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {editable.map((f) => (
                <TextInput
                  key={f.id}
                  id={`decl-${f.manual}`}
                  label={f.label}
                  value={draft[f.manual!] ?? ""}
                  onChange={(v) => setDraft({ ...draft, [f.manual!]: v })}
                  error={errors[f.manual!]}
                  optional={!f.required}
                  hint={f.manual === "hsCode" ? "Enter the code from your records. XimVerse doesn't suggest HS codes." : f.manual === "freightAmount" || f.manual === "insuranceAmount" ? `Amount in ${view.order?.terms.currency ?? "the invoice currency"}, if known.` : undefined}
                />
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className={`${primaryButton} h-10`}>Save Fields</button>
              <button type="button" onClick={() => setEditing(false)} className={`${ghostButton} h-10`}>Cancel</button>
            </div>
          </form>
        )}

        <h3 className="mt-6 text-sm font-semibold text-ink">Line items</h3>
        <div className="mt-2 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-xs text-ink-muted">
                {["Line", "Description", "HS Code", "Quantity", "Invoice value", "Origin"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.lineItems.map((l) => (
                <tr key={l.line} className="align-top">
                  <td className="px-3 py-2 text-ink-muted">{l.line}</td>
                  <td className="px-3 py-2 text-ink">{l.description ?? "Not provided"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{l.hsCode ?? <span className="text-orange">HS Code required.</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{l.quantity !== undefined ? `${l.quantity.toLocaleString("en-US")} ${l.unit}` : "Not provided"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{l.invoiceValue !== undefined && l.currency ? formatPrice(l.invoiceValue, l.currency) : "Not provided"}</td>
                  <td className="px-3 py-2 text-ink">{l.countryOfOrigin ?? "Not provided"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex gap-2 text-sm text-ink-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {NO_DUTIES}
        </p>
      </div>
    </Panel>
  );
}

function FieldRow({ f }: { f: DeclarationField }) {
  const shown = f.value && f.id === "invoiceDate" ? formatDate(f.value) : f.value;
  return (
    <div className="min-w-0" data-field={f.id}>
      <dt className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-ink-faint">
        {f.label}
        {f.source && <span className="rounded border border-line px-1 font-normal text-ink-muted">{FIELD_SOURCE_LABEL[f.source]}</span>}
      </dt>
      <dd className="mt-1 break-words text-sm">
        {shown ? (
          <span className="text-ink">{shown}</span>
        ) : (
          <span className="font-medium text-orange">{f.id === "hsCode" ? "HS Code required." : f.required ? "Not provided" : "Not entered"}</span>
        )}
        {f.sourceHref && (
          <Link href={f.sourceHref} className={`${sourceLink} ml-2`}>
            Update source record<span className="sr-only"> for {f.label}</span>
          </Link>
        )}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Section D — Customs Broker / CHA                                          */
/* ------------------------------------------------------------------------ */

const CHA_FIELDS: { key: keyof ChaAssignment; label: string; type?: string; optional?: boolean }[] = [
  { key: "company", label: "CHA Company" },
  { key: "contactPerson", label: "Contact Person", optional: true },
  { key: "email", label: "Email", type: "email", optional: true },
  { key: "phone", label: "Phone", type: "tel", optional: true },
  { key: "licenseRef", label: "License / Reference", optional: true },
];

export function ChaSection({ view, onMessage }: { view: CustomsCaseView; onMessage: Say }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ChaAssignment>({ company: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof ChaAssignment, string>>>({});
  const cha = view.cha;
  const open = () => {
    setDraft({ company: "", contactPerson: "", email: "", phone: "", licenseRef: "", notes: "", ...cha });
    setErrors({});
    setEditing(true);
  };

  return (
    <Panel id="cha" title="Customs Broker / CHA" description="Importer-side record of who handles customs. Not verified by XimVerse.">
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
        {cha ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Assigned Customs Broker</p>
            <dl className="mt-2 divide-y divide-line">
              {[
                ["CHA Company", cha.company],
                ["Contact Person", cha.contactPerson],
                ["Email", cha.email],
                ["Phone", cha.phone],
                ["License / Reference", cha.licenseRef],
                ["Notes", cha.notes],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="min-w-0 break-words text-right text-ink">{v || "Not provided"}</dd>
                </div>
              ))}
            </dl>
            {view.chaSource === "shipment" && <p className="mt-2 text-xs text-ink-faint">From the shipment record. Add contact details to complete the assignment.</p>}
          </>
        ) : (
          <p className="flex gap-2 text-ink-muted">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-orange" />
            No customs broker has been assigned yet.
          </p>
        )}
        {view.handoffStale && (
          <p className="mt-3 rounded-lg bg-orange-soft/50 px-3 py-2 text-ink">The assigned broker changed after the last handoff. Record a new handoff for this broker.</p>
        )}

        {canEditCase(view) && !editing && (
          <button type="button" onClick={open} className={`${smallButton} mt-4`}>
            {cha ? "Edit Assignment" : "Assign Customs Broker"}
          </button>
        )}
        {editing && (
          <form
            aria-labelledby="cha-form-heading"
            noValidate
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
            }}
            onSubmit={(e) => {
              e.preventDefault();
              const errs = validateCha(draft);
              setErrors(errs);
              if (Object.keys(errs).length) return;
              const err = assignCha(view, draft);
              if (err) return onMessage(err);
              setEditing(false);
              onMessage("Customs broker assignment recorded.");
            }}
            className="mt-4 space-y-3 rounded-xl border border-line p-4"
          >
            <h3 id="cha-form-heading" className="text-sm font-semibold text-ink">{cha ? "Edit customs broker" : "Assign customs broker"}</h3>
            {CHA_FIELDS.map((f) => (
              <TextInput key={f.key} id={`cha-${f.key}`} label={f.label} type={f.type} optional={f.optional} value={draft[f.key] ?? ""} onChange={(v) => setDraft({ ...draft, [f.key]: v })} error={errors[f.key]} />
            ))}
            <div>
              <label htmlFor="cha-notes" className="mb-1 block text-xs font-medium text-ink-muted">Notes <span className="font-normal text-ink-faint">Optional</span></label>
              <textarea id="cha-notes" rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} aria-invalid={!!errors.notes} className={`${inputClass} h-auto py-2`} />
              {errors.notes && <p className="mt-1 text-xs font-medium text-orange">{errors.notes}</p>}
            </div>
            <p className="text-xs text-ink-faint">Recorded in XimVerse only. This doesn&apos;t create a broker account, send an invitation or verify the broker.</p>
            <div className="flex gap-2">
              <button type="submit" className={`${primaryButton} h-10`}>Save Assignment</button>
              <button type="button" onClick={() => setEditing(false)} className={`${ghostButton} h-10`}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------------ */
/* Section E — CHA Handoff Package                                           */
/* ------------------------------------------------------------------------ */

export function HandoffSection({ view, onMessage }: { view: CustomsCaseView; onMessage: Say }) {
  const [preview, setPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const allowed = canRecordHandoff(view);
  const docRefs = view.documents.filter((d) => d.complete);
  const outstanding = view.blockers;
  const included = [
    ["Shipment Summary", `${view.shipment.id} · ${modeLabel(view.shipment.route.mode)} · ${view.shipment.route.portOfLoading} → ${view.shipment.route.portOfDischarge}`],
    ["Order Summary", view.order ? `${view.order.id} · ${view.order.purchaseOrder.number}` : "Order not found"],
    ["Importer Details", PLACEHOLDER_IMPORTER.company],
    ["Supplier Details", view.supplierName],
    ["Declaration Draft", `Version ${view.declarationVersion} · ${view.fields.filter((f) => f.value).length} fields with values`],
    ["Document References", `${docRefs.length} document ${docRefs.length === 1 ? "reference" : "references"} (IDs only — no files)`],
    ["Outstanding Issues", outstanding.length ? `${outstanding.length}` : "None"],
    ["Importer Notes", "Added when the handoff is recorded"],
  ];

  return (
    <Panel id="handoff" title="CHA Handoff Package" description="What the assigned broker receives from you. References only — no files are copied or generated.">
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
        <div id="handoff-readiness" className={`rounded-xl px-4 py-3 ${outstanding.length ? "bg-orange-soft/40" : "bg-teal-soft/50"}`}>
          {outstanding.length ? (
            <>
              <p className="font-semibold text-ink">{view.handoff ? "Open items before filing" : "Handoff blocked"}</p>
              <p className="mt-0.5 text-ink-muted">{outstanding.length} {outstanding.length === 1 ? "item needs" : "items need"} attention:</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-ink">
                {outstanding.map((b) => (
                  <li key={b.id}>
                    {b.documentId ? <Link href={importerHref(`documents/${b.documentId}`)} className={`rounded hover:text-teal hover:underline ${focusRing}`}>{b.title}</Link> : b.title}
                  </li>
                ))}
              </ul>
            </>
          ) : view.handoff && view.changedSinceHandoff.length === 0 ? (
            <p className="flex gap-2 font-semibold text-ink"><CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-teal" />Handoff recorded to {view.handoff.cha.company}.</p>
          ) : view.handoff ? (
            <p className="flex gap-2 font-semibold text-ink"><CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-orange" />Ready to record an updated handoff to {view.cha?.company}.</p>
          ) : (
            <p className="flex gap-2 font-semibold text-ink"><CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-teal" />Ready for handoff to {view.cha?.company}.</p>
          )}
        </div>

        <h3 className="mt-4 text-sm font-semibold text-ink">Included in the package</h3>
        <dl className="mt-1 divide-y divide-line">
          {included.map(([k, v]) => (
            <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="min-w-0 break-words text-right text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setPreview(true)} className={`${secondaryButton} h-10`}>
            <Eye aria-hidden className="size-4" />
            Preview Handoff
          </button>
          {canEditCase(view) && (
            <button type="button" disabled={!allowed} onClick={() => { setNote(""); setError(""); setConfirming(true); }} className={`${primaryButton} h-10`}>
              <Send aria-hidden className="size-4" />
              {view.handoff ? "Record Updated Handoff" : "Record Handoff to CHA"}
            </button>
          )}
        </div>
        {canEditCase(view) && !allowed && (
          <p className="mt-2 text-xs text-ink-muted">
            {outstanding.length ? "Resolve the items above before recording the handoff." : "The current package was already handed over. A new handoff becomes available when something changes."}
          </p>
        )}

        {view.handoff && view.changedSinceHandoff.length > 0 && (
          <div className="mt-4 rounded-xl border border-orange/30 px-4 py-3">
            <p className="font-semibold text-ink">Changed since handoff</p>
            <ul className="mt-1 list-disc pl-5 text-ink-muted">
              {view.changedSinceHandoff.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
        )}

        {view.handoffs.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-semibold text-ink">Handoff history</h3>
            <ol id="handoff-history" className="mt-2 space-y-3">
              {view.handoffs.toReversed().map((h) => (
                <li key={h.eventId} className="rounded-xl border border-line px-4 py-3">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                    Handed to {h.cha.company}
                    {h.historical && <span className="rounded-full border border-line px-1.5 text-xs font-normal text-ink-muted">Historical Record</span>}
                  </p>
                  <p className="text-xs text-ink-faint"><time dateTime={h.at}>{formatDate(h.at)}</time> · Declaration version {h.declarationVersion} · {h.documentIds.length} document references</p>
                  <p className="mt-1 break-words text-xs text-ink-muted">Documents: {h.documentIds.join(", ")}</p>
                  {h.note && <p className="mt-1 text-ink-muted">Note: {h.note}</p>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <Dialog open={preview} onClose={() => setPreview(false)} title="Handoff Preview" id="handoff-preview">
        <HandoffPreview view={view} />
      </Dialog>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Record Handoff to CHA" id="handoff-confirm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const err = recordHandoff(view, note);
            if (err) return setError(err);
            setConfirming(false);
            onMessage(`Handoff to ${view.cha?.company} recorded. Nothing was sent.`);
          }}
        >
          <p className="text-sm text-ink">{HANDOFF_CONFIRMATION}</p>
          <p className="mt-2 text-sm text-ink-muted">Broker: <span className="font-medium text-ink">{view.cha?.company}</span> · Declaration version {view.declarationVersion} · {docRefs.length} document references</p>
          <label htmlFor="handoff-note" className="mt-4 block text-xs font-medium text-ink-muted">Note for the broker <span className="font-normal text-ink-faint">Optional</span></label>
          <textarea id="handoff-note" rows={3} value={note} onChange={(e) => { setNote(e.target.value); setError(""); }} className={`${inputClass} h-auto py-2`} />
          {error && <p role="alert" className="mt-1 text-sm font-medium text-orange">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" className={`${primaryButton} h-10`}>Record Handoff</button>
            <button type="button" onClick={() => setConfirming(false)} className={`${ghostButton} h-10`}>Cancel</button>
          </div>
        </form>
      </Dialog>
    </Panel>
  );
}

function HandoffPreview({ view }: { view: CustomsCaseView }) {
  const sh = view.shipment;
  const block = (title: string, rows: [string, string | undefined][]) => (
    <section className="mt-4 first:mt-0">
      <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">{title}</h3>
      <dl className="mt-1 divide-y divide-line rounded-xl border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 px-3 py-2 text-sm">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="min-w-0 break-words text-right text-ink">{v || "Not provided"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
  return (
    <div id="handoff-preview-body">
      <p className="mb-4 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-muted">{PREPARATION_ONLY} Preview only — no file is generated and nothing is sent.</p>
      {block("Customs case", [["Case", view.id], ["Assigned broker", view.cha?.company], ["Declaration version", String(view.declarationVersion)]])}
      {block("Shipment summary", [["Shipment", sh.id], ["Mode", modeLabel(sh.route.mode)], ["Route", `${sh.route.portOfLoading} → ${sh.route.portOfDischarge}`], ["ETA", formatDate(view.eta)], ["Packages", view.fields.find((f) => f.id === "packageCount")?.value]])}
      {block("Order summary", [["Order", view.order?.id], ["Purchase order", view.order?.purchaseOrder.number], ["Value", view.order ? formatOrderValue(view.order.terms) : undefined], ["Incoterm", view.fields.find((f) => f.id === "incoterm")?.value]])}
      {block("Importer details", [["Importer", PLACEHOLDER_IMPORTER.company], ["Address", PLACEHOLDER_IMPORTER.address.replace(/\n/g, ", ")], ["Contact", `${PLACEHOLDER_IMPORTER.contact.name} · ${PLACEHOLDER_IMPORTER.contact.email}`]])}
      {block("Supplier details", [["Supplier", view.supplierName], ["Country of consignment", view.fields.find((f) => f.id === "countryOfConsignment")?.value]])}
      {block("Declaration draft", view.fields.filter((f) => !f.onlyIfKnown || f.value).map((f) => [f.label, f.value] as [string, string | undefined]))}
      {block("Document references", view.documents.filter((d) => d.complete).map((d) => [d.label, d.id] as [string, string]))}
      {block("Outstanding issues", view.blockers.length ? view.blockers.map((b) => [b.title, "Open"] as [string, string]) : [["Issues", "None"]])}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Section F — CHA Clarifications                                            */
/* ------------------------------------------------------------------------ */

export function ClarificationsSection({ view, onMessage }: { view: CustomsCaseView; onMessage: Say }) {
  const [recording, setRecording] = useState(false);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [responding, setResponding] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [responseError, setResponseError] = useState("");
  const editable = canEditCase(view);

  return (
    <Panel id="clarifications" title="CHA Clarifications" description="Questions from the broker and your responses, recorded in XimVerse.">
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
        {!view.handoff && view.clarifications.length === 0 && <p className="text-ink-muted">Clarifications can be recorded once the case has been handed to the broker.</p>}
        {view.handoff && view.clarifications.length === 0 && <p className="text-ink-muted">No clarifications recorded.</p>}

        {view.clarifications.length > 0 && (
          <ol id="clarification-list" className="divide-y divide-line">
            {view.clarifications.map((c) => (
              <li key={c.id} className="py-3 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ink-faint">{c.id}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.status === "open" ? "bg-orange-soft text-orange" : c.status === "responded" ? "border border-teal/40 text-teal" : "bg-teal-soft text-teal"}`}>
                    {CLARIFICATION_STATUS_LABEL[c.status]}
                  </span>
                  {c.demo && demoTag}
                </div>
                <p className="mt-1 font-medium text-ink">{c.question}</p>
                <p className="text-xs text-ink-faint">Requested <time dateTime={c.requestedAt}>{formatDate(c.requestedAt)}</time> by the customs broker</p>
                {c.response && (
                  <div className="mt-2 border-l-2 border-teal/40 pl-3">
                    <p className="text-xs font-medium text-ink-muted">Your response · <time dateTime={c.respondedAt}>{formatDate(c.respondedAt!)}</time></p>
                    <p className="text-ink">{c.response}</p>
                  </div>
                )}
                {c.resolvedAt && <p className="mt-1 text-xs text-ink-faint">Resolved {formatDate(c.resolvedAt)}</p>}

                {editable && c.status === "open" && responding !== c.id && (
                  <button type="button" onClick={() => { setResponding(c.id); setResponse(""); setResponseError(""); }} className={`${smallButton} mt-2`}>
                    Respond<span className="sr-only"> to {c.id}</span>
                  </button>
                )}
                {editable && c.status === "responded" && (
                  <button type="button" onClick={() => onMessage(resolveClarification(view, c.id) || `${c.id} marked resolved.`)} className={`${smallButton} mt-2`}>
                    Mark Resolved<span className="sr-only"> {c.id}</span>
                  </button>
                )}
                {responding === c.id && (
                  <form
                    className="mt-2 space-y-2"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setResponding(null);
                    }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const err = respondToClarification(view, c.id, response);
                      if (err) return setResponseError(err);
                      setResponding(null);
                      onMessage("Response recorded locally. No message was sent.");
                    }}
                  >
                    <label htmlFor={`respond-${c.id}`} className="block text-xs font-medium text-ink-muted">Response to {c.id}</label>
                    <textarea id={`respond-${c.id}`} rows={2} value={response} onChange={(e) => { setResponse(e.target.value); setResponseError(""); }} aria-invalid={!!responseError} className={`${inputClass} h-auto py-2`} />
                    {responseError && <p role="alert" className="text-xs font-medium text-orange">{responseError}</p>}
                    <p className="text-xs text-ink-faint">Recorded locally — no message was sent.</p>
                    <div className="flex gap-2">
                      <button type="submit" className={`${primaryButton} h-9 px-3`}>Save Response</button>
                      <button type="button" onClick={() => setResponding(null)} className={`${ghostButton} h-9`}>Cancel</button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ol>
        )}

        {canRecordClarification(view) && !recording && (
          <button type="button" onClick={() => { setRecording(true); setQuestion(""); setError(""); }} className={`${smallButton} mt-3`}>
            <FlaskConical aria-hidden className="size-3.5 text-orange" />
            Record CHA Clarification {demoTag}
          </button>
        )}
        {recording && (
          <form
            aria-labelledby="clar-form-heading"
            className="mt-3 space-y-2 rounded-xl border border-line p-4"
            onKeyDown={(e) => {
              if (e.key === "Escape") setRecording(false);
            }}
            onSubmit={(e) => {
              e.preventDefault();
              const err = recordClarification(view, question);
              if (err) return setError(err);
              setRecording(false);
              onMessage("Demo clarification recorded.");
            }}
          >
            <h3 id="clar-form-heading" className="flex items-center gap-2 text-sm font-semibold text-ink">Record CHA clarification {demoTag}</h3>
            <p className="text-xs text-ink-muted">Demo only — no real broker message was received.</p>
            <label htmlFor="clar-example" className="block text-xs font-medium text-ink-muted">Example question</label>
            <select id="clar-example" value="" onChange={(e) => { if (e.target.value) setQuestion(e.target.value); setError(""); }} className={inputClass}>
              <option value="">Choose an example…</option>
              {EXAMPLE_CLARIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
            <label htmlFor="clar-question" className="block text-xs font-medium text-ink-muted">Broker&apos;s question</label>
            <textarea id="clar-question" rows={2} value={question} onChange={(e) => { setQuestion(e.target.value); setError(""); }} aria-invalid={!!error} className={`${inputClass} h-auto py-2`} />
            {error && <p role="alert" className="text-xs font-medium text-orange">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className={`${primaryButton} h-9 px-3`}>Record Clarification</button>
              <button type="button" onClick={() => setRecording(false)} className={`${ghostButton} h-9`}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}
