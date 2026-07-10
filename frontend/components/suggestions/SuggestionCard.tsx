"use client";

import { motion } from "framer-motion";
import { itemVariants } from "../Reveal";

/** One curated product from product_suggester's get_suggestions view. */
export interface SuggestedProduct {
  name: string;
  brand: string;
  price: string;
  rating: string;
  why: string;
  source_quote: string;
}

/**
 * One validator-curated product pick. Clones the CategoryCard treatment
 * (glass-card, hover-grow accent wash) in the PRODUCT cyan accent family.
 */
export default function SuggestionCard({
  product,
  rank,
}: {
  product: SuggestedProduct;
  rank: number;
}) {
  return (
    <motion.div variants={itemVariants} className="h-full">
      <div className="glass-card group relative flex h-full flex-col overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
        {/* accent wash that grows on hover */}
        <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-cyan-500 to-sky-500 opacity-10 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-20" />

        <div className="relative flex items-start justify-between gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-500 font-manrope text-sm font-bold text-white shadow-soft transition-transform duration-300 group-hover:scale-110">
            #{rank}
          </span>
          {product.price && (
            <span className="chip bg-white/70 font-semibold text-cyan-600 backdrop-blur dark:text-cyan-400">
              {product.price}
            </span>
          )}
        </div>

        <h3 className="relative mt-4 text-lg font-bold text-slate-900">
          {product.name}
        </h3>

        <div className="relative mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          {product.brand && (
            <span className="font-manrope uppercase tracking-wide">
              {product.brand}
            </span>
          )}
          {product.rating && (
            <span className="inline-flex items-center gap-1 text-amber-500">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6L2.5 9.5l6.6-.8L12 2.5z" />
              </svg>
              {product.rating}
            </span>
          )}
        </div>

        {product.why && (
          <p className="relative mt-3 text-sm leading-relaxed text-slate-500">
            {product.why}
          </p>
        )}

        {product.source_quote && (
          <blockquote className="relative mt-4 border-l-2 border-cyan-500/40 pl-3 text-xs italic leading-relaxed text-slate-400">
            &ldquo;{product.source_quote}&rdquo;
          </blockquote>
        )}
      </div>
    </motion.div>
  );
}
