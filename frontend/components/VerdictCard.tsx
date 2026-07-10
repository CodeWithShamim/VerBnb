'use client';

import { motion } from 'framer-motion';
import TrustScoreBadge from './TrustScoreBadge';
import ReputationBadge from './ReputationBadge';
import ShareVerdict from './ShareVerdict';

export interface Verdict {
  resolved?: boolean;
  verdict?: string;
  refund_percentage?: number;
  refund_due?: boolean;
  trust_score?: number;
  claim_supported?: boolean;
  reasoning?: string;
  summary?: string;
  order_id?: string;
  claimed_amount?: number;
  error?: string;
}

const POSITIVE = ['REFUND_GRANTED', 'NOT_DELIVERED', 'WRONG_ADDRESS', 'VERIFIED'];

function tone(verdict?: string) {
  if (!verdict) return 'border-surface-border bg-surface-subtle text-slate-600';
  if (verdict === 'DELIVERED' || verdict === 'DISPUTE_REJECTED')
    return 'border-rose-200 bg-rose-50 text-rose-600';
  if (POSITIVE.includes(verdict)) return 'border-emerald-200 bg-emerald-50 text-emerald-600';
  return 'border-amber-200 bg-amber-50 text-amber-600';
}

export default function VerdictCard({
  verdict,
  disputant,
  counterparty,
  consensusRate,
  disputeId,
  category,
}: {
  verdict: Verdict | null;
  disputant?: string;
  counterparty?: string;
  consensusRate?: number;
  /** Optional - when provided along with `category`, share actions render. */
  disputeId?: string;
  category?: string;
}) {
  if (!verdict || verdict.error) {
    return (
      <div className="card flex min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
        </span>
        <p className="text-sm text-slate-500">
          {verdict?.error
            ? 'No verdict recorded yet for this dispute.'
            : 'Awaiting verdict - validators are still reaching consensus.'}
        </p>
      </div>
    );
  }

  const hasRefundPct = typeof verdict.refund_percentage === 'number';
  const hasTrust = typeof verdict.trust_score === 'number';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="card p-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Verdict</h3>
        {verdict.resolved ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Resolved
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
            Pending
          </span>
        )}
      </div>

      {verdict.verdict && (
        <div
          className={`mt-4 inline-block rounded-xl border px-4 py-2.5 text-lg font-bold ${tone(
            verdict.verdict,
          )}`}
        >
          {verdict.verdict.replaceAll('_', ' ')}
        </div>
      )}

      {hasRefundPct && (
        <div className="mt-6">
          <div className="flex items-end justify-between">
            <span className="text-sm text-slate-500">Recommended refund</span>
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {verdict.refund_percentage}%
            </span>
          </div>
          <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand to-violet-500"
              initial={{ width: 0 }}
              animate={{
                width: `${Math.max(0, Math.min(100, verdict.refund_percentage!))}%`,
              }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {hasTrust && (
        <div className="mt-6">
          <TrustScoreBadge score={verdict.trust_score!} />
        </div>
      )}

      {typeof verdict.refund_due === 'boolean' && (
        <div className="mt-5 flex items-center justify-between rounded-xl bg-surface-subtle px-4 py-3 text-sm">
          <span className="text-slate-500">Refund due</span>
          <span
            className={`font-semibold ${verdict.refund_due ? 'text-emerald-600' : 'text-rose-500'}`}
          >
            {verdict.refund_due ? 'Yes' : 'No'}
          </span>
        </div>
      )}

      {(verdict.reasoning || verdict.summary) && (
        <div className="mt-5 rounded-xl border border-surface-border bg-surface-subtle p-4 text-sm leading-relaxed text-slate-600">
          {verdict.reasoning || verdict.summary}
        </div>
      )}

      {typeof consensusRate === 'number' && (
        <div className="mt-5 flex items-center justify-between rounded-xl bg-surface-subtle px-4 py-3 text-sm">
          <span className="text-slate-500">Validators agree</span>
          <span className="font-semibold text-emerald-600">{consensusRate}%</span>
        </div>
      )}

      {(disputant || counterparty) && (
        <div className="mt-5 flex flex-wrap items-center gap-6 border-t border-surface-border pt-5">
          {disputant && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Disputant</p>
              <ReputationBadge address={disputant} size="small" />
            </div>
          )}
          {counterparty && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Counterparty</p>
              <ReputationBadge address={counterparty} size="small" />
            </div>
          )}
        </div>
      )}

      {verdict.resolved && !verdict.error && disputeId && category && (
        <ShareVerdict id={disputeId} category={category} verdict={verdict} />
      )}
    </motion.div>
  );
}
