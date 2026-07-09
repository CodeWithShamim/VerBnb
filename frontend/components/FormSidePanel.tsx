"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CATEGORIES, type Category } from "@/lib/contracts";
import { CategoryIconWith3D } from "@/components/3d";

const STEPS = [
  {
    title: "Pin your evidence",
    body: "Photos and reports are uploaded to IPFS — tamper-proof and fetchable by every validator.",
  },
  {
    title: "Validators judge independently",
    body: "Each GenLayer validator fetches the evidence and asks an LLM for its own verdict.",
  },
  {
    title: "Consensus settles on-chain",
    body: "Verdicts converge within tolerance and the outcome is written immutably to the chain.",
  },
];

/**
 * Animated companion panel for the dispute forms — sits to the right of the
 * form on desktop. Category-tinted glow card with a floating 3D badge, a
 * staggered process timeline and live-network chips.
 */
export default function FormSidePanel({ category }: { category: Category }) {
  const meta = CATEGORIES[category];
  const reduce = useReducedMotion();

  return (
    <motion.aside
      initial={reduce ? false : { opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="lg:sticky lg:top-24"
    >
      <div className="glow-border relative overflow-hidden rounded-3xl">
        <div className="hero-dark-canvas relative rounded-3xl p-7 sm:p-8">
          {/* drifting accent blobs */}
          <div
            className="aurora-blob h-56 w-56 -right-16 -top-16"
            style={{ background: `radial-gradient(circle, ${meta.accent}, transparent 70%)` }}
          />
          <div
            className="aurora-blob h-44 w-44 -bottom-14 -left-14"
            style={{
              background: "radial-gradient(circle, #ec4899, transparent 70%)",
              animationDelay: "-8s",
            }}
          />

          <div className="relative">
            {/* floating 3D category badge */}
            <motion.div
              animate={reduce ? undefined : { y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="mx-auto grid h-28 w-28 place-items-center"
            >
              <CategoryIconWith3D
                category={category}
                size={112}
                fallback={
                  <span
                    className="grid h-20 w-20 place-items-center rounded-2xl text-3xl"
                    style={{ background: `${meta.accent}22`, color: meta.accent }}
                  >
                    ⚖️
                  </span>
                }
              />
            </motion.div>

            <p className="mt-2 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: meta.accent }}
                />
                {meta.title} judge
              </span>
            </p>
            <h2 className="mt-3 text-center font-serif-hero text-2xl text-white">
              {meta.tagline}
            </h2>

            {/* process timeline */}
            <motion.ol
              initial={reduce ? false : "hidden"}
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.14, delayChildren: 0.7 } } }}
              className="relative mt-8 space-y-6 border-l border-white/15 pl-5"
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
                    className="absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white/10"
                    style={{
                      background: meta.accent,
                      boxShadow: `0 0 12px ${meta.accent}`,
                    }}
                  />
                  <p className="text-sm font-semibold text-white">
                    <span className="mr-1.5 text-white/40">0{i + 1}</span>
                    {s.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-white/60">{s.body}</p>
                </motion.li>
              ))}
            </motion.ol>

            {/* live-network chips */}
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {["⛓ Settled on GenLayer", "🧠 LLM consensus", "📦 IPFS evidence"].map(
                (chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/80"
                  >
                    {chip}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
