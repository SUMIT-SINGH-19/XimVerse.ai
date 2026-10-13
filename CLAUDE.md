@AGENTS.md
@docs/PROJECT_CONTEXT.md

# Ximverse — Platform Vision (North Star)

Ximverse is not just a procurement marketplace. It is an **AI-powered, end-to-end global trade orchestration and execution platform**.

**Philosophy: "Serve the Shipment."**

A buyer should not need to coordinate 10 different companies, 20 email threads and 5 software systems. The buyer places a requirement on Ximverse, and Ximverse coordinates the entire journey — from selecting a manufacturer in India to delivering the goods to the buyer's factory in another country.

**SUMIT** is the AI orchestration agent coordinating it all.

## The North Star we are building toward

```
                 Global Importer
        Submits one purchase requirement
                        ↓
        ┌───────────────────────────────┐
        │ SUMIT — AI Orchestration Agent│
        │ Sourcing, negotiation,        │
        │ verified orders, planning     │
        └───────────────────────────────┘
                        ↓
  Stage 1  Manufacturing         Production & quality
  Stage 2  Trucking              Factory pickup
  Stage 3  Origin Customs        CHA + ICEGATE
  Stage 4  Ocean Freight         Best sailing & rate
  Stage 5  Destination Customs   Broker clearance
  Stage 6  Final Delivery        Truck to buyer
                        ↓
        Delivered to Importer's Factory
   One order · One timeline · Full accountability
```

## How this relates to the current build

This is the platform identity and long-term destination. It supersedes the "think of Ximverse mainly as a procurement marketplace" framing in `docs/PROJECT_CONTEXT.md` §1. The importer → exporter sourcing loop (PROJECT_CONTEXT §18–19) is the first stage of this journey, not the whole product — design data models and boundaries so Stages 2–6 can attach to a Deal/Order later. Build order still follows the current development priority unless the user says otherwise.
