# Interface languages

English plus ten Indian languages, each mixed with English the way traders
actually talk: Hinglish, Banglish, Tanglish, Manglish and so on. Everyday words
are in the language's own script; trade terms people already say in English —
RFQ, quotation, shipment, supplier, customs, HS code, FOB — stay in English.

The viewer picks a language from the switcher in the top bar (or on the landing
page). It is saved in the `locale` cookie; on a first visit the browser's
`Accept-Language` decides, falling back to English.

## Translating text

The English text is the key. Anything without a translation shows in English,
so a screen can be converted a piece at a time.

| Where the text is | Use |
|---|---|
| Server component | `const t = await getT();` from `@/i18n/server` |
| Client component | `const t = useT();` from `@/i18n/client` |
| Component rendered from both | `<T>Coming soon</T>` from `@/i18n/client` |

Placeholders go in braces: `t("{count} open", { count })`. Inside JSX, write
the text as a string literal — `<T vars={{ count }}>{"{count} open"}</T>` — or
JSX will read `{count}` as an expression.

`PageHeader`, `Panel`, `StatusPill`, the nav items and the importer dashboard
`Panel` / `StatusBadge` translate the labels they are given, so page titles,
panel headings and status labels only need a dictionary entry.

Record content — product names, companies, places, messages typed by users —
is data, not interface text, and is not translated.

## Adding translations

Add the English text and its translation to each file in `messages/`. Leave a
string out of a language to keep it in English there. Keep the trade terms in
English and the same choices across languages, so the mix feels consistent.

To add a language: create `messages/<code>.ts`, register it in
`messages/index.ts`, and add it to `LOCALES` in `locales.ts`.

The translations were written without native-speaker review; have each
language checked before relying on it with customers.
