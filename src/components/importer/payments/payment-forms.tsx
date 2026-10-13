"use client";

import { useState } from "react";
import { DOCUMENT_TYPE_LABEL, type DocumentType } from "@/lib/importer-documents";
import {
  EVIDENCE_NOTE,
  formatMoney,
  INSTRUMENT_LABEL,
  MANUAL_TRIGGERS,
  PAYMENT_METHODS,
  TRIGGER_LABEL,
  type FinanceInstrument,
  type LcPlan,
  type ObligationInput,
  type PaymentMethod,
  type PaymentTrigger,
  type PaymentWorkspace,
} from "@/lib/importer-payments";
import { focusRing, ghostButton, primaryButton } from "../styles";
import { recordPayment, saveFinancePlan, saveLcDetails, setManualSchedule, setObligationOverride, updateReference } from "./payment-store";

export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";
export const smallButton = `inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink transition hover:border-teal/40 hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;
export const focusSoon = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

type Say = (m: string) => void;
const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

function Field({ id, label, children, hint, wide }: { id: string; label: string; children: React.ReactNode; hint?: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-full" : ""}`}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-muted">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

function Shell({ id, heading, onCancel, onSubmit, error, children, submit, note }: { id: string; heading: string; onCancel: () => void; onSubmit: () => void; error?: string; children: React.ReactNode; submit: string; note?: string }) {
  return (
    <form
      aria-labelledby={`${id}-heading`}
      noValidate
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-line p-4 sm:grid-cols-2"
    >
      <h3 id={`${id}-heading`} className="text-sm font-semibold text-ink sm:col-span-full">{heading}</h3>
      {children}
      {note && <p className="text-xs text-ink-faint sm:col-span-full">{note}</p>}
      {error && <p role="alert" className="text-sm font-medium text-orange sm:col-span-full">{error}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-full">
        <button type="submit" className={`${primaryButton} h-10`}>{submit}</button>
        <button type="button" onClick={onCancel} className={`${ghostButton} h-10`}>Cancel</button>
      </div>
    </form>
  );
}

/* ---------------- Record payment ---------------- */

export function RecordPaymentForm({ w, onDone, onMessage, initialObligation }: { w: PaymentWorkspace; onDone: () => void; onMessage: Say; initialObligation?: string }) {
  const open = w.obligations.filter((o) => o.remaining > 0);
  const [obligationId, setObligationId] = useState(initialObligation ?? open[0]?.id ?? "");
  const ob = w.obligations.find((o) => o.id === obligationId);
  const [amount, setAmount] = useState(ob ? String(ob.remaining) : "");
  const [v, setV] = useState({ paymentDate: "2026-10-07", method: (w.finance.instrument === "letter-of-credit" ? "letter-of-credit" : w.finance.instrument === "documentary-collection" ? "documentary-collection" : "bank-transfer") as PaymentMethod, reference: "", provider: "", payer: "", payee: "", notes: "", advice: "", utr: "", filename: "", evidenceNotes: "" });
  const [error, setError] = useState("");
  const set = (k: keyof typeof v, value: string) => {
    setV({ ...v, [k]: value });
    setError("");
  };
  return (
    <Shell
      id="pay"
      heading="Record an external payment"
      submit="Record Payment"
      onCancel={onDone}
      error={error}
      note="This records that a payment was made outside XimVerse. No funds are transferred and no bank is contacted."
      onSubmit={() => {
        const res = recordPayment(w, {
          obligationId,
          paymentDate: v.paymentDate,
          amount: Number(amount === "" ? NaN : amount),
          method: v.method,
          reference: v.reference,
          provider: v.provider,
          payerAccountLabel: v.payer,
          payeeAccountLabel: v.payee,
          notes: v.notes,
          evidence: { bankAdviceNumber: v.advice, utr: v.utr, declaredFilename: v.filename, notes: v.evidenceNotes },
        });
        if (res.error) return setError(res.error);
        onDone();
        onMessage(`Payment recorded: ${res.id}.`);
      }}
    >
      <Field id="pay-obligation" label="Obligation" wide>
        <select id="pay-obligation" value={obligationId} onChange={(e) => { setObligationId(e.target.value); const o = w.obligations.find((x) => x.id === e.target.value); setAmount(o ? String(o.remaining) : ""); setError(""); }} className={inputClass}>
          {open.map((o) => <option key={o.id} value={o.id}>{o.sequence}. {o.label} — {formatMoney(o.remaining, w.currency)} remaining</option>)}
        </select>
      </Field>
      <Field id="pay-date" label="Payment date"><input id="pay-date" type="date" value={v.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} className={inputClass} /></Field>
      <Field id="pay-amount" label={`Amount (${w.currency})`} hint={ob ? `Up to ${formatMoney(ob.remaining, w.currency)} remaining. Partial amounts are allowed.` : undefined}>
        <input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} className={inputClass} />
      </Field>
      <Field id="pay-currency" label="Currency" hint="Payments are recorded in the order currency. No FX conversion."><input id="pay-currency" value={w.currency} readOnly className={`${inputClass} bg-canvas`} /></Field>
      <Field id="pay-method" label="Payment method">
        <select id="pay-method" value={v.method} onChange={(e) => set("method", e.target.value)} className={inputClass}>
          {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </Field>
      <Field id="pay-reference" label="Reference number"><input id="pay-reference" value={v.reference} onChange={(e) => set("reference", e.target.value)} className={inputClass} /></Field>
      <Field id="pay-provider" label="Bank / provider name"><input id="pay-provider" value={v.provider} onChange={(e) => set("provider", e.target.value)} className={inputClass} /></Field>
      <Field id="pay-payer" label="Payer account label"><input id="pay-payer" value={v.payer} onChange={(e) => set("payer", e.target.value)} className={inputClass} placeholder="e.g. Operating account" /></Field>
      <Field id="pay-payee" label="Payee account label"><input id="pay-payee" value={v.payee} onChange={(e) => set("payee", e.target.value)} className={inputClass} placeholder="e.g. Supplier USD account" /></Field>
      <Field id="pay-notes" label="Notes" wide><input id="pay-notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} className={inputClass} /></Field>
      <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted sm:col-span-full">Evidence</h4>
      <Field id="pay-advice" label="Bank advice number"><input id="pay-advice" value={v.advice} onChange={(e) => set("advice", e.target.value)} className={inputClass} /></Field>
      <Field id="pay-utr" label="UTR / transaction reference"><input id="pay-utr" value={v.utr} onChange={(e) => set("utr", e.target.value)} className={inputClass} /></Field>
      <Field id="pay-filename" label="Declared filename"><input id="pay-filename" value={v.filename} onChange={(e) => set("filename", e.target.value)} className={inputClass} /></Field>
      <Field id="pay-evidence-notes" label="Evidence notes"><input id="pay-evidence-notes" value={v.evidenceNotes} onChange={(e) => set("evidenceNotes", e.target.value)} className={inputClass} /></Field>
      <p className="text-xs text-ink-faint sm:col-span-full">{EVIDENCE_NOTE}</p>
    </Shell>
  );
}

/* ---------------- Reference ---------------- */

export function ReferenceForm({ w, recordId, onDone, onMessage }: { w: PaymentWorkspace; recordId: string; onDone: () => void; onMessage: Say }) {
  const [ref, setRef] = useState("");
  const [error, setError] = useState("");
  return (
    <Shell id={`ref-${recordId}`} heading={`Add reference to ${recordId}`} submit="Save Reference" onCancel={onDone} error={error} onSubmit={() => { const err = updateReference(w, recordId, ref); if (err) return setError(err); onDone(); onMessage(`Reference updated on ${recordId}.`); }}>
      <Field id={`ref-input-${recordId}`} label="Reference number" wide><input id={`ref-input-${recordId}`} value={ref} onChange={(e) => { setRef(e.target.value); setError(""); }} className={inputClass} /></Field>
    </Shell>
  );
}

/* ---------------- Due date ---------------- */

export function DueDateForm({ w, obligationId, sequence, current, onDone, onMessage }: { w: PaymentWorkspace; obligationId: string; sequence: number; current?: string; onDone: () => void; onMessage: Say }) {
  const [date, setDate] = useState(current ?? "");
  const [error, setError] = useState("");
  return (
    <Shell id={`due-form-${sequence}`} heading="Set due date" submit="Save Due Date" onCancel={onDone} error={error} note="A planning date you set. It doesn't change the agreed payment terms." onSubmit={() => { if (!date) return setError("Enter a date."); const err = setObligationOverride(w, obligationId, { dueDate: date }); if (err) return setError(err); onDone(); onMessage(`Due date saved: ${date}.`); }}>
      <Field id={`due-${sequence}`} label="Due date"><input id={`due-${sequence}`} type="date" value={date} onChange={(e) => { setDate(e.target.value); setError(""); }} className={inputClass} /></Field>
    </Shell>
  );
}

/* ---------------- Manual schedule ---------------- */

const blank = (): ObligationInput => ({ label: "", percentage: 0, trigger: "manual-date" });

export function ManualScheduleForm({ w, onDone, onMessage }: { w: PaymentWorkspace; onDone: () => void; onMessage: Say }) {
  const start = w.usingManual ? w.obligations.map((o) => ({ label: o.label, percentage: o.percentage, trigger: o.trigger, dueDate: o.dueDate, notes: o.notes })) : [blank()];
  const [rows, setRows] = useState<(ObligationInput & { pct: string })[]>(start.map((r) => ({ ...r, pct: r.percentage ? String(r.percentage) : "" })));
  const [error, setError] = useState("");
  const total = rows.reduce((a, r) => a + (Number(r.pct) || 0), 0);
  const setRow = (i: number, patch: Partial<ObligationInput & { pct: string }>) => {
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setError("");
  };
  return (
    <Shell
      id="ms"
      heading="Set up payment schedule"
      submit="Save Schedule"
      onCancel={onDone}
      error={error}
      note={`Percentages of the order value (${formatMoney(w.orderValue, w.currency)}). The schedule must total exactly 100%. The agreed payment terms on the order are not changed.`}
      onSubmit={() => {
        const list = rows.map((r) => ({ label: r.label, percentage: Number(r.pct || NaN), trigger: r.trigger, dueDate: r.dueDate || undefined, notes: r.notes }));
        const err = setManualSchedule(w, list);
        if (err) return setError(err);
        onDone();
        onMessage("Payment schedule saved.");
      }}
    >
      {rows.map((r, i) => (
        <fieldset key={i} className="grid grid-cols-1 gap-3 rounded-lg border border-line p-3 sm:col-span-full sm:grid-cols-4">
          <legend className="px-1 text-xs font-semibold text-ink-muted">Obligation {i + 1}</legend>
          <Field id={`ms-label-${i + 1}`} label="Label"><input id={`ms-label-${i + 1}`} value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} className={inputClass} /></Field>
          <Field id={`ms-pct-${i + 1}`} label="Percentage"><input id={`ms-pct-${i + 1}`} inputMode="decimal" value={r.pct} onChange={(e) => setRow(i, { pct: e.target.value })} className={inputClass} /></Field>
          <Field id={`ms-trigger-${i + 1}`} label="Trigger">
            <select id={`ms-trigger-${i + 1}`} value={r.trigger} onChange={(e) => setRow(i, { trigger: e.target.value as PaymentTrigger })} className={inputClass}>
              {MANUAL_TRIGGERS.map((t) => <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field id={`ms-due-${i + 1}`} label="Due date"><input id={`ms-due-${i + 1}`} type="date" value={r.dueDate ?? ""} onChange={(e) => setRow(i, { dueDate: e.target.value })} className={inputClass} /></Field>
          {rows.length > 1 && (
            <button type="button" className={`${smallButton} justify-self-start`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              Remove<span className="sr-only"> obligation {i + 1}</span>
            </button>
          )}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-full">
        <button type="button" disabled={rows.length >= 5} onClick={() => setRows([...rows, { ...blank(), pct: "" }])} className={smallButton}>Add Obligation</button>
        <span role="status" className={`text-sm font-medium ${Math.round(total * 100) / 100 === 100 ? "text-teal" : "text-orange"}`}>Total: {Math.round(total * 100) / 100}%</span>
      </div>
    </Shell>
  );
}

/* ---------------- LC details ---------------- */

const LC_FIELDS: { key: keyof LcPlan; label: string; type?: string; numeric?: boolean }[] = [
  { key: "issuingBank", label: "Issuing bank" },
  { key: "advisingBank", label: "Advising bank" },
  { key: "applicant", label: "Applicant" },
  { key: "beneficiary", label: "Beneficiary" },
  { key: "amount", label: "LC amount", numeric: true },
  { key: "expiryDate", label: "Expiry date", type: "date" },
  { key: "latestShipmentDate", label: "Latest shipment date", type: "date" },
  { key: "presentationDays", label: "Presentation period (days)", numeric: true },
  { key: "reference", label: "Reference number" },
];

export function LcForm({ w, onDone, onMessage }: { w: PaymentWorkspace; onDone: () => void; onMessage: Say }) {
  const plan = w.lc!.plan;
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(LC_FIELDS.map((f) => [f.key, plan[f.key] !== undefined ? String(plan[f.key]) : ""])));
  const allTypes = Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[];
  const [docs, setDocs] = useState<DocumentType[]>(w.lc!.documents.map((d) => d.type));
  const [error, setError] = useState("");
  return (
    <Shell
      id="lc"
      heading="LC details"
      submit="Save LC Details"
      onCancel={onDone}
      error={error}
      note="Planning information only. No LC application is sent to a bank."
      onSubmit={() => {
        const next: LcPlan = { documents: docs };
        for (const f of LC_FIELDS) {
          const raw = v[f.key]?.trim() ?? "";
          if (!raw) continue;
          (next as Record<string, unknown>)[f.key] = f.numeric ? Number(raw) : raw;
        }
        const err = saveLcDetails(w, next);
        if (err) return setError(err);
        onDone();
        onMessage("LC details saved.");
      }}
    >
      {LC_FIELDS.map((f) => (
        <Field key={f.key} id={`lc-${f.key}`} label={`${f.label}${f.key === "amount" ? ` (${w.currency})` : ""}`}>
          <input id={`lc-${f.key}`} type={f.type ?? "text"} inputMode={f.numeric ? "decimal" : undefined} value={v[f.key]} onChange={(e) => { setV({ ...v, [f.key]: e.target.value }); setError(""); }} className={inputClass} />
        </Field>
      ))}
      <fieldset className="sm:col-span-full">
        <legend className="mb-1 text-xs font-medium text-ink-muted">Documents required by the LC (planning checklist — confirm against the actual LC)</legend>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {allTypes.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm text-ink">
              <input id={`lc-doc-${t}`} type="checkbox" checked={docs.includes(t)} onChange={(e) => { setDocs(e.target.checked ? [...docs, t] : docs.filter((d) => d !== t)); setError(""); }} className="size-4 accent-teal" />
              {DOCUMENT_TYPE_LABEL[t]}
            </label>
          ))}
        </div>
      </fieldset>
    </Shell>
  );
}

/* ---------------- Finance plan ---------------- */

export function FinanceForm({ w, onDone, onMessage }: { w: PaymentWorkspace; onDone: () => void; onMessage: Say }) {
  const p = w.finance.plan;
  const [needed, setNeeded] = useState(p.needed === false ? "no" : "yes");
  const [instrument, setInstrument] = useState<FinanceInstrument>(w.finance.instrument);
  const [amount, setAmount] = useState(p.requestedAmount !== undefined ? String(p.requestedAmount) : "");
  const [neededBy, setNeededBy] = useState(p.neededBy ?? "");
  const [purpose, setPurpose] = useState(p.purpose ?? "");
  const [provider, setProvider] = useState(p.provider ?? "");
  const [error, setError] = useState("");
  return (
    <Shell
      id="fin"
      heading="Trade-finance plan"
      submit="Save Finance Plan"
      onCancel={onDone}
      error={error}
      note="Planning only. XimVerse doesn't apply for finance, assess eligibility or recommend providers."
      onSubmit={() => {
        const a = num(amount);
        const err = saveFinancePlan(w, { needed: needed === "yes", instrument: needed === "yes" ? instrument : "none", requestedAmount: a, neededBy: neededBy || undefined, purpose, provider });
        if (err) return setError(err);
        onDone();
        onMessage("Trade-finance plan saved.");
      }}
    >
      <Field id="fin-needed" label="Finance needed?">
        <select id="fin-needed" value={needed} onChange={(e) => setNeeded(e.target.value)} className={inputClass}><option value="yes">Yes</option><option value="no">No</option></select>
      </Field>
      <Field id="fin-instrument" label="Instrument">
        <select id="fin-instrument" value={instrument} onChange={(e) => setInstrument(e.target.value as FinanceInstrument)} className={inputClass}>
          {(Object.keys(INSTRUMENT_LABEL) as FinanceInstrument[]).filter((i) => i !== "letter-of-credit").map((i) => <option key={i} value={i}>{INSTRUMENT_LABEL[i]}</option>)}
        </select>
      </Field>
      <Field id="fin-amount" label={`Requested amount (${w.currency})`}><input id="fin-amount" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} className={inputClass} /></Field>
      <Field id="fin-neededBy" label="Needed by"><input id="fin-neededBy" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className={inputClass} /></Field>
      <Field id="fin-purpose" label="Purpose"><input id="fin-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className={inputClass} /></Field>
      <Field id="fin-provider" label="Bank / provider (your choice)"><input id="fin-provider" value={provider} onChange={(e) => setProvider(e.target.value)} className={inputClass} /></Field>
    </Shell>
  );
}
