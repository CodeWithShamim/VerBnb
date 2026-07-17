# VerBnb Roadmap

> Last updated: 2026-07-18 · Live on the [GenLayer Studio Network](https://studio.genlayer.com) · [ver-bnb.vercel.app](https://ver-bnb.vercel.app)

This roadmap tracks where VerBnb is and where it is going. Shipped phases are
facts; future phases are intent and may be reordered as GenLayer's own roadmap
(mainnet, validator set growth) firms up.

**Status legend:** ✅ Shipped · 🔨 In progress · 🔜 Planned · 💡 Exploring

---

## Phase 1 — Core Dispute Resolution ✅

The foundation: AI-consensus arbitration for four marketplace dispute
categories, settled on-chain.

- ✅ Registry pattern — single entry point (`verBnb_registry`) routing to four
  specialist contracts, discovered at runtime via `get_contract_for_category`
- ✅ **RENTAL** — `listing_accuracy_judge` (Airbnb-style listing accuracy)
- ✅ **PRODUCT** — `not_as_described` (marketplace arbitration)
- ✅ **SOURCING** — `ethical_sourcing` (brand claim validation)
- ✅ **DELIVERY** — `delivery_adjudicator` (courier proof adjudication)
- ✅ Leader/validator consensus via `gl.vm.run_nondet` with ±15 refund-percentage
  agreement bands (exact verdict match for DELIVERY)
- ✅ Evidence pinned to IPFS via Pinata
- ✅ Frontend dispute flows with live consensus tracker
  (Submitted → Proposing → Committing → Revealing → Finalized)

## Phase 2 — Trust & Platform Layer ✅

Standalone tracker contracts orchestrated off-chain at dispute lifecycle points.

- ✅ Appeal Manager — 7-day appeal window, escalation to a larger validator set
- ✅ On-chain appeal consensus in **all four specialist judges** — each judge
  re-runs `gl.vm.run_nondet` over its own stored evidence with a stricter
  agreement bar per round (`resolve_appeal`), and the appeal manager finalizes
  by reading that outcome cross-contract (`finalize_appeal_from_state`); the
  verdict is never supplied off-chain
- ✅ Round-bound appeal outcomes — every outcome is stored under its consensus
  round, rounds are strictly monotonic, the appeal manager only accepts the
  outcome recorded for the appeal's exact round, and the legacy owner-written
  `finalize_appeal` path is removed; validated reproducibly in `tests/sim/`
  (glsim, no network or LLM keys) and surfaced in the UI as a full round
  history with per-round escalation
- ✅ Reputation Tracker — per-user reputation from dispute history
- ✅ Fraud Detector — pattern detection across disputes
- ✅ Analytics Tracker — platform statistics powering `/analytics`
- ✅ Frontend surfaces: `/appeals`, `/leaderboard`, `/analytics`, `/explorer`,
  `/activity`, `/user`, `/validator`, `/simulator`, in-app `/docs`

## Phase 3 — Curation (Product Suggester) 🔨

Turning the same validator consensus into a curation feed: validators
independently LLM-extract top product picks from trusted review sites and
publish the agreed list on-chain.

- ✅ `product_suggester` contract — owner-managed trusted-domain allowlist,
  `refresh_suggestions(topic, source_url)`, ≥50 % product-name overlap consensus
- ✅ `/suggestions` page reading via `/api/suggestions`
- 🔨 Home-page suggestions surface (`HomeSuggestions`)
- 🔜 Scheduled auto-refresh so topics never go stale (cron-driven
  `refresh_suggestions` runs)
- 🔜 Broader trusted-domain allowlist beyond the Wirecutter/RTINGS defaults
- 💡 Multi-source aggregation per topic (consensus across several review sites,
  not one page per refresh)

## Phase 4 — Real Settlement 🔜

Today verdicts are recorded on-chain but money does not move. This phase makes
the refund percentage enforceable.

- 🔜 Escrow contract — buyer funds held at purchase, released per the verdict's
  refund split
- 🔜 Appeal-bonded escalation — appellants stake a bond, slashed on frivolous
  appeals
- 🔜 Reputation-weighted dispute limits (fraud-flagged users face stricter
  evidence requirements)
- 💡 Partial-settlement plans (structured refund schedules for high-value
  disputes)

## Phase 5 — Production Hardening 🔜

- 🔜 Notifications for dispute state changes (email/webhook when a verdict or
  appeal lands)
- 🔜 Contract security review ahead of any value-bearing deployment
- 🔜 Load/latency benchmarking of the consensus tracker under many concurrent
  disputes
- 🔜 GenLayer **mainnet** deployment when the network launches (currently
  GenLayer Studio Network, chain ID 61999)

## Phase 6 — Open Platform 💡

- 💡 Marketplace SDK / public API so third-party platforms can plug disputes
  into VerBnb instead of running support desks
- 💡 Governance of the trusted-domain allowlist and consensus parameters
  (community-curated rather than owner-managed)
- 💡 Additional dispute categories (services, freelance work, event tickets)
- 💡 Cross-chain verdict attestation so settlements can execute on other chains

---

## Non-goals

- **Custodial funds on testnet** — no real value flows until Phase 4 + audit.
- **Human moderators** — the whole point is AI-validator consensus; we won't
  add a manual override path.
- **Hardcoded contract addresses in the UI** — the frontend resolves specialists
  through the registry and env overrides only.

Contributions toward any 🔜/💡 item are welcome — see
[Contributing](README.md#contributing).
