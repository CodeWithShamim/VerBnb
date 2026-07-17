'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { CATEGORIES, explorerTx, type Category, type ChainTxRow } from '@/lib/contracts';

// Status → badge styling. Explorer reports lower-cased GenLayer statuses.
function statusStyle(status: string): { dot: string; chip: string; label: string } {
  const s = (status || '').toUpperCase();
  if (s === 'FINALIZED' || s === 'ACCEPTED')
    return {
      dot: 'bg-emerald-500',
      chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: s === 'FINALIZED' ? 'Finalized' : 'Accepted',
    };
  if (s === 'UNDETERMINED' || s === 'VALIDATORS_TIMEOUT' || s === 'LEADER_TIMEOUT')
    return {
      dot: 'bg-amber-500',
      chip: 'bg-amber-50 text-amber-700 border-amber-200',
      label: 'Undetermined',
    };
  if (s === 'CANCELED')
    return {
      dot: 'bg-rose-500',
      chip: 'bg-rose-50 text-rose-700 border-rose-200',
      label: 'Canceled',
    };
  if (
    s === 'PROPOSING' ||
    s === 'COMMITTING' ||
    s === 'REVEALING' ||
    s === 'APPEAL_COMMITTING' ||
    s === 'APPEAL_REVEALING' ||
    s === 'PENDING' ||
    s === 'ACTIVATED' ||
    s === 'READY_TO_FINALIZE'
  )
    return {
      dot: 'bg-brand animate-pulse',
      chip: 'bg-brand-50 text-brand border-brand/20',
      label: s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' '),
    };
  return {
    dot: 'bg-slate-400 animate-pulse',
    chip: 'bg-surface-subtle text-slate-500 border-surface-border',
    label: s ? s.charAt(0) + s.slice(1).toLowerCase() : 'Pending',
  };
}

// Method → friendly label.
const METHOD_LABEL: Record<string, string> = {
  raise_dispute: 'Dispute raised',
  register_dispute: 'Dispute registered',
  validate_claim: 'Claim validated',
  mark_resolved: 'Marked resolved',
  revealVote: 'Vote revealed',
  addTransaction: 'Contract deployed',
};
function methodLabel(m: string): string {
  return METHOD_LABEL[m] || m.replace(/_/g, ' ');
}

function shortHash(h?: string | null): string {
  if (!h) return '-';
  return h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h;
}

function relativeTime(secEpoch?: number | null): string {
  if (!secEpoch) return '';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - secEpoch);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Row({ row, glass = false }: { row: ChainTxRow; glass?: boolean }) {
  const meta =
    row.category && CATEGORIES[row.category as Category]
      ? CATEGORIES[row.category as Category]
      : null;
  const st = statusStyle(row.status);

  // Click target: in-app dispute page when this tx carries a dispute id,
  // otherwise the explorer transaction page. Pass the tx hash + category so the
  // dispute page can show the explorer link and poll the right transaction.
  const internal = Boolean(row.disputeId);
  const href = internal
    ? (() => {
        const params = new URLSearchParams();
        if (row.category) params.set('category', row.category);
        if (row.hash) params.set('tx', row.hash);
        const qs = params.toString();
        return `/dispute/${encodeURIComponent(row.disputeId!)}${qs ? `?${qs}` : ''}`;
      })()
    : explorerTx(row.hash);

  const inner = (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:border-brand/40 ${
        glass
          ? 'border-slate-900/10 bg-[rgba(255,255,255,0.55)] hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]'
          : 'border-surface-border bg-white hover:bg-brand-50/30'
      }`}
    >
      {/* contract/category badge */}
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${
          meta?.gradient ?? 'from-slate-400 to-slate-500'
        } text-xs font-bold text-white`}
        title={row.contractKey}
      >
        {(meta?.title ?? row.contractKey)?.[0] ?? '?'}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900">
            {methodLabel(row.method)}
          </span>
          <span className="hidden shrink-0 rounded-md bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline">
            {row.contractKey}
          </span>
          {row.block != null && (
            <span className="hidden shrink-0 rounded-md bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 md:inline">
              #{row.block}
            </span>
          )}
        </div>
        <span className="block truncate font-mono text-xs text-slate-400">
          {shortHash(row.hash)}
          {row.disputeId ? `  ·  ${row.disputeId}` : ''}
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${st.chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
          {st.label}
        </span>
        <span className="text-[11px] text-slate-400">{relativeTime(row.timestamp)}</span>
      </div>
    </div>
  );

  return internal ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  ) : (
    // No explorer on this network - render the row without a link target.
    <div className="block">{inner}</div>
  );
}

export default function LiveTransactions({
  limit = 20,
  showHeader = true,
  glass = false,
}: {
  /** Max rows to show. */
  limit?: number;
  showHeader?: boolean;
  /** Hero-style glassmorphism styling (used on the home page canvas). */
  glass?: boolean;
}) {
  const [rows, setRows] = useState<ChainTxRow[] | null>(null);
  const [errored, setErrored] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/transactions?limit=${limit}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (Array.isArray(data.rows)) {
        setRows(data.rows);
        setErrored(false);
      } else {
        setErrored(true);
      }
    } catch {
      setErrored(true);
    }
  }, [limit]);

  useEffect(() => {
    const start = () => {
      if (timer.current) return;
      load();
      timer.current = setInterval(load, 10000); // live: re-poll the chain every 10s
    };
    const stop = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
    // Only poll while the tab is visible - background tabs stop hitting the
    // explorer and refresh immediately on return.
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [load]);

  return (
    <div className={`${glass ? 'glass-card' : 'card'} overflow-hidden`}>
      {showHeader && (
        <div
          className={`flex items-center justify-between border-b px-5 py-4 ${
            glass ? 'border-slate-900/10 dark:border-white/10' : 'border-surface-border'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">Live on-chain activity</h3>
          </div>
          <span className="text-xs text-slate-400">
            Status &amp; block pulled live from GenLayer
          </span>
        </div>
      )}

      <div className="space-y-2 p-4">
        {rows === null ? (
          // initial skeleton
          Array.from({ length: Math.min(limit, 6) }).map((_, i) => (
            <div key={i} className="h-[60px] rounded-xl bg-surface-muted shimmer" />
          ))
        ) : rows.length === 0 ? (
          <div className="px-2 py-10 text-center">
            <p className="text-sm font-medium text-slate-600">
              {errored ? 'Couldn’t reach the chain' : 'No transactions yet'}
            </p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-slate-400">
              {errored
                ? 'The explorer API didn’t respond. Retrying every 10 seconds.'
                : 'Disputes raised on the platform appear here and update live as validators reach consensus.'}
            </p>
            <Link href="/#categories" className="btn-primary mt-5 inline-flex px-4 py-2 text-sm">
              Raise a dispute
            </Link>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {rows.map((row) => (
              <motion.div
                key={row.hash}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Row row={row} glass={glass} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
