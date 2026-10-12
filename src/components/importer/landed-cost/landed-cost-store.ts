"use client";

import { useMemo, useSyncExternalStore } from "react";
import { MOCK_NOW, type Currency } from "@/lib/import-requirements";
import { customsCaseForShipment, type CustomsCaseView } from "@/lib/importer-customs";
import {
  calculateLandedCost,
  EMPTY_INPUTS,
  makeSnapshot,
  MAX_SCENARIOS,
  MOCK_LANDED_COST_INPUTS,
  validateFxRate,
  type ComponentInput,
  type ComponentType,
  type CostSnapshot,
  type CustomCost,
  type DutyKey,
  type FxRate,
  type LandedCostContext,
  type LandedCostInputs,
  type LandedCostResult,
  type LandedCostScenario,
  type OtherDuty,
  type RateInput,
  type ScenarioOverrides,
  type ValuationChoices,
} from "@/lib/importer-landed-cost";
import { orderStatus, orderUpdatedAt, type Order } from "@/lib/importer-orders";
import { shipmentForOrder, type Shipment } from "@/lib/importer-shipments";
import { useCustomsCases } from "../customs/customs-store";
import { useOrders } from "../orders/order-store";
import { useShipments } from "../shipments/shipment-store";

/*
 * Landed-cost planning inputs (per order), scenarios and snapshots, persisted
 * in sessionStorage. Commercial data stays on the order; shipment and customs
 * values are read live. Demo planning assumptions seed two orders until the
 * importer edits them.
 */

const KEY = "ximverse.importer.landed-cost";

interface StoredState {
  inputs: Record<string, LandedCostInputs>;
  scenarios: Record<string, LandedCostScenario[]>;
  snapshots: Record<string, CostSnapshot[]>;
}

const EMPTY: StoredState = { inputs: {}, scenarios: {}, snapshots: {} };

function load(): StoredState {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as StoredState) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

let state: StoredState | null = null;
const listeners = new Set<() => void>();

function snapshot(): StoredState {
  state ??= load();
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: StoredState) {
  state = next;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: keep the in-memory state for this page.
  }
  listeners.forEach((l) => l());
}

export function useLandedCostState(): StoredState {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function useLandedCostLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/** The stored planning inputs for an order: session edits, else demo seed, else empty. */
export function storedInputs(s: StoredState, orderId: string): LandedCostInputs {
  return s.inputs[orderId] ?? MOCK_LANDED_COST_INPUTS[orderId] ?? EMPTY_INPUTS;
}

export interface LandedCostSheet {
  order: Order;
  shipment?: Shipment;
  customsCase?: CustomsCaseView;
  ctx: LandedCostContext;
  stored: LandedCostInputs;
  result: LandedCostResult;
  scenarios: LandedCostScenario[];
  snapshots: CostSnapshot[];
  updatedAt: string;
}

/** One sheet per non-cancelled order; shipment and customs case when they exist. */
export function useLandedCostSheets(): LandedCostSheet[] {
  const orders = useOrders();
  const shipments = useShipments();
  const customsCases = useCustomsCases();
  const s = useLandedCostState();
  return useMemo(
    () =>
      orders
        .filter((o) => orderStatus(o) !== "cancelled")
        .map((order) => {
          const shipment = shipmentForOrder(order.id, shipments);
          const customsCase = shipment ? customsCaseForShipment(shipment.id, customsCases) : undefined;
          const ctx: LandedCostContext = { order, shipment, customsCase };
          const stored = storedInputs(s, order.id);
          const updated = [stored.updatedAt ?? "", orderUpdatedAt(order), ...(s.snapshots[order.id] ?? []).map((x) => x.at)].reduce((a, b) => (b > a ? b : a));
          return { order, shipment, customsCase, ctx, stored, result: calculateLandedCost(ctx, stored), scenarios: s.scenarios[order.id] ?? [], snapshots: s.snapshots[order.id] ?? [], updatedAt: updated };
        }),
    [orders, shipments, customsCases, s],
  );
}

function now(): string {
  const t = new Date().toISOString();
  return t > MOCK_NOW ? t : MOCK_NOW;
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Copy-on-write update of one order's inputs. */
function update(orderId: string, fn: (i: LandedCostInputs) => LandedCostInputs) {
  const s = snapshot();
  const current = structuredClone(storedInputs(s, orderId));
  commit({ ...s, inputs: { ...s.inputs, [orderId]: { ...fn(current), updatedAt: now() } } });
}

const validAmount = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;

/** Saves (or with `null`, clears back to the default) one cost component. */
export function saveComponent(orderId: string, type: ComponentType, input: ComponentInput | null): string | undefined {
  if (input) {
    if (input.inclusion === "additional" && input.amount !== undefined && !validAmount(input.amount)) return "Enter an amount of zero or more.";
    if ((input.note ?? "").length > 200) return "Keep the note under 200 characters.";
  }
  update(orderId, (i) => {
    const components = { ...i.components };
    if (input) components[type] = { ...input, note: input.note?.trim() || undefined, source: input.source ?? "manual" };
    else delete components[type];
    return { ...i, components };
  });
}

export function setCalculationCurrency(orderId: string, currency: Currency) {
  update(orderId, (i) => ({ ...i, calculationCurrency: currency }));
}

export function addFxRate(orderId: string, rate: FxRate): string | undefined {
  const err = validateFxRate(rate);
  if (err) return err;
  update(orderId, (i) => ({ ...i, fxRates: [...i.fxRates.filter((r) => !(r.from === rate.from && r.to === rate.to)), { ...rate, sourceNote: rate.sourceNote?.trim() || undefined }] }));
}

export function removeFxRate(orderId: string, from: Currency, to: Currency) {
  update(orderId, (i) => ({ ...i, fxRates: i.fxRates.filter((r) => !(r.from === from && r.to === to)) }));
}

export function setDutyRate(orderId: string, key: DutyKey, input: RateInput | null): string | undefined {
  if (input && (!Number.isFinite(input.rate) || input.rate < 0 || input.rate > 1000)) return "Enter a rate between 0 and 1000%.";
  update(orderId, (i) => {
    const duties = { ...i.duties };
    if (input) duties[key] = { rate: input.rate, sourceNote: input.sourceNote?.trim() || undefined };
    else delete duties[key];
    return { ...i, duties };
  });
}

export function addOtherDuty(orderId: string, d: Omit<OtherDuty, "id">): string | undefined {
  if (!d.name.trim()) return "Enter a name.";
  if (!validAmount(d.amount)) return "Enter an amount of zero or more.";
  update(orderId, (i) => ({ ...i, otherDuties: [...i.otherDuties, { ...d, name: d.name.trim(), note: d.note?.trim() || undefined, id: uid("od") }] }));
}

export function removeOtherDuty(orderId: string, id: string) {
  update(orderId, (i) => ({ ...i, otherDuties: i.otherDuties.filter((d) => d.id !== id) }));
}

export function addCustomCost(orderId: string, c: Omit<CustomCost, "id">): string | undefined {
  if (!c.name.trim()) return "Enter a name.";
  if (!validAmount(c.amount)) return "Enter an amount of zero or more.";
  update(orderId, (i) => ({ ...i, customCosts: [...i.customCosts, { ...c, name: c.name.trim(), note: c.note?.trim() || undefined, id: uid("cc") }] }));
}

export function removeCustomCost(orderId: string, id: string) {
  update(orderId, (i) => ({ ...i, customCosts: i.customCosts.filter((c) => c.id !== id) }));
}

export function setValuation(orderId: string, v: ValuationChoices): string | undefined {
  if (v.additions !== undefined && !validAmount(v.additions)) return "Enter an amount of zero or more.";
  update(orderId, (i) => ({ ...i, valuation: { ...v, additionsNote: v.additionsNote?.trim() || undefined } }));
}

export function createScenario(orderId: string, name: string, overrides: ScenarioOverrides): string | undefined {
  const s = snapshot();
  const list = s.scenarios[orderId] ?? [];
  if (list.length >= MAX_SCENARIOS) return `Up to ${MAX_SCENARIOS} scenarios per cost sheet.`;
  if (!name.trim()) return "Enter a scenario name.";
  if (overrides.fx && !(overrides.fx.rate > 0)) return "Enter an FX rate greater than zero.";
  for (const v of Object.values(overrides.components ?? {})) if (!validAmount(v?.amount)) return "Enter amounts of zero or more.";
  for (const v of Object.values(overrides.duties ?? {})) if (!(typeof v === "number" && v >= 0 && v <= 1000)) return "Enter rates between 0 and 1000%.";
  if (!overrides.fx && !Object.keys(overrides.components ?? {}).length && !Object.keys(overrides.duties ?? {}).length) return "Change at least one value for the scenario.";
  const scenario: LandedCostScenario = { id: uid("sc"), orderId, name: name.trim(), createdAt: now(), overrides: structuredClone(overrides) };
  commit({ ...s, scenarios: { ...s.scenarios, [orderId]: [...list, scenario] } });
}

export function deleteScenario(orderId: string, id: string) {
  const s = snapshot();
  commit({ ...s, scenarios: { ...s.scenarios, [orderId]: (s.scenarios[orderId] ?? []).filter((x) => x.id !== id) } });
}

/** Freezes the current sheet. Later edits never change a saved snapshot. */
export function saveSnapshot(ctx: LandedCostContext, label?: string): string | undefined {
  if ((label ?? "").length > 80) return "Keep the label under 80 characters.";
  const s = snapshot();
  const snap = makeSnapshot(uid("snap"), now(), ctx, storedInputs(s, ctx.order.id), label);
  commit({ ...s, snapshots: { ...s.snapshots, [ctx.order.id]: [...(s.snapshots[ctx.order.id] ?? []), snap] } });
}
