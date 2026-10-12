/**
 * Landed cost: a transparent cost-planning sheet per order.
 *
 * The order's frozen agreed terms are the commercial truth (quantity, unit
 * price, currency, Incoterm). The shipment adds route context; the customs
 * case adds the HS code and any manual freight / insurance planning values.
 * This module stores nothing of those — only the importer's planning inputs
 * (cost amounts, inclusion choices, manual FX and duty rates), and derives
 * every number from them with a visible formula.
 *
 * Nothing here is official: there is no tariff engine, no FX feed and no HS
 * classification. Rates are user-entered; results are planning estimates.
 */

import { type Currency, type QuantityUnit } from "./import-requirements";
import type { CustomsCaseView } from "./importer-customs";
import { orderValue, type Order } from "./importer-orders";
import type { Shipment } from "./importer-shipments";

export const LANDED_COST_NOTICE =
  "Calculations are based on values and assumptions recorded in XimVerse. Duties, taxes and exchange rates are not verified against live government or market sources.";
export const VALUATION_CAVEAT = "Planning calculation. Actual customs valuation may differ.";
export const DEMO_ASSUMPTION = "Demo planning assumption";

/* ------------------------------------------------------------------------ */
/* Vocabulary                                                                */
/* ------------------------------------------------------------------------ */

export type CostInclusion = "included" | "additional" | "not-applicable" | "unknown";

export const INCLUSION_LABEL: Record<CostInclusion, string> = {
  included: "Included in Commercial Price",
  additional: "Additional Cost",
  "not-applicable": "Not Applicable",
  unknown: "Unknown",
};

export type CostSource = "order" | "quotation" | "shipment" | "customs-case" | "manual" | "scenario" | "demo";

export const COST_SOURCE_LABEL: Record<CostSource, string> = {
  order: "Order",
  quotation: "Quotation",
  shipment: "Shipment",
  "customs-case": "Customs Case",
  manual: "Manual Entry",
  scenario: "Scenario Assumption",
  demo: "Demo planning assumption",
};

export type CostGroup = "freight" | "insurance" | "port" | "cha" | "inland" | "other";

export const COMPONENT_TYPES = [
  { id: "freight", label: "International Freight", group: "freight" },
  { id: "insurance", label: "Insurance", group: "insurance" },
  { id: "origin-charges", label: "Origin Charges", group: "port" },
  { id: "destination-charges", label: "Destination Port / Terminal Charges", group: "port" },
  { id: "forwarder", label: "Freight Forwarder Charges", group: "port" },
  { id: "cha", label: "CHA / Customs Broker Charges", group: "cha" },
  { id: "inland", label: "Inland Transport", group: "inland" },
  { id: "warehousing", label: "Warehousing", group: "inland" },
  { id: "inspection", label: "Inspection Charges", group: "other" },
  { id: "other-logistics", label: "Other Logistics Charges", group: "other" },
] as const satisfies readonly { id: string; label: string; group: CostGroup }[];
export type ComponentType = (typeof COMPONENT_TYPES)[number]["id"];

export const componentLabel = (t: ComponentType) => COMPONENT_TYPES.find((c) => c.id === t)!.label;

export interface ComponentInput {
  amount?: number;
  currency?: Currency;
  inclusion: CostInclusion;
  note?: string;
  source?: CostSource;
}

export interface FxRate {
  from: Currency;
  to: Currency;
  /** 1 `from` = `rate` `to`. */
  rate: number;
  /** YYYY-MM-DD */
  effectiveDate: string;
  sourceNote?: string;
}

export interface RateInput {
  /** Percent, e.g. 10 for 10%. */
  rate: number;
  sourceNote?: string;
}

export type DutyKey = "bcd" | "sws" | "igst";

export const DUTY_LABEL: Record<DutyKey, string> = {
  bcd: "Basic Customs Duty (BCD)",
  sws: "Social Welfare Surcharge (SWS)",
  igst: "IGST",
};

export interface OtherDuty {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  /** Added to the IGST base (customs duties are; a user decision). */
  inIgstBase: boolean;
  note?: string;
}

export interface CustomCost {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  inclusion: CostInclusion;
  note?: string;
}

export interface ValuationChoices {
  /** Add freight to the assessable value when it is an additional cost. */
  freightInAv: boolean;
  insuranceInAv: boolean;
  additions?: number;
  additionsNote?: string;
}

/** Everything the importer enters. Commercial data is never stored here. */
export interface LandedCostInputs {
  calculationCurrency?: Currency;
  components: Partial<Record<ComponentType, ComponentInput>>;
  fxRates: FxRate[];
  duties: Partial<Record<DutyKey, RateInput>>;
  otherDuties: OtherDuty[];
  customCosts: CustomCost[];
  valuation: ValuationChoices;
  updatedAt?: string;
}

export const EMPTY_INPUTS: LandedCostInputs = {
  components: {},
  fxRates: [],
  duties: {},
  otherDuties: [],
  customCosts: [],
  valuation: { freightInAv: true, insuranceInAv: true },
};

/* ------------------------------------------------------------------------ */
/* Money                                                                     */
/* ------------------------------------------------------------------------ */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export const formatPercent = (rate: number) => `${Number(rate.toFixed(4))}%`;

export interface Conversion {
  ok: boolean;
  value?: number;
  /** "$1,000.00 × ₹84.10 / USD = ₹84,100.00" */
  formula?: string;
  rate?: FxRate;
  /** Why it couldn't convert. */
  missing?: { from: Currency; to: Currency; inverseRecorded: boolean };
}

/** Rejects zero/negative/non-finite rates and same-currency pairs. */
export function validateFxRate(r: Partial<FxRate>): string | undefined {
  if (!r.from || !r.to) return "Choose both currencies.";
  if (r.from === r.to) return "Choose two different currencies.";
  if (typeof r.rate !== "number" || !Number.isFinite(r.rate) || r.rate <= 0) return "Enter a rate greater than zero.";
  if (!r.effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(r.effectiveDate)) return "Enter the date this rate applies from.";
}

/**
 * Converts using a rate recorded in exactly this direction. An inverse rate
 * is never flipped silently; it is reported so the user can enter the right one.
 */
export function convert(amount: number, from: Currency, to: Currency, rates: readonly FxRate[]): Conversion {
  if (from === to) return { ok: true, value: round2(amount) };
  const rate = rates.filter((r) => r.from === from && r.to === to && !validateFxRate(r)).at(-1);
  if (!rate) return { ok: false, missing: { from, to, inverseRecorded: rates.some((r) => r.from === to && r.to === from) } };
  const value = round2(amount * rate.rate);
  return { ok: true, value, rate, formula: `${formatMoney(amount, from)} × ${formatMoney(rate.rate, to)} / ${from} = ${formatMoney(value, to)}` };
}

/* ------------------------------------------------------------------------ */
/* Defaults from source records                                              */
/* ------------------------------------------------------------------------ */

const FREIGHT_INCLUDED = ["CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const INSURANCE_INCLUDED = ["CIF", "CIP"];

/** What the agreed Incoterm says about freight / insurance — explanation only. */
export function incotermNote(incoterm: string): string {
  if (incoterm === "CIF" || incoterm === "CIP") return `${incoterm}: the agreed price is on terms that include main freight and insurance to the named place.`;
  if (FREIGHT_INCLUDED.includes(incoterm)) return `${incoterm}: the agreed price is on terms that include main freight to the named place, but not insurance.`;
  if (incoterm === "FOB" || incoterm === "FCA") return `${incoterm}: the agreed price generally covers delivery to the port or place of loading; international freight and insurance are generally not included.`;
  if (incoterm === "EXW") return "EXW: the agreed price generally covers goods at the seller's premises only.";
  return `${incoterm}: confirm which charges the agreed price includes.`;
}

/**
 * Default freight / insurance treatment. The order's agreed Incoterm is an
 * explicit term of the order, so CFR/CIF-type terms mark freight (and CIF/CIP
 * insurance) as included. Everything else starts Unknown with a prompt —
 * nothing is subtracted or added on Incoterm theory alone.
 */
export function defaultComponent(type: ComponentType, order: Order, customs?: CustomsCaseView): ComponentInput | undefined {
  const inc = order.terms.incoterm;
  const manual = customs?.manual;
  if (type === "freight") {
    if (FREIGHT_INCLUDED.includes(inc)) return { inclusion: "included", source: "order", note: `Agreed Incoterm ${inc} ${order.terms.namedPlace}` };
    if (manual?.freightAmount) return { inclusion: "additional", amount: Number(manual.freightAmount), currency: order.terms.currency, source: "customs-case", note: `Freight amount from customs case ${customs!.id}` };
    return { inclusion: "unknown", source: "order", note: `Agreed Incoterm ${inc}` };
  }
  if (type === "insurance") {
    if (INSURANCE_INCLUDED.includes(inc)) return { inclusion: "included", source: "order", note: `Agreed Incoterm ${inc} ${order.terms.namedPlace}` };
    if (manual?.insuranceAmount) return { inclusion: "additional", amount: Number(manual.insuranceAmount), currency: order.terms.currency, source: "customs-case", note: `Insurance amount from customs case ${customs!.id}` };
    return { inclusion: "unknown", source: "order", note: `Agreed Incoterm ${inc}` };
  }
  return undefined;
}

/* ------------------------------------------------------------------------ */
/* Calculation                                                               */
/* ------------------------------------------------------------------------ */

export type CostStatus = "needs-input" | "partial" | "complete";

export const COST_STATUS_LABEL: Record<CostStatus, string> = {
  "needs-input": "Needs Input",
  partial: "Partial Estimate",
  complete: "Estimate Complete",
};

export interface CostLine {
  key: string;
  label: string;
  group: CostGroup | "commercial" | "duty";
  inclusion: CostInclusion;
  source: CostSource;
  note?: string;
  amount?: number;
  currency?: Currency;
  /** In the calculation currency. */
  converted?: number;
  fxFormula?: string;
  /** Amount added to the landed cost (0 when included / not applicable). */
  added: number;
  /** Couldn't be converted for lack of an FX rate. */
  blocked?: boolean;
}

export interface DutyLine {
  key: DutyKey | `other:${string}`;
  label: string;
  /** Percent, when rate-based. */
  rate?: number;
  base?: number;
  amount?: number;
  formula: string;
  sourceNote?: string;
  entered: boolean;
}

export type WarningKind = "fx-missing" | "rate-missing" | "inclusion-unclear" | "amount-missing" | "customs-value-incomplete";

export interface CostWarning {
  id: string;
  kind: WarningKind;
  text: string;
  /** Blocks the total (cannot be calculated without it). */
  blocking: boolean;
}

export interface WaterfallStep {
  key: "commercial" | "freight" | "insurance" | "duties" | "port" | "cha" | "inland" | "other";
  label: string;
  amount: number;
}

export interface LandedCostResult {
  currency: Currency;
  quantity: { amount: number; unit: QuantityUnit };
  commercial: CostLine;
  components: CostLine[];
  customCosts: CostLine[];
  assessable: {
    invoice?: number;
    freight: number;
    freightNote: string;
    insurance: number;
    insuranceNote: string;
    additions: number;
    value?: number;
    formula: string;
  };
  duties: DutyLine[];
  igstBase?: { value: number; formula: string };
  totalDuties?: number;
  waterfall: WaterfallStep[];
  total?: number;
  perUnit?: { value: number; formula: string };
  share?: { commercial: number; logistics: number; duties: number; other: number };
  warnings: CostWarning[];
  assumptions: string[];
  status: CostStatus;
}

export interface LandedCostContext {
  order: Order;
  shipment?: Shipment;
  customsCase?: CustomsCaseView;
}

/** Stored inputs with defaults filled in for freight / insurance. */
export function effectiveInputs(ctx: LandedCostContext, stored: LandedCostInputs = EMPTY_INPUTS): LandedCostInputs {
  const components = { ...stored.components };
  for (const t of ["freight", "insurance"] as const) {
    if (!components[t]) {
      const d = defaultComponent(t, ctx.order, ctx.customsCase);
      if (d) components[t] = d;
    }
  }
  return { ...EMPTY_INPUTS, ...stored, components, valuation: { ...EMPTY_INPUTS.valuation, ...stored.valuation } };
}

/** True when the importer (or demo data) has entered any planning input. */
export function hasPlanningInput(stored: LandedCostInputs | undefined): boolean {
  if (!stored) return false;
  return Object.keys(stored.components).length > 0 || stored.fxRates.length > 0 || Object.keys(stored.duties).length > 0 || stored.otherDuties.length > 0 || stored.customCosts.length > 0 || !!stored.valuation.additions || !!stored.calculationCurrency;
}

export function calculateLandedCost(ctx: LandedCostContext, stored: LandedCostInputs = EMPTY_INPUTS): LandedCostResult {
  const { order } = ctx;
  const t = order.terms;
  const inputs = effectiveInputs(ctx, stored);
  const cur = inputs.calculationCurrency ?? t.currency;
  const warnings: CostWarning[] = [];
  const assumptions: string[] = [];
  const fxMissing = new Set<string>();
  const warnFx = (c: Conversion) => {
    if (!c.missing) return;
    const key = `${c.missing.from}-${c.missing.to}`;
    if (fxMissing.has(key)) return;
    fxMissing.add(key);
    warnings.push({
      id: `fx-${key}`,
      kind: "fx-missing",
      blocking: true,
      text: `FX rate missing for ${c.missing.from} → ${c.missing.to} conversion${c.missing.inverseRecorded ? ` (a ${c.missing.to} → ${c.missing.from} rate is recorded; enter the rate in this direction)` : ""}.`,
    });
  };

  // Commercial value: quantity × agreed unit price, from the frozen order terms.
  const productValue = round2(orderValue(t));
  const commercialConv = convert(productValue, t.currency, cur, inputs.fxRates);
  warnFx(commercialConv);
  const commercial: CostLine = {
    key: "commercial",
    label: "Commercial Product Cost",
    group: "commercial",
    inclusion: "additional",
    source: "order",
    note: `${t.quantity.amount.toLocaleString("en-US")} ${t.quantity.unit} × ${formatMoney(t.unitPrice, t.currency)} (agreed ${t.incoterm} ${t.namedPlace})`,
    amount: productValue,
    currency: t.currency,
    converted: commercialConv.value,
    fxFormula: commercialConv.formula,
    added: commercialConv.value ?? 0,
    blocked: !commercialConv.ok,
  };

  const line = (key: string, label: string, group: CostLine["group"], c: ComponentInput | undefined): CostLine => {
    const inclusion = c?.inclusion ?? "unknown";
    const base: CostLine = { key, label, group, inclusion, source: c?.source ?? "manual", note: c?.note, amount: c?.amount, currency: c?.currency ?? t.currency, added: 0 };
    if (inclusion !== "additional") return base;
    if (c?.amount === undefined) return base;
    const conv = convert(c.amount, base.currency!, cur, inputs.fxRates);
    warnFx(conv);
    return { ...base, converted: conv.value, fxFormula: conv.formula, added: conv.value ?? 0, blocked: !conv.ok };
  };

  const components = COMPONENT_TYPES.filter((ct) => inputs.components[ct.id] || ct.id === "freight" || ct.id === "insurance").map((ct) =>
    line(ct.id, ct.label, ct.group, inputs.components[ct.id]),
  );
  const customCosts = inputs.customCosts.map((c) => line(`custom:${c.id}`, c.name, "other", { amount: c.amount, currency: c.currency, inclusion: c.inclusion, note: c.note, source: "manual" }));

  for (const l of [...components, ...customCosts]) {
    if (l.inclusion === "unknown" && (l.key === "freight" || l.key === "insurance")) {
      warnings.push({ id: `inclusion-${l.key}`, kind: "inclusion-unclear", blocking: false, text: `${l.key === "freight" ? "Freight" : "Insurance"} inclusion unclear. Confirm whether this charge is already included in the agreed price.` });
    }
    if (l.inclusion === "additional" && l.amount === undefined) {
      warnings.push({ id: `amount-${l.key}`, kind: "amount-missing", blocking: false, text: `${l.label}: marked as an additional cost but no amount is entered.` });
    }
  }

  // Customs value preparation (planning only).
  const freight = components.find((l) => l.key === "freight")!;
  const insurance = components.find((l) => l.key === "insurance")!;
  const avPart = (l: CostLine, flag: boolean, name: string): [number, string] => {
    if (l.inclusion === "included") return [0, `${name} included in the invoice value — not added again`];
    if (l.inclusion === "not-applicable") return [0, `${name} not applicable`];
    if (l.inclusion === "unknown") return [0, `${name} inclusion unclear — not added`];
    if (!flag) return [0, `${name} excluded from the assessable value by your choice`];
    if (l.converted === undefined) return [0, `${name} amount not available`];
    return [l.converted, `${name} added separately`];
  };
  const [avFreight, freightNote] = avPart(freight, inputs.valuation.freightInAv, "Freight");
  const [avInsurance, insuranceNote] = avPart(insurance, inputs.valuation.insuranceInAv, "Insurance");
  const additions = round2(inputs.valuation.additions ?? 0);
  const avValue = commercialConv.ok ? round2(commercialConv.value! + avFreight + avInsurance + additions) : undefined;
  if (freight.inclusion === "unknown" || insurance.inclusion === "unknown") {
    warnings.push({ id: "customs-value", kind: "customs-value-incomplete", blocking: false, text: "Customs value incomplete: freight or insurance treatment is not confirmed." });
  }
  const m = (n: number) => formatMoney(n, cur);
  const assessable = {
    invoice: commercialConv.value,
    freight: avFreight,
    freightNote,
    insurance: avInsurance,
    insuranceNote,
    additions,
    value: avValue,
    formula: avValue === undefined ? "Not calculated — the invoice value can't be converted." : `${m(commercialConv.value!)} + ${m(avFreight)} + ${m(avInsurance)} + ${m(additions)} = ${m(avValue)}`,
  };

  // Duties & taxes — manual rates only.
  const duties: DutyLine[] = [];
  const rate = (k: DutyKey) => inputs.duties[k];
  let bcd: number | undefined;
  let sws: number | undefined;
  const bcdIn = rate("bcd");
  if (bcdIn && avValue !== undefined) {
    bcd = round2((avValue * bcdIn.rate) / 100);
    duties.push({ key: "bcd", label: DUTY_LABEL.bcd, rate: bcdIn.rate, base: avValue, amount: bcd, formula: `${m(avValue)} × ${formatPercent(bcdIn.rate)} = ${m(bcd)}`, sourceNote: bcdIn.sourceNote, entered: true });
  } else duties.push({ key: "bcd", label: DUTY_LABEL.bcd, formula: bcdIn ? "Not calculated — assessable value unavailable." : "Rate not entered.", entered: !!bcdIn });
  const swsIn = rate("sws");
  if (swsIn && bcd !== undefined) {
    sws = round2((bcd * swsIn.rate) / 100);
    duties.push({ key: "sws", label: DUTY_LABEL.sws, rate: swsIn.rate, base: bcd, amount: sws, formula: `${m(bcd)} × ${formatPercent(swsIn.rate)} = ${m(sws)}`, sourceNote: swsIn.sourceNote, entered: true });
  } else duties.push({ key: "sws", label: DUTY_LABEL.sws, formula: swsIn ? "Not calculated — BCD unavailable." : "Rate not entered.", entered: !!swsIn });

  let otherInBase = 0;
  let otherTotal = 0;
  let otherBlocked = false;
  for (const d of inputs.otherDuties) {
    const conv = convert(d.amount, d.currency, cur, inputs.fxRates);
    warnFx(conv);
    if (!conv.ok) otherBlocked = true;
    const v = conv.value ?? 0;
    otherTotal = round2(otherTotal + v);
    if (d.inIgstBase) otherInBase = round2(otherInBase + v);
    duties.push({
      key: `other:${d.id}`,
      label: d.name,
      amount: conv.value,
      formula: `Entered manually: ${formatMoney(d.amount, d.currency)}${conv.formula ? ` → ${conv.formula}` : ""}${d.inIgstBase ? " (in IGST base)" : " (not in IGST base)"}`,
      sourceNote: d.note,
      entered: true,
    });
  }

  let igstBase: LandedCostResult["igstBase"];
  let igst: number | undefined;
  const igstIn = rate("igst");
  if (avValue !== undefined && bcd !== undefined && sws !== undefined && !otherBlocked) {
    const baseValue = round2(avValue + bcd + sws + otherInBase);
    igstBase = { value: baseValue, formula: `${m(avValue)} + ${m(bcd)} + ${m(sws)} + ${m(otherInBase)} = ${m(baseValue)}` };
  }
  if (igstIn && igstBase) {
    igst = round2((igstBase.value * igstIn.rate) / 100);
    duties.push({ key: "igst", label: DUTY_LABEL.igst, rate: igstIn.rate, base: igstBase.value, amount: igst, formula: `${m(igstBase.value)} × ${formatPercent(igstIn.rate)} = ${m(igst)}`, sourceNote: igstIn.sourceNote, entered: true });
  } else duties.push({ key: "igst", label: DUTY_LABEL.igst, formula: igstIn ? "Not calculated — IGST base needs BCD and SWS." : "Rate not entered.", entered: !!igstIn });

  for (const k of ["bcd", "sws", "igst"] as const) {
    if (!inputs.duties[k]) warnings.push({ id: `rate-${k}`, kind: "rate-missing", blocking: false, text: `${DUTY_LABEL[k]} rate not entered.` });
  }
  const dutiesComplete = bcd !== undefined && sws !== undefined && igst !== undefined && !otherBlocked;
  const totalDuties = round2((bcd ?? 0) + (sws ?? 0) + (igst ?? 0) + otherTotal);

  // Waterfall.
  const sum = (g: CostLine["group"]) => round2([...components, ...customCosts].filter((l) => l.group === g).reduce((a, l) => a + l.added, 0));
  const waterfall: WaterfallStep[] = [
    { key: "commercial", label: "Commercial Product Cost", amount: commercial.added },
    { key: "freight", label: "Additional Freight", amount: sum("freight") },
    { key: "insurance", label: "Additional Insurance", amount: sum("insurance") },
    { key: "duties", label: "Duties & Taxes", amount: totalDuties },
    { key: "port", label: "Port / Handling", amount: sum("port") },
    { key: "cha", label: "CHA", amount: sum("cha") },
    { key: "inland", label: "Inland Logistics", amount: sum("inland") },
    { key: "other", label: "Other Costs", amount: sum("other") },
  ];
  const blocked = warnings.some((w) => w.blocking);
  const total = blocked ? undefined : round2(waterfall.reduce((a, s) => a + s.amount, 0));
  const qty = t.quantity.amount;
  const perUnit = total !== undefined && qty > 0 ? { value: round2(total / qty), formula: `${m(total)} ÷ ${qty.toLocaleString("en-US")} ${t.quantity.unit} = ${m(round2(total / qty))} / ${t.quantity.unit}` } : undefined;
  const share =
    total && total > 0
      ? {
          commercial: (waterfall[0].amount / total) * 100,
          logistics: ((waterfall[1].amount + waterfall[2].amount + waterfall[4].amount + waterfall[5].amount + waterfall[6].amount) / total) * 100,
          duties: (waterfall[3].amount / total) * 100,
          other: (waterfall[7].amount / total) * 100,
        }
      : undefined;

  // Assumptions: every non-derived input, in words.
  if (cur !== t.currency) assumptions.push(`Calculation currency set to ${cur} (order currency is ${t.currency}).`);
  for (const r of inputs.fxRates) assumptions.push(`Manual exchange rate: 1 ${r.from} = ${r.rate} ${r.to} from ${r.effectiveDate}${r.sourceNote ? ` — ${r.sourceNote}` : ""}.`);
  for (const l of [...components, ...customCosts]) {
    if (l.inclusion === "included") assumptions.push(`${l.label} treated as included in the agreed price${l.note ? ` (${l.note})` : ""}.`);
    else if (l.inclusion === "additional" && l.amount !== undefined) assumptions.push(`${l.label} entered at ${formatMoney(l.amount, l.currency!)} as an additional cost (${COST_SOURCE_LABEL[l.source]}${l.note ? ` — ${l.note}` : ""}).`);
    else if (l.inclusion === "not-applicable") assumptions.push(`${l.label} marked not applicable.`);
  }
  for (const k of ["bcd", "sws", "igst"] as const) {
    const r = inputs.duties[k];
    if (r) assumptions.push(`${DUTY_LABEL[k]} manually entered at ${formatPercent(r.rate)}${r.sourceNote ? ` — ${r.sourceNote}` : ""}.`);
  }
  for (const d of inputs.otherDuties) assumptions.push(`${d.name} entered manually at ${formatMoney(d.amount, d.currency)}${d.note ? ` — ${d.note}` : ""}.`);
  if (additions) assumptions.push(`Manual valuation additions of ${m(additions)}${inputs.valuation.additionsNote ? ` — ${inputs.valuation.additionsNote}` : ""}.`);
  if (!inputs.valuation.freightInAv) assumptions.push("Freight excluded from the assessable value by your choice.");
  if (!inputs.valuation.insuranceInAv) assumptions.push("Insurance excluded from the assessable value by your choice.");

  // Status: required for this planning model = freight + insurance treatment
  // decided (with amounts when additional), BCD/SWS/IGST rates entered, and
  // every conversion possible.
  const decided = (l: CostLine) => l.inclusion !== "unknown" && (l.inclusion !== "additional" || l.amount !== undefined);
  const complete = !blocked && decided(freight) && decided(insurance) && dutiesComplete && customCosts.every(decided) && components.every(decided);
  const status: CostStatus = !hasPlanningInput(stored) ? "needs-input" : complete ? "complete" : "partial";

  return {
    currency: cur,
    quantity: t.quantity,
    commercial,
    components,
    customCosts,
    assessable,
    duties,
    igstBase,
    totalDuties: dutiesComplete ? totalDuties : undefined,
    waterfall,
    total,
    perUnit,
    share,
    warnings,
    assumptions,
    status,
  };
}

/* ------------------------------------------------------------------------ */
/* Scenarios & snapshots                                                     */
/* ------------------------------------------------------------------------ */

export const MAX_SCENARIOS = 3;

/** Only what a scenario may vary. Commercial terms are never overridable. */
export interface ScenarioOverrides {
  fx?: { from: Currency; to: Currency; rate: number };
  components?: Partial<Record<"freight" | "insurance" | "destination-charges" | "cha" | "inland" | "other-logistics", { amount: number; currency?: Currency }>>;
  duties?: Partial<Record<DutyKey, number>>;
}

export interface LandedCostScenario {
  id: string;
  orderId: string;
  name: string;
  createdAt: string;
  overrides: ScenarioOverrides;
}

/** Base inputs + scenario overrides. Never mutates the base. */
export function applyScenario(ctx: LandedCostContext, stored: LandedCostInputs, overrides: ScenarioOverrides): LandedCostInputs {
  const base = effectiveInputs(ctx, stored);
  const components = { ...base.components };
  for (const [k, v] of Object.entries(overrides.components ?? {}) as [ComponentType, { amount: number; currency?: Currency }][]) {
    const prev = components[k];
    components[k] = { ...prev, inclusion: "additional", amount: v.amount, currency: v.currency ?? prev?.currency ?? ctx.order.terms.currency, source: "scenario", note: "Scenario assumption" };
  }
  const duties = { ...base.duties };
  for (const [k, v] of Object.entries(overrides.duties ?? {}) as [DutyKey, number][]) duties[k] = { rate: v, sourceNote: "Scenario assumption" };
  const fxRates = overrides.fx ? [...base.fxRates.filter((r) => !(r.from === overrides.fx!.from && r.to === overrides.fx!.to)), { ...overrides.fx, effectiveDate: base.fxRates.at(-1)?.effectiveDate ?? "2026-10-07", sourceNote: "Scenario assumption" }] : base.fxRates;
  return { ...base, components, duties, fxRates };
}

export interface CostSnapshot {
  id: string;
  orderId: string;
  at: string;
  label?: string;
  currency: Currency;
  /** Deep copy of the inputs at the time (frozen). */
  inputs: LandedCostInputs;
  total?: number;
  perUnit?: number;
  totalDuties?: number;
  assessableValue?: number;
  waterfall: WaterfallStep[];
  assumptions: string[];
  status: CostStatus;
}

export function makeSnapshot(id: string, at: string, ctx: LandedCostContext, stored: LandedCostInputs, label?: string): CostSnapshot {
  const r = calculateLandedCost(ctx, stored);
  return deepFreeze(
    JSON.parse(
      JSON.stringify({
        id,
        orderId: ctx.order.id,
        at,
        label: label?.trim() || undefined,
        currency: r.currency,
        inputs: effectiveInputs(ctx, stored),
        total: r.total,
        perUnit: r.perUnit?.value,
        totalDuties: r.totalDuties,
        assessableValue: r.assessable.value,
        waterfall: r.waterfall,
        assumptions: r.assumptions,
        status: r.status,
      }),
    ) as CostSnapshot,
  );
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

/* ------------------------------------------------------------------------ */
/* Demo planning assumptions (not tariff data)                               */
/* ------------------------------------------------------------------------ */

export const MOCK_LANDED_COST_INPUTS: Readonly<Record<string, LandedCostInputs>> = {
  // CFR order costed in INR: freight included by the agreed Incoterm, insurance
  // additional, manual FX and duty rates. Every value is a demo assumption.
  "ORD-2026-0001": {
    calculationCurrency: "INR",
    components: {
      insurance: { inclusion: "additional", amount: 330, currency: "USD", source: "demo" },
      "destination-charges": { inclusion: "additional", amount: 45_000, currency: "INR", source: "demo" },
      cha: { inclusion: "additional", amount: 18_000, currency: "INR", source: "demo" },
      inland: { inclusion: "additional", amount: 60_000, currency: "INR", source: "demo" },
    },
    fxRates: [{ from: "USD", to: "INR", rate: 84.1, effectiveDate: "2026-08-10", sourceNote: DEMO_ASSUMPTION }],
    duties: {
      bcd: { rate: 10, sourceNote: DEMO_ASSUMPTION },
      sws: { rate: 10, sourceNote: DEMO_ASSUMPTION },
      igst: { rate: 5, sourceNote: DEMO_ASSUMPTION },
    },
    otherDuties: [],
    customCosts: [],
    valuation: { freightInAv: true, insuranceInAv: true },
    updatedAt: "2026-08-12T06:00:00Z",
  },
  // FOB order costed in USD: freight and insurance additional; duties not entered yet.
  "ORD-2026-0002": {
    components: {
      freight: { inclusion: "additional", amount: 9_500, currency: "USD", source: "demo" },
      insurance: { inclusion: "additional", amount: 400, currency: "USD", source: "demo" },
      "destination-charges": { inclusion: "additional", amount: 2_800, currency: "USD", source: "demo" },
    },
    fxRates: [],
    duties: {},
    otherDuties: [],
    customCosts: [],
    valuation: { freightInAv: true, insuranceInAv: true },
    updatedAt: "2026-09-24T08:00:00Z",
  },
};
