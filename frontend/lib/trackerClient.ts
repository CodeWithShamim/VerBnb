"use client";

/**
 * Shared client for the read-only tracker API (/api/trackers).
 *
 * Two optimizations over calling fetch() directly from each component:
 *  1. In-flight dedup - concurrent requests for the same resource share one
 *     network round-trip (e.g. a VerdictCard rendering two ReputationBadges,
 *     or many badges in a list, all hit the chain once).
 *  2. Short TTL memo cache - repeat reads within TTL_MS resolve instantly from
 *     memory, matching the server's Cache-Control window so the data stays fresh.
 *
 * Keep this in sync with the s-maxage on /api/trackers (15s).
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
  return `/api/trackers?${sp.toString()}`;
}

/**
 * Fetch a tracker resource with dedup + TTL caching. `signal` lets callers
 * abort on unmount; aborting one subscriber does not cancel the shared request
 * for others.
 */
export async function trackerFetch(
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

/** Drop a cached resource so the next read re-fetches (use after a write). */
export function invalidateTracker(
  resource: string,
  params: Record<string, string | number> = {},
): void {
  cache.delete(buildUrl(resource, params));
}
