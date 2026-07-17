# VerBnb - AI-Enforced Marketplace Dispute Resolution

> Every dispute. Resolved by AI consensus. On-chain.

[Live App](https://ver-bnb.vercel.app) ·
[Docs](https://ver-bnb.vercel.app/docs) ·
[Roadmap](ROADMAP.md) ·
[GenLayer Studio](https://studio.genlayer.com) ·
[GenLayer Portal](https://portal.genlayer.foundation)

---

## What is VerBnb?

VerBnb resolves marketplace disputes without call centers, courts, or platform
intervention. Built on [GenLayer](https://genlayer.com), a network of AI
validators independently fetch evidence, apply LLM judgment, reach consensus,
and settle outcomes on-chain through **Optimistic Democracy**.

Four dispute categories, one registry:

| Category | What it judges |
| --- | --- |
| 🏠 **RENTAL** | Airbnb-style listing accuracy |
| 📦 **PRODUCT** | "Not as described" marketplace arbitration |
| 🌿 **SOURCING** | Brand ethical-sourcing claim validation |
| 🚚 **DELIVERY** | Courier delivery-proof adjudication |

Beyond disputes, the **Product Suggester** contract turns the same validator
consensus into a curation feed: it fetches product-roundup pages from an
owner-approved allowlist of trusted review sites (e.g. RTINGS), validators
independently extract the top picks with an LLM, and the agreed list is
published on-chain - browsable at [/suggestions](https://ver-bnb.vercel.app/suggestions).

---

## How It Works

1. **Submit** - Upload evidence to IPFS, describe your claim in plain English.
2. **Validate** - GenLayer AI validators independently fetch and judge the evidence.
3. **Consensus** - Optimistic Democracy: a leader proposes, validators agree or appeal.
4. **Verdict** - Refund percentage and reasoning written on-chain, permanently.

---

## Deployed Contracts (GenLayer Studio Network · Chain ID 61999)

| Contract | Address |
| --- | --- |
| Registry (entry point) | `0x029DC6adBdF5C5DdBF90a71b9895FC506A0Fd115` |
| RENTAL - `listing_accuracy_judge` | `0xB384a4951c1627Ec110fdd481f5d4ECf34D25C15` |
| PRODUCT - `not_as_described` | `0x4CFf6E02EB8ee9BaA3Be68E55B2C0143161C7341` |
| SOURCING - `ethical_sourcing` | `0xb378Daef5Af4eeec237521379a37126C585fB970` |
| DELIVERY - `delivery_adjudicator` | `0x146D6d3cA35A5cF1f38cf2aaa1cA1CaCB3bbeb1b` |
| Appeal Manager | `0x8BDF93b8011C67766E1C3b82B28D24E62A15581B` |
| Reputation Tracker | `0xD087F6Ab2f4681ff475f69a94Dbdf8bf6d2efc86` |
| Fraud Detector | `0x1184E6972bf4F8290eC168893EBE9037B6bE8fF4` |
| Analytics Tracker | `0x1b8F3Eab2585a161cf3bADe15dE267D90Fdde77c` |
| Product Suggester | `0x72E08498F3d4FDe14D4f230DC56C6353fa8ff19f` |

This full deployment (2026-07-18, all 10 contracts) brings **round-bound
on-chain appeal consensus**: all four judges support `resolve_appeal` with
strictly monotonic rounds, store every round's outcome under its own round key
(`get_appeal_outcome_for_round`), and the appeal manager finalizes **only**
from the outcome recorded for the appeal's exact round
(`finalize_appeal_from_state`) — the legacy owner-written `finalize_appeal`
path is removed.

RPC: `https://studio.genlayer.com/api` (no public block explorer; explorer
links in the UI are hidden unless `NEXT_PUBLIC_GL_EXPLORER` is set).

> The frontend connects **only** to the registry; the four specialist addresses
> are discovered at runtime via `get_contract_for_category`, so the UI never
> hardcodes them. The single source of truth is
> [`deployments/studionet.json`](deployments/studionet.json) (written by the
> deploy script) - the frontend reads addresses straight from it, so a
> re-deploy needs no code or env change. Contract addresses are **not** read
> from `.env`.

---

## Architecture

```
verBnb_registry.py              ← Master registry (single entry point)
├── listing_accuracy_judge.py   ← RENTAL
├── not_as_described.py         ← PRODUCT
├── ethical_sourcing.py         ← SOURCING
├── delivery_adjudicator.py     ← DELIVERY
├── appeal_manager.py           ← Appeals & escalation
├── reputation_tracker.py       ← User reputation
├── fraud_detector.py           ← Pattern detection
├── analytics_tracker.py        ← Platform statistics
└── product_suggester.py        ← Trusted-site product curation (standalone)
```

**Registry pattern.** Deploy the 4 specialists first to get their addresses,
then deploy the registry wired to them. The registry routes each category to its
specialist and records every dispute for platform stats.

**Phase 2 trackers** (appeal / reputation / fraud / analytics) are standalone
contracts orchestrated off-chain: the server-side API routes write to them at the
existing dispute lifecycle points. The registry stores their addresses and
exposes them via `get_extension_addresses`; its original interface is unchanged.

**Product Suggester** is also standalone (not registry-routed): the owner
maintains a trusted-domain allowlist, `refresh_suggestions(topic, source_url)`
has the leader fetch the page and LLM-extract up to 5 products, and validators
agree when at least half of the product names overlap. The frontend reads it
via `/api/suggestions` and renders the picks at `/suggestions`.

**Consensus strategy.** All AI adjudication uses a leader/validator pair via
`gl.vm.run_nondet` - never `strict_eq`, because LLM output is non-deterministic:

- The **leader** fetches evidence, runs the LLM, and returns a clean JSON verdict.
- Each **validator** independently re-fetches and re-judges, then agrees if the
  `refund_percentage` is within **±15** of the leader's, or (for DELIVERY) the
  `verdict` string matches exactly.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Contracts | Python · GenLayer Intelligent Contracts · GenVM |
| Network | GenLayer Studio Network |
| Frontend | Next.js 14 · TypeScript · Tailwind CSS |
| 3D | React Three Fiber · Three.js · Drei |
| Animation | Framer Motion · GSAP · Lenis |
| Chain client | `genlayer-js` (frontend) · `genlayer-py` (deploy) |
| Evidence | IPFS via Pinata |
| Testing | `pytest` (direct) · `gltest` (integration) |

---

## Local Setup

### Prerequisites
- Node.js 20+
- Python 3.11+
- GenLayer CLI: `npm install -g genlayer`
- No faucet needed: Studio Network accounts are funded automatically

### Backend (Contracts)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: GENLAYER_PRIVATE_KEY=0x...
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local: PINATA_JWT=... (registry + tracker addresses pre-filled)
npm run dev   # → http://localhost:3000
```

---

## Quality Gates

```bash
# Contracts
genvm-lint check contracts/*.py --json
pytest tests/direct/ -v          # fast mocked unit tests
pytest tests/sim/ -v             # reproducible state-derived appeal flow (glsim, no network/keys)
gltest tests/integration/ -v -s  # full consensus integration

# Frontend
cd frontend
npm run lint
npm run build
```

---

## Deployment

```bash
# Deploy all 10 contracts (writes deployments/studionet.json incrementally)
python tools/deploy.py --network studionet

# Add only the 4 Phase 2 trackers to an already-deployed 5-contract setup
python tools/deploy.py --network studionet --add-contracts
```

The frontend picks the new addresses up from `deployments/studionet.json`
automatically - no env change needed.

---

## How to Raise a Dispute (Step by Step)

1. Open <https://ver-bnb.vercel.app>.
2. Click your dispute category (Rental, Marketplace, Sourcing, Delivery).
3. Fill in the listing URL, order details, and your claim.
4. Upload evidence (photos, documents) → pinned to IPFS.
5. Submit → the transaction is sent to GenLayer.
6. Watch the consensus tracker: Submitted → Proposing → Committing → Revealing → Finalized.
7. The verdict appears: refund percentage + validator reasoning.
8. Disagree? Click **Appeal** within 7 days.

---

## How Validators Reach Consensus

GenLayer uses **Optimistic Democracy** ([Condorcet's Jury
Theorem](https://en.wikipedia.org/wiki/Condorcet%27s_jury_theorem)): a diverse
validator set is more likely to reach the correct answer than any single model.

1. A **leader** validator runs the contract's `leader_fn` - it fetches the
   evidence URLs, asks an LLM with a strict JSON prompt, and returns a structured
   verdict.
2. Every other validator runs `validator_fn` - it independently re-fetches and
   re-asks an LLM, then votes **agree** if its result is close enough (refund
   within ±15, or an exact verdict string for delivery).
3. Majority agree → accepted, written on-chain.
4. Majority disagree → the leader rotates and the round repeats.
5. Anyone can **appeal** → a larger validator set re-evaluates. The specialist
   re-runs consensus over its own stored evidence (`resolve_appeal`) and stamps
   the outcome with its **consensus round**; the appeal manager finalizes only
   from that round-bound on-chain state (`finalize_appeal_from_state`) — there
   is no path that accepts a caller-supplied verdict, and an outcome recorded
   for one round can never finalize an appeal of another round.

No single model, operator, or platform decides the outcome.

---

## Project Structure

```
VerBnb/
├── contracts/            # 10 intelligent contracts (Python)
├── tests/
│   ├── direct/           # Mocked unit tests (pytest)
│   ├── sim/              # Reproducible cross-contract appeal flow (glsim, in-process)
│   └── integration/      # Full consensus tests (gltest)
├── tools/deploy.py       # Deployment script
├── deployments/
│   └── studionet.json    # All 10 deployed addresses
├── frontend/
│   ├── app/              # Next.js App Router pages (incl. /docs user guide)
│   ├── components/       # React components (2D + 3D)
│   ├── lib/              # Client, constants, utilities
│   └── scripts/          # Maintenance (e.g. backfill-analytics.mjs)
├── README.md
└── ROADMAP.md            # Phased roadmap (shipped → planned → exploring)
```

---

## Contributing

1. Fork the repository.
2. Create your feature branch: `git checkout -b feature/my-feature`.
3. Commit changes: `git commit -m 'Add my feature'`.
4. Push: `git push origin feature/my-feature`.
5. Open a Pull Request.

The in-app user guide lives at [/docs](https://ver-bnb.vercel.app/docs)
(`frontend/app/docs/page.tsx`); the contract reference and architecture notes
are in this README.

---

## License

MIT © 2026 [@NOYON_12](https://github.com/CodeWithShamim)

Built with [GenLayer](https://genlayer.com) ·
Deployed on the [GenLayer Studio Network](https://studio.genlayer.com) ·
Frontend on [Vercel](https://vercel.com)
