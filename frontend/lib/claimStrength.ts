// claimStrength.ts - LOCAL heuristic pre-check for the Refund Simulator.
//
// ⚠️  This is NOT the validators' judgment. Real VerBnb disputes are decided
// on-chain by independent GenLayer AI validators through Optimistic
// Democracy, after they fetch and weigh the actual evidence. This module is a
// transparent, deterministic, client-side heuristic that estimates how
// *well-formed* a draft claim is before the user pays gas to file it.
//
// Design goals:
//  - Pure function: same input → same output, no I/O, no randomness. Safe to
//    unit-test and to run on every "Run pre-check" click.
//  - Transparent: the total is the exact sum of labeled sub-scores, each with
//    a max and (when points were missed) a concrete improvement tip, so the
//    UI can render a checklist instead of a black-box number.
//  - Cheap signals only: word counts, digit/currency/date regexes, evidence
//    toggles, tone checks and per-category keyword checks. Nothing here
//    understands the claim - it only measures specificity and preparedness,
//    which historically correlate with claims validators can verify.
//
// Score bands: 0-44 weak · 45-69 fair · 70-100 strong.

import type { Category } from "@/lib/contracts";

export type StrengthTier = "weak" | "fair" | "strong";

export interface BreakdownItem {
  /** Human label for the checklist row. */
  label: string;
  /** Points awarded for this component. */
  points: number;
  /** Maximum points this component can award. */
  max: number;
  /** Improvement tip - present only when points < max. */
  tip?: string;
}

export interface ClaimStrengthInput {
  category: Category;
  /** The draft claim text. */
  claim: string;
  /** Evidence-readiness toggles from the simulator form. */
  hasPhotos: boolean;
  hasListingUrl: boolean;
  hasReceipts: boolean;
  /** Raw "claimed amount" input (string so empty stays distinguishable). */
  claimedAmount?: string;
  /** Incident date as yyyy-mm-dd (native <input type="date"> value). */
  incidentDate?: string;
}

export interface ClaimStrengthResult {
  /** 0-100, the exact sum of breakdown points. */
  score: number;
  tier: StrengthTier;
  breakdown: BreakdownItem[];
}

// ---------------------------------------------------------------- regexes

/** $120, €45.50, 1,200 USD, 40 dollars … */
const CURRENCY_RE =
  /(?:[$€£¥]\s?\d[\d,]*(?:\.\d+)?)|(?:\b\d[\d,]*(?:\.\d+)?\s?(?:usd|eur|gbp|dollars?|euros?|cents?)\b)/i;

/** 2026-07-01, 3/12, 12.06.2026, "June 3", "Mar 12" … */
const DATE_RE =
  /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\/.]\d{1,2}(?:[\/.]\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2})\b/i;

/** "the listing said / seller advertised / host promised / described as …" */
const PROMISE_RE =
  /\b(?:said|says|stated|advertised|promised|described|claimed|guaranteed|listed(?:\s+as)?|supposed\s+to)\b/i;

/** "… actually / instead / turned out / what I received / never arrived …" */
const REALITY_RE =
  /\b(?:actually|instead|in\s+fact|turned\s+out|received|arrived|got|in\s+reality|was\s+not|wasn'?t|never|missing|different)\b/i;

/** Common courier tracking formats (UPS 1Z…, UPU SS123456789CC, long digit runs). */
const TRACKING_RE = /\b(?:1Z[0-9A-Z]{10,16}|[A-Z]{2}\d{9}[A-Z]{2}|\d{12,22})\b/;

const URL_RE = /https?:\/\/\S+/i;

// ---------------------------------------------------------------- helpers

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** Words of 4+ letters written entirely in capitals (shouting heuristic). */
function capsWordCount(text: string): number {
  let n = 0;
  for (const w of words(text)) {
    const letters = w.replace(/[^a-zA-Z]/g, "");
    if (letters.length >= 4 && letters === letters.toUpperCase()) n += 1;
  }
  return n;
}

function push(
  breakdown: BreakdownItem[],
  label: string,
  points: number,
  max: number,
  tip: string,
): number {
  const clamped = Math.max(0, Math.min(max, Math.round(points)));
  breakdown.push({
    label,
    points: clamped,
    max,
    ...(clamped < max ? { tip } : {}),
  });
  return clamped;
}

// ------------------------------------------------------- category checks

/** Two 5-point keyword checks per category → max 10. */
function categoryCheck(
  category: Category,
  claim: string,
  hasListingUrl: boolean,
): { label: string; points: number; tip: string } {
  const hasUrlInText = URL_RE.test(claim);
  switch (category) {
    case "RENTAL": {
      let pts = 0;
      if (hasListingUrl || hasUrlInText) pts += 5;
      if (/\b(?:check.?in|checkout|stay|night|booking|reservation|host|listing|property|apartment|room|guests?)\b/i.test(claim))
        pts += 5;
      return {
        label: "Rental specifics",
        points: pts,
        tip: "Reference the listing URL and stay details (check-in date, nights, what the listing promised).",
      };
    }
    case "PRODUCT": {
      let pts = 0;
      if (/\b(?:order|item|sku|model|serial|purchase|#\s?\d+)\b/i.test(claim)) pts += 5;
      if (/\b(?:condition|damaged|broken|fake|counterfeit|used|refurbished|missing|defect\w*|scratch\w*|not\s+as\s+described|different)\b/i.test(claim))
        pts += 5;
      return {
        label: "Marketplace specifics",
        points: pts,
        tip: "Name the order/item and describe exactly how the received product differs from the listing.",
      };
    }
    case "SOURCING": {
      let pts = 0;
      if (/\b(?:certif\w*|organic|fair.?trade|audit\w*|registry|supplier|label\w*|sustainab\w*|ethical)\b/i.test(claim))
        pts += 5;
      if (hasListingUrl || hasUrlInText) pts += 5;
      return {
        label: "Sourcing specifics",
        points: pts,
        tip: "Cite the certification/registry (e.g. fair-trade, organic) and link the public page validators can fetch.",
      };
    }
    case "DELIVERY": {
      let pts = 0;
      if (TRACKING_RE.test(claim) || /\btracking\b/i.test(claim)) pts += 5;
      if (/\b(?:address|courier|carrier|deliver\w*|signed|signature|parcel|package|shipment|doorstep|left)\b/i.test(claim))
        pts += 5;
      return {
        label: "Delivery specifics",
        points: pts,
        tip: "Include the tracking number and delivery details (address, courier, what the proof-of-delivery shows).",
      };
    }
  }
}

// ----------------------------------------------------------------- scorer

/**
 * Score a draft claim 0-100 with a labeled breakdown.
 *
 * Components (sum of maxima = 100):
 *  1. Detail & length ......... 15  (word count of the claim)
 *  2. Specific facts .......... 15  (currency amount / date / any numbers)
 *  3. Expectation vs reality .. 10  ("listing said X … actually Y" language)
 *  4. Evidence readiness ...... 30  (photos / listing-order URL / receipts)
 *  5. Amount & timing ......... 10  (claimed amount + incident date filled in)
 *  6. Measured tone ........... 10  (no ALL-CAPS shouting or "!!!" runs)
 *  7. Category specifics ...... 10  (e.g. tracking # for DELIVERY)
 */
export function scoreClaim(input: ClaimStrengthInput): ClaimStrengthResult {
  const claim = input.claim || "";
  const breakdown: BreakdownItem[] = [];
  let score = 0;

  // 1. Detail & length (15): ~80 words earns full credit; a one-liner earns
  // little. Linear ramp so partial effort shows partial points.
  const wc = words(claim).length;
  score += push(
    breakdown,
    "Detail & length",
    (wc / 80) * 15,
    15,
    wc === 0
      ? "Write the claim - validators can only judge what you tell them."
      : "Expand the story: what was promised, what happened, when, and what it cost you (aim for ~80+ words).",
  );

  // 2. Specific facts (15): concrete, checkable details.
  let facts = 0;
  if (CURRENCY_RE.test(claim)) facts += 5; // a money amount in the text
  if (DATE_RE.test(claim)) facts += 5; // a date in the text
  if (/\d/.test(claim)) facts += 5; // any number (qty, room count, order #…)
  score += push(
    breakdown,
    "Specific facts (amounts, dates, quantities)",
    facts,
    15,
    "Mention concrete numbers: the price paid, the incident date, quantities (\"2 of 3 items\", \"advertised 4 beds\").",
  );

  // 3. Expectation vs reality (10): the strongest claims contrast what was
  // promised with what was delivered.
  let contrast = 0;
  if (PROMISE_RE.test(claim)) contrast += 5;
  if (REALITY_RE.test(claim)) contrast += 5;
  score += push(
    breakdown,
    "Expectation vs. reality contrast",
    contrast,
    10,
    "Use direct comparison: \"the listing said X, but what I actually got was Y\".",
  );

  // 4. Evidence readiness (30): each toggle is worth 10. Validators fetch
  // evidence independently, so having it ready is the single biggest lever.
  let evidence = 0;
  if (input.hasPhotos) evidence += 10;
  if (input.hasListingUrl) evidence += 10;
  if (input.hasReceipts) evidence += 10;
  score += push(
    breakdown,
    "Evidence ready (photos · listing/order URL · receipts)",
    evidence,
    30,
    "Gather what's missing: photos of the problem, the public listing/order URL, and receipts or tracking records.",
  );

  // 5. Amount & timing (10): a positive claimed amount and a plausible
  // (non-future) incident date.
  let meta = 0;
  const amount = parseFloat((input.claimedAmount || "").replace(/[, ]/g, ""));
  if (Number.isFinite(amount) && amount > 0) meta += 5;
  if (input.incidentDate) {
    const d = new Date(`${input.incidentDate}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.getTime() <= Date.now()) meta += 5;
  }
  score += push(
    breakdown,
    "Claimed amount & incident date",
    meta,
    10,
    "Fill in how much you're claiming and when the incident happened (a future date won't count).",
  );

  // 6. Measured tone (10): start at 10 and deduct for shouting. Neutral,
  // factual claims are easier for validators to verify than rants.
  const caps = capsWordCount(claim);
  const exclaimRuns = (claim.match(/!{2,}/g) || []).length;
  let tone = 10;
  tone -= Math.min(6, caps * 2); // -2 per ALL-CAPS word, capped
  tone -= Math.min(4, exclaimRuns * 2); // -2 per "!!"+ run, capped
  score += push(
    breakdown,
    "Measured, factual tone",
    tone,
    10,
    "Drop the ALL-CAPS and exclamation runs - state facts calmly; validators verify evidence, not volume.",
  );

  // 7. Category-specific checks (10).
  const cat = categoryCheck(input.category, claim, input.hasListingUrl);
  score += push(breakdown, cat.label, cat.points, 10, cat.tip);

  const total = Math.max(0, Math.min(100, score));
  const tier: StrengthTier = total >= 70 ? "strong" : total >= 45 ? "fair" : "weak";
  return { score: total, tier, breakdown };
}

/**
 * Display label + accent hex per tier (rose / amber / emerald). Tailwind class
 * names deliberately live in the components (tailwind.config.ts only scans
 * app/ and components/, so class literals here would be purged).
 */
export const TIER_META: Record<StrengthTier, { label: string; hex: string }> = {
  weak: { label: "Weak", hex: "#f43f5e" },
  fair: { label: "Fair", hex: "#f59e0b" },
  strong: { label: "Strong", hex: "#10b981" },
};
