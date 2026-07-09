'use client';

import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

const PROOFS = [
  {
    icon: '🤖',
    label: '5 AI validators',
    sub: 'independent LLM verdicts per case',
    tint: 'from-violet-500/25 to-purple-500/10',
    glow: 'rgba(139,92,246,0.35)',
  },
  {
    icon: '📌',
    label: 'Evidence on IPFS',
    sub: 'tamper-proof & permanent',
    tint: 'from-cyan-400/25 to-sky-500/10',
    glow: 'rgba(34,211,238,0.35)',
  },
  {
    icon: '⛓',
    label: '100% on-chain',
    sub: 'auditable, irreversible settlement',
    tint: 'from-pink-500/25 to-rose-500/10',
    glow: 'rgba(236,72,153,0.35)',
  },
  {
    icon: '⚡',
    label: 'Minutes, not months',
    sub: 'consensus without middlemen',
    tint: 'from-orange-400/25 to-amber-400/10',
    glow: 'rgba(251,146,60,0.35)',
  },
];

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * Animated proof-point bar docked at the hero's bottom edge: four qualitative
 * trust signals (the live numbers live in PlatformStats) plus a scroll cue.
 * Items cascade in on first view and lift on hover.
 */
export default function HeroBottomBar() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.09, delayChildren: 0.35 } },
      }}
      className="container-page flex flex-wrap items-center justify-between gap-x-8 gap-y-5"
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
        {PROOFS.map((p) => (
          <motion.div
            key={p.label}
            variants={item}
            whileHover={reduce ? undefined : { y: -4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="group flex items-center gap-3"
          >
            <span
              className={`grid h-11 w-11 place-items-center rounded-xl border border-slate-900/10 bg-gradient-to-br text-lg backdrop-blur-sm transition-shadow duration-300 group-hover:shadow-[0_8px_24px_var(--glow)] dark:border-white/15 ${p.tint}`}
              style={{ '--glow': p.glow } as React.CSSProperties}
            >
              {p.icon}
            </span>
            <span>
              <span className="block font-cabin text-sm font-semibold text-slate-900 dark:text-white">
                {p.label}
              </span>
              <span className="block text-xs text-slate-500 dark:text-white/55">{p.sub}</span>
            </span>
          </motion.div>
        ))}
      </div>

      {/* Scroll cue - invites the reader down to the category cards. */}
      <motion.div variants={item} className="hidden lg:block">
        <Link
          href="#categories"
          className="group flex items-center gap-2.5 text-sm font-medium text-slate-500 transition-colors duration-300 hover:text-slate-900 dark:text-white/50 dark:hover:text-white"
        >
          Scroll to explore
          <span className="grid h-8 w-8 place-items-center rounded-full border border-slate-900/15 bg-white/40 backdrop-blur transition-colors duration-300 group-hover:border-brand/50 dark:border-white/20 dark:bg-white/5">
            <motion.span
              aria-hidden
              animate={reduce ? undefined : { y: [0, 3, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              ↓
            </motion.span>
          </span>
        </Link>
      </motion.div>
    </motion.div>
  );
}
