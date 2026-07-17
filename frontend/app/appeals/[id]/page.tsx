'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import AppealForm, { type AppealSubmitPayload } from '@/components/AppealForm';
import { CATEGORIES, type Category } from '@/lib/contracts';
import { trackerFetch, invalidateTracker } from '@/lib/trackerClient';

const APPEAL_WINDOW_DAYS = 7;
const BASE_VALIDATORS = 3;
const EXTRA_VALIDATORS_PER_ROUND = 2;

interface DisputeRecord {
  dispute_id: string;
  category: string;
  submitter: string;
  timestamp: number;
  resolved: boolean;
}

interface AppealRecord {
  appeal_id: string;
  appeal_status: string;
  appeal_reason: string;
  appeal_submitted_at: number;
  appeal_verdict: string;
  new_consensus_round: number;
  validators_this_round: number;
  original_refund_pct: number;
  appeal_refund_pct: number;
}

/** The specialist judge's on-chain AppealOutcome for one consensus round. */
interface RoundOutcome {
  round_no: number;
  tolerance?: number;
  original_verdict?: string;
  appeal_verdict?: string;
  original_refund_pct?: number;
  appeal_refund_pct?: number;
  original_trust_score?: number;
  appeal_trust_score?: number;
  overturned?: boolean;
  resolved: boolean;
}

function daysRemaining(verdictAt: number): number {
  if (!verdictAt) return 0;
  const elapsed = Date.now() / 1000 - verdictAt;
  return Math.max(0, APPEAL_WINDOW_DAYS - Math.floor(elapsed / 86400));
}

function validatorsForRound(round: number): number {
  return BASE_VALIDATORS + EXTRA_VALIDATORS_PER_ROUND * Math.max(1, round);
}

export default function AppealPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const disputeId = decodeURIComponent(params.id);
  const category = (search.get('category') || '') as Category | '';

  const [record, setRecord] = useState<DisputeRecord | null>(null);
  const [verdict, setVerdict] = useState<any>(null);
  const [appeals, setAppeals] = useState<AppealRecord[]>([]);
  const [outcomes, setOutcomes] = useState<Record<number, RoundOutcome>>({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, a] = await Promise.all([
        fetch(
          `/api/verdict/${encodeURIComponent(disputeId)}?category=${encodeURIComponent(category)}`,
        ).then((r) => r.json()),
        trackerFetch('appeals', { disputeId }),
      ]);
      if (v?.record) setRecord(v.record);
      if (v?.verdict) setVerdict(v.verdict);
      const list: AppealRecord[] = Array.isArray(a?.appeals) ? a.appeals : [];
      setAppeals(list);

      // For every finalized round, read the specialist's round-bound outcome
      // (the same authenticated record finalize_appeal_from_state consumed).
      const finalized = list.filter((x) => x.appeal_status === 'FINALIZED');
      const fetched = await Promise.all(
        finalized.map((x) =>
          trackerFetch('appeal_outcome', {
            disputeId,
            round: x.new_consensus_round,
          }).catch(() => null),
        ),
      );
      const byRound: Record<number, RoundOutcome> = {};
      finalized.forEach((x, i) => {
        if (fetched[i]?.resolved) byRound[x.new_consensus_round] = fetched[i];
      });
      setOutcomes(byRound);
    } finally {
      setLoading(false);
    }
  }, [disputeId, category]);

  useEffect(() => {
    load();
  }, [load]);

  const verdictAt = record?.timestamp ?? 0;
  const remaining = daysRemaining(verdictAt);
  const windowOpen = remaining > 0;
  const originalRefund =
    typeof verdict?.refund_percentage === 'number' ? verdict.refund_percentage : 0;

  const sorted = [...appeals].sort((a, b) => b.new_consensus_round - a.new_consensus_round);
  const open = sorted.find((a) => a.appeal_status !== 'FINALIZED');
  const lastRound = sorted.length ? sorted[0].new_consensus_round : 0;
  const nextRound = lastRound + 1;
  const canEscalate = windowOpen && !open;
  // An escalation appeals the PREVIOUS round's outcome, so its refund baseline
  // is the latest finalized round's refund, not the original verdict's.
  const lastFinalized = sorted.find((a) => a.appeal_status === 'FINALIZED');
  const baselineRefund = lastFinalized ? lastFinalized.appeal_refund_pct : originalRefund;

  async function handleSubmit(payload: AppealSubmitPayload) {
    const reason = payload.details ? `${payload.reason}: ${payload.details}` : payload.reason;
    const res = await fetch('/api/appeal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disputeId,
        appellant: record?.submitter || '',
        originalVerdictAt: verdictAt,
        originalRefundPct: baselineRefund,
        partyA: record?.submitter || '',
        partyB: '',
        reason,
        evidenceUrl: payload.evidenceUrl,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    setSubmitted(true);
    // Drop the cached (stale) appeals list so the reload shows the new round.
    invalidateTracker('appeals', { disputeId });
    setTimeout(load, 1500);
  }

  /** Run the state-derived re-review: specialist.resolve_appeal for this exact
   *  round, then appeal_manager.finalize_appeal_from_state reads the
   *  round-bound outcome back. No verdict is ever supplied off-chain. */
  async function handleResolve() {
    if (!open) return;
    setResolving(true);
    setResolveError('');
    try {
      const res = await fetch('/api/appeal/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId,
          appealId: open.appeal_id,
          round: open.new_consensus_round,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      invalidateTracker('appeals', { disputeId });
      invalidateTracker('appeal_outcome', { disputeId, round: open.new_consensus_round });
      await load();
    } catch (err: any) {
      setResolveError(err?.message || 'On-chain re-review failed');
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="bg-grid min-h-screen">
      <div className="container-page max-w-3xl py-12">
        <Link
          href={`/dispute/${encodeURIComponent(disputeId)}?category=${category}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand"
        >
          ← Back to dispute
        </Link>

        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Appeal verdict for <span className="break-all font-mono text-brand">{disputeId}</span>
        </h1>

        {loading && <div className="card mt-6 p-8 text-center text-slate-400">Loading…</div>}

        {!loading && (
          <div className="mt-6 space-y-6">
            {/* Card 1: Original verdict */}
            <div className="card p-6">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Original verdict</h2>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Category</span>
                  <span className="font-medium text-slate-800">
                    {record?.category
                      ? CATEGORIES[record.category as Category]?.title || record.category
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Verdict</span>
                  <span className="font-medium text-slate-800">
                    {verdict?.verdict?.replaceAll('_', ' ') || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Refund given</span>
                  <span className="font-medium text-slate-800">{originalRefund}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Finalized</span>
                  <span className="font-medium text-slate-800">
                    {verdictAt ? format(new Date(verdictAt * 1000), 'MMM d, yyyy') : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Round history: every appeal, newest round first, each bound to
                its own on-chain consensus outcome. */}
            {sorted.map((a) => {
              const outcome = outcomes[a.new_consensus_round];
              const isOpen = a.appeal_status !== 'FINALIZED';
              return (
                <div key={a.appeal_id} className="card p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-700">
                      Appeal round {a.new_consensus_round}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        a.appeal_status === 'FINALIZED'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {a.appeal_status}
                    </span>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Appeal ID</span>
                      <span className="font-mono text-xs text-slate-700">{a.appeal_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Submitted</span>
                      <span className="font-medium text-slate-800">
                        {a.appeal_submitted_at
                          ? format(new Date(a.appeal_submitted_at * 1000), 'MMM d, yyyy HH:mm')
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Consensus panel</span>
                      <span className="font-medium text-slate-800">
                        {a.validators_this_round} validators (vs original 3)
                      </span>
                    </div>
                    {a.appeal_status === 'FINALIZED' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Refund before round</span>
                          <span className="font-medium text-slate-800">
                            {a.original_refund_pct}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Refund after round</span>
                          <span className="font-medium text-slate-800">{a.appeal_refund_pct}%</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* The specialist's authenticated outcome for exactly this
                      round — the record finalize_appeal_from_state consumed. */}
                  {outcome && (
                    <div className="mt-4 rounded-xl bg-surface-subtle px-4 py-3 text-sm">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="font-semibold text-slate-700">
                          On-chain consensus outcome
                        </span>
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                          round {outcome.round_no}
                        </span>
                      </div>
                      <div className="grid gap-1.5">
                        <div className="flex justify-between">
                          <span className="text-slate-500">New verdict</span>
                          <span className="font-medium text-slate-800">
                            {outcome.appeal_verdict?.replaceAll('_', ' ') || '-'}
                          </span>
                        </div>
                        {typeof outcome.tolerance === 'number' && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Agreement bar</span>
                            <span className="font-medium text-slate-800">
                              ±{outcome.tolerance}
                              {outcome.tolerance === 0 ? ' (exact match)' : ''}
                            </span>
                          </div>
                        )}
                        {typeof outcome.appeal_trust_score === 'number' && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Trust score</span>
                            <span className="font-medium text-slate-800">
                              {outcome.original_trust_score} → {outcome.appeal_trust_score}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-center font-semibold">
                        {outcome.overturned
                          ? '✅ Original verdict overturned by the larger panel'
                          : 'Original verdict upheld by the larger panel'}
                      </div>
                      <p className="mt-2 text-center text-[11px] text-slate-400">
                        Derived from the judge&apos;s own stored evidence via a fresh validator
                        round — no off-chain party supplied this verdict.
                      </p>
                    </div>
                  )}

                  {/* Trigger the round-bound state-derived re-review. */}
                  {isOpen && (
                    <div className="mt-4">
                      <button
                        onClick={handleResolve}
                        disabled={resolving}
                        className="w-full rounded-xl bg-gradient-to-r from-brand to-violet-500 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {resolving
                          ? `Re-running consensus on-chain (round ${a.new_consensus_round})…`
                          : `Run on-chain re-review (${a.validators_this_round} validators)`}
                      </button>
                      {resolveError && (
                        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                          {resolveError}
                        </p>
                      )}
                      <p className="mt-2 text-center text-[11px] text-slate-400">
                        The judge re-evaluates its stored evidence with a stricter agreement bar
                        and the appeal finalizes from that round-bound on-chain state.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Appeal window + form: first appeal, or escalation to the next
                round once the previous one is finalized. */}
            {!open && (
              <>
                <div className="card p-6">
                  <h2 className="mb-2 text-sm font-semibold text-slate-700">Appeal window</h2>
                  <p className="text-sm text-slate-500">
                    Days remaining to appeal:{' '}
                    <span
                      className={`font-bold ${windowOpen ? 'text-emerald-600' : 'text-rose-500'}`}
                    >
                      {remaining}/{APPEAL_WINDOW_DAYS}
                    </span>
                  </p>
                  {!windowOpen && (
                    <p className="mt-2 text-sm text-rose-500">
                      The 7-day appeal window has closed for this verdict.
                    </p>
                  )}
                </div>

                {canEscalate && (
                  <div className="card p-6">
                    <h2 className="mb-4 text-sm font-semibold text-slate-700">
                      {lastRound === 0
                        ? 'File an appeal'
                        : `Escalate to appeal round ${nextRound}`}
                    </h2>
                    {submitted ? (
                      <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        ✓ Appeal submitted. Refreshing status…
                      </p>
                    ) : (
                      <AppealForm
                        disputeId={disputeId}
                        onSubmit={handleSubmit}
                        validatorCount={validatorsForRound(nextRound)}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
