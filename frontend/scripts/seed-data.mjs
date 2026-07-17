#!/usr/bin/env node
/**
 * Seed the live deployment with ~20 transactions per contract so every
 * contract in deployments/<network>.json has real, cross-linked on-chain data
 * for the frontend to display (disputes, verdicts, appeals, fraud flags,
 * reputations, analytics, product suggestions).
 *
 * The script is RESUMABLE: it uses fixed seed ids, and treats every
 * "already exists / already recorded / already resolved / already pending"
 * revert as a skip, so re-running only fills the gaps.
 *
 * Contracts split into two kinds of write:
 *   - deterministic owner-writes (fast): registry, analytics, appeal,
 *     fraud, reputation, product_suggester.add_trusted_domain
 *   - LLM + web-consensus (slow, minutes each; need reachable URLs):
 *     listing_accuracy_judge / not_as_described / delivery_adjudicator
 *     .raise_dispute, ethical_sourcing.validate_claim,
 *     product_suggester.refresh_suggestions
 * Deterministic contracts run first so useful data lands immediately.
 *
 * Usage:
 *   node scripts/seed-data.mjs                # all contracts
 *   node scripts/seed-data.mjs --only=fraud   # one contract group
 *   node scripts/seed-data.mjs --deterministic-only   # skip the slow LLM ones
 *   node scripts/seed-data.mjs --llm-only
 *
 * Env (frontend/.env.local): GENLAYER_PRIVATE_KEY (must be the contract owner),
 * NEXT_PUBLIC_GL_NETWORK (default studionet), NEXT_PUBLIC_GL_RPC (optional RPC
 * override). Addresses come from deployments/<network>.json.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient, createAccount } from "genlayer-js";
import { localnet, studionet } from "genlayer-js/chains";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const CHAINS = { localnet, studionet };
const DEPLOY_FILES = { localnet: "localnet", studionet: "studionet" };
const networkKey = process.env.NEXT_PUBLIC_GL_NETWORK || "studionet";
const baseChain = CHAINS[networkKey] || studionet;
// Optional RPC override (NEXT_PUBLIC_GL_RPC) on top of the chain's default.
const rpcOverride = process.env.NEXT_PUBLIC_GL_RPC;
const chain = rpcOverride
  ? { ...baseChain, rpcUrls: { ...baseChain.rpcUrls, default: { http: [rpcOverride] } } }
  : baseChain;
const deployment = JSON.parse(
  readFileSync(
    join(dirname(root), "deployments", `${DEPLOY_FILES[networkKey] || networkKey}.json`),
    "utf8",
  ),
);
const C = deployment.contracts;
const KEY = process.env.GENLAYER_PRIVATE_KEY;
if (!KEY) {
  console.error("GENLAYER_PRIVATE_KEY missing from frontend/.env.local");
  process.exit(1);
}

const argv = process.argv.slice(2);
const only = (argv.find((a) => a.startsWith("--only=")) || "").split("=")[1];
const skip = new Set(
  ((argv.find((a) => a.startsWith("--skip=")) || "").split("=")[1] || "")
    .split(",")
    .filter(Boolean),
);
const deterministicOnly = argv.includes("--deterministic-only");
const llmOnly = argv.includes("--llm-only");

const account = createAccount(KEY);
const client = createClient({ chain, account });
console.log(`seeding as ${account.address}  network=${chain.name || chain.id}`);
console.log(`registry=${C.verBnb_registry}\n`);

// ---- helpers ---------------------------------------------------------------

// Contract UserError strings that mean "this record already exists" - benign,
// skip immediately (no retry).
const DUP_MARKERS = [
  "already registered",
  "already recorded",
  "already resolved",
  "already pending",
  "outcome already recorded",
  "an appeal is already pending",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRIES = Number(
  (argv.find((a) => a.startsWith("--retries=")) || "").split("=")[1] || 4,
);
// GenLayer caps an account's not-yet-accepted (PENDING) transactions (~20).
// writeContract returns at PENDING and acceptance can take minutes, so we keep our own in-flight PENDING count
// well under the cap and free slots as txs reach a decided state (ACCEPTED and
// beyond). State is visible to views at ACCEPTED, so we never wait for the
// (very slow) FINALIZED window.
const MAX_INFLIGHT = Number(
  (argv.find((a) => a.startsWith("--max-inflight=")) || "").split("=")[1] || 10,
);
const inflight = new Map(); // txHash -> label
// Numeric tx statuses: 1 PENDING, 2 PROPOSING, 3 COMMITTING, 4 REVEALING,
// 5 ACCEPTED, 6 UNDETERMINED, 7 FINALIZED. >=5 means it no longer holds a
// PENDING slot.
const isDecided = (s) => Number(s) >= 5;

const readJson = async (address, functionName, args) => {
  try {
    return JSON.parse(
      await client.readContract({ address, functionName, args }),
    );
  } catch {
    return null;
  }
};

/** Block until fewer than `limit` of our submitted txs are still un-accepted. */
async function drainBelow(limit) {
  let waited = 0;
  while (inflight.size >= limit) {
    for (const h of [...inflight.keys()]) {
      try {
        const t = await client.getTransaction({ hash: h });
        if (isDecided(t.status)) inflight.delete(h);
      } catch {
        /* transient RPC - re-check next sweep */
      }
    }
    if (inflight.size >= limit) {
      if (waited % 30000 === 0)
        console.log(`  .. waiting for accepts (${inflight.size} in flight)`);
      await sleep(6000);
      waited += 6000;
    }
  }
}

/** Submit one write, respecting the in-flight cap. Returns "ok"|"skip"|"fail".
 *  A generic "reverted / consensus contract" error here is usually the pending
 *  cap or a validator flap, so we drain harder and retry. Known-duplicate
 *  UserErrors skip immediately. */
async function submit(address, functionName, args, label) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    await drainBelow(MAX_INFLIGHT);
    try {
      const tx = await client.writeContract({
        address,
        functionName,
        args,
        value: 0n,
      });
      inflight.set(tx, label);
      console.log(`  ok   ${label}  tx=${tx}  (inflight=${inflight.size})`);
      return "ok";
    } catch (e) {
      const msg = (e?.message || String(e)).toLowerCase();
      if (DUP_MARKERS.some((m) => msg.includes(m))) {
        console.log(`  skip ${label}  (already seeded)`);
        return "skip";
      }
      if (attempt < RETRIES) {
        // Likely the pending cap: aggressively drain, then retry.
        await drainBelow(Math.max(3, Math.floor(MAX_INFLIGHT / 2)));
        await sleep(5000 * attempt);
        continue;
      }
      console.log(
        `  FAIL ${label}  ${(e?.message || String(e)).slice(0, 140)}`,
      );
      return "fail";
    }
  }
}

async function runGroup(name, items) {
  if (only && only !== name) return;
  if (skip.has(name)) {
    console.log(`\n=== ${name} SKIPPED (--skip) ===`);
    return;
  }
  console.log(`\n=== ${name} (${items.length} tx) ===`);
  const tally = { ok: 0, skip: 0, fail: 0, exists: 0 };
  for (const it of items) {
    // Cheap idempotent pre-check where the contract exposes one: avoids
    // re-running an expensive LLM dispute (or any write) that already landed.
    if (it.check && (await it.check())) {
      console.log(`  have ${it.label}  (already on-chain)`);
      tally.exists++;
      continue;
    }
    tally[await submit(it.address, it.fn, it.args, it.label)]++;
    await sleep(500); // gentle pacing; keeps nonces ordered and RPC happy
  }
  console.log(
    `--- ${name}: ${tally.ok} ok, ${tally.exists} have, ${tally.skip} skip, ${tally.fail} fail`,
  );
}

const pad = (n) => String(n).padStart(2, "0");
// 12 deterministic pseudo-user addresses (valid 20-byte hex).
const USERS = Array.from({ length: 12 }, (_, i) =>
  ("0x" + (i + 0xa1).toString(16).padStart(2, "0").repeat(20)).toLowerCase(),
);
const nowSec = Math.floor(Date.now() / 1000);

// Stable, text-render-friendly URLs (Wikipedia renders reliably for
// gl.nondet.web.render(mode="text")). Plausible topical pairings so the LLM
// verdict has coherent material to reason over.
const WIKI = (t) => `https://en.wikipedia.org/wiki/${t}`;

// ---- LLM + web specialists -------------------------------------------------

const RENTAL_TOPICS = [
  "Vacation_rental",
  "Airbnb",
  "Hotel",
  "Apartment",
  "Villa",
  "Cottage",
  "Hostel",
  "Bed_and_breakfast",
  "Timeshare",
  "Motel",
  "Guest_house",
  "Cabin",
  "Penthouse_apartment",
  "Studio_apartment",
  "Loft",
  "Bungalow",
  "Chalet",
  "Serviced_apartment",
  "Houseboat",
  "Resort",
];
// Specialist disputes are resolved on-chain (get_verdict.resolved) - a cheap
// read that lets a rerun skip already-adjudicated ids instead of paying for
// another LLM consensus round.
const verdictResolved = (addr, id) => async () => {
  const v = await readJson(addr, "get_verdict", [id]);
  return !!(v && v.resolved === true && !v.error);
};

const rentalItems = RENTAL_TOPICS.map((t, i) => {
  const id = `seed-rental-${pad(i + 1)}`;
  return {
    address: C.listing_accuracy_judge,
    fn: "raise_dispute",
    label: `rental ${id}`,
    args: [id, WIKI(t), WIKI("Consumer_complaint"), BigInt(120 + i * 45)],
    check: verdictResolved(C.listing_accuracy_judge, id),
  };
});

const PRODUCT_TOPICS = [
  "Headphones",
  "Smartphone",
  "Laptop",
  "Wristwatch",
  "Sneakers",
  "Handbag",
  "Sunglasses",
  "Coffeemaker",
  "Blender",
  "Backpack",
  "Camera",
  "Keyboard",
  "Drone",
  "Bicycle",
  "Electric_guitar",
  "Tent",
  "Espresso_machine",
  "Smartwatch",
  "Vacuum_cleaner",
  "Perfume",
];
const productItems = PRODUCT_TOPICS.map((t, i) => {
  const id = `seed-product-${pad(i + 1)}`;
  return {
    address: C.not_as_described,
    fn: "raise_dispute",
    label: `product ${id}`,
    args: [id, WIKI(t), WIKI("Counterfeit_consumer_goods")],
    check: verdictResolved(C.not_as_described, id),
  };
});

const CITIES = [
  "New_York_City",
  "London",
  "Tokyo",
  "Paris",
  "Berlin",
  "Toronto",
  "Sydney",
  "Dubai",
  "Singapore",
  "Amsterdam",
  "Madrid",
  "Rome",
  "Chicago",
  "Seattle",
  "Austin,_Texas",
  "Boston",
  "Miami",
  "Denver",
  "Portland,_Oregon",
  "Vancouver",
];
const deliveryItems = CITIES.map((city, i) => {
  const id = `seed-delivery-${pad(i + 1)}`;
  return {
    address: C.delivery_adjudicator,
    fn: "raise_dispute",
    label: `delivery ${id}`,
    args: [
      id,
      `ORD-${1000 + i}`,
      WIKI("Proof_of_delivery"),
      "Package marked delivered but never arrived; no photo on file.",
      `${100 + i} Main St, ${city.replace(/_/g, " ")}`,
    ],
    check: verdictResolved(C.delivery_adjudicator, id),
  };
});

const BRANDS = [
  "Patagonia",
  "The_Body_Shop",
  "Everlane",
  "Allbirds",
  "Lush_(company)",
  "Seventh_Generation_Inc.",
  "Dr._Bronner's",
  "Ben_&_Jerry's",
  "Tony's_Chocolonely",
  "Fairphone",
  "Veja_(brand)",
  "Pukka_Herbs",
  "Nudie_Jeans",
  "Alter_Eco",
  "Ecover",
  "Method_(cleaning_products)",
  "Tom's_of_Maine",
  "Numi_Organic_Tea",
  "Klean_Kanteen",
  "People_Tree_(company)",
];
const SOURCING_CLAIM =
  "Sourced from certified fair-trade suppliers with no forced labor.";
const sourcingItems = BRANDS.map((b, i) => {
  const brand = `brand-${pad(i + 1)}`;
  // First 5 claims carry the registry's seed-sourcing dispute ids so the
  // specialist persists their evidence and they are appealable on-chain.
  const disputeId = i < 5 ? `seed-sourcing-${pad(i + 1)}` : "";
  return {
    address: C.ethical_sourcing,
    fn: "validate_claim",
    label: `sourcing ${brand}`,
    args: [
      brand,
      SOURCING_CLAIM,
      WIKI("Fair_trade_certification"),
      WIKI("Supply_chain"),
      disputeId,
    ],
    check: async () => {
      const v = await readJson(C.ethical_sourcing, "get_claim_verdict", [
        brand,
        SOURCING_CLAIM,
      ]);
      return !!(v && !v.error);
    },
  };
});

const SUGGEST_TOPICS = [
  ["wireless earbuds", "Headphones"],
  ["standing desk", "Standing_desk"],
  ["robot vacuum", "Robotic_vacuum_cleaner"],
  ["mechanical keyboard", "Keyboard_technology"],
  ["running shoes", "Running_shoe"],
  ["air purifier", "Air_purifier"],
  ["electric kettle", "Kettle"],
  ["yoga mat", "Yoga_mat"],
  ["office chair", "Office_chair"],
  ["water bottle", "Water_bottle"],
  ["backpack", "Backpack"],
  ["smartwatch", "Smartwatch"],
  ["coffee grinder", "Burr_mill"],
  ["dash cam", "Dashcam"],
  ["portable charger", "Battery_charger"],
  ["desk lamp", "Desk_lamp"],
  ["bluetooth speaker", "Loudspeaker"],
  ["e-reader", "E-reader"],
];
// 2 trusted-domain writes + 18 refresh_suggestions = 20 tx.
const trustedDomainItem = (host) => ({
  address: C.product_suggester,
  fn: "add_trusted_domain",
  label: `add_trusted_domain ${host}`,
  args: [host],
  check: async () =>
    (await readJson(C.product_suggester, "is_trusted_domain", [host])) === true,
});
const suggesterItems = [
  trustedDomainItem("en.wikipedia.org"),
  trustedDomainItem("www.wikipedia.org"),
  ...SUGGEST_TOPICS.map(([topic, wiki]) => ({
    address: C.product_suggester,
    fn: "refresh_suggestions",
    label: `refresh "${topic}"`,
    args: [topic, WIKI(wiki)],
    check: async () =>
      Number(await readJson(C.product_suggester, "get_last_updated", [topic])) >
      0,
  })),
];

// ---- deterministic owner-writes -------------------------------------------

// registry: register 5 disputes per category (address must match the routed
// specialist for that category).
const registryItems = [];
const REG_MAP = [
  ["RENTAL", C.listing_accuracy_judge, "seed-rental"],
  ["PRODUCT", C.not_as_described, "seed-product"],
  ["DELIVERY", C.delivery_adjudicator, "seed-delivery"],
  ["SOURCING", C.ethical_sourcing, "seed-sourcing"],
];
for (const [cat, addr, prefix] of REG_MAP) {
  for (let i = 1; i <= 5; i++) {
    registryItems.push({
      address: C.verBnb_registry,
      fn: "register_dispute",
      label: `register ${prefix}-${pad(i)} [${cat}]`,
      args: [`${prefix}-${pad(i)}`, cat, addr],
    });
  }
}

// analytics: one recorded outcome per dispute, mixed categories/verdicts.
const CATS = ["RENTAL", "PRODUCT", "DELIVERY", "SOURCING"];
const analyticsItems = Array.from({ length: 20 }, (_, i) => {
  const refund = [0, 100, 50, 30, 0, 75, 100, 0, 60, 25][i % 10];
  return {
    address: C.analytics_tracker,
    fn: "record_outcome",
    label: `record_outcome seed-ana2-${pad(i + 1)} refund=${refund}`,
    args: [
      `seed-ana2-${pad(i + 1)}`,
      CATS[i % 4],
      refund > 0 ? "FAVORABLE" : "UNFAVORABLE",
      refund,
      3600 * (2 + (i % 12)), // resolution time (s)
      i % 3, // appeal count
      "Item materially different from the listing description.",
    ],
  };
});

// appeals: one appeal per distinct dispute, verdict timestamped "now" (within
// the 7-day window). Owner files on behalf of the appellant (a party).
const appealItems = Array.from({ length: 20 }, (_, i) => {
  const a = USERS[i % USERS.length];
  const b = USERS[(i + 1) % USERS.length];
  return {
    address: C.appeal_manager,
    fn: "create_appeal",
    label: `create_appeal seed-app2-${pad(i + 1)}`,
    args: [
      `seed-app2-${pad(i + 1)}`,
      a,
      BigInt(nowSec - 3600 * (i % 24)),
      [10, 40, 0, 100, 25][i % 5],
      a,
      b,
      "New evidence shows the original verdict overlooked the delivery photo.",
      i % 2 ? WIKI("Evidence") : "",
    ],
  };
});

// fraud: concentrate disputes on a few addresses so the pattern detector flags
// them; spread the rest.
const fraudItems = Array.from({ length: 20 }, (_, i) => {
  const addr = i < 12 ? USERS[i % 3] : USERS[3 + (i % 9)]; // first 3 users get hammered
  return {
    address: C.fraud_detector,
    fn: "check_and_flag_patterns",
    label: `check_and_flag ${addr.slice(0, 8)} seed-fraud-${pad(i + 1)}`,
    args: [
      addr,
      `seed-fraud-${pad(i + 1)}`,
      i % 2 === 0,
      BigInt(nowSec - 60 * i),
    ],
  };
});

// reputation: mix of the four record methods (8 + 6 + 4 + 2 = 20).
const reputationItems = [];
for (let i = 0; i < 8; i++)
  reputationItems.push({
    address: C.reputation_tracker,
    fn: "record_dispute_filed",
    label: `record_dispute_filed ${USERS[i % USERS.length].slice(0, 8)}`,
    args: [USERS[i % USERS.length], `seed-rep-${pad(i + 1)}`],
  });
for (let i = 0; i < 6; i++)
  reputationItems.push({
    address: C.reputation_tracker,
    fn: "record_verdict",
    label: `record_verdict w=${USERS[i].slice(0, 8)} l=${USERS[i + 6].slice(0, 8)}`,
    args: [
      USERS[i],
      USERS[i + 6],
      `seed-rep-v-${pad(i + 1)}`,
      "REFUND_GRANTED",
    ],
  });
for (let i = 0; i < 4; i++)
  reputationItems.push({
    address: C.reputation_tracker,
    fn: "record_validator_round",
    label: `record_validator_round ${USERS[i].slice(0, 8)} agree=${i % 2 === 0}`,
    args: [USERS[i], i % 2 === 0],
  });
for (let i = 0; i < 2; i++)
  reputationItems.push({
    address: C.reputation_tracker,
    fn: "record_appeal_outcome",
    label: `record_appeal_outcome ${USERS[i].slice(0, 8)} won=${i === 0}`,
    args: [USERS[i], i === 0],
  });

// ---- run -------------------------------------------------------------------

async function main() {
  const deterministic = [
    ["registry", registryItems],
    ["analytics", analyticsItems],
    ["appeal", appealItems],
    ["fraud", fraudItems],
    ["reputation", reputationItems],
  ];
  const llm = [
    ["listing", rentalItems],
    ["product", productItems],
    ["delivery", deliveryItems],
    ["sourcing", sourcingItems],
    ["suggester", suggesterItems],
  ];

  if (!llmOnly)
    for (const [n, items] of deterministic) await runGroup(n, items);
  if (!deterministicOnly)
    for (const [n, items] of llm) await runGroup(n, items);

  // Let the tail of submitted txs reach a decided state before exiting, so the
  // final on-chain view reflects the whole run.
  console.log(`\ndraining ${inflight.size} in-flight tx(s) to accepted ...`);
  await drainBelow(1);
  console.log("seed complete.");
}

main().catch((e) => {
  console.error("seed failed:", e?.message || e);
  process.exit(1);
});
