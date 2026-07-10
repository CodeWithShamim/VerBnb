'use client';

import { useMemo, useState } from 'react';
import type { Verdict } from './VerdictCard';

/**
 * Compact share row for a resolved verdict: tweet intent, copy link and a
 * downloadable OG card (/api/og) with a live preview.
 */
export default function ShareVerdict({
  id,
  category,
  verdict,
}: {
  id: string;
  category: string;
  verdict: Verdict;
}) {
  const [copied, setCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const ogPath = useMemo(() => {
    const params = new URLSearchParams({ id, category });
    if (verdict.verdict) params.set('verdict', verdict.verdict);
    if (typeof verdict.refund_percentage === 'number')
      params.set('refund', String(verdict.refund_percentage));
    if (typeof verdict.trust_score === 'number')
      params.set('trust', String(verdict.trust_score));
    const summary = verdict.summary || verdict.reasoning;
    if (summary) params.set('summary', summary.slice(0, 140));
    return `/api/og?${params.toString()}`;
  }, [id, category, verdict]);

  const disputeUrl = () =>
    `${window.location.origin}/dispute/${encodeURIComponent(id)}?category=${encodeURIComponent(
      category,
    )}`;

  const shareOnX = () => {
    const outcome =
      typeof verdict.refund_percentage === 'number'
        ? `${verdict.refund_percentage}% refund`
        : (verdict.verdict || 'verdict reached').replaceAll('_', ' ').toLowerCase();
    const text = `AI validators resolved my ${category.toLowerCase()} dispute on @VerBnb — ${outcome}, settled on-chain. ${disputeUrl()}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(disputeUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) - ignore.
    }
  };

  const btn =
    'inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-subtle px-3.5 py-1.5 font-manrope text-xs font-semibold text-slate-600 transition-all duration-200 hover:border-brand/40 hover:text-brand dark:text-slate-300';

  return (
    <div className="mt-5 border-t border-surface-border pt-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Share this verdict
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={shareOnX} className={btn}>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Z" />
          </svg>
          Share on X
        </button>

        <button type="button" onClick={copyLink} className={btn}>
          {copied ? (
            <svg
              viewBox="0 0 20 20"
              className="h-3.5 w-3.5 fill-none stroke-emerald-500 stroke-2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m4 10.5 4 4 8-9" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 20 20"
              className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.6]"
              aria-hidden="true"
            >
              <rect x="7" y="7" width="9" height="9" rx="2" />
              <path d="M13 7V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h1" />
            </svg>
          )}
          {copied ? 'Copied' : 'Copy link'}
        </button>

        <a href={ogPath} target="_blank" rel="noopener noreferrer" download className={btn}>
          <svg
            viewBox="0 0 20 20"
            className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.6]"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 16h12" />
          </svg>
          Download card
        </a>
      </div>

      {!imgFailed && (
        <div className="relative mt-3 overflow-hidden rounded-xl border border-surface-border">
          {!imgLoaded && (
            <div className="absolute inset-0 animate-pulse bg-surface-muted" aria-hidden="true" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ogPath}
            alt={`Shareable verdict card for dispute ${id}`}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
            className={`aspect-[1200/630] w-full object-cover transition-opacity duration-300 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      )}
    </div>
  );
}
