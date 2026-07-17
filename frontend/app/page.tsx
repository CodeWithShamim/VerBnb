import Link from 'next/link';
import CategoryCard from '@/components/CategoryCard';
import PlatformStats from '@/components/PlatformStats';
import LiveTransactions from '@/components/LiveTransactions';
import { HeroScene3D } from '@/components/3d';
import HeroSideCards from '@/components/HeroSideCards';
import HeroBottomBar from '@/components/HeroBottomBar';
import Reveal, { RevealGroup } from '@/components/Reveal';
import CopyAddress from '@/components/CopyAddress';
import FaqSection from '@/components/FaqSection';
import { CATEGORIES } from '@/lib/contracts';
import { ALL_CONTRACTS, NETWORK } from '@/lib/constants';

const STEPS = [
  {
    n: '01',
    icon: '📌',
    title: 'Pin your evidence',
    body: 'Photos, reports and receipts are pinned to IPFS - tamper-proof, permanent, and fetchable by every validator on the network.',
    tint: 'from-violet-500 to-purple-500',
    glow: 'rgba(139,92,246,0.25)',
  },
  {
    n: '02',
    icon: '🤖',
    title: 'Five independent AI verdicts',
    body: 'Each GenLayer validator fetches your evidence and asks an LLM for its own judgment - no shared answer key, no single point of bias.',
    tint: 'from-cyan-400 to-sky-500',
    glow: 'rgba(34,211,238,0.25)',
  },
  {
    n: '03',
    icon: '⛓',
    title: 'Consensus, sealed on-chain',
    body: 'Verdicts converge within tolerance and the outcome is written immutably to the chain - auditable by anyone, reversible by no one.',
    tint: 'from-pink-500 to-orange-400',
    glow: 'rgba(236,72,153,0.25)',
  },
];

/** Side-by-side proof points for the "why on-chain" comparison panels. */
const OLD_WAY = [
  'Open a support ticket, then wait days for a human to skim your case',
  'The platform judges disputes it profits from',
  'Evidence scattered across email threads and screenshots',
  'A one-line verdict with no reasoning and nowhere to appeal',
];
const VERBNB_WAY = [
  'Five independent AI validators judge every case in minutes',
  'No platform thumb on the scale - consensus is the referee',
  'Evidence pinned to IPFS: permanent, public, fetchable by anyone',
  'Verdict sealed on-chain with a reasoning trail and a 7-day appeal window',
];

const MARQUEE_CHIPS = [
  '🏠 Rental disputes',
  '📦 Marketplace claims',
  '🌿 Ethical sourcing',
  '🚚 Delivery proofs',
  '🛡 Fraud detection',
  '⭐ Reputation tracking',
  '🧾 One-click appeals',
  '📊 Live case analytics',
  '🌐 GenLayer intelligent contracts',
  '🔍 Publicly auditable verdicts',
];

/** All 10 deployed contracts, in registry-first order, for the home table. */
const CONTRACT_ROWS: { label: string; address: string }[] = [
  { label: 'Registry - entry point', address: ALL_CONTRACTS.REGISTRY },
  { label: 'Rental judge', address: ALL_CONTRACTS.RENTAL },
  { label: 'Marketplace judge', address: ALL_CONTRACTS.PRODUCT },
  { label: 'Sourcing validator', address: ALL_CONTRACTS.SOURCING },
  { label: 'Delivery adjudicator', address: ALL_CONTRACTS.DELIVERY },
  { label: 'Appeal manager', address: ALL_CONTRACTS.APPEAL },
  { label: 'Reputation tracker', address: ALL_CONTRACTS.REPUTATION },
  { label: 'Fraud detector', address: ALL_CONTRACTS.FRAUD },
  { label: 'Analytics tracker', address: ALL_CONTRACTS.ANALYTICS },
  { label: 'Product suggester', address: ALL_CONTRACTS.SUGGESTER },
];

export default function Home() {
  return (
    <div className="bg-grid">
      {/* HERO */}
      <section className="hero-canvas relative flex min-h-screen flex-col overflow-hidden">
        {/* Drifting aurora blobs behind everything. */}
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <div
            className="aurora-blob left-[6%] top-[-10%] h-[480px] w-[480px]"
            style={{ background: 'radial-gradient(circle, #7b39fc, transparent 70%)' }}
          />
          <div
            className="aurora-blob right-[4%] top-[12%] h-[420px] w-[420px]"
            style={{
              background: 'radial-gradient(circle, #22d3ee, transparent 70%)',
              animationDelay: '-6s',
            }}
          />
          <div
            className="aurora-blob bottom-[-14%] left-[30%] h-[460px] w-[460px]"
            style={{
              background: 'radial-gradient(circle, #ec4899, transparent 70%)',
              animationDelay: '-11s',
            }}
          />
        </div>

        {/* 3D floating geometry - above the aurora, below the content.
            Auto-skips on reduced-motion / no-WebGL (renders nothing). */}
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <HeroScene3D />
        </div>

        {/* Floating case/consensus cards on the hero's right flank. */}
        <HeroSideCards />

        <div className="container-page relative z-10 flex flex-1 flex-col items-start justify-center pb-16 pt-28 text-left">
          <Reveal direction="down">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/40 px-4 py-1.5 backdrop-blur-md dark:border-white/15 dark:bg-white/10">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 dark:bg-pop-lime" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 dark:bg-pop-lime" />
              </span>
              <span className="font-cabin text-sm font-medium text-slate-800 dark:text-white">
                Live on {NETWORK.NAME} · 10 contracts on-chain
              </span>
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mt-8 max-w-3xl font-serif-hero text-5xl leading-[1.06] text-slate-900 dark:text-white sm:text-6xl md:text-7xl">
              Every dispute deserves a <span className="text-gradient-pop">fair verdict</span> - not
              a support ticket.
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-6 max-w-[620px] font-inter text-lg leading-relaxed text-slate-600 dark:text-white/70">
              VerBnb turns rental, marketplace, sourcing and delivery conflicts into on-chain cases.
              GenLayer validators fetch your evidence, form independent LLM judgments, reach
              consensus, and settle the outcome in minutes - no call centers, no courts, no platform
              middlemen.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="#categories"
                className="btn-shine rounded-xl bg-gradient-to-r from-hero-purple via-pop-magenta to-pop-pink bg-[length:200%_100%] px-7 py-3.5 font-cabin text-base font-semibold text-white shadow-glow transition-transform duration-300 hover:scale-[1.04] active:scale-[0.98]"
              >
                Raise a dispute →
              </Link>
              <Link
                href="/activity"
                className="rounded-xl border border-slate-900/15 bg-white/40 px-7 py-3.5 font-cabin text-base font-medium text-slate-800 backdrop-blur transition-colors duration-300 hover:border-slate-900/30 hover:bg-white/80 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:border-white/40 dark:hover:bg-white/10"
              >
                Watch live activity
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.26}>
            <div className="mt-16 w-full max-w-3xl">
              <PlatformStats />
            </div>
          </Reveal>
        </div>

        {/* Hero bottom edge - staggered proof-point bar, then the animated
            gradient divider with its sweeping light beam, then the capability
            carousel docked beneath it. */}
        <div className="relative z-10 pb-8">
          <div className="mb-7">
            <HeroBottomBar />
          </div>
          <div aria-hidden className="container-page mb-6">
            <div className="hero-divider" />
          </div>
          <div className="marquee">
            <div className="marquee-track">
              {[...MARQUEE_CHIPS, ...MARQUEE_CHIPS].map((chip, i) => (
                <span
                  key={i}
                  className="whitespace-nowrap rounded-full border border-slate-900/10 bg-white/40 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors duration-300 hover:border-brand/40 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:border-white/30 dark:hover:text-white"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section id="categories" className="cv-auto relative scroll-mt-24 overflow-hidden py-20">
        <div
          aria-hidden
          className="glow-spot -left-40 top-[-60px] h-[460px] w-[460px]"
          style={{ background: 'radial-gradient(circle, rgba(123,57,252,0.14), transparent 70%)' }}
        />
        <div
          aria-hidden
          className="glow-spot -right-40 bottom-[-80px] h-[420px] w-[420px]"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.1), transparent 70%)' }}
        />
        <div className="container-page relative">
          <Reveal className="text-center">
            <span className="chip-hero">⚖️ Pick your battlefield</span>
            <h2 className="section-title mt-6">
              Four specialist <span className="text-gradient-pop">AI judges</span>, one registry
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-500">
              Each category runs its own on-chain judge, tuned to the evidence that matters for
              that kind of case. Pick the one that fits yours.
            </p>
          </Reveal>

          <RevealGroup className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Object.values(CATEGORIES).map((meta) => (
              <CategoryCard key={meta.key} meta={meta} />
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* LIVE ACTIVITY */}
      <section id="activity" className="cv-auto relative scroll-mt-24 overflow-hidden py-20">
        <div
          aria-hidden
          className="glow-spot -right-32 top-[-40px] h-[440px] w-[440px]"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.12), transparent 70%)' }}
        />
        <div className="container-page relative grid items-start gap-10 lg:grid-cols-[0.9fr,1.1fr]">
          <Reveal className="lg:sticky lg:top-28">
            <span className="chip-hero">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live from the chain
            </span>
            <h2 className="section-title mt-6">
              Consensus, <span className="text-gradient-pop">happening now</span>
            </h2>
            <p className="mt-4 max-w-md text-slate-500">
              Status and block are pulled live from GenLayer as validators reach consensus -
              nothing here is mocked. Every row links to the case or the explorer.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="chip-hero px-3 py-1 text-xs">🔄 Refreshes every 10s</span>
              <span className="chip-hero px-3 py-1 text-xs">🛰 Direct from the explorer</span>
            </div>
            <Link href="/activity" className="btn-ghost mt-8 px-5 py-2.5 text-sm">
              View all activity →
            </Link>
          </Reveal>

          <Reveal delay={0.05}>
            <LiveTransactions limit={5} glass />
          </Reveal>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="cv-auto relative scroll-mt-24 overflow-hidden py-20">
        <div
          aria-hidden
          className="glow-spot left-1/2 top-[-120px] h-[480px] w-[640px] -translate-x-1/2"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.1), transparent 70%)' }}
        />
        <div className="container-page relative">
          <Reveal className="text-center">
            <span className="chip-hero">🧭 The process</span>
            <h2 className="section-title mt-6">
              From evidence to <span className="text-gradient-pop">on-chain verdict</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-500">
              Three steps. No humans in the loop, no way to put a thumb on the scale.
            </p>
          </Reveal>

          <RevealGroup className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <Reveal key={s.n} className="h-full">
                <div className="glass-card card-hover relative h-full overflow-hidden p-7">
                  <div
                    className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl"
                    style={{ background: s.glow }}
                  />
                  <div className="flex items-start justify-between">
                    <span
                      className={`bg-gradient-to-r bg-clip-text font-serif-hero text-6xl text-transparent ${s.tint}`}
                    >
                      {s.n}
                    </span>
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-slate-900/10 bg-white/40 text-xl backdrop-blur-sm dark:border-white/15 dark:bg-white/10">
                      {s.icon}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* WHY ON-CHAIN - old way vs the VerBnb way */}
      <section id="why" className="cv-auto relative scroll-mt-24 overflow-hidden py-20">
        <div
          aria-hidden
          className="glow-spot -left-32 bottom-[-100px] h-[440px] w-[440px]"
          style={{ background: 'radial-gradient(circle, rgba(123,57,252,0.12), transparent 70%)' }}
        />
        <div className="container-page relative">
          <Reveal className="text-center">
            <span className="chip-hero">🥊 Why on-chain?</span>
            <h2 className="section-title mt-6">
              Support tickets plead. <span className="text-gradient-pop">Verdicts prove.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-500">
              Centralized platforms referee their own games. VerBnb hands the whistle to a network
              that has nothing to gain from either side.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <Reveal className="h-full">
              <div className="glass-card h-full p-8 opacity-90">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  The old way
                </span>
                <ul className="mt-6 space-y-4">
                  {OLD_WAY.map((line) => (
                    <li key={line} className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-500/15 text-[11px] font-bold text-rose-500 dark:text-rose-300">
                        ✗
                      </span>
                      <span className="text-sm leading-relaxed text-slate-500">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.1} className="h-full">
              <div className="glow-border h-full rounded-2xl">
                <div className="glass-card h-full p-8">
                  <span className="bg-gradient-to-r from-hero-purple via-pop-pink to-pop-orange bg-clip-text text-xs font-semibold uppercase tracking-[0.2em] text-transparent">
                    The VerBnb way
                  </span>
                  <ul className="mt-6 space-y-4">
                    {VERBNB_WAY.map((line) => (
                      <li key={line} className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
                          ✓
                        </span>
                        <span className="text-sm leading-relaxed text-slate-700">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* DEPLOYED CONTRACTS */}
      <section id="contracts" className="cv-auto relative scroll-mt-24 overflow-hidden py-20">
        <div
          aria-hidden
          className="glow-spot -right-40 top-[-60px] h-[460px] w-[460px]"
          style={{ background: 'radial-gradient(circle, rgba(123,57,252,0.12), transparent 70%)' }}
        />
        <div className="container-page relative grid items-start gap-10 lg:grid-cols-[0.9fr,1.1fr]">
          <Reveal className="lg:sticky lg:top-28">
            <span className="chip-hero">⛓ On-chain</span>
            <h2 className="section-title mt-6">
              Nine contracts, <span className="text-gradient-pop">zero trust required</span>
            </h2>
            <p className="mt-4 max-w-md text-slate-500">
              Everything runs on {NETWORK.NAME} (Chain ID {NETWORK.CHAIN_ID}). Tap any address to
              copy it and verify it yourself.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'The registry is the single entry point - it routes each case to its judge.',
                'Judges are specialists: rental, marketplace, sourcing and delivery read different evidence.',
                'Every judge re-runs appeal consensus on-chain over its own stored evidence - verdicts are never supplied off-chain.',
                'Appeals, reputation, fraud signals and analytics run as support contracts.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-hero-purple to-pop-pink" />
                  <span className="text-sm leading-relaxed text-slate-500">{line}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="glow-border rounded-2xl">
              <div className="glass-card divide-y divide-slate-900/10 p-2 dark:divide-white/10">
                {CONTRACT_ROWS.filter((r) => r.address).map((r) => (
                  <div
                    key={r.label}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
                  >
                    <span className="text-sm font-medium text-slate-700">{r.label}</span>
                    <CopyAddress value={r.address} label={r.label} truncate />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="cv-auto relative scroll-mt-24 overflow-hidden py-20">
        <div
          aria-hidden
          className="glow-spot -left-32 top-[-40px] h-[400px] w-[400px]"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.1), transparent 70%)' }}
        />
        <div className="container-page relative">
          <Reveal className="text-center">
            <span className="chip-hero">💬 Questions</span>
            <h2 className="section-title mt-6">
              Frequently <span className="text-gradient-pop">asked</span>
            </h2>
          </Reveal>
          <FaqSection />
        </div>
      </section>

      {/* CTA */}
      <section className="cv-auto container-page py-14">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-hero-purple via-pop-pink to-pop-orange bg-[length:200%_100%] p-10 text-center shadow-lift animate-gradient-x sm:p-16">
            <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(600px_circle_at_20%_0%,white,transparent)]" />
            <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Have a dispute worth resolving fairly?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-white/85">
              Submit your evidence and let an impartial validator set decide - transparently, in
              minutes, and on-chain.
            </p>
            <Link
              href="#categories"
              className="btn-shine relative mt-8 inline-flex items-center justify-center rounded-xl bg-[#ffffff] px-7 py-3.5 font-semibold text-brand shadow-soft transition-transform duration-300 hover:scale-105"
            >
              Get started →
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
