import Link from "next/link";
import CategoryCard from "@/components/CategoryCard";
import PlatformStats from "@/components/PlatformStats";
import LiveTransactions from "@/components/LiveTransactions";
import { HeroScene3D } from "@/components/3d";
import HeroSideCards from "@/components/HeroSideCards";
import Reveal, { RevealGroup } from "@/components/Reveal";
import CopyAddress from "@/components/CopyAddress";
import FaqSection from "@/components/FaqSection";
import { CATEGORIES } from "@/lib/contracts";
import { ALL_CONTRACTS, NETWORK } from "@/lib/constants";

const STEPS = [
  {
    n: "01",
    title: "Pin your evidence",
    body: "Photos, reports and receipts are pinned to IPFS — tamper-proof, permanent, and fetchable by every validator on the network.",
    tint: "from-violet-500 to-purple-500",
    glow: "rgba(139,92,246,0.25)",
  },
  {
    n: "02",
    title: "Five independent AI verdicts",
    body: "Each GenLayer validator fetches your evidence and asks an LLM for its own judgment — no shared answer key, no single point of bias.",
    tint: "from-cyan-400 to-sky-500",
    glow: "rgba(34,211,238,0.25)",
  },
  {
    n: "03",
    title: "Consensus, sealed on-chain",
    body: "Verdicts converge within tolerance and the outcome is written immutably to the chain — auditable by anyone, reversible by no one.",
    tint: "from-pink-500 to-orange-400",
    glow: "rgba(236,72,153,0.25)",
  },
];

const MARQUEE_CHIPS = [
  "🏠 Rental disputes",
  "📦 Marketplace claims",
  "🌿 Ethical sourcing",
  "🚚 Delivery proofs",
  "🧠 LLM consensus",
  "⛓ On-chain settlement",
  "📌 IPFS evidence",
  "🛡 Fraud detection",
  "⭐ Reputation tracking",
  "⚡ Verdicts in minutes",
];

/** All 9 deployed contracts, in registry-first order, for the home table. */
const CONTRACT_ROWS: { label: string; address: string }[] = [
  { label: "Registry — entry point", address: ALL_CONTRACTS.REGISTRY },
  { label: "Rental judge", address: ALL_CONTRACTS.RENTAL },
  { label: "Marketplace judge", address: ALL_CONTRACTS.PRODUCT },
  { label: "Sourcing validator", address: ALL_CONTRACTS.SOURCING },
  { label: "Delivery adjudicator", address: ALL_CONTRACTS.DELIVERY },
  { label: "Appeal manager", address: ALL_CONTRACTS.APPEAL },
  { label: "Reputation tracker", address: ALL_CONTRACTS.REPUTATION },
  { label: "Fraud detector", address: ALL_CONTRACTS.FRAUD },
  { label: "Analytics tracker", address: ALL_CONTRACTS.ANALYTICS },
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
            style={{ background: "radial-gradient(circle, #7b39fc, transparent 70%)" }}
          />
          <div
            className="aurora-blob right-[4%] top-[12%] h-[420px] w-[420px]"
            style={{
              background: "radial-gradient(circle, #22d3ee, transparent 70%)",
              animationDelay: "-6s",
            }}
          />
          <div
            className="aurora-blob bottom-[-14%] left-[30%] h-[460px] w-[460px]"
            style={{
              background: "radial-gradient(circle, #ec4899, transparent 70%)",
              animationDelay: "-11s",
            }}
          />
        </div>

        {/* 3D floating geometry — above the aurora, below the content.
            Auto-skips on reduced-motion / no-WebGL (renders nothing). */}
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <HeroScene3D />
        </div>

        {/* Floating case/consensus cards on the hero's left and right flanks. */}
        <HeroSideCards />

        <div className="container-page relative z-10 flex flex-1 flex-col justify-center pb-16 pt-28 text-center">
          <Reveal direction="down">
            <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/40 px-4 py-1.5 backdrop-blur-md dark:border-white/15 dark:bg-white/10">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 dark:bg-pop-lime" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 dark:bg-pop-lime" />
              </span>
              <span className="font-cabin text-sm font-medium text-slate-800 dark:text-white">
                Live on GenLayer Bradbury testnet · 9 contracts on-chain
              </span>
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mx-auto mt-8 max-w-4xl font-serif-hero text-5xl leading-[1.06] text-slate-900 dark:text-white sm:text-7xl md:text-[88px]">
              Every dispute deserves a{" "}
              <span className="text-gradient-pop">fair verdict</span> — not a
              support ticket.
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mx-auto mt-6 max-w-[680px] font-inter text-lg leading-relaxed text-slate-600 dark:text-white/70">
              VerBnb turns rental, marketplace, sourcing and delivery conflicts
              into on-chain cases. GenLayer validators fetch your evidence, form
              independent LLM judgments, reach consensus, and settle the outcome
              in minutes — no call centers, no courts, no platform middlemen.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
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
            <div className="mx-auto mt-16 max-w-3xl">
              <PlatformStats />
            </div>
          </Reveal>
        </div>

        {/* Scrolling capability marquee pinned to the hero's bottom edge. */}
        <div className="relative z-10 pb-8">
          <div className="marquee">
            <div className="marquee-track">
              {[...MARQUEE_CHIPS, ...MARQUEE_CHIPS].map((chip, i) => (
                <span
                  key={i}
                  className="whitespace-nowrap rounded-full border border-slate-900/10 bg-white/40 px-4 py-1.5 text-sm font-medium text-slate-600 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-white/70"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section id="categories" className="container-page scroll-mt-24 py-16">
        <Reveal className="text-center">
          <span className="chip mx-auto">Pick your battlefield</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Four specialist <span className="text-gradient-pop">AI judges</span>,
            one registry
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">
            Each category runs its own on-chain judge, tuned to the evidence that
            matters for that kind of case. Pick the one that fits yours.
          </p>
        </Reveal>

        <RevealGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.values(CATEGORIES).map((meta) => (
            <CategoryCard key={meta.key} meta={meta} />
          ))}
        </RevealGroup>
      </section>

      {/* LIVE ACTIVITY */}
      <section id="activity" className="container-page scroll-mt-24 py-16">
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="chip">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live from the chain
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Consensus, happening now
            </h2>
            <p className="mt-2 max-w-md text-slate-500">
              Status and block are pulled live from GenLayer as validators reach
              consensus — nothing here is mocked.
            </p>
          </div>
          <Link href="/activity" className="btn-ghost px-4 py-2 text-sm">
            View all activity →
          </Link>
        </Reveal>

        <Reveal delay={0.05} className="mx-auto max-w-3xl">
          <LiveTransactions limit={5} />
        </Reveal>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="container-page scroll-mt-24 py-16">
        <Reveal className="text-center">
          <span className="chip mx-auto">The process</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            From evidence to{" "}
            <span className="text-gradient-pop">on-chain verdict</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">
            Three steps. No humans in the loop, no way to put a thumb on the
            scale.
          </p>
        </Reveal>

        <RevealGroup className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <Reveal key={s.n} className="h-full">
              <div className="card card-hover relative h-full overflow-hidden p-7">
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl"
                  style={{ background: s.glow }}
                />
                <span
                  className={`bg-gradient-to-r bg-clip-text text-5xl font-black text-transparent ${s.tint}`}
                >
                  {s.n}
                </span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </RevealGroup>
      </section>

      {/* DEPLOYED CONTRACTS */}
      <section id="contracts" className="container-page scroll-mt-24 py-16">
        <Reveal className="text-center">
          <span className="chip mx-auto">On-chain</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Nine contracts, <span className="text-gradient-pop">zero trust required</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">
            Everything runs on {NETWORK.NAME} (Chain ID {NETWORK.CHAIN_ID}).
            Tap any address to copy it and verify it yourself.
          </p>
        </Reveal>

        <Reveal delay={0.05} className="mx-auto mt-10 max-w-3xl">
          <div className="glow-border rounded-2xl">
            <div className="card divide-y divide-surface-border p-2">
              {CONTRACT_ROWS.filter((r) => r.address).map((r) => (
                <div
                  key={r.label}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {r.label}
                  </span>
                  <CopyAddress value={r.address} label={r.label} truncate />
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section id="faq" className="container-page scroll-mt-24 py-16">
        <Reveal className="text-center">
          <span className="chip mx-auto">Questions</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            Frequently asked
          </h2>
        </Reveal>
        <FaqSection />
      </section>

      {/* CTA */}
      <section className="container-page py-12">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-hero-purple via-pop-pink to-pop-orange bg-[length:200%_100%] p-10 text-center shadow-lift animate-gradient-x sm:p-16">
            <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(600px_circle_at_20%_0%,white,transparent)]" />
            <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Have a dispute worth resolving fairly?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-white/85">
              Submit your evidence and let an impartial validator set decide —
              transparently, in minutes, and on-chain.
            </p>
            <Link
              href="#categories"
              className="btn-shine relative mt-8 inline-flex items-center justify-center rounded-xl bg-white px-7 py-3.5 font-semibold text-brand shadow-soft transition-transform duration-300 hover:scale-105"
            >
              Get started →
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
