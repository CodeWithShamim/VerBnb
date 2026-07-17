// Client-side watchlist of disputes the user chose to follow.
//
// Mirrors the lib/recentDisputes.ts pattern: a small localStorage index with a
// versioned key, a custom window event ("verbnb:watchlist") so same-tab
// listeners refresh immediately, and the native "storage" event for cross-tab
// sync. All functions are SSR-safe no-ops on the server.
//
// The watchlist stores only light tracking metadata (last status/resolved seen
// by the notification poller + an unread flag); live truth always comes from
// the chain via /api/verdict and /api/tx (see components/NotificationBell.tsx).

import { REGISTRY_ADDRESS, type Category } from "@/lib/contracts";

// Scoped to the LIVE registry (deployments/<network>.json) so a redeploy starts
// a clean watchlist — entries pointing at retired contracts never resurface.
// Watchlists scoped to other registries (and the legacy "v1" key) are pruned.
const KEY_PREFIX = "verbnb.watchlist.";
const KEY = `${KEY_PREFIX}${(REGISTRY_ADDRESS || "unknown").toLowerCase()}`;
const MAX = 100;

if (typeof window !== "undefined") {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (!k || k === KEY) continue;
      if (k === `${KEY_PREFIX}v1` || k.startsWith(KEY_PREFIX)) {
        window.localStorage.removeItem(k);
      }
    }
  } catch {
    /* storage disabled - nothing to prune */
  }
}

/** Custom event fired on every write so same-tab subscribers refresh. */
export const WATCHLIST_EVENT = "verbnb:watchlist";

export interface WatchEntry {
  id: string;
  category: Category;
  /** Specialist tx hash, when known (drives live status polling). */
  txHash?: string;
  /** ms epoch this browser added the entry to the watchlist. */
  addedAt: number;
  /** Last transaction status the notification poller observed. */
  lastKnownStatus?: string;
  /** Last resolved flag the notification poller observed. */
  lastKnownResolved?: boolean;
  /** True when the entry changed since the user last looked at it. */
  unread?: boolean;
}

function read(): WatchEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: WatchEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    // Let same-tab listeners refresh immediately; the native "storage" event
    // only fires in OTHER tabs.
    window.dispatchEvent(new Event(WATCHLIST_EVENT));
  } catch {
    /* storage full / disabled - watchlist simply shows nothing */
  }
}

/** Returns watched disputes, newest first. */
export function getWatchlist(): WatchEntry[] {
  return read().sort((a, b) => b.addedAt - a.addedAt);
}

/** Add (or upsert) a dispute to the watchlist. Newest entries win on conflict. */
export function watchDispute(
  entry: Omit<WatchEntry, "addedAt"> & { addedAt?: number },
) {
  const list = read().filter((d) => d.id !== entry.id);
  list.unshift({ addedAt: Date.now(), ...entry });
  write(list);
}

/** Remove a dispute from the watchlist. */
export function unwatchDispute(id: string) {
  const list = read();
  const next = list.filter((d) => d.id !== id);
  if (next.length !== list.length) write(next);
}

/** Whether a dispute id is currently watched. */
export function isWatched(id: string): boolean {
  return read().some((d) => d.id === id);
}

/** Patch an existing entry (no-op if the id isn't watched). */
export function updateWatchEntry(
  id: string,
  patch: Partial<Omit<WatchEntry, "id">>,
) {
  const list = read();
  const idx = list.findIndex((d) => d.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...patch, id: list[idx].id };
  write(list);
}

/** Clear the unread flag on every entry. */
export function markAllRead() {
  const list = read();
  if (!list.some((d) => d.unread)) return;
  write(list.map((d) => ({ ...d, unread: false })));
}

/** Subscribe to changes (this tab via custom event, other tabs via storage). */
export function subscribeWatchlist(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(WATCHLIST_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(WATCHLIST_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}
