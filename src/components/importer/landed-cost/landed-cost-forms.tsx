"use client";

import { useState } from "react";
import { CURRENCIES, type Currency } from "@/lib/import-requirements";
import {
  componentLabel,
  DUTY_LABEL,
  INCLUSION_LABEL,
  MAX_SCENARIOS,
  type ComponentType,
  type CostInclusion,
  type DutyKey,
  type ScenarioOverrides,
} from "@/lib/importer-landed-cost";
import { focusRing, ghostButton, primaryButton } from "../styles";
import {
  addCustomCost,
  addFxRate,
  addOtherDuty,
  createScenario,
  saveComponent,
  saveSnapshot,
  setDutyRate,
  setValuation,
  type LandedCostSheet,
} from "./landed-cost-store";

export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";
export const smallButton = `inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink transition hover:border-teal/40 hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;
export const focusSoon = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

type Say = (m: string) => void;

/** Parses a non-empty numeric field; undefined when blank. */
const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-muted">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

function CurrencySelect({ id, value, onChange }: { id: string; value: Currency; onChange: (c: Currency) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as Currency)} className={inputClass}>
      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

function Actions({ submit, onCancel }: { submit: string; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap gap-2 sm:col-span-full">
      <button type="submit" className={`${primaryButton} h-10`}>{submit}</button>
      <button type="button" onClick={onCancel} className={`${ghostButton} h-10`}>Cancel</button>
    </div>
  );
}

function FormShell({ heading, id, onCancel, onSubmit, children, error }: { heading: string; id: string; onCancel: () => void; onSubmit: () => void; children: React.ReactNode; error?: string }) {
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
      {error && <p role="alert" className="text-sm font-medium text-orange sm:col-span-full">{error}</p>}
    </form>
  );
}

/* ---------------- Cost component ---------------- */

export function ComponentForm({ sheet, type, onDone, onMessage }: { sheet: LandedCostSheet; type: ComponentType; onDone: () => void; onMessage: Say }) {
  const current = sheet.result.components.find((l) => l.key === type);
  const [inclusion, setInclusion] = useState<CostInclusion>(current?.inclusion ?? "additional");
  const [amount, setAmount] = useState(current?.amount !== undefined ? String(current.amount) : "");
  const [currency, setCurrency] = useState<Currency>(current?.currency ?? sheet.result.currency);
  const [note, setNote] = useState(current?.note ?? "");
  const [error, setError] = useState("");
  return (
    <FormShell
      id="comp"
      heading={`Edit ${componentLabel(type)}`}
      onCancel={onDone}
      error={error}
      onSubmit={() => {
        const a = num(amount);
        if (a !== undefined && (!Number.isFinite(a) || a < 0)) return setError("Enter an amount of zero or more.");
        const err = saveComponent(sheet.order.id, type, { inclusion, amount: a, currency, note, source: "manual" });
        if (err) return setError(err);
        onDone();
        onMessage(`${componentLabel(type)} saved. Recalculated.`);
      }}
    >
      <Field id="comp-inclusion" label="Treatment">
        <select id="comp-inclusion" value={inclusion} onChange={(e) => setInclusion(e.target.value as CostInclusion)} className={inputClass}>
          {(Object.keys(INCLUSION_LABEL) as CostInclusion[]).map((k) => <option key={k} value={k}>{INCLUSION_LABEL[k]}</option>)}
        </select>
      </Field>
      <Field id="comp-amount" label="Amount" hint={inclusion === "additional" ? "Added to the landed cost once." : "Not added to the landed cost."}>
        <input id="comp-amount" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} className={inputClass} />
      </Field>
      <Field id="comp-currency" label="Currency">
        <CurrencySelect id="comp-currency" value={currency} onChange={setCurrency} />
      </Field>
      <Field id="comp-note" label="Note">
        <input id="comp-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="e.g. Forwarder estimate" />
      </Field>
      <p className="text-xs text-ink-faint sm:col-span-full">Recorded as Manual Entry. Confirm whether this charge is already included in the agreed price before marking it additional.</p>
      <Actions submit="Save" onCancel={onDone} />
    </FormShell>
  );
}

/* ---------------- FX ---------------- */

export function FxForm({ sheet, onDone, onMessage }: { sheet: LandedCostSheet; onDone: () => void; onMessage: Say }) {
  const cur = sheet.result.currency;
  const [from, setFrom] = useState<Currency>(sheet.order.terms.currency === cur ? "USD" : sheet.order.terms.currency);
  const [to, setTo] = useState<Currency>(cur);
  const [rate, setRate] = useState("");
  const [date, setDate] = useState("2026-10-07");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  return (
    <FormShell
      id="fx"
      heading="Add manual exchange rate"
      onCancel={onDone}
      error={error}
      onSubmit={() => {
        const err = addFxRate(sheet.order.id, { from, to, rate: Number(rate || NaN), effectiveDate: date, sourceNote: note });
        if (err) return setError(err);
        onDone();
        onMessage(`Manual exchange rate saved: 1 ${from} = ${rate} ${to}. Recalculated.`);
      }}
    >
      <Field id="fx-from" label="From currency"><CurrencySelect id="fx-from" value={from} onChange={(c) => { setFrom(c); setError(""); }} /></Field>
      <Field id="fx-to" label="To currency"><CurrencySelect id="fx-to" value={to} onChange={(c) => { setTo(c); setError(""); }} /></Field>
      <Field id="fx-rate" label={`Rate (1 ${from} = ? ${to})`}>
        <input id="fx-rate" inputMode="decimal" value={rate} onChange={(e) => { setRate(e.target.value); setError(""); }} className={inputClass} />
      </Field>
      <Field id="fx-date" label="Effective date"><input id="fx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></Field>
      <Field id="fx-note" label="Source note"><input id="fx-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="e.g. Bank planning rate" /></Field>
      <p className="text-xs text-ink-faint sm:col-span-full">Manual exchange rate — not a market rate. No FX feed is connected.</p>
      <Actions submit="Add Rate" onCancel={onDone} />
    </FormShell>
  );
}

/* ---------------- Valuation ---------------- */

export function ValuationForm({ sheet, onDone, onMessage }: { sheet: LandedCostSheet; onDone: () => void; onMessage: Say }) {
  const v = sheet.stored.valuation;
  const [freight, setFreight] = useState(v.freightInAv);
  const [insurance, setInsurance] = useState(v.insuranceInAv);
  const [additions, setAdditions] = useState(v.additions ? String(v.additions) : "");
  const [note, setNote] = useState(v.additionsNote ?? "");
  const [error, setError] = useState("");
  return (
    <FormShell
      id="av"
      heading="Customs value choices"
      onCancel={onDone}
      error={error}
      onSubmit={() => {
        const a = num(additions);
        if (a !== undefined && (!Number.isFinite(a) || a < 0)) return setError("Enter an amount of zero or more.");
        const err = setValuation(sheet.order.id, { freightInAv: freight, insuranceInAv: insurance, additions: a, additionsNote: note });
        if (err) return setError(err);
        onDone();
        onMessage("Customs value choices saved. Recalculated.");
      }}
    >
      <label className="flex items-start gap-2 text-sm text-ink sm:col-span-full">
        <input id="av-freight" type="checkbox" checked={freight} onChange={(e) => setFreight(e.target.checked)} className="mt-0.5 size-4 accent-teal" />
        Add freight to the assessable value when it is an additional cost
      </label>
      <label className="flex items-start gap-2 text-sm text-ink sm:col-span-full">
        <input id="av-insurance" type="checkbox" checked={insurance} onChange={(e) => setInsurance(e.target.checked)} className="mt-0.5 size-4 accent-teal" />
        Add insurance to the assessable value when it is an additional cost
      </label>
      <Field id="av-additions" label={`Manual valuation additions (${sheet.result.currency})`}>
        <input id="av-additions" inputMode="decimal" value={additions} onChange={(e) => { setAdditions(e.target.value); setError(""); }} className={inputClass} />
      </Field>
      <Field id="av-additions-note" label="Additions note"><input id="av-additions-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} /></Field>
      <Actions submit="Save Valuation" onCancel={onDone} />
    </FormShell>
  );
}

/* ---------------- Duty rates ---------------- */

export function DutyRatesForm({ sheet, onDone, onMessage }: { sheet: LandedCostSheet; onDone: () => void; onMessage: Say }) {
  const d = sheet.stored.duties;
  const init = (k: DutyKey) => (d[k] ? String(d[k]!.rate) : "");
  const [rates, setRates] = useState<Record<DutyKey, string>>({ bcd: init("bcd"), sws: init("sws"), igst: init("igst") });
  const [notes, setNotes] = useState<Record<DutyKey, string>>({ bcd: d.bcd?.sourceNote ?? "", sws: d.sws?.sourceNote ?? "", igst: d.igst?.sourceNote ?? "" });
  const [error, setError] = useState("");
  return (
    <FormShell
      id="duty"
      heading="Manual duty and tax rates"
      onCancel={onDone}
      error={error}
      onSubmit={() => {
        for (const k of ["bcd", "sws", "igst"] as const) {
          const r = num(rates[k]);
          if (r !== undefined && (!Number.isFinite(r) || r < 0 || r > 1000)) return setError(`${DUTY_LABEL[k]}: enter a rate between 0 and 1000%.`);
        }
        for (const k of ["bcd", "sws", "igst"] as const) {
          const r = num(rates[k]);
          setDutyRate(sheet.order.id, k, r === undefined ? null : { rate: r, sourceNote: notes[k] });
        }
        onDone();
        onMessage("Duty and tax rates saved. Recalculated.");
      }}
    >
      {(["bcd", "sws", "igst"] as const).map((k) => (
        <div key={k} className="grid grid-cols-1 gap-3 sm:col-span-full sm:grid-cols-2">
          <Field id={`duty-${k}`} label={`${DUTY_LABEL[k]} %`} hint="Leave blank if not known. No rate is filled in for you.">
            <input id={`duty-${k}`} inputMode="decimal" value={rates[k]} onChange={(e) => { setRates({ ...rates, [k]: e.target.value }); setError(""); }} className={inputClass} />
          </Field>
          <Field id={`duty-${k}-note`} label="Source note">
            <input id={`duty-${k}-note`} value={notes[k]} onChange={(e) => setNotes({ ...notes, [k]: e.target.value })} className={inputClass} placeholder="e.g. Entered from broker estimate" />
          </Field>
        </div>
      ))}
      <Actions submit="Save Rates" onCancel={onDone} />
    </FormShell>
  );
}

/* ---------------- Other duty ---------------- */

export function OtherDutyForm({ sheet, onDone, onMessage }: { sheet: LandedCostSheet; onDone: () => void; onMessage: Say }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(sheet.result.currency);
  const [inBase, setInBase] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  return (
    <FormShell
      id="od"
      heading="Add other duty"
      onCancel={onDone}
      error={error}
      onSubmit={() => {
        const err = addOtherDuty(sheet.order.id, { name, amount: Number(amount === "" ? NaN : amount), currency, inIgstBase: inBase, note });
        if (err) return setError(err);
        onDone();
        onMessage(`${name.trim()} added. Recalculated.`);
      }}
    >
      <Field id="od-name" label="Name"><input id="od-name" list="od-names" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} className={inputClass} /></Field>
      <datalist id="od-names">{["Cess", "Anti-dumping duty", "Safeguard duty", "Other customs duty"].map((n) => <option key={n} value={n} />)}</datalist>
      <Field id="od-amount" label="Amount"><input id="od-amount" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} className={inputClass} /></Field>
      <Field id="od-currency" label="Currency"><CurrencySelect id="od-currency" value={currency} onChange={setCurrency} /></Field>
      <Field id="od-note" label="Note"><input id="od-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} /></Field>
      <label className="flex items-start gap-2 text-sm text-ink sm:col-span-full">
        <input id="od-base" type="checkbox" checked={inBase} onChange={(e) => setInBase(e.target.checked)} className="mt-0.5 size-4 accent-teal" />
        Include in the IGST base
      </label>
      <p className="text-xs text-ink-faint sm:col-span-full">Entered manually. XimVerse does not infer duties from the product or HS code.</p>
      <Actions submit="Add Duty" onCancel={onDone} />
    </FormShell>
  );
}

/* ---------------- Custom cost ---------------- */

export function CustomCostForm({ sheet, onDone, onMessage }: { sheet: LandedCostSheet; onDone: () => void; onMessage: Say }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(sheet.result.currency);
  const [inclusion, setInclusion] = useState<CostInclusion>("additional");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  return (
    <FormShell
      id="cc"
      heading="Add cost"
      onCancel={onDone}
      error={error}
      onSubmit={() => {
        const err = addCustomCost(sheet.order.id, { name, amount: Number(amount === "" ? NaN : amount), currency, inclusion, note });
        if (err) return setError(err);
        onDone();
        onMessage(`${name.trim()} added. Recalculated.`);
      }}
    >
      <Field id="cc-name" label="Name"><input id="cc-name" list="cc-names" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} className={inputClass} /></Field>
      <datalist id="cc-names">{["Bank Charges", "Inspection", "Certification", "Storage", "Demurrage", "Detention", "Port Handling", "Last-Mile Delivery", "Other"].map((n) => <option key={n} value={n} />)}</datalist>
      <Field id="cc-amount" label="Amount"><input id="cc-amount" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} className={inputClass} /></Field>
      <Field id="cc-currency" label="Currency"><CurrencySelect id="cc-currency" value={currency} onChange={setCurrency} /></Field>
      <Field id="cc-inclusion" label="Treatment">
        <select id="cc-inclusion" value={inclusion} onChange={(e) => setInclusion(e.target.value as CostInclusion)} className={inputClass}>
          {(Object.keys(INCLUSION_LABEL) as CostInclusion[]).map((k) => <option key={k} value={k}>{INCLUSION_LABEL[k]}</option>)}
        </select>
      </Field>
      <Field id="cc-note" label="Note"><input id="cc-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} /></Field>
      <p className="text-xs text-ink-faint sm:col-span-full">Demurrage and detention are manual inputs only; nothing is calculated automatically.</p>
      <Actions submit="Add Cost" onCancel={onDone} />
    </FormShell>
  );
}

/* ---------------- Scenario ---------------- */

const SCENARIO_FIELDS = [
  ["freight", "International freight"],
  ["insurance", "Insurance"],
  ["destination-charges", "Port charges"],
  ["cha", "CHA charges"],
  ["inland", "Inland transport"],
  ["other-logistics", "Other costs"],
] as const;

export function ScenarioForm({ sheet, onDone, onMessage }: { sheet: LandedCostSheet; onDone: () => void; onMessage: Say }) {
  const cur = sheet.result.currency;
  const orderCur = sheet.order.terms.currency;
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const set = (k: string, v: string) => {
    setValues({ ...values, [k]: v });
    setError("");
  };
  return (
    <FormShell
      id="sc"
      heading="Create scenario"
      onCancel={onDone}
      error={error}
      onSubmit={() => {
        const overrides: ScenarioOverrides = {};
        const fx = num(values.fx ?? "");
        if (fx !== undefined) overrides.fx = { from: orderCur, to: cur, rate: fx };
        for (const [k] of SCENARIO_FIELDS) {
          const a = num(values[k] ?? "");
          if (a !== undefined) overrides.components = { ...overrides.components, [k]: { amount: a, currency: cur } };
        }
        for (const k of ["bcd", "sws", "igst"] as const) {
          const r = num(values[k] ?? "");
          if (r !== undefined) overrides.duties = { ...overrides.duties, [k]: r };
        }
        const err = createScenario(sheet.order.id, name, overrides);
        if (err) return setError(err);
        onDone();
        onMessage(`Scenario “${name.trim()}” created. The base estimate is unchanged.`);
      }}
    >
      <Field id="sc-name" label="Scenario name"><input id="sc-name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} className={inputClass} placeholder="e.g. Higher Freight" /></Field>
      {orderCur !== cur && (
        <Field id="sc-fx" label={`FX rate (1 ${orderCur} = ? ${cur})`}>
          <input id="sc-fx" inputMode="decimal" value={values.fx ?? ""} onChange={(e) => set("fx", e.target.value)} className={inputClass} />
        </Field>
      )}
      {SCENARIO_FIELDS.map(([k, label]) => (
        <Field key={k} id={`sc-${k}`} label={`${label} (${cur}, additional)`}>
          <input id={`sc-${k}`} inputMode="decimal" value={values[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={inputClass} />
        </Field>
      ))}
      {(["bcd", "sws", "igst"] as const).map((k) => (
        <Field key={k} id={`sc-${k}`} label={`${DUTY_LABEL[k]} %`}>
          <input id={`sc-${k}`} inputMode="decimal" value={values[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={inputClass} />
        </Field>
      ))}
      <p className="text-xs text-ink-faint sm:col-span-full">Leave a field blank to keep the base value. Quantity, supplier, product and agreed price can&apos;t be changed in a scenario. Up to {MAX_SCENARIOS} scenarios.</p>
      <Actions submit="Save Scenario" onCancel={onDone} />
    </FormShell>
  );
}

/* ---------------- Snapshot ---------------- */

export function SnapshotForm({ sheet, onDone, onMessage }: { sheet: LandedCostSheet; onDone: () => void; onMessage: Say }) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  return (
    <FormShell
      id="snap"
      heading="Save snapshot"
      onCancel={onDone}
      error={error}
      onSubmit={() => {
        const err = saveSnapshot(sheet.ctx, label);
        if (err) return setError(err);
        onDone();
        onMessage("Snapshot saved. Later edits won't change it.");
      }}
    >
      <Field id="snap-label" label="Label (optional)"><input id="snap-label" value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} placeholder="e.g. Before broker quote" /></Field>
      <Actions submit="Save Snapshot" onCancel={onDone} />
    </FormShell>
  );
}

