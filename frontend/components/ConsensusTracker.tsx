'use client';

import { motion } from 'framer-motion';
import { ValidatorOrb3D } from '@/components/3d';

const PHASES = [
  { key: 'SUBMITTED', label: 'Submitted', desc: 'Transaction broadcast' },
  {
    key: 'PROPOSING',
    label: 'Proposing',
    desc: 'Leader fetches evidence + LLM verdict',
  },
  { key: 'COMMITTING', label: 'Committing', desc: 'Validators commit votes' },
  {
    key: 'REVEALING',
    label: 'Revealing',
    desc: 'Votes revealed, consensus checked',
  },
  { key: 'FINALIZED', label: 'Finalized', desc: 'Verdict settled on-chain' },
] as const;

export type Phase = (typeof PHASES)[number]['key'];

// Maps a GenLayer transaction status to a tracker phase index.
export function phaseFromStatus(status?: string): number {
  switch ((status || '')?.toUpperCase()) {
    case 'PENDING':
    case 'ACTIVATED':
    case 'PROPOSING':
      return 1;
    case 'COMMITTING':
      return 2;
    case 'REVEALING':
      return 3;
    case 'ACCEPTED':
    case 'FINALIZED':
    case 'UNDETERMINED':
      return 4;
    default:
      return 0;
  }
}

export default function ConsensusTracker({ status }: { status?: string }) {
  const active = phaseFromStatus(status);
  // Show the animated 3D orb only while consensus is actively in flight
  // (proposing → committing → revealing). Idle/finalized states skip it.
  const inFlight = active >= 1 && active <= 3;
  const phaseKey = PHASES[active]?.key ?? 'SUBMITTED';
  return (
    <div className="card p-6">
      <h3 className="mb-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Consensus
      </h3>

      {inFlight && (
        <div className="mb-6">
          <ValidatorOrb3D phase={phaseKey} />
          <p className="mt-2 text-center text-xs font-medium text-slate-400">
            Validators reaching consensus…
          </p>
        </div>
      )}

      <ol className="relative space-y-1">
        {PHASES.map((p, i) => {
          const done = i < active;
          const current = i === active;
          const isLast = i === PHASES.length - 1;
          return (
            <li key={p.key} className="relative flex gap-3.5 pb-5 last:pb-0">
              {/* connector line */}
              {!isLast && (
                <span className="absolute left-[13px] top-7 h-[calc(100%-12px)] w-0.5 -translate-x-1/2 bg-surface-muted">
                  <motion.span
                    className="block w-full rounded-full bg-gradient-to-b from-emerald-400 to-teal-500"
                    initial={{ height: 0 }}
                    animate={{ height: done ? '100%' : 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </span>
              )}

              <span
                className={[
                  'relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors',
                  done
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-600'
                    : current
                      ? 'animate-pulse-ring border-brand bg-brand text-white'
                      : 'border-surface-border bg-white text-slate-400',
                ].join(' ')}
              >
                {done ? '✓' : i + 1}
              </span>

              <div className="pt-0.5">
                <p
                  className={
                    current
                      ? 'font-semibold text-slate-900'
                      : done
                        ? 'font-medium text-slate-700'
                        : 'text-slate-400'
                  }
                >
                  {p.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{p.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex items-center justify-between rounded-lg bg-surface-subtle px-3 py-2 text-xs">
        <span className="text-slate-400">Status</span>
        <span className="font-mono font-medium text-slate-600">{status || '-'}</span>
      </div>
    </div>
  );
}
