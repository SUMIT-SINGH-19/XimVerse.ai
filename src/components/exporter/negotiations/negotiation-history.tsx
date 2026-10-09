import { formatDateTime } from "@/lib/exporter-opportunities";
import { offerChanges, formatOfferPrice, type ExporterNegotiation, type NegotiationEvent } from "@/lib/exporter-negotiations";
import { eventLabel, PARTY_TEXT } from "./negotiation-ui";

const DOT: Record<NegotiationEvent["by"], string> = {
  importer: "border-orange bg-orange-soft",
  supplier: "border-teal bg-teal",
  system: "border-line bg-canvas",
};

/**
 * Append-only timeline. Each entry shows its own offer snapshot.
 */
/**
 * Changes are always read against *your* offer at that point: your own moves
 * against your previous position, the buyer's against what you had offered.
 */
function historyItems(n: ExporterNegotiation) {
  const items = [];
  let yours = n.originalQuotationSnapshot;
  for (const e of n.events) {
    const offer = e.type === "original-quotation" ? n.originalQuotationSnapshot : e.offer;
    const changes = offer && e.type !== "original-quotation" ? offerChanges(yours, offer) : [];
    if (offer && e.by === "supplier") yours = offer;
    items.push({ e, offer, changes });
  }
  return items;
}

export function NegotiationHistory({ n }: { n: ExporterNegotiation }) {
  const items = historyItems(n);

  return (
    <ol className="relative space-y-5 pl-6 before:absolute before:inset-y-1 before:left-[0.4375rem] before:w-px before:bg-line">
      {items.map(({ e, offer, changes }) => (
        <li key={e.id} className="relative">
          <span aria-hidden className={`absolute -left-6 top-1 size-3.5 rounded-full border-2 ${DOT[e.by]}`} />
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-ink">{eventLabel(e)}</span>
            {e.demo && <span className="rounded-full border border-orange/40 px-1.5 text-[0.6875rem] font-medium text-orange">Demo</span>}
            <span className="text-xs text-ink-faint">
              {PARTY_TEXT[e.by]} · {formatDateTime(e.at)}
            </span>
          </p>
          {offer && (e.type === "original-quotation" || e.type === "agreement" || e.type === "supplier-kept-offer") && (
            <p className="mt-0.5 text-sm text-ink-muted">
              {formatOfferPrice(offer)} · {offer.incoterm} {offer.namedPlace}
            </p>
          )}
          {changes.length > 0 && e.type !== "agreement" && (
            <ul className="mt-1 space-y-0.5 text-sm">
              {changes.map((c) => (
                <li key={c.field} className="text-ink-muted">
                  {c.label}: <span className="line-through decoration-ink-faint">{c.from}</span> →{" "}
                  <span className="font-semibold text-ink">{c.to}</span>
                </li>
              ))}
            </ul>
          )}
          {e.note && <p className="mt-1 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">“{e.note}”</p>}
        </li>
      ))}
    </ol>
  );
}
