'use client';

// Toggle button that adds/removes a dispute from the local watchlist
// (lib/watchlist.ts). The NotificationBell in the navbar polls watched
// disputes and surfaces status changes as toasts + unread badges.
//
// Variants:
//   - "onGradient": white/20 backdrop pill, matches the "Copy ID" button on
//     the dispute page's gradient header.
//   - "default": bordered pill for regular light/dark surfaces.

import { useEffect, useState } from 'react';
import type { Category } from '@/lib/contracts';
import {
  isWatched,
  subscribeWatchlist,
  unwatchDispute,
  watchDispute,
} from '@/lib/watchlist';

interface WatchButtonProps {
  id: string;
  category: Category;
  txHash?: string;
  variant?: 'onGradient' | 'default';
  className?: string;
}

export default function WatchButton({
  id,
  category,
  txHash,
  variant = 'default',
  className = '',
}: WatchButtonProps) {
  // Start unwatched so the server-rendered markup matches, then sync from
  // localStorage after mount and stay subscribed for same-tab/cross-tab edits.
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    const refresh = () => setWatched(isWatched(id));
    refresh();
    return subscribeWatchlist(refresh);
  }, [id]);

  function toggle() {
    if (watched) {
      unwatchDispute(id);
    } else {
      watchDispute({ id, category, txHash });
    }
  }

  const base =
    'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-manrope text-sm font-semibold transition-colors';
  const styles =
    variant === 'onGradient'
      ? watched
        ? 'bg-white/30 text-white backdrop-blur hover:bg-white/40'
        : 'bg-white/20 text-white backdrop-blur hover:bg-white/30'
      : watched
        ? 'border border-surface-border bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
        : 'border border-surface-border bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={watched}
      aria-label={watched ? 'Stop watching this dispute' : 'Watch this dispute'}
      className={`${base} ${styles} ${className}`}
    >
      {watched ? (
        // Bell icon while watching (notifications active).
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
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
      ) : (
        // Eye icon while not watching.
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={12} cy={12} r={2.6} stroke="currentColor" strokeWidth={1.8} />
        </svg>
      )}
      {watched ? 'Watching ✓' : 'Watch'}
    </button>
  );
}
