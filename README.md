# VerBnb - AI-Enforced Marketplace Dispute Resolution

> Every dispute. Resolved by AI consensus. On-chain.

[Live App](https://ver-bnb.vercel.app) ·
[Docs](https://ver-bnb.vercel.app/docs) ·
[Explorer](https://explorer-bradbury.genlayer.com) ·
[GenLayer Portal](https://portal.genlayer.foundation) ·
[Faucet](https://testnet-faucet.genlayer.foundation)

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

---

## How It Works

1. **Submit** - Upload evidence to IPFS, describe your claim in plain English.
2. **Validate** - GenLayer AI validators independently fetch and judge the evidence.
3. **Consensus** - Optimistic Democracy: a leader proposes, validators agree or appeal.
4. **Verdict** - Refund percentage and reasoning written on-chain, permanently.

---

## Deployed Contracts (Bradbury Testnet · Chain ID 4221)

| Contract | Address |
| --- | --- |
| Registry (entry point) | `0x5d6DF470903AbC697B5F3b75a3f895470E65aE6C` |
| RENTAL - `listing_accuracy_judge` | `0x76e3Ff31Ca5cB4e6ce46EF109c52272F27151b32` |
| PRODUCT - `not_as_described` | `0xBF6Efed489B28c2680FE0b3eF8Dffe4288e50548` |
| SOURCING - `ethical_sourcing` | `0xb516DB96E8DefE26dE624dfF1f7D0802a828996D` |
| DELIVERY - `delivery_adjudicator` | `0x63FFE6DE2988ABC6f49F3b3fd56415ef2A16d3AF` |
| Appeal Manager | `0x86d5E6DAe032fb62EdA7cE345F37374BCbb96e19` |
| Reputation Tracker | `0x5A92cd40E7FE241177b924bb4Ed5dEE5d0CaCfa9` |
| Fraud Detector | `0x27e840Bc1fa7C0448FeF03AA34E64ddcf76010E2` |
| Analytics Tracker | `0x840B72a83aa2707AF8aD84e4537B6a5c78459A4B` |

RPC: `https://rpc-bradbury.genlayer.com` · Explorer: `https://explorer-bradbury.genlayer.com`

> The frontend connects **only** to the registry; the four specialist addresses
> are discovered at runtime via `get_contract_for_category`, so the UI never
> hardcodes them. The canonical record lives in
> [`deployments/bradbury.json`](deployments/bradbury.json). All addresses are
> env-overridable so the same UI works against a re-deploy without a code change.

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
└── analytics_tracker.py        ← Platform statistics
```

**Registry pattern.** Deploy the 4 specialists first to get their addresses,
then deploy the registry wired to them. The registry routes each category to its
specialist and records every dispute for platform stats.

**Phase 2 trackers** (appeal / reputation / fraud / analytics) are standalone
contracts orchestrated off-chain: the server-side API routes write to them at the
existing dispute lifecycle points. The registry stores their addresses and
exposes them via `get_extension_addresses`; its original interface is unchanged.

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
| Network | GenLayer Bradbury Testnet |
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
- Testnet GEN: <https://testnet-faucet.genlayer.foundation>

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
gltest tests/integration/ -v -s  # full consensus integration

# Frontend
cd frontend
npm run lint
npm run build
```

---

## Deployment

```bash
# Deploy all 9 contracts (writes deployments/bradbury.json incrementally)
python tools/deploy.py --network testnet_bradbury

# Add only the 4 Phase 2 trackers to an already-deployed 5-contract setup
python tools/deploy.py --network testnet_bradbury --add-contracts
```

Then copy any new addresses into `frontend/.env.local`.

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
5. Anyone can **appeal** → a larger validator set re-evaluates.

No single model, operator, or platform decides the outcome.

---

## Project Structure

```
VerBnb/
├── contracts/            # 9 intelligent contracts (Python)
├── tests/
│   ├── direct/           # Mocked unit tests (pytest)
│   └── integration/      # Full consensus tests (gltest)
├── tools/deploy.py       # Deployment script
├── deployments/
│   └── bradbury.json     # All 9 deployed addresses
├── frontend/
│   ├── app/              # Next.js App Router pages (incl. /docs user guide)
│   ├── components/       # React components (2D + 3D)
│   ├── lib/              # Client, constants, utilities
│   └── scripts/          # Maintenance (e.g. backfill-analytics.mjs)
└── README.md
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
Deployed on [Bradbury Testnet](https://rpc-bradbury.genlayer.com) ·
Frontend on [Vercel](https://vercel.com)
