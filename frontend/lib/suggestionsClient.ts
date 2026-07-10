"use client";

/**
 * Shared client for the read-only suggestions API (/api/suggestions).
 *
 * Mirrors lib/trackerClient.ts: in-flight dedup so concurrent reads of the
 * same resource share one round-trip, plus a short TTL memo cache matched to
 * the server's Cache-Control window (15s) so repeat reads stay fresh.
 */

const TTL_MS = 15_000;

type Entry = { at: number; value: any };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<any>>();

function buildUrl(
  resource: string,
  params: Record<string, string | number>,
): string {
  const sp = new URLSearchParams({ resource });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return `/api/suggestions?${sp.toString()}`;
}

/**
 * Fetch a suggestions resource ("topics" | "suggestions" | "last_updated")
 * with dedup + TTL caching.
 */
export async function suggestionsFetch(
  resource: string,
  params: Record<string, string | number> = {},
): Promise<any> {
  const url = buildUrl(resource, params);

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const pending = inflight.get(url);
  if (pending) return pending;

  const p = fetch(url)
    .then((r) => r.json())
    .then((value) => {
      cache.set(url, { at: Date.now(), value });
      inflight.delete(url);
      return value;
    })
    .catch((err) => {
      inflight.delete(url);
      throw err;
    });

  inflight.set(url, p);
  return p;
}
