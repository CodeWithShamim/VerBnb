import Link from "next/link";
import CategoryCard from "@/components/CategoryCard";
import PlatformStats from "@/components/PlatformStats";
import MeshBackground from "@/components/MeshBackground";
import Reveal, { RevealGroup } from "@/components/Reveal";
import { CATEGORIES } from "@/lib/contracts";

const STEPS = [
  {
    n: "01",
    title: "Upload evidence",
    body: "Your photos, reports and proofs are pinned to IPFS and passed to the contract as a URL.",
    tint: "from-indigo-500 to-violet-500",
  },
  {
    n: "02",
    title: "Independent judgment",
    body: "Each validator fetches the evidence and asks an LLM for a verdict — no shared answer key.",
    tint: "from-cyan-500 to-sky-500",
  },
  {
    n: "03",
    title: "Settled on-chain",
    body: "Validators reach consensus within tolerance and the result is written immutably on-chain.",
    tint: "from-emerald-500 to-teal-500",
  },
];

export default function Home() {
  return (
    <div className="bg-grid">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <MeshBackground />
        <div className="container-page relative z-10 pb-20 pt-20 text-center sm:pt-28">
          <Reveal direction="down">
            <span className="chip mx-auto bg-white/70 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live on GenLayer Bradbury testnet
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-6xl">
              Every dispute.{" "}
              <span className="gradient-text">Resolved by AI consensus.</span>{" "}
              On-chain.
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              No call centers. No courts. No platform middlemen. GenLayer
              validators independently fetch your evidence, apply LLM judgment,
              reach consensus, and settle the outcome on-chain.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="#categories" className="btn-primary px-6 py-3.5 text-base">
                Raise a dispute
              </Link>
              <Link href="#how" className="btn-ghost px-6 py-3.5 text-base">
                How it works
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.26}>
            <div className="mx-auto mt-16 max-w-3xl">
              <PlatformStats />
            </div>
          </Reveal>
        </div>
      </section>

      {/* CATEGORIES */}
      <section id="categories" className="container-page scroll-mt-24 py-16">
        <Reveal className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Choose a dispute category
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">
            Four specialist AI judges, one registry. Pick the one that fits your
            case.
          </p>
        </Reveal>

        <RevealGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.values(CATEGORIES).map((meta) => (
            <CategoryCard key={meta.key} meta={meta} />
          ))}
        </RevealGroup>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="container-page scroll-mt-24 py-16">
        <Reveal className="text-center">
          <span className="chip mx-auto">The process</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            How consensus works
          </h2>
        </Reveal>

        <RevealGroup className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <Reveal key={s.n} className="h-full">
              <div className="card card-hover relative h-full overflow-hidden p-7">
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

      {/* CTA */}
      <section className="container-page py-12">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-violet-600 to-cyan-500 p-10 text-center shadow-lift sm:p-16">
            <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(600px_circle_at_20%_0%,white,transparent)]" />
            <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Have a dispute worth resolving fairly?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-white/85">
              Submit your evidence and let an impartial validator set decide —
              transparently, and on-chain.
            </p>
            <Link
              href="#categories"
              className="relative mt-8 inline-flex items-center justify-center rounded-xl bg-white px-7 py-3.5 font-semibold text-brand shadow-soft transition-transform duration-300 hover:scale-105"
            >
              Get started
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
