import type { Metadata } from "next";
import MeshBackground from "@/components/MeshBackground";
import Reveal from "@/components/Reveal";
import SuggestionsBoard from "@/components/suggestions/SuggestionsBoard";

export const metadata: Metadata = {
  title: "Suggested Products - VerBnb",
  description:
    "Validator-curated product picks fetched from trusted review sites and stored on-chain by the product_suggester contract.",
};

/**
 * /suggestions - Suggested Products. Read-only board over the
 * product_suggester contract: pick a curated topic, see the validators' top
 * picks with prices, ratings and the source they were verified against.
 */
export default function SuggestionsPage() {
  return (
    <div className="bg-grid min-h-screen">
      <section className="relative overflow-hidden">
        <MeshBackground />
        <div className="container-page relative z-10 max-w-4xl pb-10 pt-16 sm:pt-20">
          <Reveal direction="down">
            <span className="chip mx-auto bg-white/70 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
              </span>
              Curated on-chain by AI validators
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mx-auto mt-6 max-w-2xl text-center text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Suggested <span className="gradient-text">Products</span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mx-auto mt-4 max-w-xl text-center text-slate-600">
              Validator-curated picks fetched from trusted review sites - every
              recommendation verified against its source before it lands on-chain.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="container-page max-w-6xl pb-20">
        <Reveal>
          <SuggestionsBoard />
        </Reveal>
      </div>
    </div>
  );
}
