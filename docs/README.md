# Ximverse documentation

Start here if you are new. Read in this order — about an hour in total:

1. **[project-status.md](project-status.md)** — what actually works, what is demo, what is missing. Read this first so nothing else misleads you.
2. **[architecture.md](architecture.md)** — how the app is put together (frontend only today), and the store pattern every feature uses.
3. **[data-model.md](data-model.md)** — the records (RFQ → Quotation → Negotiation → Order → Shipment …), how they reference each other, who owns which field, and where each is stored.
4. **[development.md](development.md)** — folder layout, conventions, how to add a feature, how to debug.
5. The feature docs for the area you are about to touch (below).

Then: [operations.md](operations.md) (deploy, rollback, common errors) and [decisions/](decisions/) (why things are the way they are).

Product direction lives in [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) and the vision at the top of [CLAUDE.md](../CLAUDE.md). Those describe where we are going; the files above describe what exists.

## Feature docs

| Area | Doc |
|---|---|
| Importer — RFQs, quotations, negotiations | [features/importer-sourcing.md](features/importer-sourcing.md) |
| Importer — orders & purchase orders | [features/importer-orders.md](features/importer-orders.md) |
| Importer — shipments & documents | [features/importer-shipments-documents.md](features/importer-shipments-documents.md) |
| Importer — customs, compliance, tracking | [features/importer-customs-compliance-tracking.md](features/importer-customs-compliance-tracking.md) |
| Importer — payments & landed cost | [features/importer-payments-landed-cost.md](features/importer-payments-landed-cost.md) |
| Importer — overview, suppliers, reports, insights | [features/importer-overview-reports.md](features/importer-overview-reports.md) |
| Exporter — company, products, opportunities, quotations | [features/exporter-sourcing.md](features/exporter-sourcing.md) |
| Exporter — negotiations & deals | [features/exporter-negotiations-deals.md](features/exporter-negotiations-deals.md) |
| Exporter — orders & shipments | [features/exporter-orders-shipments.md](features/exporter-orders-shipments.md) |
| Exporter — documents, messages, notifications, analytics | [features/exporter-workspace-tools.md](features/exporter-workspace-tools.md) |
| CHA & Freight Forwarder dashboards | [features/cha-freight-forwarder.md](features/cha-freight-forwarder.md) |
| Landing page, role picker, languages | [features/platform-shell-i18n.md](features/platform-shell-i18n.md) |

Every feature doc uses the same headings: **Purpose · Entry points · Data · Rules · Connections · Verification · Limitations**. Use [features/_template.md](features/_template.md) for a new one.

## Domain reference

[`info from domian persons/`](info%20from%20domian%20persons/) holds notes and diagrams from trade-domain experts (DDP vs DAP, HS vs HSN codes, port-to-importer movement, pre- and post-shipment documents). Read these if trade terms in the code are unfamiliar.

## Keeping docs current

The rule (also in [CLAUDE.md](../CLAUDE.md)): **every feature or bug fix updates the relevant docs in the same change.** Describe what the code does, not what we hope it does. Always say whether something is *working*, *demo/mock*, *planned*, or a *known limitation*. Never put secrets or credentials in docs.

| You changed… | Update |
|---|---|
| Behavior of a feature | its file in `features/` |
| A record's fields, an ID format, a relationship, a storage key | `data-model.md` |
| Something moved from demo to real (or a new bug was found) | `project-status.md` |
| Setup, scripts, env vars | `README.md` (root) |
| Folder layout or a convention | `development.md` |
| A choice with trade-offs someone may question later | new file in `decisions/` |
