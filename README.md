# Verdix — VerBnb

**Universal AI-Enforced Marketplace Dispute Resolution Platform**

> Every dispute. Resolved by AI consensus. On-chain.

Verdix resolves marketplace disputes without call centers, courts, or platform
intervention. Built on [GenLayer](https://genlayer.com), validators running
diverse LLMs **independently fetch the evidence, apply judgment, reach
consensus, and settle the outcome on-chain** through GenLayer's Optimistic
Democracy.

Four dispute categories, one registry:

| Category | Contract | What it judges |
| --- | --- | --- |
| **RENTAL** | `listing_accuracy_judge.py` | Airbnb-style listing accuracy disputes |
| **PRODUCT** | `not_as_described.py` | "Not as described" marketplace arbitration |
| **SOURCING** | `ethical_sourcing.py` | Brand ethical-sourcing claim validation |
| **DELIVERY** | `delivery_adjudicator.py` | Courier delivery-proof adjudication |
| *(router)* | `verBnb_registry.py` | Routes every dispute + tracks platform stats |

### Phase 2 — advanced trackers (new)

Four standalone contracts layer appeals, reputation, fraud detection, and
analytics on top of the existing flow **without modifying the 5 contracts above**:

| Contract | What it adds |
| --- | --- |
| `appeal_manager.py` | 7-day appeal window; each appeal opens a round with **N + 2** validators |
| `reputation_tracker.py` | Per-address win rate, validator accuracy, appeal success → 0–100 credibility |
| `fraud_detector.py` | Pattern flags: `REPEAT_DISPUTANT`, `SKEWED_VERDICTS`, `RAPID_CYCLING` (LOW/MEDIUM/HIGH) |
| `analytics_tracker.py` | Per-category outcome stats, consensus rate, similar-case keyword search |

**Integration model.** The GenLayer registry is deterministic-only and the
specialists are standalone contracts the frontend calls directly, so the four
trackers are likewise **standalone and orchestrated off-chain** — the server-side
API routes write to them at the existing lifecycle points (mirroring
`register_dispute` / `mark_resolved`). The registry stores their addresses and
exposes them via `get_extension_addresses` so the UI can discover them; its
original interface is unchanged (the 4 new constructor args are optional and can
also be set post-deploy via `set_extension_addresses`).

---

## Deployed contracts (GenLayer Bradbury testnet)

Chain ID `4221` · RPC `https://rpc-bradbury.genlayer.com`

| Contract | Address |
| --- | --- |
| `listing_accuracy_judge` (RENTAL) | `0x76e3Ff31Ca5cB4e6ce46EF109c52272F27151b32` |
| `not_as_described` (PRODUCT) | `0xBF6Efed489B28c2680FE0b3eF8Dffe4288e50548` |
| `ethical_sourcing` (SOURCING) | `0xb516DB96E8DefE26dE624dfF1f7D0802a828996D` |
| `delivery_adjudicator` (DELIVERY) | `0x63FFE6DE2988ABC6f49F3b3fd56415ef2A16d3AF` |
| **`verBnb_registry`** (entry point) | **`0x8aA6527B539814c454ee178dd7CE8cAd011834eB`** |

The frontend connects **only** to the registry; specialist addresses are
discovered at runtime via `get_contract_for_category`. The canonical record
lives in [`deployments/bradbury.json`](deployments/bradbury.json).

The 4 Phase 2 trackers are deployed with `--add-contracts` (see **Deploying**)
and recorded in the same `deployments/bradbury.json`, for a total of **9
contracts**. The frontend reads them via `NEXT_PUBLIC_APPEAL_MANAGER`,
`NEXT_PUBLIC_REPUTATION_TRACKER`, `NEXT_PUBLIC_FRAUD_DETECTOR`, and
`NEXT_PUBLIC_ANALYTICS_TRACKER`.

---

## Architecture

```
verBnb_registry.py          ← Master registry (deploy last)
├── listing_accuracy_judge.py   ← RENTAL  / Airbnb disputes
├── not_as_described.py         ← PRODUCT / marketplace disputes
├── ethical_sourcing.py         ← SOURCING / brand claim validation
└── delivery_adjudicator.py     ← DELIVERY / courier disputes
```

**Registry pattern.** Deploy the 4 specialists first to get addresses A–D, then
deploy the registry with `(A, B, C, D)` as constructor args. The registry routes
each category to its specialist and records every dispute for platform stats.

**Equivalence strategy.** All AI adjudication uses a custom leader/validator pair
via `gl.vm.run_nondet` (never `strict_eq` — LLM output is non-deterministic):

- The **leader** fetches evidence, runs the LLM, and returns a clean JSON verdict.
- Each **validator** independently re-fetches and re-judges, then agrees if:
  - its `refund_percentage` is within **±15** of the leader's (RENTAL, PRODUCT, SOURCING uses ±15 on `trust_score`), or
  - its `verdict` string **matches exactly** (DELIVERY).

**LLM resilience (all contracts).** JSON-only prompts, defensive `json` parsing,
required-field validation, error classification (`LLM_ERROR` / `EXTERNAL`), and
web fetches always sliced to `[:2000]` to avoid token overflow.

---

## Tech stack

| Layer | Tooling |
| --- | --- |
| Contracts | Python · GenLayer Intelligent Contracts · GenVM |
| Network | GenLayer Bradbury testnet |
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| Chain client | `genlayer-js` (frontend) · `genlayer-py` (deploy) |
| Evidence | IPFS via Pinata |
| Testing | `pytest` (direct mode) · `gltest` (integration) |
| Linting | `genvm-linter` |

---

## Setup

### 1. Backend (contracts, tests, deploy)

```bash
# from repo root
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `.env` (gitignored) from the template:

```bash
cp .env.example .env
# then edit .env:
#   GENLAYER_PRIVATE_KEY=0x...   (funded Bradbury key)
#   GENLAYER_NETWORK=testnet_bradbury
```

Get testnet funds from the **faucet**: <https://testnet-faucet.genlayer.foundation>

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local      # registry address is pre-filled
# add your PINATA_JWT and a server-side GENLAYER_PRIVATE_KEY to .env.local
npm run dev                            # http://localhost:3000
```

---

## Quality gates

```bash
# 1. Lint every contract
genvm-lint check contracts/verBnb_registry.py --json
genvm-lint check contracts/listing_accuracy_judge.py --json
genvm-lint check contracts/not_as_described.py --json
genvm-lint check contracts/ethical_sourcing.py --json
genvm-lint check contracts/delivery_adjudicator.py --json

# 2. Direct tests (fast, mocked, no network) — 78 tests
pytest tests/direct/ -v

# 3. Integration test (needs a live GenLayer env)
gltest tests/integration/ -v -s --network localnet
gltest tests/integration/test_full_flow_with_appeals.py -v -s --network localnet

# 4. Frontend build
cd frontend && npm run build
```

> **Testing note.** Direct-mode tests run the real `py-genlayer-std` SDK
> in-process and cover the full storage layout + LLM resilience paths. The
> lightweight `glsim` simulator currently mishandles `@allow_storage`
> dataclasses inside a `TreeMap`, so use **local Studio** (`genlayer up`) or
> **testnet** for true end-to-end consensus.

---

## Deploying

```bash
# uses GENLAYER_PRIVATE_KEY + GENLAYER_NETWORK from .env
python tools/deploy.py --network testnet_bradbury
```

The script deploys the 4 specialists and the 4 Phase 2 trackers, then the
registry (wired to all 8 dependency addresses), writing all 9 to
`deployments/bradbury.json` incrementally.

To add the Phase 2 trackers to an **already-deployed** 5-contract setup without
redeploying the registry:

```bash
python tools/deploy.py --network testnet_bradbury --add-contracts
```

This deploys only the 4 trackers and wires them into the existing registry via
`set_extension_addresses`. Afterwards, copy the 4 new addresses from
`deployments/bradbury.json` into `frontend/.env.local`.

---

## How to raise a dispute (step by step)

1. Open the app and pick a category (Rental, Marketplace, Sourcing, Delivery).
2. **Upload your evidence** — photos, a report, a tracking screenshot. It is
   pinned to **IPFS via Pinata** and the resulting gateway URL is filled in
   automatically.
3. Fill in the listing/order details (URLs, amount, claim text, address).
4. Click **Submit dispute**. The server route:
   - asks the registry for the right specialist contract,
   - calls that specialist's write method (`raise_dispute` / `validate_claim`),
   - registers the dispute in the registry for tracking.
5. You're redirected to `/dispute/[id]`, which **polls every 10 s** and shows:
   - a **consensus tracker** (Submitted → Proposing → Committing → Revealing → Finalized),
   - a **verdict card** with the verdict, refund %, trust score, and reasoning.
6. Copy the dispute ID to check back any time.

---

## How validators reach consensus (brief)

GenLayer uses **Optimistic Democracy** ([Condorcet's Jury
Theorem](https://en.wikipedia.org/wiki/Condorcet%27s_jury_theorem)): a diverse
set of validators is more likely to reach the correct answer than any one model.

For each dispute:

1. A **leader** validator runs the contract's `leader_fn` — it fetches the
   evidence URLs, sends them to an LLM with a strict JSON prompt, and returns a
   structured verdict.
2. Every other validator runs `validator_fn` — it **independently** re-fetches
   the same evidence and re-asks an LLM, then votes **agree** if its result is
   close enough to the leader's (refund within ±15, or an exact verdict-string
   match for delivery).
3. If a majority agrees, the result is **accepted** and written on-chain. If
   not, the leader rotates and the round repeats.
4. Anyone can **appeal** an accepted result, triggering re-evaluation by a
   larger validator set, until the decision is finalized.

No single model, operator, or platform decides the outcome — the judgment
emerges from the validator set.

---

## Project layout

```
VerBnb/
├── contracts/            # 9 intelligent contracts (5 core + 4 Phase 2 trackers)
├── tests/
│   ├── direct/           # 78 fast mocked tests (pytest)
│   └── integration/      # full registry-routed flow + appeals flow (gltest)
├── tools/deploy.py       # Bradbury deploy script (--add-contracts mode)
├── deployments/bradbury.json
├── frontend/             # Next.js 14 app
├── gltest.config.yaml
├── requirements.txt
└── .env.example
```

### Frontend pages (Phase 2 additions)

The App Router serves these at the route path (each is a `page.tsx`):

| Route | What it shows |
| --- | --- |
| `/analytics` | Platform KPIs, category pie/bar charts (recharts), per-category deep dives |
| `/validator` | Per-validator stats, agreement rate, estimated earnings chart |
| `/user` | Reputation summary, activity timeline, dispute history (lookup by address) |
| `/appeals/[id]` | Original verdict, 7-day window, appeal form / appeal status tracker |

Reusable components: `ReputationBadge`, `AppealForm`, `FraudAlert`,
`SimilarCases`. The dispute page (`/dispute/[id]`) gains an **Appeal this
verdict** CTA and a fraud badge; `VerdictCard` gains reputation badges and a
"validators agree" line.
# VerBnb
