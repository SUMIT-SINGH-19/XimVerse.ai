# Ximverse — Project Context for Claude

## Purpose of this file

This file gives Claude context about the kind of platform we are building with Ximverse.

It is NOT a final PRD, fixed architecture, or immutable product plan. The product, workflows, terminology, database models, architecture, and priorities may change as we build, test with users, learn from the market, and make better decisions.

Use this document as directional context and inspiration, not as a rigid implementation specification.

**When the latest user instruction conflicts with this file, the latest user instruction always wins.**

## 1. What Ximverse Is

Ximverse is being built as a technology platform for cross-border trade.

The long-term idea is to connect and coordinate participants such as:

- Importers / buyers
- Exporters / suppliers
- Freight forwarders
- CHAs / customs brokers
- Transporters / truck owners
- Shipping lines / carriers
- Other trade and logistics partners

However, we are NOT building all of this right now. The immediate product focus is much narrower:

```
Importer demand
      ↓
Ximverse marketplace
      ↓
Relevant exporters
      ↓
Exporter quotations
      ↓
Ximverse evaluates / coordinates offers
      ↓
Best commercial offer sent to importer
      ↓
Importer accepts
      ↓
Deal
```

For the current phase, think of Ximverse mainly as a **B2B sourcing and procurement marketplace between importers and exporters**.

## 2. Current Product Scope

For now, focus only on:

1. Exporter
2. Importer
3. Marketplace / RFQ workflow
4. Ximverse operations between buyer and supplier

Do not automatically start building the following unless the user specifically asks for them (they remain future possibilities):

- CHA marketplace
- Freight marketplace
- Truck marketplace
- Shipping-line integrations
- Customs automation
- Regulatory engines
- Payments
- Financing
- Insurance
- Advanced agent systems

## 3. Current Business Flow

```
Importer creates requirement / RFQ
            ↓
Ximverse receives the requirement
            ↓
Relevant exporters are identified
            ↓
Requirement is shared with exporters
            ↓
Exporters send their prices / quotations
            ↓
Ximverse compares responses
            ↓
Ximverse selects or negotiates the best option
            ↓
Ximverse prepares the commercial offer
            ↓
Offer is sent to the importer
            ↓
Importer accepts
            ↓
Deal is created / marked confirmed
```

At this stage, the buyer does not necessarily need to directly interact with every exporter. Ximverse may operate more like a procurement layer:

```
Importer
   ↓
Ximverse
   ↓
Multiple exporters
```

Ximverse sources from exporters, evaluates the available options, prepares the final offer, and sends it to the importer.

## 4. Important Commercial Concept

Ximverse is not necessarily just a directory where the buyer searches a supplier, contacts them, and the platform disappears. Ximverse can sit **inside the transaction workflow**.

Example — importer asks for: 500 MT Basmati Rice, CIF Jebel Ali, 25 kg packaging, LC at sight.

```
Ximverse finds suitable exporters
        ↓
Exporter A / B / C / D → Quotes
        ↓
Ximverse compares:
- Price
- Product specifications
- MOQ
- Capacity
- Packaging
- Delivery timeline
- Certifications
- Existing market experience
- Commercial terms
        ↓
Ximverse selects / negotiates the strongest option
        ↓
Importer receives a clean offer
```

The exact commercial model may evolve. Possible models: marketplace commission, procurement fee, service fee, supplier-side commission, buyer-side fee, trading / principal model, margin between sourcing price and buyer price, subscription, or a combination.

**Do not hardcode a business model unless explicitly instructed.**

## 5. Exporter Profile

Exporter profiles should eventually help Ximverse understand what a supplier is actually capable of supplying.

- **Company information:** company name, description, country, state / location, contact details, website, export experience, markets served
- **Product information:** product name, category, HS code, specifications, variants, grades, packaging options, MOQ, production capacity, available quantity, lead time
- **Commercial information:** typical pricing basis, EXW / FOB / CIF capability, payment terms, preferred currencies, preferred ports
- **Certifications / compliance:** e.g. FSSAI, APEDA, ISO, HACCP, organic, product-specific and market-specific certifications

The exact fields will depend on the category. Avoid one giant exporter form with unnecessary fields — prefer progressive onboarding:

```
Basic company profile → Add product → Add product capability → Add commercial information → Add certifications when relevant
```

## 6. Importer Profile

Importer profiles represent buying capability and demand. Potential information: company, country, markets, product categories purchased, typical purchase volume, destination ports, preferred Incoterms, payment preferences, contact people, historical RFQs, historical orders.

Do not overbuild onboarding in the beginning.

## 7. Importer RFQ

The importer should be able to create a buying requirement. Example:

| Field | Value |
| --- | --- |
| Product | 1121 Steam Basmati Rice |
| Quantity | 500 MT |
| Destination | Jebel Ali, UAE |
| Packaging | 25 kg bags |
| Required delivery | 30 November |
| Certification | HACCP + phytosanitary |
| Incoterm | CIF Jebel Ali |
| Payment | LC at sight |

Eventually the importer should also be able to type naturally — "Need 500 tons 1121 steam basmati, 25 kg packing, Dubai, CIF, LC." — and Ximverse may convert that into structured data.

But do not introduce AI simply because it sounds useful. **First make the underlying marketplace flow work.**

## 8. Core Marketplace Objects

Keep the conceptual data model clean. Likely objects (names may change; not mandatory):

```
User
Organization
ExporterProfile
ImporterProfile
Product
ProductCapability
RFQ
RFQRequirement
RFQMatch
ExporterQuote
BuyerOffer
Deal
Order
```

The important conceptual distinction:

- **RFQ** = buyer requirement
- **ExporterQuote** = supplier response to that RFQ
- **BuyerOffer** = commercial offer Ximverse sends to importer
- **Deal** = accepted commercial agreement

Later: `Deal → Order → Shipment`. Shipment execution is not the current focus.

## 9. Suggested Current State Flow

Examples only — if implementation reveals a better structure, use it.

**RFQ:** `DRAFT → SUBMITTED → SOURCING → QUOTES_RECEIVED → OFFER_READY → OFFER_SENT → ACCEPTED / REJECTED / EXPIRED`

**Supplier Quote:** `REQUESTED → SUBMITTED → UNDER_REVIEW → SHORTLISTED / REJECTED`

**Deal:** `PENDING → CONFIRMED → IN_PROGRESS → COMPLETED`

## 10. Matching Exporters to an RFQ

Initially, matching does not need to be an advanced ML system. Start with deterministic filters.

Possible factors: product compatibility, product specification, quantity capability, MOQ, production capacity, certification requirements, destination-market experience, delivery capability, location, preferred port, price history, response rate, past transaction performance.

```
20 exporters in database
        ↓
12 sell the product
        ↓
8 satisfy required specifications
        ↓
6 satisfy quantity / MOQ
        ↓
5 satisfy certification requirements
        ↓
Send RFQ to those 5
```

This is preferable to blindly broadcasting every RFQ to every exporter.

## 11. Quote Comparison

Exporter quotations may arrive in different formats:

- Exporter A: ₹79/kg EXW
- Exporter B: $1,020/MT FOB Mundra
- Exporter C: $1,140/MT CIF Jebel Ali

Eventually Ximverse should normalize these before comparing them. Potential cost components:

```
Supplier price
+ inland logistics
+ documentation
+ customs / handling
+ freight
+ insurance
+ taxes / duties where applicable
+ Ximverse fee / margin
--------------------------------
Buyer offer
```

However, do not build a complex landed-cost engine before the basic quote flow works. For the MVP, begin with simple commercial comparisons.

## 12. Buyer Offer

An importer does not necessarily need to see every raw supplier quote. Ximverse can create a cleaner buyer-facing offer, e.g.: product, quantity, Incoterm, price per MT, delivery days, packaging, payment terms, offer validity (e.g. 7 days).

Ximverse may internally know which exporter is fulfilling the requirement. Whether the supplier identity is shown immediately, after acceptance, or never is a business decision that may change. **Do not hardcode assumptions around supplier visibility unless instructed.**

## 13. Current Dashboards

### Exporter Dashboard

Areas: Overview, My Company, Products, RFQ Opportunities, My Quotes, Deals, Messages / Notifications.

The exporter should be able to: maintain profile, add products, receive relevant RFQs, view RFQ details, submit quotation, track quotation status, view won deals.

### Importer Dashboard

Areas: Overview, Create RFQ, My RFQs, Offers, Deals, Company Profile, Messages / Notifications.

The importer should be able to: maintain profile, post requirement, track sourcing status, receive Ximverse offer, accept / reject offer, view confirmed deals.

### Ximverse Admin / Ops

This is important — the platform may initially require human-assisted operations. Admin/Ops may need to: review RFQs, fix RFQ data, select exporters, send RFQs, review supplier quotes, compare quotes, negotiate manually, shortlist suppliers, prepare and send buyer offer, mark deal confirmed, handle exceptions.

Do not assume every process must be automated from day one. Human-assisted workflows are acceptable during MVP.

## 14. SUMIT

"SUMIT" is the working name for Ximverse's AI / intelligence layer.

Long term, SUMIT may help with: understanding RFQs, structuring requirements, product classification, exporter matching, quote normalization, supplier ranking, commercial analysis, translation, compliance intelligence, freight intelligence, document understanding, workflow coordination.

Right now, SUMIT should be introduced **only where it produces clear product value**. Do not create a complex autonomous-agent architecture for basic CRUD or marketplace actions.

Prefer: simple deterministic software first, plus AI where ambiguity / unstructured data exists.

- Good AI use: buyer writes unstructured requirement → AI extracts structured RFQ fields.
- Bad AI use: user clicks "Save Profile" → AI agent decides how to save the database record.

Use normal software engineering when normal software engineering is sufficient.

## 15. Longer-Term Platform Direction

```
                    XIMVERSE

          ┌─────────────────────────┐
          │  DEMAND / BUYER LAYER   │
          │ Importers post RFQs     │
          │ External RFQs ingested  │
          └────────────┬────────────┘
                       ↓
          ┌─────────────────────────┐
          │         SUMIT           │
          │ Understand              │
          │ Match                   │
          │ Compare                 │
          │ Coordinate              │
          │ Compliance intelligence │
          └────────────┬────────────┘
                       ↓
          ┌─────────────────────────┐
          │ EXECUTION NETWORK       │
          │ Exporters               │
          │ Transporters            │
          │ Freight Forwarders      │
          │ CHA                     │
          │ Carriers                │
          │ Destination partners    │
          └─────────────────────────┘
```

Eventual trade lifecycle: RFQ → Quotes → Deal → Order → Shipment → Pickup → Freight → Customs → International movement → Destination compliance → Delivery.

This is long-term context only. Do not interpret it as an instruction to implement all stages now.

## 16. Possible Future Modules

- **Transport marketplace:** when cargo is ready (pickup location, destination port, cargo, weight, container, pickup window), transporters can bid.
- **Freight marketplace:** a confirmed order may generate a freight requirement; forwarders quote ocean / air freight, sailing date, shipping line, local charges, transit time, free days, validity.
- **CHA / customs marketplace:** shipments offered to appropriate CHAs with a structured shipment dossier to reduce manual re-entry.
- **Compliance engine:** export restrictions, product and certification requirements, destination requirements, duties, taxes, rules of origin, scheme eligibility, documentation. Compliance must not rely only on an LLM:

  ```
  Official source → Structured regulatory data / rules → Deterministic checks → AI explanation / extraction → Human approval when required
  ```

- **RFQ ingestion:** native importer RFQs, email, WhatsApp, Telegram, partner APIs, trade portals, procurement sources, chambers / EPCs, buyer-seller meets, referrals, enterprise procurement integrations.

These are future possibilities.

## 17. Product Philosophy

**A. Build vertical slices.** Do not build disconnected modules. Prefer:

```
Importer creates RFQ → Exporter receives RFQ → Exporter submits quote → Ximverse reviews quote → Importer receives offer → Importer accepts → Deal created
```

A working end-to-end loop is more valuable than ten unfinished dashboards.

**B. Do not over-engineer.** Do not introduce Kafka, Temporal, Kubernetes, multiple microservices, complex agent swarms, separate vector databases, event buses, or elaborate ML infrastructure unless current scale or requirements justify them. Start simple.

**C. Keep architecture extensible.** Simple does not mean careless. Create boundaries so future modules can be added without rewriting everything. RFQ, Quote, Offer, Deal, Order, Shipment should remain conceptually separate.

**D. Human-in-the-loop is acceptable.** Early on, Ximverse Ops can manually verify buyer requirements, find exporters, negotiate, rank quotations, and prepare final offers. Automate gradually after observing repeated behavior.

**E. Do not make AI the source of truth.** For commercial calculations, regulations, identity, payments, customs, compliance, and legally important actions, AI may assist, extract, recommend and explain — but important actions should use deterministic validation and human approval where appropriate.

## 18. Current Development Priority

1. Exporter Profile
2. Exporter Products / Capabilities
3. Importer Profile
4. Importer Creates RFQ
5. Ximverse Sees RFQ
6. Match / Select Relevant Exporters
7. Exporters Receive RFQ
8. Exporters Submit Quote
9. Ximverse Reviews / Compares Quotes
10. Ximverse Creates Buyer Offer
11. Importer Receives Offer
12. Importer Accepts / Rejects
13. Accepted Offer Becomes Deal

Everything else should be postponed unless explicitly requested.

## 19. Recommended MVP Loop

```
EXPORTER SUPPLY
      +
IMPORTER DEMAND
      ↓
MATCH
      ↓
QUOTE
      ↓
XIMVERSE OFFER
      ↓
DEAL
```

If this loop works, we have the foundation. Future execution layers can then be attached.

## 20. How Claude Should Work on This Project

1. **Understand before changing.** Before a major feature or architecture change: inspect the existing code, explain the relevant current flow, identify what needs to change, preserve working behavior unless necessary.
2. **Work feature-by-feature.** Do not attempt to build the entire vision in one prompt. If asked to build Exporter Products, focus on Exporter Products.
3. **Explain important changes.** For substantial work, explain: what we are building, why, which files are involved, how data flows, what database/API changes happen, how the UI connects to the backend, what should be tested. The user wants to understand the project, not merely receive generated code.
4. **Do not silently rewrite architecture.** If existing architecture conflicts with a new feature: point out the conflict, recommend the smallest clean change, avoid unnecessary rewrites.
5. **Latest instruction wins.** The user may change business model, workflow, feature priority, technology, user roles, UI, data model, or product direction. That is expected. Do not argue that something must stay a certain way because it appears in this file.
6. **Treat this as a living startup product.** Expect decisions to change after customer feedback, pilot results, technical discoveries, new integrations, regulatory requirements, and business-model experiments. Prefer adaptable architecture over rigid assumptions.

## 21. Current Technology Direction

The project may use:

- **Frontend:** Next.js, React, Tailwind CSS, shadcn/ui
- **Backend:** Python / FastAPI
- **Database:** PostgreSQL
- **AI:** LLM provider abstraction, potential SUMIT workflows
- **Storage:** S3-compatible object storage
- **Deployment:** Vercel for frontend, cloud infrastructure for backend

However, first inspect the actual repository before assuming anything. **The repository is the source of truth for the current implementation.** Do not replace an existing technology merely because a different technology appears in this document.

## 22. A Simple Mental Model

- **Importer:** "I need this product."
- **Ximverse:** "I will source it for you."
- **Exporter:** "I can supply it at these terms."
- **Ximverse:** "I will compare suppliers and prepare the best commercial option."
- **Importer:** "I accept."
- **Ximverse:** "Deal confirmed."

## 23. North Star

Make cross-border sourcing and trade execution feel like one coordinated digital workflow instead of a fragmented chain of suppliers, emails, spreadsheets, WhatsApp messages, brokers, logistics providers, portals, and manual follow-ups.

The current milestone is much simpler: build a working importer-to-exporter sourcing marketplace where Ximverse can receive demand, source from qualified exporters, compare quotations, send a strong offer to the buyer, and convert it into a deal.

## 24. Final Instruction to Claude

Treat this file as context, not command. Use it to understand what kind of company Ximverse is, where the product is heading, how the current importer/exporter marketplace fits the larger vision, and why certain architecture decisions may matter later. Do not blindly implement everything described here.

Always prioritize:

```
Latest user request
      ↓
Existing working code
      ↓
Current product milestone
      ↓
This contextual vision
```

The product will evolve. Build it accordingly.
