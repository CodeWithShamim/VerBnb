"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORIES, type Category } from "@/lib/contracts";
import { trackerFetch } from "@/lib/trackerClient";
import { scoreClaim, type ClaimStrengthResult } from "@/lib/claimStrength";
import CategoryPicker from "@/components/simulator/CategoryPicker";
import StrengthGauge from "@/components/simulator/StrengthGauge";
import ComparableCases, {
  type ComparableCase,
  type CategoryStats,
} from "@/components/simulator/ComparableCases";

/** Evidence-readiness toggles shown under the claim textarea. */
const EVIDENCE_TOGGLES: {
  key: "hasPhotos" | "hasListingUrl" | "hasReceipts";
  label: string;
  hint: string;
}[] = [
  { key: "hasPhotos", label: "I have photos", hint: "of the item / property / delivery" },
  { key: "hasListingUrl", label: "I have the listing/order URL", hint: "public page validators can fetch" },
  { key: "hasReceipts", label: "I have receipts / tracking", hint: "payment or shipping records" },
];

interface SimilarState {
  loading: boolean;
  error: string | null;
  configured: boolean;
  cases: ComparableCase[];
  matchCount: number;
  stats: CategoryStats | null;
}

/**
 * Refund Simulator - a free, local + read-only pre-check. Scoring runs
 * entirely in the browser (lib/claimStrength.ts); comparable cases and
 * category averages come from the analytics tracker's public views via
 * /api/trackers. Nothing here writes to the chain or costs gas.
 */
export default function SimulatorClient() {
  const [category, setCategory] = useState<Category>("RENTAL");
  const [claim, setClaim] = useState("");
  const [hasPhotos, setHasPhotos] = useState(false);
  const [hasListingUrl, setHasListingUrl] = useState(false);
  const [hasReceipts, setHasReceipts] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Results only update on "Run pre-check", never on keystrokes.
  const [result, setResult] = useState<ClaimStrengthResult | null>(null);
  const [resultCategory, setResultCategory] = useState<Category>("RENTAL");
  const [similar, setSimilar] = useState<SimilarState | null>(null);
  const runSeq = useRef(0);

  const toggles = { hasPhotos, hasListingUrl, hasReceipts };
  const setToggle = {
    hasPhotos: setHasPhotos,
    hasListingUrl: setHasListingUrl,
    hasReceipts: setHasReceipts,
  };

  const runPrecheck = useCallback(async () => {
    if (!claim.trim()) {
      setFormError("Describe your claim first - the pre-check needs something to assess.");
      return;
    }
    setFormError(null);

    // 1. Local heuristic - instant, deterministic.
    setResult(
      scoreClaim({
        category,
        claim,
        hasPhotos,
        hasListingUrl,
        hasReceipts,
        claimedAmount,
        incidentDate,
      }),
    );
    setResultCategory(category);

    // 2. Chain reads - comparable past disputes + category averages. A newer
    // run supersedes any in-flight one (seq guard instead of aborting, since
    // trackerFetch dedups requests across subscribers).
    const seq = ++runSeq.current;
    setSimilar({
      loading: true,
      error: null,
      configured: true,
      cases: [],
      matchCount: 0,
      stats: null,
    });
    try {
      const [sim, stats] = await Promise.all([
        trackerFetch("similar", { category, snippet: claim.slice(0, 500) }),
        trackerFetch("category_stats", { category }),
      ]);
      if (seq !== runSeq.current) return;
      if (sim?.configured === false) {
        setSimilar({
          loading: false,
          error: null,
          configured: false,
          cases: [],
          matchCount: 0,
          stats: null,
        });
        return;
      }
      if (sim?.error) throw new Error(sim.error);
      setSimilar({
        loading: false,
        error: null,
        configured: true,
        cases: Array.isArray(sim?.results) ? sim.results : [],
        matchCount: typeof sim?.match_count === "number" ? sim.match_count : 0,
        stats:
          stats && typeof stats.total_disputes === "number"
            ? (stats as CategoryStats)
            : null,
      });
    } catch (e: any) {
      if (seq !== runSeq.current) return;
      setSimilar({
        loading: false,
        error: e?.message || "Could not reach the analytics tracker.",
        configured: true,
        cases: [],
        matchCount: 0,
        stats: null,
      });
    }
  }, [category, claim, hasPhotos, hasListingUrl, hasReceipts, claimedAmount, incidentDate]);

  const meta = CATEGORIES[resultCategory];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ── Draft form ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="card h-fit overflow-hidden lg:sticky lg:top-24"
      >
        <div className={`h-1.5 bg-gradient-to-r ${CATEGORIES[category].gradient} transition-colors`} />
        <form
          className="p-6 sm:p-7"
          onSubmit={(e) => {
            e.preventDefault();
            void runPrecheck();
          }}
        >
          <div>
            <span className="label">Dispute category</span>
            <CategoryPicker value={category} onChange={setCategory} />
          </div>

          <div className="mt-6">
            <label className="label" htmlFor="sim-claim">
              Your claim, in your own words
            </label>
            <textarea
              id="sim-claim"
              className="input min-h-[140px] resize-y"
              placeholder={
                category === "RENTAL"
                  ? "The listing said 4 beds and a pool; we arrived on June 3rd to 2 beds and no pool. Paid $500 for 2 nights…"
                  : category === "PRODUCT"
                    ? "Order #10293 was advertised as new; the item I received on 3/12 was clearly used, scratched, and missing the charger…"
                    : category === "SOURCING"
                      ? "The brand claims 100% organic fair-trade cotton, but the certification registry shows their audit lapsed in 2025…"
                      : "Parcel 1Z999AA10123456784 was marked delivered on June 3rd, but nothing arrived and no one signed at 742 Evergreen Terrace…"
              }
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Be specific: dates, amounts, and “listing said X, actually Y” comparisons score
              highest.
            </p>
          </div>

          {/* Evidence readiness */}
          <div className="mt-6">
            <span className="label">Evidence readiness</span>
            <div className="space-y-2">
              {EVIDENCE_TOGGLES.map((t) => {
                const on = toggles[t.key];
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => setToggle[t.key]((v: boolean) => !v)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-200 ${
                      on
                        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10"
                        : "border-surface-border bg-surface-subtle hover:border-brand/40"
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold transition-colors ${
                        on
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-surface-border bg-surface text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-700">{t.label}</span>
                      <span className="block text-[11px] text-slate-400">{t.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount + date */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="sim-amount">
                Claimed amount
              </label>
              <input
                id="sim-amount"
                type="number"
                min="0"
                className="input"
                placeholder="500"
                value={claimedAmount}
                onChange={(e) => setClaimedAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="sim-date">
                Incident date
              </label>
              <input
                id="sim-date"
                type="date"
                className="input"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
              />
            </div>
          </div>

          {formError && (
            <motion.p
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10"
            >
              {formError}
            </motion.p>
          )}

          <button type="submit" className="btn-primary btn-shine mt-7 w-full">
            Run pre-check
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4"
            >
              <path d="M13 5l7 7-7 7M4 12h16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">
            Free and local - nothing is written on-chain and no gas is spent.
          </p>
        </form>
      </motion.div>

      {/* ── Results panel ──────────────────────────────────────────────── */}
      <div className="min-w-0">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="card grid min-h-[320px] place-items-center p-8 text-center"
            >
              <div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-hero-purple-light text-white shadow-soft">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    className="h-7 w-7"
                  >
                    <path
                      d="M12 3v3m6.4-.4-2.1 2.1M21 12h-3m.4 6.4-2.1-2.1M12 18v3m-6.4-.4 2.1-2.1M3 12h3m-.4-6.4 2.1 2.1"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="12" r="3.5" />
                  </svg>
                </div>
                <h2 className="mt-5 text-2xl text-slate-900">Your pre-check appears here</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                  Draft your claim on the left and run the pre-check to see its strength
                  score and how comparable disputes were refunded.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              {/* Strength gauge + breakdown */}
              <section className="card p-6 sm:p-7">
                <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-700">
                  Claim strength
                </h2>
                <StrengthGauge result={result} />
              </section>

              {/* Comparable disputes */}
              <section className="card p-6 sm:p-7">
                {similar?.loading ? (
                  <div className="space-y-3" aria-label="Loading comparable disputes">
                    <div className="h-4 w-48 rounded shimmer bg-surface-muted" />
                    <div className="h-16 rounded-xl shimmer bg-surface-muted" />
                    <div className="h-16 rounded-xl shimmer bg-surface-muted" />
                    <p className="text-center text-xs text-slate-400">
                      Reading past outcomes from the chain…
                    </p>
                  </div>
                ) : similar && !similar.configured ? (
                  <p className="text-sm text-slate-500">
                    The analytics tracker isn't configured on this deployment, so
                    comparable-case history is unavailable. Your strength score above
                    still applies.
                  </p>
                ) : similar?.error ? (
                  <div>
                    <p className="text-sm font-medium text-rose-500">
                      Couldn't load comparable disputes: {similar.error}
                    </p>
                    <button
                      type="button"
                      onClick={() => void runPrecheck()}
                      className="btn-ghost mt-3 px-4 py-2 text-sm"
                    >
                      Retry
                    </button>
                  </div>
                ) : similar ? (
                  <ComparableCases
                    category={resultCategory}
                    cases={similar.cases}
                    matchCount={similar.matchCount}
                    stats={similar.stats}
                  />
                ) : null}
              </section>

              {/* Non-binding disclaimer */}
              <section className="card relative overflow-hidden p-5 sm:p-6">
                <span
                  className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-400/15 blur-2xl"
                  aria-hidden
                />
                <div className="flex gap-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-500/10">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      className="h-5 w-5"
                    >
                      <path
                        d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      This simulation is not a verdict
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      The score is a local heuristic and past outcomes don't bind future
                      ones. If you file, your dispute is judged from scratch by
                      independent AI validators who fetch your evidence and settle the
                      refund on-chain via Optimistic Democracy.
                    </p>
                  </div>
                </div>
              </section>

              {/* CTA to the real filing flow */}
              <Link
                href={`/${meta.slug}`}
                className={`group flex items-center justify-between rounded-2xl bg-gradient-to-r ${meta.gradient} p-5 text-white shadow-soft transition-all duration-300 hover:shadow-lift sm:p-6`}
              >
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/75">
                    Ready to make it count?
                  </span>
                  <span className="mt-0.5 block text-lg font-bold">
                    File this {meta.title.toLowerCase()} dispute for real
                  </span>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 transition-transform duration-300 group-hover:translate-x-1">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="h-5 w-5"
                  >
                    <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
