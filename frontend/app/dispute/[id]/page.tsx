'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import ConsensusTracker from '@/components/ConsensusTracker';
import VerdictCard, { type Verdict } from '@/components/VerdictCard';
import FraudAlert from '@/components/FraudAlert';
import { CATEGORIES, explorerTx, type Category } from '@/lib/contracts';

export default function DisputePage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = decodeURIComponent(params.id);
  const category = (search.get('category') || '') as Category | '';
  const txHash = search.get('tx') || '';
  const meta = category && CATEGORIES[category] ? CATEGORIES[category] : null;

  const [status, setStatus] = useState<string>('SUBMITTED');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [submitter, setSubmitter] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const markedRef = useRef(false);

  const poll = useCallback(async () => {
    // 1. Transaction status (drives the consensus tracker).
    if (txHash) {
      try {
        const r = await fetch(`/api/tx?hash=${encodeURIComponent(txHash)}`);
        const d = await r.json();
        if (d.status) setStatus(d.status);
      } catch {
        /* keep last status */
      }
    }
    // 2. Verdict (once resolved).
    try {
      const r = await fetch(
        `/api/verdict/${encodeURIComponent(id)}?category=${encodeURIComponent(category)}`,
      );
      const d = await r.json();
      if (d.verdict) {
        setVerdict(d.verdict);
        if (d.record?.submitter) setSubmitter(d.record.submitter); // 3. Once the specialist has a resolved verdict, mark it resolved in the
        // registry (idempotent) so platform stats stay accurate. Fire once.
        const isResolved = d.verdict?.resolved === true && !d.verdict?.error;
        if (isResolved && !markedRef.current) {
          markedRef.current = true;
          fetch('/api/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disputeId: id }),
          }).catch(() => {
            markedRef.current = false; // allow retry on failure
          });
        }
      }
    } catch {
      /* not resolved yet */
    }
  }, [id, category, txHash]);

  useEffect(() => {
    poll();
    const t = setInterval(() => {
      // Stop polling once the verdict is finalized - nothing more will change.
      if (verdict?.resolved && !verdict?.error) {
        clearInterval(t);
        return;
      }
      if (!document.hidden) poll(); // skip ticks while the tab is backgrounded
    }, 10000);
    return () => clearInterval(t);
  }, [poll, verdict?.resolved, verdict?.error]);

  function copyId() {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="bg-grid min-h-screen">
      <div className="container-page max-w-4xl py-12">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand"
        >
          ← Back home
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="card overflow-hidden"
        >
          <div
            className={`relative bg-gradient-to-r ${
              meta?.gradient ?? 'from-brand to-violet-500'
            } px-6 py-6 text-white sm:px-8`}
          >
            <div className="pointer-events-none absolute inset-0 opacity-25 [background:radial-gradient(400px_circle_at_90%_-20%,white,transparent)]" />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                  {meta ? `${meta.title} dispute` : 'Dispute'}
                </p>
                <p className="mt-1 break-all font-mono text-sm font-medium">{id}</p>
              </div>
              <button
                type="button"
                onClick={copyId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3.5 py-2 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/30"
              >
                {copied ? 'Copied ✓' : 'Copy ID'}
              </button>
            </div>
          </div>

          {txHash && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-surface-border px-6 py-3 text-xs text-slate-400 sm:px-8">
              <span>Tx hash:</span>
              <span className="break-all font-mono text-slate-600">{txHash}</span>
              <a
                href={explorerTx(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-brand transition-colors hover:text-brand/80"
              >
                View on explorer
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
                  <path
                    d="M7 17 17 7M9 7h8v8"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          )}
        </motion.div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <ConsensusTracker status={status} />
          <VerdictCard verdict={verdict} />
        </div>

        {/* Fraud flag badge for the disputant (if any). */}
        {submitter && (
          <div className="mt-6">
            <FraudAlert address={submitter} />
          </div>
        )}

        {/* Appeal CTA - visible once a verdict is resolved (window is enforced
            on the appeals page itself). */}
        {verdict?.resolved && !verdict?.error && (
          <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <p className="text-sm font-semibold text-slate-800">Disagree with this verdict?</p>
              <p className="text-sm text-slate-500">
                You can appeal within 7 days - a larger validator panel re-evaluates.
              </p>
            </div>
            <Link
              href={`/appeals/${encodeURIComponent(id)}?category=${category}`}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              Appeal this verdict
            </Link>
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Refreshing every 10 seconds while validators reach consensus
        </p>
      </div>
    </div>
  );
}
