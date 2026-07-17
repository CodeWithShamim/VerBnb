# VerBnb - AI-Enforced Marketplace Dispute Resolution

> Every dispute. Resolved by AI consensus. On-chain.

[Live App](https://ver-bnb.vercel.app) ·
[Docs](https://ver-bnb.vercel.app/docs) ·
[Roadmap](ROADMAP.md) ·
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

## Deployed Contracts (Bradbury Testnet · Chain ID 4221)

| Contract | Address |
| --- | --- |
| Registry (entry point) | `0xa8FA18DED9Fd2Be0B28169FdD1023599d4B5B685` |
| RENTAL - `listing_accuracy_judge` | `0x8C857c96cC39A51AC401D0270b6D53905e45972E` |
| PRODUCT - `not_as_described` | `0xA42Ba690D16D54E8c8a62100b07D213e3FAc2aa8` |
| SOURCING - `ethical_sourcing` | `0xDaEb60AA8F4A5e8514e546f72775b3CD46148964` |
| DELIVERY - `delivery_adjudicator` | `0x0a454Cc6f1509b171D43c97E9dA8D40b8dD20d06` |
| Appeal Manager | `0x820b3096923b57Ed3F280bA30BbbdE69deF34dff` |
| Reputation Tracker | `0xC469fF9382DfFdB7E7C70b3a080fE083da7779C0` |
| Fraud Detector | `0x50a9ada4DdBd5306ddB470a7D67B1c4Ba0B47FaC` |
| Analytics Tracker | `0x4982D3873A85C9702e587Ea9Da0C5bDe80E19A04` |
| Product Suggester | `0xf19bdD5d35CF87F3958b3A5cBd262D22f7A63886` |

This deployment (2026-07-17) brings **on-chain appeal consensus to every
specialist judge** — all four categories support
`resolve_appeal`/`get_appeal_outcome`, and the registry gained an owner-only
`set_specialist_addresses` so future single-judge upgrades no longer force a
full redeploy.

RPC: `https://rpc-bradbury.genlayer.com` · Explorer: `https://explorer-bradbury.genlayer.com`

> The frontend connects **only** to the registry; the four specialist addresses
> are discovered at runtime via `get_contract_for_category`, so the UI never
> hardcodes them. The single source of truth is
> [`deployments/bradbury.json`](deployments/bradbury.json) (written by the deploy
> script) - the frontend reads addresses straight from it, so a re-deploy needs
> no code or env change. Contract addresses are **not** read from `.env`.

### Previous deployments (historical tx lookups)

Superseded deployments stay live on Bradbury - every contract below is kept so
the team can check disputes and transactions raised before each cut-over on the
[explorer](https://explorer-bradbury.genlayer.com). This table is the record;
each address links to its explorer page.

<details>
<summary><strong>Retired 2026-07-17</strong> — registry <code>0x535E67E2…49Da</code> (deployer <code>0x32d1DC49…3036</code>)</summary>

| Contract | Address |
| --- | --- |
| Registry (entry point) | [`0x535E67E23913B5B0A79adC39Ca2B05fe696149Da`](https://explorer-bradbury.genlayer.com/address/0x535E67E23913B5B0A79adC39Ca2B05fe696149Da) |
| RENTAL - `listing_accuracy_judge` | [`0x9941940c3E7Ff7574EB50738F3c7D7C8cc08880E`](https://explorer-bradbury.genlayer.com/address/0x9941940c3E7Ff7574EB50738F3c7D7C8cc08880E) |
| PRODUCT - `not_as_described` | [`0x701aF3b64a1595ee628A48654ec9773633cAB11B`](https://explorer-bradbury.genlayer.com/address/0x701aF3b64a1595ee628A48654ec9773633cAB11B) |
| SOURCING - `ethical_sourcing` | [`0xe3EFBD1873781ee47a6C2D9399EC07C36D0d3B91`](https://explorer-bradbury.genlayer.com/address/0xe3EFBD1873781ee47a6C2D9399EC07C36D0d3B91) |
| DELIVERY - `delivery_adjudicator` | [`0x20Bf0E57ab63D545CFA483a8b152eaDddBe4dbAf`](https://explorer-bradbury.genlayer.com/address/0x20Bf0E57ab63D545CFA483a8b152eaDddBe4dbAf) |
| Appeal Manager | [`0x501E579CD5784516cB7200fCb2165F1DC77dFd40`](https://explorer-bradbury.genlayer.com/address/0x501E579CD5784516cB7200fCb2165F1DC77dFd40) |
| Reputation Tracker | [`0xe7E76C8e1Cf0BC2651FE06E4cCEEe97e09F417D3`](https://explorer-bradbury.genlayer.com/address/0xe7E76C8e1Cf0BC2651FE06E4cCEEe97e09F417D3) |
| Fraud Detector | [`0xAfC36aBEE699195c87e6c0E1E0d59CB621a6E36F`](https://explorer-bradbury.genlayer.com/address/0xAfC36aBEE699195c87e6c0E1E0d59CB621a6E36F) |
| Analytics Tracker | [`0xD74D14fD3e3a545b19db9BE88F48593c4AD86Cb6`](https://explorer-bradbury.genlayer.com/address/0xD74D14fD3e3a545b19db9BE88F48593c4AD86Cb6) |
| Product Suggester | [`0x6c3C7a4D70628210362C074C28fF9F88b1C0805B`](https://explorer-bradbury.genlayer.com/address/0x6c3C7a4D70628210362C074C28fF9F88b1C0805B) |

</details>

<details>
<summary><strong>Retired 2026-07-15</strong> — registry <code>0x032806fb…8B34</code> (deployer <code>0x32d1DC49…3036</code>)</summary>

| Contract | Address |
| --- | --- |
| Registry (entry point) | [`0x032806fb59020560538DC470A0C44dd1ebCD8B34`](https://explorer-bradbury.genlayer.com/address/0x032806fb59020560538DC470A0C44dd1ebCD8B34) |
| RENTAL - `listing_accuracy_judge` | [`0x19441393f5F1EE033D1502A6557F87705A20f4CC`](https://explorer-bradbury.genlayer.com/address/0x19441393f5F1EE033D1502A6557F87705A20f4CC) |
| PRODUCT - `not_as_described` | [`0x9cBC4d4d0d0Aeefd6891FF2717D56Df14Ff8bD39`](https://explorer-bradbury.genlayer.com/address/0x9cBC4d4d0d0Aeefd6891FF2717D56Df14Ff8bD39) |
| SOURCING - `ethical_sourcing` | [`0x691d014c332eF75387708CaDd2E22f28B6a11C00`](https://explorer-bradbury.genlayer.com/address/0x691d014c332eF75387708CaDd2E22f28B6a11C00) |
| DELIVERY - `delivery_adjudicator` | [`0x757cA36D2e9BbdF60fCE646592cD04B7DC2BD6B5`](https://explorer-bradbury.genlayer.com/address/0x757cA36D2e9BbdF60fCE646592cD04B7DC2BD6B5) |
| Appeal Manager | [`0x967360d652BedE865Df79EB29B53E1566C3fe73e`](https://explorer-bradbury.genlayer.com/address/0x967360d652BedE865Df79EB29B53E1566C3fe73e) |
| Reputation Tracker | [`0x476362508A3EB421EB75B9B961C7E65db0742a55`](https://explorer-bradbury.genlayer.com/address/0x476362508A3EB421EB75B9B961C7E65db0742a55) |
| Fraud Detector | [`0xD105f30a6d9028596a42C122652D99cd827E43e4`](https://explorer-bradbury.genlayer.com/address/0xD105f30a6d9028596a42C122652D99cd827E43e4) |
| Analytics Tracker | [`0x17226eC667CB9CD1c2cBf04191c491138754efbE`](https://explorer-bradbury.genlayer.com/address/0x17226eC667CB9CD1c2cBf04191c491138754efbE) |
| Product Suggester | [`0x4Cbf2391e2C2Fe33E6cAFc7537C6Cd000A3d1df9`](https://explorer-bradbury.genlayer.com/address/0x4Cbf2391e2C2Fe33E6cAFc7537C6Cd000A3d1df9) |

</details>

<details>
<summary><strong>Retired 2026-07-10</strong> — registry <code>0x5d6DF470…aE6C</code> (deployer <code>0xbD96D8b2…F9a7</code>)</summary>

| Contract | Address |
| --- | --- |
| Registry (entry point) | [`0x5d6DF470903AbC697B5F3b75a3f895470E65aE6C`](https://explorer-bradbury.genlayer.com/address/0x5d6DF470903AbC697B5F3b75a3f895470E65aE6C) |
| RENTAL - `listing_accuracy_judge` | [`0x76e3Ff31Ca5cB4e6ce46EF109c52272F27151b32`](https://explorer-bradbury.genlayer.com/address/0x76e3Ff31Ca5cB4e6ce46EF109c52272F27151b32) |
| PRODUCT - `not_as_described` | [`0xBF6Efed489B28c2680FE0b3eF8Dffe4288e50548`](https://explorer-bradbury.genlayer.com/address/0xBF6Efed489B28c2680FE0b3eF8Dffe4288e50548) |
| SOURCING - `ethical_sourcing` | [`0xb516DB96E8DefE26dE624dfF1f7D0802a828996D`](https://explorer-bradbury.genlayer.com/address/0xb516DB96E8DefE26dE624dfF1f7D0802a828996D) |
| DELIVERY - `delivery_adjudicator` | [`0x63FFE6DE2988ABC6f49F3b3fd56415ef2A16d3AF`](https://explorer-bradbury.genlayer.com/address/0x63FFE6DE2988ABC6f49F3b3fd56415ef2A16d3AF) |
| Appeal Manager | [`0x86d5E6DAe032fb62EdA7cE345F37374BCbb96e19`](https://explorer-bradbury.genlayer.com/address/0x86d5E6DAe032fb62EdA7cE345F37374BCbb96e19) |
| Reputation Tracker | [`0x5A92cd40E7FE241177b924bb4Ed5dEE5d0CaCfa9`](https://explorer-bradbury.genlayer.com/address/0x5A92cd40E7FE241177b924bb4Ed5dEE5d0CaCfa9) |
| Fraud Detector | [`0x27e840Bc1fa7C0448FeF03AA34E64ddcf76010E2`](https://explorer-bradbury.genlayer.com/address/0x27e840Bc1fa7C0448FeF03AA34E64ddcf76010E2) |
| Analytics Tracker | [`0x840B72a83aa2707AF8aD84e4537B6a5c78459A4B`](https://explorer-bradbury.genlayer.com/address/0x840B72a83aa2707AF8aD84e4537B6a5c78459A4B) |

</details>

<details>
<summary><strong>Retired (earliest)</strong> — registry <code>0x8aA6527B…34eB</code> (holds early disputes, e.g. <code>rental-mqvayj71-i54svc</code>)</summary>

| Contract | Address |
| --- | --- |
| Registry (entry point) | [`0x8aA6527B539814c454ee178dd7CE8cAd011834eB`](https://explorer-bradbury.genlayer.com/address/0x8aA6527B539814c454ee178dd7CE8cAd011834eB) |

Specialist/tracker addresses for this set were not archived; look them up from the registry's transactions on the explorer.

</details>

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
# Deploy all 10 contracts (writes deployments/bradbury.json incrementally)
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
├── contracts/            # 10 intelligent contracts (Python)
├── tests/
│   ├── direct/           # Mocked unit tests (pytest)
│   └── integration/      # Full consensus tests (gltest)
├── tools/deploy.py       # Deployment script
├── deployments/
│   └── bradbury.json     # All 10 deployed addresses
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
Deployed on [Bradbury Testnet](https://rpc-bradbury.genlayer.com) ·
Frontend on [Vercel](https://vercel.com)
