'use client';

// Navbar bell for the dispute watchlist (lib/watchlist.ts).
//
// - Shows an unread-count badge and a frosted dropdown of watched disputes.
// - Every 30s (and on mount, skipping hidden tabs) it re-checks the 20 most
//   recent unresolved watched disputes against the chain via /api/verdict and
//   /api/tx (same endpoints the dispute page polls). When a status or the
//   resolved flag changes vs the stored lastKnown*, the entry is marked unread
//   and a sonner toast fires. The global <Toaster> already lives in
//   app/layout.tsx, so this component only calls toast().
// - Self-contained: mount it anywhere inside a client tree (the Navbar's
//   right-hand cluster is the intended home).

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { CATEGORIES } from '@/lib/contracts';
import {
  getWatchlist,
  markAllRead,
  subscribeWatchlist,
  updateWatchEntry,
  type WatchEntry,
} from '@/lib/watchlist';

const POLL_MS = 30_000;
const POLL_CAP = 20;

function shortId(id: string): string {
  return id.length > 22 ? `${id.slice(0, 12)}…${id.slice(-6)}` : id;
}

function statusLabel(entry: WatchEntry): string {
  if (entry.lastKnownResolved) return 'Resolved';
  if (entry.lastKnownStatus) return entry.lastKnownStatus.replace(/_/g, ' ');
  return 'Pending';
}

function disputeHref(entry: WatchEntry): string {
  const base = `/dispute/${encodeURIComponent(entry.id)}?category=${encodeURIComponent(
    entry.category,
  )}`;
  return entry.txHash ? `${base}&tx=${encodeURIComponent(entry.txHash)}` : base;
}

export default function NotificationBell() {
  const [entries, setEntries] = useState<WatchEntry[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pollBusyRef = useRef(false);

  // Load after mount (SSR renders an empty bell) and stay in sync with
  // same-tab writes (custom event) and other tabs (storage event).
  useEffect(() => {
    const refresh = () => setEntries(getWatchlist());
    refresh();
    return subscribeWatchlist(refresh);
  }, []);

  // Close on outside click / Escape while the panel is open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const poll = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (pollBusyRef.current) return;
    pollBusyRef.current = true;
    try {
      // Only the 20 most recent, still-unresolved entries; resolved disputes
      // never change again so we stop polling them entirely.
      const targets = getWatchlist()
        .filter((e) => !e.lastKnownResolved)
        .slice(0, POLL_CAP);

      await Promise.all(
        targets.map(async (entry) => {
          let status = entry.lastKnownStatus;
          let resolved = entry.lastKnownResolved === true;

          // Transaction status - skip once finalized (nothing more to learn).
          if (
            entry.txHash &&
            (status || '').toUpperCase() !== 'FINALIZED'
          ) {
            try {
              const r = await fetch(
                `/api/tx?hash=${encodeURIComponent(entry.txHash)}`,
              );
              const d = await r.json();
              if (d?.status) status = String(d.status);
            } catch {
              /* keep last status */
            }
          }

          // Verdict / resolved flag from the specialist via the registry.
          try {
            const r = await fetch(
              `/api/verdict/${encodeURIComponent(entry.id)}?category=${encodeURIComponent(entry.category)}`,
            );
            const d = await r.json();
            if (d?.verdict?.resolved === true && !d?.verdict?.error) {
              resolved = true;
            }
          } catch {
            /* not resolved yet */
          }

          const becameResolved = resolved && entry.lastKnownResolved !== true;
          // A status is only "news" when we had a previous one to compare
          // against; the first observation just seeds the baseline silently.
          const statusChanged =
            !!status &&
            !!entry.lastKnownStatus &&
            status !== entry.lastKnownStatus;
          const baselineOnly =
            !!status && !entry.lastKnownStatus && !becameResolved;

          if (becameResolved || statusChanged) {
            updateWatchEntry(entry.id, {
              lastKnownStatus: status,
              lastKnownResolved: resolved,
              unread: true,
            });
            if (becameResolved) {
              toast.success(`Verdict is in for ${shortId(entry.id)}`, {
                description: `${CATEGORIES[entry.category]?.title ?? entry.category} dispute resolved.`,
              });
            } else {
              toast.info(`Dispute ${shortId(entry.id)} update`, {
                description: `Status changed to ${status}.`,
              });
            }
          } else if (baselineOnly) {
            updateWatchEntry(entry.id, {
              lastKnownStatus: status,
              lastKnownResolved: resolved,
            });
          }
        }),
      );
    } finally {
      pollBusyRef.current = false;
    }
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  const unreadCount = entries.filter((e) => e.unread).length;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : 'Notifications'
        }
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-700 transition-colors hover:bg-slate-900/5 dark:text-white dark:hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path
            d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 2.5h15L18 15Z"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 20a2 2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 py-px font-manrope text-[10px] font-bold leading-4 text-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-surface-border bg-white/95 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#14141f]/95"
          >
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-3 dark:border-white/10">
              <p className="font-manrope text-sm font-bold text-slate-900 dark:text-white">
                Watched disputes
              </p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  className="font-manrope text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800 dark:text-white/60 dark:hover:text-white"
                >
                  Mark all read
                </button>
              )}
            </div>

            {entries.length === 0 ? (
              <p className="px-4 py-8 text-center font-manrope text-sm text-slate-500 dark:text-white/60">
                No watched disputes yet — open any dispute and hit Watch.
              </p>
            ) : (
              <ul className="max-h-96 divide-y divide-surface-border overflow-y-auto dark:divide-white/10">
                {entries.map((entry) => {
                  const meta = CATEGORIES[entry.category];
                  return (
                    <li key={entry.id}>
                      <Link
                        href={disputeHref(entry)}
                        onClick={() => {
                          if (entry.unread) {
                            updateWatchEntry(entry.id, { unread: false });
                          }
                          setOpen(false);
                        }}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-900/5 dark:hover:bg-white/5"
                      >
                        <span
                          className={`mt-0.5 inline-flex shrink-0 rounded-full bg-gradient-to-r ${
                            meta?.gradient ?? 'from-slate-500 to-slate-600'
                          } px-2 py-0.5 font-manrope text-[10px] font-bold uppercase tracking-wide text-white`}
                        >
                          {meta?.title ?? entry.category}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-xs font-medium text-slate-700 dark:text-white">
                            {shortId(entry.id)}
                          </span>
                          <span className="mt-0.5 block font-manrope text-[11px] text-slate-500 dark:text-white/60">
                            {statusLabel(entry)} ·{' '}
                            {formatDistanceToNow(entry.addedAt, {
                              addSuffix: true,
                            })}
                          </span>
                        </span>
                        {entry.unread && (
                          <span
                            aria-label="Unread"
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
