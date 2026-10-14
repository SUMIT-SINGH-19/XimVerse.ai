# Architecture

_Describes the code as of 2026-10-14. If you change the structure, update this file in the same commit._

## Big picture

```
 Browser
 ┌───────────────────────────────────────────────────────────────────────┐
 │ Next.js App Router (React 19)                                         │
 │                                                                       │
 │  src/app/                 routes: one folder per role                 │
 │    /            landing page + role picker                            │
 │    /importer/…  importer workspace  ──┐                               │
 │    /exporter/…  exporter workspace  ──┤  pages are thin: they read    │
 │    /cha/…       CHA dashboard       ──┤  params and render a          │
 │    /freight-forwarder/…             ──┘  component from src/components│
 │                                                                       │
 │  src/components/<role>/…   UI + the role's stores (client state)      │
 │  src/lib/                  domain logic: types, demo data, pure rules │
 │  src/i18n/                 interface languages                        │
 │                                                                       │
 │  Persistence:  sessionStorage (importer)   localStorage (exporter)    │
 └───────────────────────────────────────────────────────────────────────┘
          │
          │  nothing goes out — apiFetch() in src/lib/api.ts exists
          ▼  but is never called
   (future backend: Python/FastAPI + PostgreSQL per PROJECT_CONTEXT §21)
```

Hosting: Vercel builds `main` and serves https://ximverse.ai. There is no server code of ours beyond Next.js rendering and one Server Action (`src/i18n/actions.ts` sets the language cookie).

## Tech stack

| Layer | Choice | Where |
|---|---|---|
| Framework | Next.js **16.3.8** (App Router) | `package.json`. **Read `node_modules/next/dist/docs/` before writing Next code** — this version differs from older tutorials (see `AGENTS.md`). |
| UI | React 19.2, TypeScript 5 (strict), Tailwind CSS 4 | `src/app/globals.css` holds the theme tokens |
| Icons | lucide-react | |
| Fonts | Geist via `next/font/google` | `src/app/layout.tsx` |
| Lint | ESLint 9 + `eslint-config-next` | `eslint.config.mjs` |
| Tests | none yet | |

There is no state library, data-fetching library or component kit (no shadcn yet). Shared UI primitives live in `src/components/workspace/`.

## The three layers

### 1. Routes — `src/app/`

Pages are **thin server components**. They read `params` / `searchParams` and render one component. For example `src/app/importer/orders/new/page.tsx` reads `?negotiation=` and renders `<CreateOrder negotiationId=… />`.

Each role has a `layout.tsx` that wraps every page in that role's shell:

| Role | Layout wraps with | Shell |
|---|---|---|
| Importer | `ImporterShell` + `ImportRequirementsProvider` | its own shell in `src/components/importer/importer-*.tsx` (built first) |
| Exporter | `ExporterWorkspace` | generic `WorkspaceShell` from `src/components/workspace/` |
| CHA | `ChaWorkspace` | generic `WorkspaceShell` |
| Freight Forwarder | `FreightForwarderWorkspace` | generic `WorkspaceShell` |

The generic shell renders whatever a `WorkspaceConfig` (`src/lib/workspace-nav.ts`) describes: nav groups, identity, assistant. A new role needs a config and a nav file, not a new shell.

**Placeholder sections.** Each role has `app/<role>/[section]/page.tsx`. It generates a "Coming soon" page for every nav entry that has no real folder yet. Static folders win over the dynamic segment. Importer and exporter keep a `BUILT_SECTIONS` set in that file, and you must add a slug there when you build its real page. `dynamicParams = false`, so unknown slugs 404.

### 2. Domain logic — `src/lib/`

One file per concept per side: `importer-orders.ts`, `exporter-orders.ts` and so on. Each typically contains, in order:

1. **Vocabulary**: status unions with their labels.
2. **Types**: shaped like the future API objects.
3. **Pure derivations**: `orderStatus(o)`, `orderEligibility(…)`, `termsFromAgreement(…)`, `nextOrderId(…)`. No React and no storage, so they can be unit-tested and later ported to the backend.
4. **Demo data**: `MOCK_*` (importer) or `SEEDED_*` (exporter).

`src/lib` never imports from `src/components`.

### 3. UI and stores — `src/components/<role>/`

Feature folders hold the screens. Importer stores live beside their feature (`components/importer/orders/order-store.ts`). Exporter stores live in `src/lib/exporter-*-store.ts`. Stores are `"use client"`.

## The store pattern (read this before touching any feature)

Every workflow store follows the same shape:

```
 demo records (MOCK_* / SEEDED_*)      local delta in browser storage
   in src/lib, never modified            { created: [...], appended: { [id]: Event[] } }
              │                                        │
              └──────────────┬─────────────────────────┘
                             ▼
                  combine(seed, delta)  →  full records
                             ▼
              pure derivation in src/lib (status, eligibility, views)
                             ▼
                         React UI
```

Rules every store obeys:

- **Seeds are never copied into storage.** They are merged at read time, so editing demo data in `src/lib` takes effect immediately.
- **History is append-only.** Actions append an event (`po-issued`, `agreement`, `status-changed`…) and never edit an earlier one. Status is **derived** from events (`orderStatus`, `negotiationStatus`, `dealStatus`, `shipmentState`) and never stored.
- **Agreed terms are frozen.** Orders and deals deep-copy the terms once, at creation.
- **Write-time re-checks.** A creating action re-runs its eligibility check against current storage, not against what the form saw. Double clicks and second tabs can't create duplicates.
- **Hydration-safe.** Stores use `useSyncExternalStore` with a server snapshot that holds demo data only. The server and the first client render match, then local changes appear. `use…Loaded()` hooks return `false` until then, and pages use them to avoid flashing "not found" for locally created records.
- **Storage failures are tolerated.** Every read and write is wrapped in try/catch. If storage is blocked, the importer keeps state in memory for the page, and exporter actions return `false` / `{ ok: false, reason: "storage" }`.

Differences between the two sides:

| | Importer stores | Exporter stores |
|---|---|---|
| Storage | `sessionStorage` (per tab) | `localStorage` (per browser, all tabs) |
| Key style | `ximverse.importer.<thing>` | `ximverse:exporter:<thing>` with a `{ v: 1, … }` envelope |
| Change notification | in-module listener set | custom window event `ximverse:exporter:<thing>-change`, plus the native `storage` event for other tabs |
| Location | `src/components/importer/<feature>/*-store.ts` | `src/lib/exporter-*-store.ts` |
| Action result | `string \| undefined` (error message), or the new ID | `boolean` or `{ ok, id \| reason }` |

### Derived views read several stores

Some features own almost no data and are computed from others on every render:

```
Importer
  requirements (React ctx) ◄── negotiations         (an agreed negotiation ⇒ "supplier-selected")
  quotation-status         ◄── negotiations         (agreed ⇒ quotation "selected")
  documents                ◄── shipments            (document list seeded per shipment)
  customs cases            ◄── shipments, documents, orders
        └── writes customs progress back as shipment events (recordCustomsProgress)
  landed cost              ◄── orders, shipments, customs
  payments                 ◄── orders, shipments, documents, landed cost
  tracking                 ◄── shipments, documents, orders, customs
  dashboard / reports      ◄── everything above

Exporter
  shipments                ◄── orders (allocation checks)
  documents index          ◄── company profile, orders, shipments, deals   (no store of its own)
  notifications            ◄── threads, negotiations, quotations, deals, orders, shipments, documents
  analytics                ◄── everything above
```

So a bug on the Payments page may come from the shipment or document store. Trace the inputs listed above.

## Cross-cutting pieces

- **Configuration**: `src/lib/config.ts` reads only `NEXT_PUBLIC_*` variables (site URL, API base). See the root [README](../README.md#configuration).
- **Formatting**: `src/lib/format.ts`. Dates are formatted in UTC with a fixed locale, so server and client output match. Don't use `toLocaleDateString()` without a locale in rendered output, or hydration will mismatch.
- **Languages**: `src/i18n/`. The English text is the key and missing strings fall back to English. The locale comes from the `locale` cookie, then `Accept-Language`, then English. Reading the cookie makes routes render per request. See [features/platform-shell-i18n.md](features/platform-shell-i18n.md).
- **SUMIT**: only presentational today. See [project-status.md](project-status.md).
- **Honesty notices**: modules export user-facing disclaimers such as `PAYMENTS_NOTICE`, `TRACKING_NOTICE`, `CUSTOMS_NOTICE` and `LANDED_COST_NOTICE`. Demo events carry `demo: true` and are labelled in the UI. Keep both when changing a feature (see [decisions/0003](decisions/0003-label-demo-vs-real.md)).

## Where a backend will plug in

The stores are the seam. When an API exists:

1. Keep the types and the pure functions in `src/lib`. Port the rules (eligibility, status derivation, ID issuing) to the backend so the server enforces them.
2. Replace each store's `load` / `commit` with `apiFetch()` calls. Components already talk only to the store hooks and actions, so they barely change.
3. Replace `MOCK_*` / `SEEDED_*` with API responses of the same shape.
4. Merge the importer and exporter datasets into one set of records, with per-role projections. `exporter-opportunities.ts` and `toBuyerFacingQuotation()` already define what each side may see.

See [decisions/0001](decisions/0001-frontend-only-demo-first.md) and [decisions/0002](decisions/0002-browser-storage-as-stand-in.md).
