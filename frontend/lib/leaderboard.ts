// Client helpers for the Reputation Leaderboard.
//
// The reputation tracker contract only exposes per-address views (there is no
// on-chain "list all users"), so the leaderboard ranks a candidate set built
// from: signers recorded in lib/recentDisputes.ts, addresses the visitor adds
// manually (persisted below, mirroring the recentDisputes storage pattern),
// and the connected wallet. Scores themselves always come from the chain via
// /api/leaderboard.

const KEY = "verbnb.leaderboard.addresses.v1";
const EVENT = "verbnb:leaderboard";
const MAX = 20;

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isValidAddress(value: string): boolean {
  return ADDRESS_RE.test(value.trim());
}

/** One ranked row returned by /api/leaderboard. */
export interface LeaderboardEntry {
  address: string;
  /** 0-100 on-chain credibility score. */
  credibility: number;
  disputesFiled: number;
  disputesWon: number;
  disputesLost: number;
  /** Percentage 0-100, or null when no dispute has been decided yet. */
  winRate: number | null;
  validatorRounds: number;
  /** Percentage 0-100, or null when the address never validated. */
  validatorAccuracy: number | null;
  appealsFiled: number;
  appealsWon: number;
  /** Seconds epoch of last tracked activity (0 = never). */
  lastActive: number;
  /** False when the tracker has no record for this address yet. */
  exists: boolean;
  /** Set instead of the fields above when the chain read failed. */
  error?: string;
}

export interface LeaderboardResponse {
  configured: boolean;
  entries: LeaderboardEntry[];
}

// ---------------------------------------------------------------- storage

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((a): a is string => typeof a === "string" && ADDRESS_RE.test(a))
      : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    // Same-tab listeners refresh via the custom event; the native "storage"
    // event only fires in OTHER tabs.
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage full / disabled - the list simply doesn't persist */
  }
}

/** Manually-added addresses, insertion order preserved. */
export function getManualAddresses(): string[] {
  return read();
}

/** Add a validated address (dedup, case-insensitive). Returns false if rejected. */
export function addManualAddress(address: string): boolean {
  const value = address.trim();
  if (!ADDRESS_RE.test(value)) return false;
  const list = read();
  if (list.some((a) => a.toLowerCase() === value.toLowerCase())) return false;
  list.unshift(value);
  write(list);
  return true;
}

/** Remove an address from the manual list (case-insensitive). */
export function removeManualAddress(address: string) {
  const lower = address.toLowerCase();
  write(read().filter((a) => a.toLowerCase() !== lower));
}

/** Subscribe to changes (this tab via custom event, other tabs via storage). */
export function subscribeManualAddresses(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

// ------------------------------------------------------------------ fetch

/** Fetch on-chain reputation rows for a set of addresses (server caps at 20). */
export async function fetchLeaderboard(
  addresses: string[],
): Promise<LeaderboardResponse> {
  const valid = addresses.filter((a) => ADDRESS_RE.test(a));
  if (valid.length === 0) return { configured: true, entries: [] };
  const res = await fetch(
    `/api/leaderboard?addresses=${encodeURIComponent(valid.join(","))}`,
  );
  if (!res.ok) throw new Error(`leaderboard fetch failed (${res.status})`);
  return res.json();
}
