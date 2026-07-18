"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { suggestionsFetch } from "@/lib/suggestionsClient";
import Reveal, { RevealGroup } from "./Reveal";
import SuggestionCard, {
  type SuggestedProduct,
} from "./suggestions/SuggestionCard";

// Home surface stays lean: probe a few topics for one with picks, show top 3.
const MAX_TOPICS_TRIED = 4;
const MAX_PICKS = 3;

interface HomePicks {
  topic: string;
  products: SuggestedProduct[];
  source_host: string;
}

/** "wireless-earbuds" / "wireless_earbuds" -> "Wireless Earbuds". */
function prettyTopic(key: string): string {
  return key.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Home-page surface for the product_suggester feed: the first curated topic
 * that has picks, rendered in the home section idiom. Until validators have
 * published a non-empty topic (or if the contract isn't deployed), it renders
 * nothing - no section, no empty state - so the home page never degrades.
 */
export default function HomeSuggestions() {
  const [picks, setPicks] = useState<HomePicks | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await suggestionsFetch("topics");
        const topics: string[] = Array.isArray(res?.topics) ? res.topics : [];
        for (const topic of topics.slice(0, MAX_TOPICS_TRIED)) {
          const data = await suggestionsFetch("suggestions", { topic });
          if (cancelled) return;
          if (Array.isArray(data?.products) && data.products.length > 0) {
            setPicks({
              topic,
              products: data.products.slice(0, MAX_PICKS),
              source_host:
                typeof data.source_host === "string" ? data.source_host : "",
            });
            return;
          }
        }
      } catch {
        /* stay hidden - the home page never shows a broken suggestions state */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!picks) return null;

  return (
    <section
      id="suggestions"
      className="cv-auto relative scroll-mt-24 overflow-hidden py-20"
    >
      <div
        aria-hidden
        className="glow-spot -left-40 top-[-60px] h-[440px] w-[440px]"
        style={{
          background:
            "radial-gradient(circle, rgba(34,211,238,0.12), transparent 70%)",
        }}
      />
      <div className="container-page relative">
        <Reveal className="text-center">
          <span className="chip-hero">🛍 Validator-curated</span>
          <h2 className="section-title mt-6">
            Top {prettyTopic(picks.topic)},{" "}
            <span className="text-gradient-pop">picked by consensus</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-500">
            The same validator consensus that settles disputes also curates
            products - every pick verified against{" "}
            {picks.source_host || "a trusted review site"} before it lands
            on-chain.
          </p>
        </Reveal>

        <RevealGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {picks.products.map((p, i) => (
            <SuggestionCard key={`${p.name}-${i}`} product={p} rank={i + 1} />
          ))}
        </RevealGroup>

        <Reveal className="mt-10 text-center">
          <Link href="/suggestions" className="btn-ghost px-5 py-2.5 text-sm">
            Browse all curated topics →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
