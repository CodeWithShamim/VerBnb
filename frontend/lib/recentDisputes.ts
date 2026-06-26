// Client-side ledger of disputes raised from this browser.
//
// The deployed registry has no "list all disputes" view, so we keep a small
// local index of dispute ids the user has submitted. The live feed reads this
// list and then enriches every entry STRAIGHT FROM THE CHAIN (registry record
// + transaction status/block) — the local part is only the id list, never the
// status. See components/LiveTransactions.tsx + app/api/transactions/route.ts.

import type { Category } from "@/lib/contracts";

const KEY = "verbnb.recentDisputes.v1";
const MAX = 50;

export interface RecentDispute {
  id: string;
  category: Category;
  /** Specialist tx hash (drives live status). */
  tx?: string;
  /** Registry register_dispute tx hash, if it landed. */
  registryTx?: string;
  /** Wallet that signed, when known. */
  signer?: string;
  /** ms epoch this browser recorded the submission (display fallback only). */
  submittedAt: number;
}

function read(): RecentDispute[] {
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

function write(list: RecentDispute[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    // Let same-tab listeners (the feed) refresh immediately; the native
    // "storage" event only fires in OTHER tabs.
    window.dispatchEvent(new Event("verbnb:disputes"));
  } catch {
    /* storage full / disabled — feed simply shows nothing */
  }
}

/** Returns recorded disputes, newest first. */
export function getRecentDisputes(): RecentDispute[] {
  return read().sort((a, b) => b.submittedAt - a.submittedAt);
}

/** Record (or upsert) a submitted dispute. Newest entries win on conflict. */
export function recordDispute(
  entry: Omit<RecentDispute, "submittedAt"> & { submittedAt?: number }
) {
  const list = read().filter((d) => d.id !== entry.id);
  list.unshift({ submittedAt: Date.now(), ...entry });
  write(list);
}

/** Subscribe to changes (this tab via custom event, other tabs via storage). */
export function subscribeRecentDisputes(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("verbnb:disputes", cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("verbnb:disputes", cb);
    window.removeEventListener("storage", onStorage);
  };
}
