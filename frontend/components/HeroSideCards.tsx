"use client";

import { motion, useReducedMotion } from "framer-motion";

const VALIDATORS = [
  { color: "#a78bfa", delay: 0 },
  { color: "#22d3ee", delay: 0.15 },
  { color: "#ec4899", delay: 0.3 },
  { color: "#fb923c", delay: 0.45 },
  { color: "#a3e635", delay: 0.6 },
];

function GlassCard({
  children,
  className = "",
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
      <motion.div
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: floatDuration, repeat: Infinity, ease: "easeInOut", delay }}
        className="rounded-2xl border border-slate-900/10 bg-[rgba(255,255,255,0.7)] p-4 shadow-lift backdrop-blur-md dark:border-white/15 dark:bg-white/[0.07]"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/**
 * Decorative floating UI cards flanking the hero headline — a freshly resolved
 * case on the left, live validator consensus on the right. Purely illustrative
 * (sample data), pointer-events disabled, and hidden below ~1400px so they
 * never crowd the headline.
 */
export default function HeroSideCards() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[5] hidden min-[1400px]:block"
    >
      {/* LEFT — resolved case card + IPFS chip */}
      <div className="absolute left-8 top-1/2 w-64 -translate-y-1/2 space-y-5">
        <GlassCard delay={0.5} tilt={-4} floatDuration={6.5}>
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
              animate={{ width: "82%" }}
              transition={{ duration: 1.2, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </GlassCard>

        <GlassCard delay={0.75} tilt={-2} floatDuration={5.5} className="ml-8 w-52">
          <p className="text-xs font-medium text-slate-700 dark:text-white/80">
            📌 Evidence sealed on <span className="font-semibold text-slate-900 dark:text-white">IPFS</span>
          </p>
          <p className="mt-1 truncate font-mono text-[10px] text-slate-400 dark:text-white/40">
            bafkreihc6ramgg7qgyyeeb3lhkp…
          </p>
        </GlassCard>
      </div>

      {/* RIGHT — live consensus card + block chip */}
      <div className="absolute right-8 top-1/2 w-64 -translate-y-1/2 space-y-5">
        <GlassCard delay={0.6} tilt={4} floatDuration={7}>
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
              <motion.span
                key={i}
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-900/10 text-[11px] font-bold dark:border-white/20"
                style={{ background: `${v.color}33` }}
                animate={{ scale: [1, 1.12, 1] }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: v.delay,
                }}
              >
                <span style={{ color: v.color }}>✓</span>
              </motion.span>
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
            ⛓ Sealed at block{" "}
            <span className="font-mono font-semibold text-slate-900 dark:text-white">#2,841,022</span>
          </p>
          <p className="mt-1 text-[10px] text-slate-400 dark:text-white/40">
            GenLayer Bradbury · immutable
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
