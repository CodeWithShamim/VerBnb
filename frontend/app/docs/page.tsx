import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import CopyAddress from "@/components/CopyAddress";
import { CATEGORIES } from "@/lib/contracts";
import { ALL_CONTRACTS, NETWORK } from "@/lib/constants";

export const metadata: Metadata = {
  title: "How VerBnb Works — Docs",
  description:
    "A plain-English guide to raising disputes, AI validator consensus, appeals, and the contracts that power VerBnb.",
};

/** Ordered list of all 9 deployed contracts for the address table. */
const CONTRACT_ROWS: { label: string; address: string }[] = [
  { label: "Registry (entry point)", address: ALL_CONTRACTS.REGISTRY },
  { label: "Rental judge", address: ALL_CONTRACTS.RENTAL },
  { label: "Marketplace judge", address: ALL_CONTRACTS.PRODUCT },
  { label: "Sourcing validator", address: ALL_CONTRACTS.SOURCING },
  { label: "Delivery adjudicator", address: ALL_CONTRACTS.DELIVERY },
  { label: "Appeal manager", address: ALL_CONTRACTS.APPEAL },
  { label: "Reputation tracker", address: ALL_CONTRACTS.REPUTATION },
  { label: "Fraud detector", address: ALL_CONTRACTS.FRAUD },
  { label: "Analytics tracker", address: ALL_CONTRACTS.ANALYTICS },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: "Choose a category",
    body: "Pick the dispute type that fits — rental, marketplace, sourcing, or delivery. Each routes to a specialist AI judge.",
  },
  {
    title: "Describe your claim",
    body: "Add the listing or order URL and explain what went wrong in plain English. No legal jargon needed.",
  },
  {
    title: "Upload evidence",
    body: "Drag in photos or documents. They're pinned to IPFS so validators can fetch them independently.",
  },
  {
    title: "Submit on-chain",
    body: "Your dispute is sent to GenLayer. You'll get a transaction link to follow along on the explorer.",
  },
  {
    title: "Watch consensus",
    body: "Track the live tracker as it moves through Submitted → Proposing → Committing → Revealing → Finalized.",
  },
  {
    title: "Read your verdict",
    body: "A refund percentage and the validators' reasoning are written on-chain permanently. Appeal within 7 days if needed.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "How long does a verdict take?",
    a: "Usually 2–6 hours, sometimes up to 24h depending on validator availability and how much evidence there is to fetch.",
  },
  {
    q: "Can I appeal a verdict?",
    a: "Yes — within 7 days of finalization. Open the verdict page and click \"Appeal\". A larger set of validators re-evaluates the case.",
  },
  {
    q: "Is my data private?",
    a: "Evidence is stored on IPFS, which is public. Don't upload sensitive personal data — only what's needed to prove your claim.",
  },
  {
    q: "What is GenLayer?",
    a: "A blockchain where AI validators independently read evidence and reach consensus on the meaning of a dispute — not just on bytes.",
  },
  {
    q: "How do validators agree?",
    a: "Each validator independently reads the same evidence and asks an LLM for a verdict. They agree if their refund estimates land within 15% of each other.",
  },
  {
    q: "What does it cost?",
    a: "Only the network gas for your dispute transaction. On the Bradbury testnet, grab free GEN from the faucet — there's no platform fee.",
  },
];

const LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: "GenLayer docs", href: "https://docs.genlayer.com", external: true },
  { label: "Testnet faucet", href: NETWORK.FAUCET, external: true },
  { label: "Chain explorer", href: NETWORK.EXPLORER, external: true },
  {
    label: "GitHub repository",
    href: "https://github.com/CodeWithShamim/VerBnb",
    external: true,
  },
];

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">
        {kicker}
      </p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        {title}
      </h2>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="bg-grid min-h-screen">
      <div className="container-page max-w-4xl py-14">
        {/* Hero */}
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            User guide
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            How VerBnb works
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-500">
            VerBnb settles marketplace disputes with AI validator consensus —
            no call centers, no courts, fully on-chain. Here's everything you
            need to use it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/rental" className="btn-primary px-5 py-2.5 text-sm">
              Start a dispute
            </Link>
            <a
              href="https://github.com/CodeWithShamim/VerBnb"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-surface-border px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand/40"
            >
              Developer docs ↗
            </a>
          </div>
        </Reveal>

        {/* What is VerBnb */}
        <section className="mt-16">
          <Reveal>
            <SectionTitle kicker="The basics" title="What is VerBnb?" />
            <div className="card p-6 text-slate-600">
              VerBnb resolves marketplace disputes without intermediaries. A
              network of AI validators independently fetches your evidence,
              applies LLM judgment, reaches consensus, and settles the outcome
              on-chain through GenLayer's Optimistic Democracy.
            </div>
          </Reveal>
        </section>

        {/* How to submit */}
        <section className="mt-16">
          <Reveal>
            <SectionTitle
              kicker="Step by step"
              title="How to submit a dispute"
            />
          </Reveal>
          <ol className="space-y-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.04}>
                <li className="card flex gap-4 p-5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{s.title}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{s.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* AI consensus, plain English */}
        <section className="mt-16">
          <Reveal>
            <SectionTitle
              kicker="No jargon"
              title="What is AI consensus?"
            />
            <div className="card space-y-3 p-6 text-slate-600">
              <p>
                When you submit a dispute, one validator (the{" "}
                <strong className="text-slate-800">leader</strong>) reads your
                evidence and asks an AI model for a fair verdict — usually a
                refund percentage.
              </p>
              <p>
                Then every other validator does the same thing on their own,
                without seeing the leader's answer. If most of them land on a
                similar result (within 15%), the verdict is{" "}
                <strong className="text-slate-800">accepted</strong> and written
                to the blockchain. If they disagree, a new leader is picked and
                the round repeats.
              </p>
              <p>
                Because the answer comes from many independent AIs agreeing —
                not one company's decision — it's much harder to game.
              </p>
            </div>
          </Reveal>
        </section>

        {/* Appeals */}
        <section className="mt-16">
          <Reveal>
            <SectionTitle kicker="Not happy?" title="How appeals work" />
            <div className="card space-y-3 p-6 text-slate-600">
              <p>
                You have <strong className="text-slate-800">7 days</strong> after
                a verdict finalizes to appeal it. Open the verdict page and click{" "}
                <strong className="text-slate-800">Appeal</strong>, give your
                reason, and optionally add new evidence.
              </p>
              <p>
                An appeal triggers re-evaluation by a{" "}
                <strong className="text-slate-800">larger set of validators</strong>,
                which makes the second verdict harder to overturn. One appeal per
                dispute.
              </p>
            </div>
          </Reveal>
        </section>

        {/* Categories */}
        <section className="mt-16">
          <Reveal>
            <SectionTitle kicker="Pick the right one" title="Dispute categories" />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.values(CATEGORIES).map((c, i) => (
              <Reveal key={c.key} delay={i * 0.04}>
                <Link
                  href={`/${c.slug}`}
                  className="card block p-5 transition-colors hover:border-brand/40"
                >
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${c.soft} ${c.text}`}
                  >
                    {c.title}
                  </span>
                  <p className="mt-2 text-sm text-slate-500">{c.tagline}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Contract addresses */}
        <section className="mt-16">
          <Reveal>
            <SectionTitle
              kicker="On-chain"
              title="Deployed contracts"
            />
            <p className="mb-4 text-sm text-slate-500">
              All 9 contracts run on {NETWORK.NAME} (Chain ID {NETWORK.CHAIN_ID}).
              Tap any address to copy it.
            </p>
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
          </Reveal>
        </section>

        {/* FAQ */}
        <section className="mt-16">
          <Reveal>
            <SectionTitle kicker="Questions" title="FAQ" />
          </Reveal>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 0.03}>
                <details className="card group p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-slate-900">
                    {f.q}
                    <span className="text-slate-400 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-slate-500">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Links */}
        <section className="mt-16">
          <Reveal>
            <SectionTitle kicker="Go deeper" title="Useful links" />
            <div className="flex flex-wrap gap-3">
              {LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target={l.external ? "_blank" : undefined}
                  rel={l.external ? "noopener noreferrer" : undefined}
                  className="rounded-xl border border-surface-border bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand/40"
                >
                  {l.label} {l.external ? "↗" : ""}
                </a>
              ))}
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  );
}
