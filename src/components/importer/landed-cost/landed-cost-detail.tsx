"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Equal, FileSearch, Plus } from "lucide-react";
import { formatDate } from "@/lib/format";
import { CURRENCIES, formatQuantity, type Currency } from "@/lib/import-requirements";
import { importerHref } from "@/lib/importer-nav";
import {
  applyScenario,
  calculateLandedCost,
  COMPONENT_TYPES,
  COST_SOURCE_LABEL,
  COST_STATUS_LABEL,
  formatMoney,
  formatPercent,
  INCLUSION_LABEL,
  incotermNote,
  MAX_SCENARIOS,
  VALUATION_CAVEAT,
  type ComponentType,
  type CostLine,
  type LandedCostResult,
} from "@/lib/importer-landed-cost";
import { findSupplier } from "@/lib/importer-suppliers";
import { ImportId, Panel } from "../dashboard/dashboard-ui";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { supplierHref } from "../suppliers/supplier-links";
import { focusRing, secondaryButton } from "../styles";
import {
  ComponentForm,
  CustomCostForm,
  DutyRatesForm,
  focusSoon,
  FxForm,
  inputClass,
  OtherDutyForm,
  ScenarioForm,
  smallButton,
  SnapshotForm,
  ValuationForm,
} from "./landed-cost-forms";
import {
  deleteScenario,
  removeCustomCost,
  removeFxRate,
  removeOtherDuty,
  saveComponent,
  setCalculationCurrency,
  useLandedCostLoaded,
  useLandedCostSheets,
  type LandedCostSheet,
} from "./landed-cost-store";
import { CostStatusBadge, LANDED_COST_PROMPTS, LandedCostNotice, SUMIT_COST_MESSAGE } from "./landed-cost-ui";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;
const textLink = `inline-flex items-center gap-1 rounded text-sm font-semibold text-teal hover:underline ${focusRing}`;
type Say = (m: string) => void;

export function LandedCostDetail({ orderId }: { orderId: string }) {
  const sheets = useLandedCostSheets();
  const loaded = useLandedCostLoaded();
  const sheet = sheets.find((s) => s.order.id === orderId);
  if (!sheet) {
    if (!loaded) return <p className="py-16 text-center text-sm text-ink-muted">Loading cost sheet…</p>;
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-canvas text-ink-faint">
          <FileSearch className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Order not found</h1>
        <p className="mt-2 text-sm text-ink-muted">There&apos;s no active order <ImportId id={orderId} className="text-ink" /> in this browser tab, so there is no cost sheet.</p>
        <Link href={importerHref("landed-cost")} className={`${secondaryButton} mt-6`}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to Landed Cost
        </Link>
      </div>
    );
  }
  return <Workspace sheet={sheet} />;
}

function Workspace({ sheet }: { sheet: LandedCostSheet }) {
  const [message, setMessage] = useState("");
  const { order, shipment, customsCase, result: r } = sheet;
  const t = order.terms;
  const supplier = findSupplier(order.supplierId);
  const hs = customsCase?.override.hsCode ?? shipment?.hsCode ?? t.hsCode;
  const m = (n: number) => formatMoney(n, r.currency);

  return (
    <div className="space-y-6">
      <div>
        <Link href={importerHref("landed-cost")} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Landed Cost
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <ImportId id={order.id} className="text-ink-muted" />
          <span className="text-xs text-ink-faint">{order.purchaseOrder.number}</span>
          <CostStatusBadge status={r.status} />
        </div>
        <h1 className="mt-1 break-words text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          {t.productName}
          <span className="font-semibold text-ink-muted"> from {supplier?.name ?? order.supplierId}</span>
        </h1>
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {[
            ["Quantity", formatQuantity(t.quantity)],
            ["Incoterm", `${t.incoterm} ${t.namedPlace}`],
            ["Commercial value", formatMoney(r.commercial.amount!, t.currency)],
            ["Shipment", shipment?.id ?? "Not created yet"],
            ["HS code", hs ?? "Not recorded"],
            ["Estimate status", COST_STATUS_LABEL[r.status]],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt className="text-ink-faint">{k}</dt>
              <dd className="font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <nav aria-label="Related records" className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Link href={importerHref(`orders/${order.id}`)} className={textLink}>View Order</Link>
          {shipment && <Link href={importerHref(`shipments/${shipment.id}`)} className={textLink}>View Shipment</Link>}
          {customsCase && <Link href={importerHref(`customs/${customsCase.id}`)} className={textLink}>View Customs Case</Link>}
          <Link href={supplierHref(order.supplierId)} className={textLink}>View Supplier</Link>
        </nav>
      </div>

      <section aria-labelledby="lc-total" className="rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Estimated Landed Cost · {r.currency}</p>
        <h2 id="lc-total" className="mt-1 text-2xl font-semibold tabular-nums text-ink">{r.total !== undefined && r.status !== "needs-input" ? m(r.total) : "Not calculated"}</h2>
        <p className="mt-1 text-sm text-ink-muted" id="lc-per-unit">
          {r.status === "needs-input"
            ? "No cost assumptions entered yet. Add freight, duty or other costs below to start an estimate."
            : r.perUnit
              ? `${m(r.perUnit.value)} / ${t.quantity.unit} estimated per unit`
              : r.total === undefined
                ? "Resolve the blocking warning below to calculate."
                : "Per-unit cost needs a quantity above zero."}
        </p>
        <p className="mt-1 text-xs text-ink-faint">Estimate status: {COST_STATUS_LABEL[r.status]}. An estimate is a planning value, not an official or verified figure.</p>
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm font-medium text-teal">{message}</p>
      </section>

      <LandedCostNotice />

      {r.warnings.length > 0 && (
        <section aria-labelledby="lc-warnings" className="rounded-2xl border border-orange/30 bg-orange-soft/30 px-5 py-4 sm:px-6">
          <h2 id="lc-warnings" className="text-base font-semibold text-ink">Warnings ({r.warnings.length})</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {r.warnings.map((w) => (
              <li key={w.id} className="flex gap-2 text-ink">
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-orange" />
                <span>
                  <span className="font-semibold">{w.blocking ? "Blocks total: " : "Warning: "}</span>
                  {w.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Commercial sheet={sheet} />
        <CurrencyPanel sheet={sheet} onMessage={setMessage} />
      </div>
      <Logistics sheet={sheet} onMessage={setMessage} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CustomsValue sheet={sheet} onMessage={setMessage} />
        <Duties sheet={sheet} onMessage={setMessage} />
      </div>
      <OtherCosts sheet={sheet} onMessage={setMessage} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Summary r={r} />
        <Assumptions r={r} />
      </div>
      <Scenarios sheet={sheet} onMessage={setMessage} />
      <History sheet={sheet} onMessage={setMessage} />
      <SumitAnalysisCard id="sumit-landed-cost-detail" heading="Ask SUMIT about this landed cost" prompts={LANDED_COST_PROMPTS} message={SUMIT_COST_MESSAGE} />
    </div>
  );
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
          <dt className="text-ink-muted">{k}</dt>
          <dd className="min-w-0 break-words text-right text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return <p className="break-words font-mono text-xs text-ink-muted">{children}</p>;
}

/* A — Commercial Cost (read-only, frozen order terms). */
function Commercial({ sheet }: { sheet: LandedCostSheet }) {
  const t = sheet.order.terms;
  const value = sheet.result.commercial.amount!;
  return (
    <Panel id="commercial" title="Commercial Cost" description="Read-only. From the frozen agreed order terms — change them on the order, not here.">
      <div className="px-5 pb-5 pt-2 sm:px-6">
        <Facts
          rows={[
            ["Quantity", t.quantity.amount.toLocaleString("en-US")],
            ["Unit", t.quantity.unit],
            ["Unit Price", formatMoney(t.unitPrice, t.currency)],
            ["Currency", t.currency],
            ["Product Value", formatMoney(value, t.currency)],
            ["Incoterm", t.incoterm],
            ["Named Place", t.namedPlace],
          ]}
        />
        <Formula>{t.quantity.amount.toLocaleString("en-US")} {t.quantity.unit} × {formatMoney(t.unitPrice, t.currency)} = {formatMoney(value, t.currency)}</Formula>
        <p className="mt-2 text-sm text-ink-muted" id="incoterm-note">{incotermNote(t.incoterm)}</p>
        {sheet.result.commercial.fxFormula && <Formula>Converted: {sheet.result.commercial.fxFormula}</Formula>}
      </div>
    </Panel>
  );
}

/* Calculation currency + manual FX. */
function CurrencyPanel({ sheet, onMessage }: { sheet: LandedCostSheet; onMessage: Say }) {
  const [adding, setAdding] = useState(false);
  const r = sheet.result;
  const rates = sheet.stored.fxRates;
  return (
    <Panel id="fx" title="Currency & Exchange Rates" description="One calculation currency. Other currencies need a manual rate in that direction.">
      <div className="px-5 pb-5 pt-3 text-sm sm:px-6">
        <label htmlFor="lc-currency" className="block text-xs font-medium text-ink-muted">Calculation currency</label>
        <select
          id="lc-currency"
          value={r.currency}
          onChange={(e) => {
            setCalculationCurrency(sheet.order.id, e.target.value as Currency);
            onMessage(`Calculation currency set to ${e.target.value}. Recalculated.`);
          }}
          className={`${inputClass} mt-1 sm:w-48`}
        >
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}{c === sheet.order.terms.currency ? " (order currency)" : ""}</option>)}
        </select>
        {rates.length === 0 ? (
          <p className="mt-3 text-ink-muted">No exchange rates recorded.</p>
        ) : (
          <ul id="fx-list" className="mt-3 divide-y divide-line">
            {rates.map((x) => (
              <li key={`${x.from}-${x.to}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium text-ink">1 {x.from} = {x.rate} {x.to}</span>
                  <span className="block text-xs text-ink-faint">Manual rate · from {x.effectiveDate}{x.sourceNote ? ` · ${x.sourceNote}` : ""}</span>
                </span>
                <button type="button" className={smallButton} onClick={() => { removeFxRate(sheet.order.id, x.from, x.to); onMessage(`Rate ${x.from} → ${x.to} removed. Recalculated.`); }}>
                  Remove<span className="sr-only"> rate {x.from} to {x.to}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!adding ? (
          <button type="button" id="fx-add-button" onClick={() => { setAdding(true); focusSoon("fx-from"); }} className={`${smallButton} mt-3`}>
            <Plus aria-hidden className="size-3.5" />
            Add Exchange Rate
          </button>
        ) : (
          <FxForm sheet={sheet} onMessage={onMessage} onDone={() => { setAdding(false); focusSoon("fx-add-button"); }} />
        )}
      </div>
    </Panel>
  );
}

function amountCell(l: CostLine) {
  if (l.amount === undefined) return <span className="text-ink-faint">Not entered</span>;
  return <span className="tabular-nums">{formatMoney(l.amount, l.currency!)}</span>;
}

/* B — Logistics costs. */
function Logistics({ sheet, onMessage }: { sheet: LandedCostSheet; onMessage: Say }) {
  const [editing, setEditing] = useState<ComponentType | null>(null);
  const r = sheet.result;
  return (
    <Panel id="logistics" title="Logistics Costs" description="Optional. Each charge is included in the agreed price, an additional cost, not applicable, or unknown.">
      <ul id="logistics-list" className="divide-y divide-line px-5 pb-3 pt-1 sm:px-6">
        {COMPONENT_TYPES.map((ct) => {
          const l = r.components.find((x) => x.key === ct.id);
          return (
            <li key={ct.id} className="py-3 text-sm" data-component={ct.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{ct.label}</p>
                  {l ? (
                    <p className="text-xs text-ink-muted">
                      {INCLUSION_LABEL[l.inclusion]} · {amountCell(l)} · Source: {COST_SOURCE_LABEL[l.source]}
                      {l.note ? ` · ${l.note}` : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-ink-faint">Not entered</p>
                  )}
                  {l?.inclusion === "additional" && l.converted !== undefined && <p className="text-xs text-ink">Adds {formatMoney(l.converted, r.currency)}</p>}
                  {l?.fxFormula && <Formula>{l.fxFormula}</Formula>}
                  {l?.blocked && <p className="text-xs font-medium text-orange">Not converted — FX rate missing.</p>}
                  {l?.inclusion === "unknown" && <p className="text-xs text-orange">Confirm whether this charge is already included in the agreed price.</p>}
                </div>
                {editing !== ct.id && (
                  <span className="flex gap-1.5">
                    <button type="button" id={`edit-${ct.id}`} className={smallButton} onClick={() => { setEditing(ct.id); focusSoon("comp-inclusion"); }}>
                      Edit<span className="sr-only"> {ct.label}</span>
                    </button>
                    {sheet.stored.components[ct.id] && (
                      <button type="button" className={smallButton} onClick={() => { saveComponent(sheet.order.id, ct.id, null); onMessage(`${ct.label} reset. Recalculated.`); }}>
                        Reset<span className="sr-only"> {ct.label}</span>
                      </button>
                    )}
                  </span>
                )}
              </div>
              {editing === ct.id && <ComponentForm sheet={sheet} type={ct.id} onMessage={onMessage} onDone={() => { setEditing(null); focusSoon(`edit-${ct.id}`); }} />}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* C — Customs value preparation. */
function CustomsValue({ sheet, onMessage }: { sheet: LandedCostSheet; onMessage: Say }) {
  const [editing, setEditing] = useState(false);
  const a = sheet.result.assessable;
  const m = (n: number) => formatMoney(n, sheet.result.currency);
  return (
    <Panel id="customs-value" title="Customs Value Preparation" description={VALUATION_CAVEAT}>
      <div className="px-5 pb-5 pt-2 text-sm sm:px-6">
        <Facts
          rows={[
            ["Commercial / Invoice Value", a.invoice !== undefined ? m(a.invoice) : "Not calculated"],
            ["Freight", <span key="f">{m(a.freight)}<span className="block text-xs text-ink-faint">{a.freightNote}</span></span>],
            ["Insurance", <span key="i">{m(a.insurance)}<span className="block text-xs text-ink-faint">{a.insuranceNote}</span></span>],
            ["Other additions", m(a.additions)],
            ["Estimated Assessable Value", <strong key="av">{a.value !== undefined ? m(a.value) : "Not calculated"}</strong>],
          ]}
        />
        <Formula>AV = {a.formula}</Formula>
        <p className="mt-2 text-xs text-ink-faint">Planning calculation. Actual customs valuation may differ.</p>
        {!editing ? (
          <button type="button" id="av-edit-button" onClick={() => { setEditing(true); focusSoon("av-freight"); }} className={`${smallButton} mt-3`}>Edit Customs Value Choices</button>
        ) : (
          <ValuationForm sheet={sheet} onMessage={onMessage} onDone={() => { setEditing(false); focusSoon("av-edit-button"); }} />
        )}
      </div>
    </Panel>
  );
}

/* D — Duties & taxes (manual rates). */
function Duties({ sheet, onMessage }: { sheet: LandedCostSheet; onMessage: Say }) {
  const [editing, setEditing] = useState(false);
  const [addingOther, setAddingOther] = useState(false);
  const r = sheet.result;
  const m = (n: number) => formatMoney(n, r.currency);
  return (
    <Panel id="duties" title="Duties & Taxes" description="Manual rates only. No tariff lookup — nothing is filled in from the HS code.">
      <div className="px-5 pb-5 pt-2 text-sm sm:px-6">
        <ul id="duty-list" className="divide-y divide-line">
          {r.duties.map((d) => (
            <li key={d.key} className="py-2" data-duty={d.key}>
              <div className="flex flex-wrap justify-between gap-x-4">
                <span className="font-medium text-ink">
                  {d.label}
                  {d.rate !== undefined && <span className="font-normal text-ink-muted"> · {formatPercent(d.rate)} manual rate</span>}
                </span>
                <span className="tabular-nums text-ink">{d.amount !== undefined ? m(d.amount) : d.entered ? "Not calculated" : "Not entered"}</span>
              </div>
              <Formula>{d.formula}</Formula>
              {d.sourceNote && <p className="text-xs text-ink-faint">Source: {d.sourceNote}</p>}
              {d.key.startsWith("other:") && (
                <button type="button" className={`${smallButton} mt-1`} onClick={() => { removeOtherDuty(sheet.order.id, d.key.slice(6)); onMessage(`${d.label} removed. Recalculated.`); }}>
                  Remove<span className="sr-only"> {d.label}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
        {r.igstBase && <Formula>IGST base = AV + BCD + SWS + other duties in base = {r.igstBase.formula}</Formula>}
        <p className="mt-2 font-semibold text-ink" id="total-duties">
          Total duties &amp; taxes: {r.totalDuties !== undefined ? m(r.totalDuties) : "Not calculated (rates missing)"}
        </p>
        <p className="mt-1 text-xs text-ink-faint">Planning model: BCD = AV × rate; SWS = BCD × rate; IGST = (AV + BCD + SWS + other duties in base) × rate. It doesn&apos;t cover every special customs situation.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!editing && <button type="button" id="duty-edit-button" onClick={() => { setEditing(true); focusSoon("duty-bcd"); }} className={smallButton}>Enter Rates</button>}
          {!addingOther && <button type="button" id="od-add-button" onClick={() => { setAddingOther(true); focusSoon("od-name"); }} className={smallButton}><Plus aria-hidden className="size-3.5" />Add Other Duty</button>}
        </div>
        {editing && <DutyRatesForm sheet={sheet} onMessage={onMessage} onDone={() => { setEditing(false); focusSoon("duty-edit-button"); }} />}
        {addingOther && <OtherDutyForm sheet={sheet} onMessage={onMessage} onDone={() => { setAddingOther(false); focusSoon("od-add-button"); }} />}
      </div>
    </Panel>
  );
}

/* E — Other import costs. */
function OtherCosts({ sheet, onMessage }: { sheet: LandedCostSheet; onMessage: Say }) {
  const [adding, setAdding] = useState(false);
  const r = sheet.result;
  return (
    <Panel id="other-costs" title="Other Import Costs" description="Bank charges, storage, demurrage and similar — entered manually.">
      <div className="px-5 pb-5 pt-2 text-sm sm:px-6">
        {r.customCosts.length === 0 ? (
          <p className="text-ink-muted">No other costs added.</p>
        ) : (
          <ul id="custom-cost-list" className="divide-y divide-line">
            {r.customCosts.map((l) => (
              <li key={l.key} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="font-medium text-ink">{l.label}</span>
                  <span className="block text-xs text-ink-muted">{INCLUSION_LABEL[l.inclusion]} · {amountCell(l)} · Manual Entry{l.note ? ` · ${l.note}` : ""}</span>
                  {l.fxFormula && <Formula>{l.fxFormula}</Formula>}
                </span>
                <button type="button" className={smallButton} onClick={() => { removeCustomCost(sheet.order.id, l.key.slice(7)); onMessage(`${l.label} removed. Recalculated.`); }}>
                  Remove<span className="sr-only"> {l.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!adding ? (
          <button type="button" id="cc-add-button" onClick={() => { setAdding(true); focusSoon("cc-name"); }} className={`${smallButton} mt-3`}>
            <Plus aria-hidden className="size-3.5" />
            Add Cost
          </button>
        ) : (
          <CustomCostForm sheet={sheet} onMessage={onMessage} onDone={() => { setAdding(false); focusSoon("cc-add-button"); }} />
        )}
      </div>
    </Panel>
  );
}

/* F — Waterfall, per unit and cost share. */
function Summary({ r }: { r: LandedCostResult }) {
  const m = (n: number) => formatMoney(n, r.currency);
  return (
    <Panel id="summary" title="Landed Cost Summary" description={`All values in ${r.currency}. Only additional costs are added; included charges are not counted twice.`}>
      <div className="px-5 pb-5 pt-2 text-sm sm:px-6">
        <ol id="waterfall" className="divide-y divide-line">
          {r.waterfall.map((s, i) => (
            <li key={s.key} className="flex justify-between gap-4 py-2" data-step={s.key}>
              <span className="text-ink-muted">{i === 0 ? "" : "+ "}{s.label}</span>
              <span className="tabular-nums text-ink">{m(s.amount)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-4 py-2 font-semibold">
            <span className="flex items-center gap-1 text-ink"><Equal aria-hidden className="size-4" />Estimated Landed Cost</span>
            <span className="tabular-nums text-ink">{r.total !== undefined ? m(r.total) : "Not calculated"}</span>
          </li>
        </ol>
        {r.perUnit && <p className="mt-2 font-medium text-ink">Estimated Landed Cost per Unit: {m(r.perUnit.value)} / {r.quantity.unit}</p>}
        {r.perUnit && <Formula>{r.perUnit.formula}</Formula>}
        {r.share && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Cost share</h3>
            <ul id="cost-share" className="mt-2 space-y-1.5">
              {(["commercial", "logistics", "duties", "other"] as const).map((k) => (
                <li key={k} className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-2 text-xs">
                  <span className="capitalize text-ink-muted">{k === "duties" ? "Duties & taxes" : k}</span>
                  <span aria-hidden className="h-2 overflow-hidden rounded-full bg-line">
                    <span className="block h-full rounded-full bg-teal" style={{ width: `${Math.min(100, r.share![k])}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-ink">{r.share![k].toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* G — Assumptions & sources. */
function Assumptions({ r }: { r: LandedCostResult }) {
  return (
    <Panel id="assumptions" title="Assumptions & Sources" description="Every value that is not derived from the order, shipment or customs case.">
      <div className="px-5 pb-5 pt-2 text-sm sm:px-6">
        {r.assumptions.length === 0 ? (
          <p className="text-ink-muted">No assumptions recorded yet.</p>
        ) : (
          <ul id="assumption-list" className="list-disc space-y-1 pl-5 text-ink">
            {r.assumptions.map((a) => <li key={a}>{a}</li>)}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-faint">Commercial values come from the order. Rates and amounts above were entered manually or are demo planning assumptions; none are verified.</p>
      </div>
    </Panel>
  );
}

/* H — Scenarios. */
function Scenarios({ sheet, onMessage }: { sheet: LandedCostSheet; onMessage: Say }) {
  const [creating, setCreating] = useState(false);
  const base = sheet.result;
  const results = sheet.scenarios.map((s) => ({ s, r: calculateLandedCost(sheet.ctx, applyScenario(sheet.ctx, sheet.stored, s.overrides)) }));
  const cols: { name: string; r: LandedCostResult; id?: string }[] = [{ name: "Base", r: base }, ...results.map(({ s, r }) => ({ name: s.name, r, id: s.id }))];
  const duty = (r: LandedCostResult, k: string) => r.duties.find((d) => d.key === k)?.amount;
  const group = (r: LandedCostResult, k: string) => r.waterfall.find((w) => w.key === k)?.amount;
  const rows: [string, (r: LandedCostResult) => number | undefined][] = [
    ["Commercial Value", (r) => r.commercial.converted],
    ["Freight", (r) => group(r, "freight")],
    ["Insurance", (r) => group(r, "insurance")],
    ["Assessable Value", (r) => r.assessable.value],
    ["BCD", (r) => duty(r, "bcd")],
    ["SWS", (r) => duty(r, "sws")],
    ["IGST", (r) => duty(r, "igst")],
    ["Other Duties", (r) => r.duties.filter((d) => d.key.startsWith("other:")).reduce((a, d) => a + (d.amount ?? 0), 0)],
    ["Port Charges", (r) => group(r, "port")],
    ["CHA", (r) => group(r, "cha")],
    ["Inland Transport", (r) => group(r, "inland")],
    ["Other", (r) => group(r, "other")],
    ["Total Landed Cost", (r) => r.total],
    ["Per Unit", (r) => r.perUnit?.value],
  ];
  const fmt = (n: number | undefined) => (n === undefined ? "—" : formatMoney(n, base.currency));
  return (
    <Panel id="scenarios" title="Scenarios" description="Each scenario stores only its overrides; the base estimate is never changed.">
      <div className="px-5 pb-5 pt-2 text-sm sm:px-6">
        {sheet.scenarios.length === 0 ? (
          <p className="text-ink-muted">No scenarios yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table id="scenario-table" className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-xs text-ink-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Line</th>
                  {cols.map((c) => <th key={c.name + (c.id ?? "")} scope="col" className="px-3 py-2 text-right font-medium">{c.name}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(([label, get]) => (
                  <tr key={label} className={label.startsWith("Total") ? "font-semibold" : undefined}>
                    <th scope="row" className="px-3 py-2 font-normal text-ink-muted">{label}</th>
                    {cols.map((c, i) => {
                      const v = get(c.r);
                      const b = get(base);
                      const diff = i > 0 && v !== undefined && b !== undefined ? Math.round((v - b) * 100) / 100 : 0;
                      return (
                        <td key={c.name + i} className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink">
                          {fmt(v)}
                          {diff !== 0 && <span className="block text-xs text-ink-muted">{diff > 0 ? "+" : "−"}{formatMoney(Math.abs(diff), base.currency)} vs base</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sheet.scenarios.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {sheet.scenarios.map((s) => (
              <li key={s.id}>
                <button type="button" className={smallButton} onClick={() => { deleteScenario(sheet.order.id, s.id); onMessage(`Scenario “${s.name}” deleted.`); }}>
                  Delete<span className="sr-only"> scenario</span> {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!creating ? (
          <button type="button" id="sc-create-button" disabled={sheet.scenarios.length >= MAX_SCENARIOS} onClick={() => { setCreating(true); focusSoon("sc-name"); }} className={`${smallButton} mt-3`}>
            <Plus aria-hidden className="size-3.5" />
            Create Scenario
          </button>
        ) : (
          <ScenarioForm sheet={sheet} onMessage={onMessage} onDone={() => { setCreating(false); focusSoon("sc-create-button"); }} />
        )}
        {sheet.scenarios.length >= MAX_SCENARIOS && <p className="mt-1 text-xs text-ink-faint">Up to {MAX_SCENARIOS} scenarios. Delete one to add another.</p>}
      </div>
    </Panel>
  );
}

/* I — Snapshot history (immutable). */
function History({ sheet, onMessage }: { sheet: LandedCostSheet; onMessage: Say }) {
  const [saving, setSaving] = useState(false);
  return (
    <Panel id="history" title="Cost History" description="Snapshots freeze the inputs, rates and totals at the time. Later edits never change them.">
      <div className="px-5 pb-5 pt-2 text-sm sm:px-6">
        {sheet.snapshots.length === 0 ? (
          <p className="text-ink-muted">No snapshots saved.</p>
        ) : (
          <ol id="snapshot-list" className="space-y-2">
            {sheet.snapshots.toReversed().map((s) => (
              <li key={s.id} className="rounded-xl border border-line px-4 py-3" data-snapshot={s.id}>
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-ink">{s.label ?? "Snapshot"} · <time dateTime={s.at}>{formatDate(s.at)}</time></span>
                  <span className="tabular-nums text-ink">{s.total !== undefined ? formatMoney(s.total, s.currency) : "Not calculated"}</span>
                </p>
                <p className="text-xs text-ink-muted">
                  {COST_STATUS_LABEL[s.status]} · Per unit {s.perUnit !== undefined ? formatMoney(s.perUnit, s.currency) : "—"} · Duties {s.totalDuties !== undefined ? formatMoney(s.totalDuties, s.currency) : "not calculated"}
                </p>
                <details className="mt-1">
                  <summary className={`cursor-pointer rounded text-xs font-medium text-teal ${focusRing}`}>Assumptions at the time ({s.assumptions.length})</summary>
                  <ul className="mt-1 list-disc pl-5 text-xs text-ink-muted">{s.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
                </details>
              </li>
            ))}
          </ol>
        )}
        {!saving ? (
          <button type="button" id="snap-button" onClick={() => { setSaving(true); focusSoon("snap-label"); }} className={`${smallButton} mt-3`}>Save Snapshot</button>
        ) : (
          <SnapshotForm sheet={sheet} onMessage={onMessage} onDone={() => { setSaving(false); focusSoon("snap-button"); }} />
        )}
      </div>
    </Panel>
  );
}

