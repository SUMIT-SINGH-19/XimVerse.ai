# Ximverse

One platform for exporters, importers, customs house agents and freight forwarders.

Production: https://ximverse.ai (GitHub → Vercel → ximverse.ai)

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · lucide-react

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

No environment variables are required for local development. To override any
defaults, copy `.env.example` to `.env.local`.

Other scripts:

```bash
npm run lint
npm run build      # production build — run this before pushing
npm run start      # serve the production build locally
```

## Configuration

All environment-specific values are read in [`src/lib/config.ts`](src/lib/config.ts)
and documented in [`.env.example`](.env.example).

| Variable | Purpose | Production value |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Public origin, used for canonical and social-preview URLs | `https://ximverse.ai` |
| `NEXT_PUBLIC_API_BASE_URL` | Where API calls go. Unset means same-origin `/api` | unset for now |

When `NEXT_PUBLIC_SITE_URL` is unset, the site URL falls back to the Vercel
deployment URL on Vercel (so previews point at themselves), then to
`http://localhost:3000` locally.

## Project layout

```
src/
  app/                 routes, root layout, global styles
  components/          UI components
  lib/
    config.ts          environment configuration
    api.ts             apiFetch() — the single place backend calls will go through
    roles.ts           the four stakeholder roles
```
