"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, FileSearch, FlaskConical, Handshake, Info, PackageCheck, Undo2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { formatQuantity, type ImportRequirement } from "@/lib/import-requirements";
import { importerHref } from "@/lib/importer-nav";
import {
  currentOffer,
  EVENT_LABEL,
  formatOfferIncoterm,
  formatOfferPrice,
  isOfferExpired,
  negotiationStatus,
  offerChanges,
  offerSummary,
  offerValue,
  originalOffer,
  PARTY_LABEL,
  quotationOf,
  WAITING_ON_LABEL,
  waitingOn,
  type CommercialOffer,
  type Negotiation,
  type NegotiationStatus,
} from "@/lib/importer-negotiations";
import { incotermCoverage, INSURANCE_LABEL, isDecisionOpen, requirementOf, supplierOf } from "@/lib/importer-quotations";
import { ImportId, Panel } from "../dashboard/dashboard-ui";
import { SumitAnalysisCard } from "../quotations/sumit-analysis-card";
import { useImportRequirements } from "../rfq/requirements-store";
import { supplierHref } from "../suppliers/supplier-links";
import { focusRing, ghostButton, primaryButton, secondaryButton } from "../styles";
import { Dialog, NegotiationStatusBadge, OfferFacts } from "./negotiation-ui";
import {
  acceptCurrentOffer,
  addCounterOffer,
  addDemoSupplierRevision,
  saveCounterDraft,
  useNegotiations,
  useNegotiationsLoaded,
  withdrawNegotiation,
} from "./negotiation-store";
import { OfferForm } from "./offer-form";
import { orderForNegotiation, type Order } from "@/lib/importer-orders";
import { useOrders } from "../orders/order-store";
import { OrderAction } from "../orders/order-ui";

const backLink = `inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`;
const textLink = `inline-flex items-center gap-1 rounded text-sm font-semibold text-teal hover:underline ${focusRing}`;

export function NegotiationWorkspace({ id }: { id: string }) {
  const negotiations = useNegotiations();
  const loaded = useNegotiationsLoaded();
  const n = negotiations.find((x) => x.id === id);

  if (!n) {
    if (!loaded) return <p className="py-16 text-center text-sm text-ink-muted">Loading negotiation…</p>;
    return <NotFound id={id} />;
  }
  return <Workspace n={n} />;
}

function Workspace({ n }: { n: Negotiation }) {
  const quote = quotationOf(n);
  const supplier = supplierOf(quote);
  const orders = useOrders();
  const requirement = useImportRequirements().find(n.requirementId) ?? requirementOf(quote)!;
  const status = negotiationStatus(n);
  const original = originalOffer(n);
  const current = currentOffer(n);
  const changes = offerChanges(original, current);
  const [panel, setPanel] = useState<"none" | "counter" | "supplier">("none");
  const [accepting, setAccepting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [notice, setNotice] = useState("");

  const active = waitingOn(status) === "you" || waitingOn(status) === "supplier";
  const canAct = active && isDecisionOpen(requirement);
  const expired = isOfferExpired(current);

  return (
    <div className="space-y-6">
      <div>
        <Link href={importerHref("negotiations")} className={backLink}>
          <ArrowLeft aria-hidden className="size-4" />
          Negotiations
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ImportId id={n.id} className="text-ink-muted" />
          <NegotiationStatusBadge status={status} />
          <span className="text-xs text-ink-faint">{WAITING_ON_LABEL[waitingOn(status)]}</span>
        </div>
        <h1 className="mt-1 break-words text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          {requirement.product.name}
          <span className="font-semibold text-ink-muted"> with {supplier.name}</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {supplier.country} · <ImportId id={n.requirementId} /> · from quotation <ImportId id={n.quotationId} />
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Link href={importerHref(`rfqs/${n.requirementId}`)} className={textLink}>View Requirement</Link>
          <Link href={importerHref(`quotations/${n.quotationId}`)} className={textLink}>View Original Quotation</Link>
          <Link href={supplierHref(n.supplierId)} className={textLink}>View Supplier</Link>
        </div>
      </div>

      <StatusBanner orders={orders} status={status} n={n} supplierName={supplier.name} requirement={requirement} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="current-offer" className="rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(11,46,48,0.04),0_8px_24px_rgba(11,46,48,0.05)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
              <div>
                <h2 id="current-offer" className="text-lg font-semibold tracking-tight text-ink">
                  {status === "agreed" ? "Agreed Terms" : "Current Offer"}
                </h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {status === "agreed"
                    ? "The terms you accepted, compared with the original quotation."
                    : `Latest terms, proposed by ${lastProposer(n)}. Compared with the original quotation.`}
                </p>
              </div>
              <p className="text-right">
                <span className="block text-xs text-ink-faint">Total commercial value</span>
                <span className="text-lg font-semibold tabular-nums text-ink">{offerValue(current)}</span>
              </p>
            </div>
            <TermsTable original={original} current={current} />
            {canAct && (
              <div className="border-t border-line px-5 py-4 sm:px-6">
                <Actions
                  status={status}
                  expired={expired}
                  hasDraft={!!n.draft}
                  onCounter={() => setPanel("counter")}
                  onSupplier={() => setPanel("supplier")}
                  onAccept={() => setAccepting(true)}
                  onWithdraw={() => setWithdrawing(true)}
                  onDiscardDraft={() => {
                    saveCounterDraft(n.id, null);
                    setNotice("Draft counter offer discarded.");
                  }}
                />
                <p role="status" className="mt-2 text-sm text-teal">{notice}</p>
              </div>
            )}
          </section>

          {canAct && panel !== "none" && (
            <section aria-label={panel === "counter" ? "Counter offer" : "Demo supplier revision"} className="rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
              <OfferForm
                key={panel}
                mode={panel === "counter" ? "counter" : "supplier-demo"}
                initial={panel === "counter" && n.draft ? n.draft.offer : current}
                initialNote={panel === "counter" ? n.draft?.note : undefined}
                onCancel={() => setPanel("none")}
                onSaveDraft={
                  panel === "counter"
                    ? (draft) => {
                        saveCounterDraft(n.id, draft);
                        setPanel("none");
                        setNotice("Draft saved. It isn't part of the negotiation until you make the counter offer.");
                      }
                    : undefined
                }
                onSubmit={(draft) => {
                  if (panel === "counter") {
                    addCounterOffer(n.id, draft);
                    setNotice("Counter offer recorded. In this demo it is not sent to the supplier.");
                  } else {
                    addDemoSupplierRevision(n.id, draft);
                    setNotice("Demo supplier revision recorded.");
                  }
                  setPanel("none");
                }}
              />
            </section>
          )}

          <Panel id="changes" title="Changes from Original Quotation">
            <div className="px-5 pb-5 pt-3 sm:px-6">
              {changes.length === 0 ? (
                <p className="text-sm text-ink-muted">Current terms match the original quotation.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {changes.map((c) => (
                    <li key={c.term} className="grid grid-cols-1 gap-1 py-2.5 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
                      <span className="text-ink-muted">{c.term}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-ink">
                        <span className="text-ink-muted line-through decoration-ink-faint/60">{c.from}</span>
                        <ArrowRight aria-label="changed to" className="size-3.5 shrink-0 text-ink-faint" />
                        <span className="font-medium">{c.to}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          <Timeline n={n} original={original} />
        </div>

        <div className="space-y-6">
          <Panel id="original" title="Original Quotation" description={`${quote.id} · read-only baseline`}>
            <div className="px-5 pb-5 pt-3 sm:px-6">
              <dl className="divide-y divide-line text-sm">
                {[
                  ["Unit price", formatOfferPrice(original)],
                  ["Currency", original.currency],
                  ["Quantity", formatQuantity(original.quantity)],
                  ["Incoterm", formatOfferIncoterm(original)],
                  ["Total quoted value", offerValue(original)],
                  ["Payment terms", original.paymentSummary],
                  ["Lead time", `${original.leadTimeDays} days`],
                  ["Validity", `Until ${formatDate(original.validUntil)}`],
                  ["MOQ", quote.product.moq ? formatQuantity(quote.product.moq) : "—"],
                  ["Port of loading", quote.delivery.portOfLoading],
                  ["Destination", requirement.delivery.destinationLocation],
                  ["Freight", incotermCoverage(original.incoterm).freightIncluded ? "Included" : "Not included"],
                  ["Insurance", INSURANCE_LABEL[incotermCoverage(original.incoterm).insurance]],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 py-2">
                    <dt className="text-ink-muted">{label}</dt>
                    <dd className="min-w-0 break-words text-right text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Panel>

          <SumitAnalysisCard
            id="sumit-negotiation"
            heading="Ask SUMIT about this negotiation"
            prompts={[
              "Summarize what changed from the original quotation.",
              "What terms are still different from my requirement?",
              "Compare this offer with the other shortlisted suppliers.",
              "What commercial risks should I review?",
              "Prepare a counter offer.",
            ]}
            message="SUMIT negotiation intelligence will be connected later. Nothing was analysed."
          />
        </div>
      </div>

      <Dialog id="accept" open={accepting} onClose={() => setAccepting(false)} title="Accept current offer?">
        <OfferFacts
          offer={current}
          extra={[
            { label: "Supplier", value: supplier.name },
            { label: "Product", value: requirement.product.name },
          ]}
        />
        <p className="mt-4 flex gap-2 rounded-lg bg-orange-soft/60 px-3 py-2.5 text-sm text-ink">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-orange" />
          Accepting these commercial terms will mark this supplier as selected for the requirement. An order has not been
          created yet.
        </p>
        <p className="mt-2 text-xs text-ink-faint">
          Other active negotiations for {n.requirementId} will be closed. Their quotations stay as historical offers.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setAccepting(false)} className={secondaryButton}>Cancel</button>
          <button
            type="button"
            onClick={() => {
              acceptCurrentOffer(n.id);
              setAccepting(false);
              setPanel("none");
              setNotice("");
            }}
            className={primaryButton}
          >
            <CircleCheck aria-hidden className="size-4" />
            Accept Terms
          </button>
        </div>
      </Dialog>

      <Dialog id="withdraw" open={withdrawing} onClose={() => setWithdrawing(false)} title="Withdraw this negotiation?">
        <p className="text-sm text-ink-muted">
          The negotiation will be closed as withdrawn. The quotation stays available, and you can start a new negotiation
          from it later while the requirement is open.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setWithdrawing(false)} className={secondaryButton}>Cancel</button>
          <button
            type="button"
            onClick={() => {
              withdrawNegotiation(n.id, "Withdrawn by you.");
              setWithdrawing(false);
              setPanel("none");
            }}
            className={`${secondaryButton} hover:border-orange/40 hover:bg-orange-soft hover:text-orange`}
          >
            <Undo2 aria-hidden className="size-4" />
            Withdraw
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function lastProposer(n: Negotiation): string {
  for (let i = n.events.length - 1; i >= 0; i--) {
    const e = n.events[i];
    if (e.type === "importer-counter") return "you";
    if (e.type === "supplier-revision") return e.demo ? "the supplier (demo)" : "the supplier";
    if (e.type === "original-quotation") return "the supplier, as quoted";
  }
  return "the supplier";
}

function StatusBanner({
  orders,
  status,
  n,
  supplierName,
  requirement,
}: {
  orders: readonly Order[];
  status: NegotiationStatus;
  n: Negotiation;
  supplierName: string;
  requirement: ImportRequirement;
}) {
  const closedNote = [...n.events].reverse().find((e) => e.type === "closed" || e.type === "withdrawn")?.note;
  const order = orderForNegotiation(n.id, orders);
  if (status === "agreed") {
    const at = [...n.events].reverse().find((e) => e.type === "agreement")?.at;
    return (
      <section aria-label="Agreement" className="flex flex-col gap-4 rounded-2xl border border-teal/30 bg-teal-soft/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <PackageCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-teal" />
          <div>
            <p className="font-semibold text-ink">
              Agreement reached{at ? ` on ${formatDate(at)}` : ""} · {order ? "Order Created" : "Ready for Order"}
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {supplierName} is selected for {requirement.id}.{" "}
              {order ? `Order ${order.id} was created from these terms.` : "An order has not been created yet."}
            </p>
          </div>
        </div>
        <OrderAction negotiationId={n.id} />
      </section>
    );
  }
  const text: Record<Exclude<NegotiationStatus, "agreed">, { Icon: typeof Info; title: string; body: string }> = {
    "awaiting-importer": { Icon: CircleAlert, title: "Waiting on you", body: "Review the quotation. Make a counter offer, or accept the terms as quoted." },
    "supplier-responded": { Icon: CircleAlert, title: "Waiting on you", body: "The supplier revised the terms. Make a counter offer or accept the current offer." },
    "draft-counter": { Icon: CircleAlert, title: "Waiting on you", body: "You have a saved draft counter offer that hasn't been made yet." },
    "awaiting-supplier": { Icon: Handshake, title: "Waiting on supplier", body: "Your counter offer is recorded. In this demo nothing is sent; use “Simulate supplier revision” to continue." },
    closed: { Icon: Info, title: "Closed", body: closedNote ?? "This negotiation is closed." },
    withdrawn: { Icon: Info, title: "Withdrawn", body: closedNote ?? "You withdrew this negotiation." },
  };
  const { Icon, title, body } = text[status];
  const attention = waitingOn(status) === "you";
  return (
    <section aria-label="Negotiation status" className={`flex gap-3 rounded-2xl border px-5 py-4 ${attention ? "border-orange/30 bg-orange-soft/40" : "border-line bg-surface"}`}>
      <Icon aria-hidden className={`mt-0.5 size-5 shrink-0 ${attention ? "text-orange" : "text-ink-muted"}`} />
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{body}</p>
      </div>
    </section>
  );
}

function Actions({
  status,
  expired,
  hasDraft,
  onCounter,
  onSupplier,
  onAccept,
  onWithdraw,
  onDiscardDraft,
}: {
  status: NegotiationStatus;
  expired: boolean;
  hasDraft: boolean;
  onCounter: () => void;
  onSupplier: () => void;
  onAccept: () => void;
  onWithdraw: () => void;
  onDiscardDraft: () => void;
}) {
  const yourTurn = waitingOn(status) === "you";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {yourTurn && (
          <>
            <button type="button" onClick={onAccept} disabled={expired} className={primaryButton}>
              <CircleCheck aria-hidden className="size-4" />
              Accept Current Offer
            </button>
            <button type="button" onClick={onCounter} className={secondaryButton}>
              {hasDraft ? "Continue Draft Counter Offer" : "Make Counter Offer"}
            </button>
            {hasDraft && (
              <button type="button" onClick={onDiscardDraft} className={ghostButton}>Discard draft</button>
            )}
          </>
        )}
        {status === "awaiting-supplier" && (
          <button type="button" onClick={onSupplier} className={secondaryButton}>
            <FlaskConical aria-hidden className="size-4 text-orange" />
            Simulate Supplier Revision
            <span className="rounded-full border border-orange/40 px-1.5 text-xs text-orange">Demo</span>
          </button>
        )}
        <button type="button" onClick={onWithdraw} className={`${ghostButton} sm:ml-auto`}>
          Withdraw
        </button>
      </div>
      {yourTurn && expired && (
        <p className="text-sm text-orange">
          This offer&apos;s validity has passed. Make a counter offer with a new validity date before accepting.
        </p>
      )}
    </div>
  );
}

/** Original vs current, term by term. Stacks on narrow screens. */
function TermsTable({ original, current }: { original: CommercialOffer; current: CommercialOffer }) {
  const rows: [string, string, string][] = [
    ["Unit price", formatOfferPrice(original), formatOfferPrice(current)],
    ["Currency", original.currency, current.currency],
    ["Quantity", formatQuantity(original.quantity), formatQuantity(current.quantity)],
    ["Incoterm", formatOfferIncoterm(original), formatOfferIncoterm(current)],
    ["Payment terms", original.paymentSummary, current.paymentSummary],
    ["Lead time", `${original.leadTimeDays} days`, `${current.leadTimeDays} days`],
    ["Validity", formatDate(original.validUntil), formatDate(current.validUntil)],
    ["Packaging", original.packaging ?? "—", current.packaging ?? "—"],
    ["Inspection", original.inspection ?? "—", current.inspection ?? "—"],
  ];
  return (
    <div>
      <div className="hidden grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-line bg-canvas/60 px-6 py-2 text-xs font-medium text-ink-faint md:grid">
        <span>Term</span>
        <span>Original quotation</span>
        <span>Current</span>
      </div>
      <dl className="divide-y divide-line">
        {rows.map(([term, from, to]) => {
          const changed = from !== to;
          return (
            <div
              key={term}
              className={`grid grid-cols-1 gap-1 px-5 py-3 text-sm sm:px-6 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-4 ${changed ? "bg-orange-soft/30" : ""}`}
            >
              <dt className="text-xs font-medium text-ink-muted md:text-sm md:font-normal">{term}</dt>
              <dd className="break-words text-ink-muted">
                <span className="text-xs text-ink-faint md:hidden">Original: </span>
                {from}
              </dd>
              <dd className="break-words font-medium text-ink">
                <span className="text-xs font-normal text-ink-faint md:hidden">Current: </span>
                {to}
                {changed && (
                  <span className="mt-0.5 block text-xs font-semibold text-orange">Changed from original quotation</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/** Pairs each event with its offer and what changed from the previous offer. */
function timelineItems(n: Negotiation, original: CommercialOffer) {
  const items = [];
  let previous = original;
  for (const e of n.events) {
    const offer = e.type === "original-quotation" ? original : e.offer;
    const changes = offer && e.type !== "original-quotation" && e.type !== "agreement" ? offerChanges(previous, offer) : [];
    if (offer) previous = offer;
    items.push({ e, offer, changes });
  }
  return items;
}

/** Each step with what changed in the terms; notes are secondary. */
function Timeline({ n, original }: { n: Negotiation; original: CommercialOffer }) {
  const items = timelineItems(n, original);

  return (
    <Panel id="timeline" title="Negotiation Timeline" description="What changed in the commercial terms at each step.">
      <ol className="px-5 pb-5 pt-4 sm:px-6">
        {items.map(({ e, offer, changes }, i) => (
          <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
            {i < items.length - 1 && <span aria-hidden className="absolute left-[7px] top-5 h-full w-px bg-line" />}
            <span
              aria-hidden
              className={`relative mt-1 size-[15px] shrink-0 rounded-full border-2 ${
                e.type === "agreement"
                  ? "border-teal bg-teal"
                  : e.by === "importer"
                    ? "border-orange bg-surface"
                    : e.by === "system"
                      ? "border-line bg-canvas"
                      : "border-teal bg-surface"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <time dateTime={e.at} className="text-ink-faint">{formatDate(e.at)}</time>
                <span className="font-semibold text-ink">{EVENT_LABEL[e.type]}</span>
                <span className="text-ink-muted">· {PARTY_LABEL[e.by]}</span>
                {e.demo && <span className="rounded-full border border-orange/40 px-1.5 text-xs font-medium text-orange">Demo</span>}
              </p>
              {offer && <p className="mt-1 break-words text-sm text-ink">{offerSummary(offer)}</p>}
              {changes.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs text-ink-muted">
                  {changes.map((c) => (
                    <li key={c.term}>
                      <span className="font-medium text-ink">{c.term}:</span> {c.from} → {c.to}
                    </li>
                  ))}
                </ul>
              )}
              {offer && e.type !== "original-quotation" && e.type !== "agreement" && changes.length === 0 && (
                <p className="mt-1 text-xs text-ink-faint">No change from the previous terms.</p>
              )}
              {e.note && <p className="mt-1.5 border-l-2 border-line pl-3 text-sm italic text-ink-muted">{e.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-canvas text-ink-faint">
        <FileSearch className="size-6" />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Negotiation not found</h1>
      <p className="mt-2 text-sm text-ink-muted">
        There&apos;s no negotiation <ImportId id={id} className="text-ink" /> in this browser tab. Negotiations you start are
        kept in this tab&apos;s session only.
      </p>
      <Link href={importerHref("negotiations")} className={`${secondaryButton} mt-6`}>
        <ArrowLeft aria-hidden className="size-4" />
        Back to Negotiations
      </Link>
    </div>
  );
}
