'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { getChainInfo } from '@/lib/contracts';

const VALIDATORS = [
  { color: '#a78bfa', delay: 0 },
  { color: '#22d3ee', delay: 0.15 },
  { color: '#ec4899', delay: 0.3 },
  { color: '#fb923c', delay: 0.45 },
  { color: '#a3e635', delay: 0.6 },
];

function GlassCard({
  children,
  className = '',
  delay = 0,
  floatDuration = 6,
  tilt = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  floatDuration?: number;
  tilt?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24, rotate: tilt }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      <div
        className="float-soft rounded-2xl border border-slate-900/10 bg-[rgba(255,255,255,0.7)] p-4 shadow-lift backdrop-blur-md dark:border-white/15 dark:bg-white/[0.07]"
        style={{ animationDuration: `${floatDuration}s`, animationDelay: `${delay}s` }}
      >
        {children}
      </div>
    </motion.div>
  );
}

/**
 * Decorative floating UI cards on the hero's right flank - a freshly resolved
 * case above live validator consensus. Purely illustrative (sample data),
 * pointer-events disabled, and hidden below ~1280px so they never crowd the
 * left-aligned headline.
 */
export default function HeroSideCards() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] hidden xl:block">
      {/* RIGHT - resolved case card + live consensus card */}
      <div className="absolute right-10 top-1/2 w-72 -translate-y-1/2 space-y-6 min-[1500px]:right-20">
        <GlassCard delay={0.5} tilt={-3} floatDuration={6.5} className="-ml-10 w-64">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/25 dark:text-violet-200">
              🏠 Rental case
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Resolved
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            “Listing not as described”
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-white/60">
            4 photos + inspection report · pinned to IPFS
          </p>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-400/15 px-3 py-2">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
              ✓ Refund approved
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">82%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"
              initial={{ width: 0 }}
              animate={{ width: '82%' }}
              transition={{ duration: 1.2, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </GlassCard>

        <GlassCard delay={0.65} tilt={3} floatDuration={7}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/70">
              Validator consensus
            </span>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pop-cyan opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-pop-cyan" />
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {VALIDATORS.map((v, i) => (
              <span
                key={i}
                className="validator-pulse grid h-9 w-9 place-items-center rounded-full border border-slate-900/10 text-[11px] font-bold dark:border-white/20"
                style={{ background: `${v.color}33`, animationDelay: `${v.delay}s` }}
              >
                <span style={{ color: v.color }}>✓</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-white/60">
            5 of 5 independent LLM verdicts agree
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            Consensus reached in <span className="text-gradient-pop">94s</span>
          </p>
        </GlassCard>

        <GlassCard delay={0.85} tilt={2} floatDuration={5} className="-ml-6 w-56">
          <p className="text-xs font-medium text-slate-700 dark:text-white/80">
            ⛓ Sealed at block{' '}
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              #2,841,022
            </span>
          </p>
          <p className="mt-1 text-[10px] text-slate-400 dark:text-white/40">
            {getChainInfo().name} · immutable
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
