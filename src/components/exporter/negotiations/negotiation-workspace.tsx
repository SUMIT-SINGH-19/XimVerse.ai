"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleCheck, Handshake, Lock, ShieldCheck, Sparkles, Undo2, Wand2 } from "lucide-react";
import { focusRing } from "@/components/workspace/styles";
import { Modal } from "@/components/exporter/products/modal";
import { MatchScore } from "@/components/exporter/opportunities/opportunity-ui";
import { exporterHref } from "@/lib/exporter-nav";
import { formatDateTime, shortCountry, type BuyerOpportunity } from "@/lib/exporter-opportunities";
import { formatMoney } from "@/lib/exporter-quotations";
import {
  agreedTerms,
  buyerLatestEvent,
  buyerLatestOffer,
  comparable,
  formatOfferPrice,
  formatOfferValue,
  negotiationInsights,
  negotiationStatus,
  needsExporterResponse,
  offerChanges,
  OFFER_ROWS,
  offerValueMinor,
  yourCurrentOffer,
  type CommercialOffer,
  type CounterDraft,
} from "@/lib/exporter-negotiations";
import {
  acceptBuyerOffer,
  keepExistingOffer,
  saveCounterDraft,
  simulateBuyerCounter,
  submitCounter,
  useNegotiation,
} from "@/lib/exporter-negotiation-store";
import { useIsClient } from "@/lib/exporter-quotation-store";
import { CounterForm } from "./counter-form";
import { SetUpDealAction } from "@/components/exporter/deals/set-up-deal";
import { SEEDED_QUOTATIONS } from "@/lib/exporter-quotation-history";
import { NegotiationHistory } from "./negotiation-history";
import { NegotiationStatusPill, OfferComparison } from "./negotiation-ui";

const primary = `inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange px-4 text-sm font-semibold text-on-brand shadow-sm shadow-orange/20 transition hover:brightness-95 ${focusRing}`;
const secondary = `inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition-colors hover:border-teal hover:bg-teal-soft ${focusRing}`;

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}>
      <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TermsTable({ offer }: { offer: CommercialOffer }) {
  return (
    <dl className="divide-y divide-line rounded-xl border border-line">
      {[...OFFER_ROWS.slice(0, 2).map((r) => [r.label, r.text(offer)]), ["Total", formatOfferValue(offer)], ...OFFER_ROWS.slice(2).map((r) => [r.label, r.text(offer)])].map(
        ([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
            <dt className="text-ink-muted">{label}</dt>
            <dd className={`text-right [overflow-wrap:anywhere] ${label === "Total" ? "font-bold" : "font-medium"} text-ink`}>{value}</dd>
          </div>
        ),
      )}
    </dl>
  );
}

type Panel = "none" | "counter";
type Dialog = { kind: "accept" } | { kind: "keep" } | { kind: "review"; draft: CounterDraft } | null;

/**
 * One negotiation. Everything the exporter does appends an event; the
 * original quotation snapshot and earlier events never change.
 */
export function NegotiationWorkspace({
  id,
  opportunity: o,
  productName,
  availableTonnes,
}: {
  id: string;
  opportunity?: BuyerOpportunity;
  productName: string;
  /** From the matched catalogue product, computed on the server. */
  availableTonnes?: number;
}) {
  const n = useNegotiation(id);
  const isClient = useIsClient();
  const [panel, setPanel] = useState<Panel>("none");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [keepNote, setKeepNote] = useState("Our current quotation remains our best commercial offer.");
  const [notice, setNotice] = useState<string | null>(null);

  if (!n) return null;
  const quotation = SEEDED_QUOTATIONS.find((q) => q.id === n.quotationId);
  const status = negotiationStatus(n);
  const yours = yourCurrentOffer(n);
  const buyer = buyerLatestOffer(n);
  const buyerEvent = buyerLatestEvent(n);
  const agreed = agreedTerms(n);
  const isRevision = status === "revision-requested" || (status === "draft-counter" && buyerEvent?.type === "revision-request");
  const respond = needsExporterResponse(status);
  const capacity = yours.quantity.unit === "MT" ? availableTonnes : undefined;
  const insights = negotiationInsights(n, o, availableTonnes);

  const done = (msg: string) => {
    setDialog(null);
    setPanel("none");
    setNotice(msg);
  };

  const values = [
    { label: "Original quote", offer: n.originalQuotationSnapshot },
    { label: "Your current offer", offer: yours },
    ...(buyer ? [{ label: isRevision ? "Buyer requested" : "Buyer counter", offer: buyer }] : []),
  ];
  const gap = buyer && comparable(yours, buyer) ? offerValueMinor(yours) - offerValueMinor(buyer) : undefined;

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <Link href={exporterHref("negotiations")} className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-teal hover:text-ink ${focusRing}`}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to Negotiations
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-ink">{n.id}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">{productName}</h1>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              <Link href={exporterHref(`quotations/${n.quotationId}`)} className={`font-mono text-teal hover:text-ink ${focusRing}`}>{n.quotationId}</Link>
              <Link href={exporterHref(`opportunities/${n.requirementId}`)} className={`font-mono text-teal hover:text-ink ${focusRing}`}>{n.requirementId}</Link>
              {o && <span className="text-ink-muted">{o.delivery.destinationLocation}</span>}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <NegotiationStatusPill status={status} />
              <span className="text-xs text-ink-faint">Last activity {formatDateTime(n.events.at(-1)!.at)}</span>
            </div>
          </div>
          {o && <MatchScore score={o.match.score} size="lg" />}
        </div>
        <p className="mt-4 flex items-start gap-2 border-t border-line pt-4 text-sm text-ink-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
          <span>
            <span className="font-semibold text-ink">Buyer identity protected by Ximverse.</span> You see the buyer&apos;s market
            and commercial requests — never their identity or other suppliers&apos; offers.
          </span>
        </p>
      </header>

      {notice && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-teal-soft px-4 py-3 text-sm text-ink">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          {/* What's being asked */}
          {buyerEvent && respond && (
            <section className="rounded-2xl border border-orange/25 bg-orange-soft p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange">
                {buyerEvent.type === "revision-request" ? "Buyer requested revision" : "Buyer counter offer"} · {formatDateTime(buyerEvent.at)}
              </p>
              {buyer && (
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  {offerChanges(yours, buyer).map((c) => (
                    <li key={c.field}>
                      <span className="font-semibold">{c.label}:</span> {c.to} <span className="text-ink-muted">(you offered {c.from})</span>
                    </li>
                  ))}
                </ul>
              )}
              {buyerEvent.note && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-ink">“{buyerEvent.note}”</p>}
            </section>
          )}

          {/* Agreement */}
          {agreed && (
            <section className="rounded-2xl border border-teal/30 bg-teal-soft p-5 sm:p-6">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <Handshake className="size-5 text-teal" aria-hidden />
                Commercial terms agreed
              </p>
              <p className="mt-1 text-sm text-ink-muted">These terms are the basis for the deal. Next step: set up the deal.</p>
              <div className="mt-4">
                <TermsTable offer={agreed} />
              </div>
              {quotation && (
                <div className="mt-4">
                  <SetUpDealAction quotation={quotation} negotiation={n} />
                </div>
              )}
            </section>
          )}

          <Card title="Current Commercial Position">
            <OfferComparison left={yours} right={buyer} leftLabel="Your offer" rightLabel={isRevision ? "Buyer requested" : "Buyer counter"} />
            <p className="mt-2 text-xs text-ink-faint">Highlighted rows differ between the two positions.</p>

            {/* Actions */}
            {respond && panel === "none" && (
              <div className="mt-5 flex flex-wrap gap-2">
                {!isRevision && buyer && (
                  <button type="button" onClick={() => setDialog({ kind: "accept" })} className={primary}>
                    <Check className="size-4" aria-hidden />
                    Accept Buyer Offer
                  </button>
                )}
                <button type="button" onClick={() => setPanel("counter")} className={isRevision ? primary : secondary}>
                  {isRevision ? "Submit Revised Terms" : status === "draft-counter" ? "Continue Counter Offer" : "Counter Offer"}
                </button>
                <button type="button" onClick={() => setDialog({ kind: "keep" })} className={secondary}>
                  <Undo2 className="size-4" aria-hidden />
                  Keep Existing Offer
                </button>
              </div>
            )}
            {status === "awaiting-buyer" && (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-canvas px-4 py-3">
                <p className="text-sm text-ink-muted">Your latest position is with the buyer. In this demo nothing is sent.</p>
                <button
                  type="button"
                  onClick={() => simulateBuyerCounter(n.id) && setNotice("Demo buyer counter added to the history.")}
                  className={secondary}
                >
                  <Wand2 className="size-4" aria-hidden />
                  Simulate Buyer Response (demo)
                </button>
              </div>
            )}
          </Card>

          {panel === "counter" && (
            <CounterForm
              base={isRevision && buyer && !n.draft ? buyer : yours}
              previous={yours}
              draft={n.draft}
              availableTonnes={capacity}
              title={isRevision ? "Revised Terms" : "Counter Offer"}
              submitLabel="Review"
              onReview={(draft) => setDialog({ kind: "review", draft })}
              onSaveDraft={(draft) => {
                saveCounterDraft(n.id, draft);
                setPanel("none");
                setNotice("Counter offer saved as a draft in this browser.");
              }}
              onCancel={() => setPanel("none")}
            />
          )}

          <Card title="Negotiation History">
            <NegotiationHistory n={n} />
          </Card>

          <Card title="Original Submitted Quotation">
            <p className="mb-3 flex items-center gap-1.5 text-xs text-ink-faint">
              <Lock className="size-3.5" aria-hidden />
              Snapshot of {n.quotationId} as submitted — never changed by negotiation.
            </p>
            <TermsTable offer={n.originalQuotationSnapshot} />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Negotiation Value">
            <dl className="space-y-2 text-sm">
              {values.map((x) => (
                <div key={x.label} className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{x.label}</dt>
                  <dd className="text-right font-semibold tabular-nums text-ink">
                    {formatOfferValue(x.offer)}
                    <span className="block text-xs font-normal text-ink-muted">{formatOfferPrice(x.offer)}</span>
                  </dd>
                </div>
              ))}
              {gap !== undefined && gap !== 0 && buyer && respond && (
                <div className="flex justify-between gap-3 border-t border-line pt-2">
                  <dt className="font-semibold text-ink">Gap to buyer</dt>
                  <dd className="font-bold tabular-nums text-orange">{formatMoney(Math.abs(gap), yours.currency)}</dd>
                </div>
              )}
            </dl>
            {buyer && !comparable(yours, buyer) && <p className="mt-2 text-xs text-ink-faint">Different currency or unit — values aren&apos;t compared.</p>}
          </Card>

          <aside aria-label="SUMIT insight" className="rounded-2xl border border-teal/15 bg-teal-soft p-5">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal">
              <Sparkles className="size-3.5 text-orange" aria-hidden />
              SUMIT insight
            </p>
            <ul className="mt-2 space-y-2">
              {insights.map((t) => (
                <li key={t} className="text-sm leading-relaxed text-ink">{t}</li>
              ))}
            </ul>
          </aside>

          {o && (
            <Card title="Buyer Market">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Region</dt><dd className="text-ink">{o.buyer.region}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-muted">Country</dt><dd className="text-ink">{shortCountry(o.buyer.country)}</dd></div>
                {o.buyer.industry && <div className="flex justify-between gap-3"><dt className="text-ink-muted">Industry</dt><dd className="text-right text-ink">{o.buyer.industry}</dd></div>}
              </dl>
            </Card>
          )}
        </div>
      </div>

      {/* Phone: keep the positions and main actions in reach. */}
      {isClient && respond && panel === "none" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 text-xs">
              <p className="truncate text-ink-muted">You {formatOfferPrice(yours)}</p>
              {buyer && <p className="truncate font-semibold text-orange">Buyer {formatOfferPrice(buyer)}</p>}
            </div>
            {!isRevision && buyer && (
              <button type="button" onClick={() => setDialog({ kind: "accept" })} className={`${primary} px-3`}>
                Accept
              </button>
            )}
            <button type="button" onClick={() => setPanel("counter")} className={`${secondary} px-3`}>
              {isRevision ? "Revise" : "Counter"}
            </button>
          </div>
        </div>
      )}

      <Modal open={dialog !== null} onClose={() => setDialog(null)} labelledBy="neg-dialog-title">
        {dialog && (
          <>
            <header className="border-b border-line px-5 py-4 sm:px-6">
              <h2 id="neg-dialog-title" className="text-lg font-bold tracking-tight text-ink">
                {dialog.kind === "accept" ? "Accept Buyer Offer" : dialog.kind === "keep" ? "Keep Existing Offer" : "Review Counter Offer"}
              </h2>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {dialog.kind === "accept" && buyer && (
                <>
                  <p className="mb-3 text-sm text-ink-muted">You are accepting these commercial terms:</p>
                  <TermsTable offer={buyer} />
                </>
              )}
              {dialog.kind === "keep" && (
                <>
                  <p className="text-sm text-ink-muted">
                    Your current offer stays on the table ({formatOfferPrice(yours)}). The buyer sees this note:
                  </p>
                  <textarea
                    aria-label="Note to buyer"
                    value={keepNote}
                    onChange={(e) => setKeepNote(e.target.value)}
                    className="mt-3 min-h-20 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
                  />
                </>
              )}
              {dialog.kind === "review" && (
                <>
                  <ul className="space-y-2">
                    {offerChanges(yours, dialog.draft.offer).map((c) => (
                      <li key={c.field} className="rounded-lg bg-orange-soft/60 px-3 py-2 text-sm">
                        <span className="font-semibold text-ink">{c.label}</span>: <span className="text-ink-muted">{c.from}</span> →{" "}
                        <span className="font-semibold text-ink">{c.to}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    <TermsTable offer={dialog.draft.offer} />
                  </div>
                  {dialog.draft.note && <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">“{dialog.draft.note}”</p>}
                </>
              )}
              <p className="mt-4 rounded-xl bg-canvas px-4 py-3 text-xs text-ink-muted">
                Demo: recorded in this browser&apos;s negotiation history. Nothing is sent to the buyer yet.
              </p>
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
              <button type="button" onClick={() => setDialog(null)} className={`h-10 rounded-lg px-4 text-sm font-semibold text-ink-muted hover:bg-canvas hover:text-ink ${focusRing}`}>
                Cancel
              </button>
              {dialog.kind === "accept" && (
                <button type="button" onClick={() => acceptBuyerOffer(n.id) && done("Commercial terms agreed. Deal setup comes next.")} className={primary}>
                  Accept Commercial Terms
                </button>
              )}
              {dialog.kind === "keep" && (
                <button type="button" onClick={() => keepExistingOffer(n.id, keepNote.trim()) && done("Your existing offer stands. Awaiting the buyer.")} className={primary}>
                  Keep Offer
                </button>
              )}
              {dialog.kind === "review" && (
                <button
                  type="button"
                  onClick={() => submitCounter(n.id, dialog.draft) && done(isRevision ? "Revised terms submitted. Awaiting the buyer." : "Counter offer submitted. Awaiting the buyer.")}
                  className={primary}
                >
                  {isRevision ? "Submit Revised Terms" : "Submit Counter Offer"}
                </button>
              )}
            </footer>
          </>
        )}
      </Modal>
    </div>
  );
}
