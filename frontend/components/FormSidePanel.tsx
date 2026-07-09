'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { CATEGORIES, type Category } from '@/lib/contracts';
import { CategoryIconWith3D } from '@/components/3d';

const STEPS = [
  {
    title: 'Pin your evidence',
    body: 'Photos and reports are uploaded to IPFS - tamper-proof and fetchable by every validator.',
  },
  {
    title: 'Validators judge independently',
    body: 'Each GenLayer validator fetches the evidence and asks an LLM for its own verdict.',
  },
  {
    title: 'Consensus settles on-chain',
    body: 'Verdicts converge within tolerance and the outcome is written immutably to the chain.',
  },
];

const CHECKLIST = [
  'A public listing or claim URL validators can open',
  'Evidence photos, reports or receipts (we pin them to IPFS)',
  'A couple of minutes - consensus usually lands fast',
];

/**
 * Sticky context panel for the dispute forms - category-tinted glow card with
 * the floating 3D badge, the resolution timeline, a what-you'll-need checklist
 * and a live-network footer.
 */
export default function FormSidePanel({ category }: { category: Category }) {
  const meta = CATEGORIES[category];
  const reduce = useReducedMotion();

  return (
    <motion.aside
      initial={reduce ? false : { opacity: 0, x: -32 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="lg:sticky lg:top-24"
    >
      <div className="glow-border relative overflow-hidden rounded-3xl">
        <div className="hero-canvas relative rounded-3xl p-7 sm:p-8">
          {/* drifting accent blobs */}
          <div
            className="aurora-blob -right-16 -top-16 h-56 w-56"
            style={{ background: `radial-gradient(circle, ${meta.accent}, transparent 70%)` }}
          />
          <div
            className="aurora-blob -bottom-14 -left-14 h-44 w-44"
            style={{
              background: 'radial-gradient(circle, #ec4899, transparent 70%)',
              animationDelay: '-8s',
            }}
          />

          <div className="relative">
            {/* header: 3D badge + judge identity */}
            <div className="flex items-center gap-4">
              <motion.div
                animate={reduce ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="grid h-[72px] w-[72px] shrink-0 place-items-center"
              >
                <CategoryIconWith3D
                  category={category}
                  size={72}
                  fallback={
                    <span
                      className="grid h-14 w-14 place-items-center rounded-2xl text-2xl"
                      style={{ background: `${meta.accent}22`, color: meta.accent }}
                    >
                      ⚖️
                    </span>
                  }
                />
              </motion.div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/50">
                  {meta.title} judge
                </p>
                <p className="mt-1 font-serif-hero text-xl leading-snug text-slate-900 dark:text-white">
                  {meta.tagline}
                </p>
              </div>
            </div>

            <div className="my-6 h-px bg-slate-900/10 dark:bg-white/10" />

            {/* resolution timeline */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/50">
              How your case resolves
            </p>
            <motion.ol
              initial={reduce ? false : 'hidden'}
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.14, delayChildren: 0.6 } } }}
              className="relative mt-4 space-y-5 border-l border-slate-900/15 pl-5 dark:border-white/15"
            >
              {STEPS.map((s, i) => (
                <motion.li
                  key={s.title}
                  variants={{
                    hidden: { opacity: 0, x: 16 },
                    show: {
                      opacity: 1,
                      x: 0,
                      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                    },
                  }}
                  className="relative"
                >
                  <span
                    className="absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-slate-900/10 dark:ring-white/10"
                    style={{
                      background: meta.accent,
                      boxShadow: `0 0 12px ${meta.accent}`,
                    }}
                  />
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    <span className="mr-1.5 text-slate-400 dark:text-white/40">0{i + 1}</span>
                    {s.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-white/60">
                    {s.body}
                  </p>
                </motion.li>
              ))}
            </motion.ol>

            <div className="my-6 h-px bg-slate-900/10 dark:bg-white/10" />

            {/* what you'll need */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/50">
              What you&apos;ll need
            </p>
            <ul className="mt-3 space-y-2.5">
              {CHECKLIST.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-white/70"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    style={{ color: meta.accent }}
                  >
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            {/* live-network footer */}
            <div className="mt-7 flex items-center justify-between rounded-xl border border-slate-900/10 bg-white/40 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <span className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-white/80">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                GenLayer Bradbury
              </span>
              <span className="text-[11px] text-slate-400 dark:text-white/50">
                5 validators · live
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
