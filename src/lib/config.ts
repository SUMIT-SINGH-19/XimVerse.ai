/**
 * Environment-specific configuration, read in one place.
 *
 * Only NEXT_PUBLIC_* variables are read here so the same module works in both
 * server and client components. Next.js inlines them at build time, so changing
 * one on Vercel needs a redeploy to take effect.
 */

function withProtocol(host: string): string {
  return host.startsWith("http") ? host : `https://${host}`;
}

/**
 * The public origin of the site, with no trailing slash.
 *
 * 1. NEXT_PUBLIC_SITE_URL, when set (https://ximverse.ai in production).
 * 2. On Vercel, the deployment's own URL, which Vercel provides automatically.
 *    This keeps preview deployments pointing at themselves rather than production.
 * 3. Local development.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelProduction =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
      ? process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      : undefined;
  const vercelHost = vercelProduction ?? process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercelHost) return withProtocol(vercelHost);

  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const config = {
  siteUrl: resolveSiteUrl(),

  /**
   * Where the frontend sends API requests. Defaults to same-origin `/api`, so a
   * backend can be added later either as Next.js route handlers or as a
   * separate service (set NEXT_PUBLIC_API_BASE_URL) without touching callers.
   */
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/+$/, ""),
} as const;
