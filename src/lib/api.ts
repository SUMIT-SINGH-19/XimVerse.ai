import { config } from "./config";

/**
 * The single entry point for talking to the backend. Nothing calls it yet; it
 * exists so features added later fetch through one place that already knows
 * the base URL, rather than each building its own.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${config.apiBaseUrl}/${path.replace(/^\/+/, "")}`;
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    throw new Error(`API ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json() as Promise<T>;
}
