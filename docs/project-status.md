# Project status

_Last verified against the code: 2026-10-14._ Update this file whenever something moves from demo to real, or a new limitation or bug is found.

## The one-paragraph truth

Ximverse today is a **frontend-only, clickable product demo**. It is a Next.js app with detailed workspaces for importers and exporters, plus dashboards for CHAs and freight forwarders. There is **no backend, no database, no authentication, no API calls, no AI model, no file storage and no external integration** (no bank, carrier, ICEGATE/customs, email or WhatsApp). Every record starts as hard-coded demo data in `src/lib/`. Whatever a user does is saved only in **their own browser**. The business rules, though, are real and deliberate: eligibility checks, status derivation, append-only histories and immutable agreed terms. They are designed to move to a backend unchanged.

## Labels used in this file

| Label | Meaning |
|---|---|
| **Working (local)** | The workflow runs end to end in the UI with real validation rules, but data lives only in this browser. |
| **Demo** | The action only *records* that something happened ("Simulate…", "Mark available", "Record payment"). Nothing real occurs. |
| **Mock** | Read-only fictional data, no actions. |
| **Placeholder** | Nav entry exists and shows "Coming soon". |
| **Planned** | Not in the code at all. |

## Platform capabilities

| Capability | Status | Notes |
|---|---|---|
| Backend / API | **Planned** | `src/lib/api.ts` has `apiFetch()` but **nothing calls it**. `NEXT_PUBLIC_API_BASE_URL` is reserved for it. |
| Database | **Planned** | Browser storage stands in. See [data-model.md § Storage](data-model.md#where-data-is-stored). |
| Authentication / users / organisations | **Planned** | Every workspace is open to anyone. The signed-in user and company are placeholders (`PLACEHOLDER_IMPORTER`, `EXPORTER_COMPANY_ID = "EXP-COMP-0001"`, `workspace-nav.ts`). Workspaces are marked `noindex`. |
| Importer ↔ exporter connection | **Planned** | The two workspaces are **separate demo worlds**. A quotation submitted as an exporter never reaches the importer, and vice versa. They share TypeScript types and one RFQ ID (`RFQ-2026-0048`) only. |
| Ximverse Ops / admin workspace | **Planned** | PROJECT_CONTEXT §13 describes it. There is no admin role or route. |
| SUMIT (AI) | **Mock** | "SUMIT" cards, insights and "Ask SUMIT" panels are fixed text or deterministic rules. No LLM is called anywhere. |
| File upload / document storage | **Planned** | Documents are metadata only. "Mark available" never stores a file. |
| Payments / banking | **Demo** | Payments, LCs and finance are *records of external events*. No money moves. |
| Carrier / tracking feeds | **Demo** | Schedule changes and milestones are typed in or simulated. No GPS, vessel or port data. |
| Customs filing (ICEGATE) | **Demo** | Filing, assessment and clearance are simulated buttons. |
| Interface languages | **Working** | English plus 10 Indian-language mixes, saved in a cookie. Translations are partial and **not native-speaker reviewed**. |
| Automated tests | **Planned** | No test framework is installed. Verification is manual (see each feature doc) plus `npm run lint` and `npm run build`. |
| Hosting | **Working** | GitHub `main` → Vercel → https://ximverse.ai. See [operations.md](operations.md). |

## Importer workspace (`/importer`)

| Feature | Status | Persistence | Doc |
|---|---|---|---|
| Overview dashboard | Working (derived) | Reads all importer stores | [importer-overview-reports](features/importer-overview-reports.md) |
| RFQs — list, detail | Working (local) | Demo + in-memory | [importer-sourcing](features/importer-sourcing.md) |
| RFQs — create (multi-step form) | Working (local) | **React state only — lost on page reload** | [importer-sourcing](features/importer-sourcing.md) |
| Quotations — list, detail, compare, shortlist | Working (local) | `sessionStorage` | [importer-sourcing](features/importer-sourcing.md) |
| Negotiations — counter, accept, withdraw | Working (local) | `sessionStorage` | [importer-sourcing](features/importer-sourcing.md) |
| Negotiations — supplier revision | **Demo** ("Simulate supplier revision") | `sessionStorage` | |
| Orders + Purchase Order | Working (local) | `sessionStorage` | [importer-orders](features/importer-orders.md) |
| Orders — supplier confirmation | **Demo** | `sessionStorage` | |
| Shipments — create, schedule, readiness checklist | Working (local) | `sessionStorage` | [importer-shipments-documents](features/importer-shipments-documents.md) |
| Shipments — booking, handover, departure, arrival | **Demo** | `sessionStorage` | |
| Documents — checklist, review, approve | Working (local), metadata only | `sessionStorage` | [importer-shipments-documents](features/importer-shipments-documents.md) |
| Compliance readiness | Working (derived) | — | [importer-customs-compliance-tracking](features/importer-customs-compliance-tracking.md) |
| Customs cases — declaration, CHA, handoff | Working (local) | `sessionStorage` | same |
| Customs — filing / assessment / clearance | **Demo** | `sessionStorage` | same |
| Tracking & exceptions | Working (derived); acknowledgements stored | `sessionStorage` | same |
| Landed cost — sheet, scenarios, snapshots | Working (local), user-entered rates | `sessionStorage` | [importer-payments-landed-cost](features/importer-payments-landed-cost.md) |
| Payments — obligations, records, LC, finance | Working (local) as records; **no money moves** | `sessionStorage` | same |
| Suppliers directory & profiles | Mock | — | [importer-overview-reports](features/importer-overview-reports.md) |
| Reports, Trade Insights | Working (derived) | — | same |
| Customs Brokers, Freight Forwarders, Logistics Partners, Notifications, Company, Team, Settings | Placeholder | — | |

## Exporter workspace (`/exporter`)

| Feature | Status | Persistence | Doc |
|---|---|---|---|
| Overview dashboard | Mock (own dataset, `exporter-dashboard.ts`) | — | [exporter-sourcing](features/exporter-sourcing.md) |
| Company profile | Mock (read-only) | — | same |
| Products catalogue | Mock; **"Add product" is in-memory only, lost on reload** | React state | same |
| Buyer Opportunities (RFQs) | Mock (read-only projection) | — | same |
| Prepare & submit quotation, drafts | Working (local) | `localStorage` | same |
| My Quotations pipeline | Working (local) | `localStorage` | same |
| Negotiations — counter, keep offer, accept | Working (local) on **seeded** negotiations | `localStorage` | [exporter-negotiations-deals](features/exporter-negotiations-deals.md) |
| Negotiations — buyer counter | **Demo** ("Simulate Buyer Response") | `localStorage` | same |
| Deals — create, confirm | Working (local) | `localStorage` | same |
| Orders — confirm, production, payment step, documents | Working (local), all hand-recorded | `localStorage` | [exporter-orders-shipments](features/exporter-orders-shipments.md) |
| Shipments — partial allocation, freight, shipping bill, BL/AWB, milestones | **Demo** records with real validation | `localStorage` | same |
| Documents & Compliance Center | Working (derived index) | — | [exporter-workspace-tools](features/exporter-workspace-tools.md) |
| Messages (threads) | Working (local); **nothing is sent** | `localStorage` | same |
| Notifications | Working (derived); read/dismiss stored | `localStorage` | same |
| Analytics | Working (derived) | — | same |
| Team, Settings | Placeholder | — | |

## CHA (`/cha`) and Freight Forwarder (`/freight-forwarder`)

| Feature | Status |
|---|---|
| Overview dashboard | Mock (`cha-dashboard-data.ts`, `freight-forwarder-dashboard-data.ts`) |
| Every other section in the sidebar | Placeholder |

See [features/cha-freight-forwarder.md](features/cha-freight-forwarder.md).

## Known limitations and bugs

These are real behaviors a developer or demo-giver can hit. Fix or re-label them deliberately.

1. **Importer and exporter data never meet.** They use different storage (`sessionStorage` vs `localStorage`), different keys and different seed datasets. "End-to-end" demos must be shown one side at a time.
2. **RFQs created in the importer UI disappear on reload.** They are held in React context (`requirements-store.tsx`), while every other importer feature persists in `sessionStorage`.
3. **New RFQs never receive quotations.** `quotationsFor()` reads only `MOCK_QUOTATIONS`. So you can't order, ship or pay against a UI-created RFQ; the downstream flow works only from the demo RFQs.
4. **Document seeding reads mock requirements only.** `importer-documents.ts → requirementFor()` looks in `MOCK_REQUIREMENTS`. Certifications on a non-mock requirement would not seed documents. This is hidden today by item 3.
5. **Exporter quotations stay "Submitted" forever.** No buyer exists to respond, and only the seeded negotiations can reach agreement → deal → order → shipment.
6. **Importer data is per-tab.** `sessionStorage` is lost when the tab closes and isn't shared with a second tab. Exporter `localStorage` persists and is shared across tabs in the same browser.
7. **Demo clock.** Business dates ("due in 3 days", "overdue", "expires") are measured against a fixed demo "now": `MOCK_NOW` / `OPPORTUNITIES_NOW` = `2026-10-07T09:30:00Z`. Events you create get the real time, but never earlier than that. See [development.md § Demo clock](development.md#the-demo-clock).
8. **IDs are per-browser.** New IDs are "highest existing + 1" in this browser. Two people would issue the same `ORD-2026-0006`. A backend must issue IDs.
9. **No server-side enforcement.** Privacy rules (e.g. exporters never see buyer identity) hold only because the exporter projection types leave those fields out. A backend must enforce the same rule.
10. **Translations unreviewed.** See `src/i18n/README.md`.

## Health checks (baseline)

| Check | Result on 2026-10-14 |
|---|---|
| `npx eslint` (same as `npm run lint`) | Clean — no errors or warnings |
| `npx tsc --noEmit` | Clean — no type errors |
| Automated tests | None exist |

Re-run these before every push. `npm run build` is the closest thing to a full check, because it also runs Next's type and route validation.
