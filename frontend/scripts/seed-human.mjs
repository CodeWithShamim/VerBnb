#!/usr/bin/env node
/**
 * Human-style seeder: a FRESH wallet drives the live deployment the
 * way a real user would - one transaction at a time, random pauses between
 * clicks, varied content per run - landing 10-20 txs on every contract in
 * deployments/<network>.json.
 *
 * Wallet split (the contracts enforce it):
 *   - NEW WALLET (permissionless writes): registry.register_dispute, the four
 *     specialists' raise_dispute / validate_claim, appeal_manager.create_appeal
 *     (as its own appellant), product_suggester.refresh_suggestions.
 *   - OWNER KEY (owner-only writes): analytics_tracker.record_outcome,
 *     fraud_detector.check_and_flag_patterns, reputation_tracker.record_*,
 *     product_suggester.add_trusted_domain (only if wikipedia isn't trusted yet).
 *
 * The new wallet is generated on first run, appended to frontend/.env.local as
 * SEED_WALLET_KEY (reused on later runs), and the script waits for you to fund
 * it at https://testnet-faucet.genlayer.foundation before writing anything.
 *
 * Every run uses a fresh run-tag in its ids (hs-<tag>-rental-01 ...) so data
 * accumulates like real traffic. Pass --run=<tag> to resume a specific run.
 *
 * Usage:
 *   node scripts/seed-human.mjs               # everything, human pacing
 *   node scripts/seed-human.mjs --fast        # short pauses (still sequential)
 *   node scripts/seed-human.mjs --only=delivery
 *   node scripts/seed-human.mjs --skip-owner  # new-wallet txs only
 */
import { readFileSync, appendFileSync } from "node:fs";
import { randomBytes, randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient, createAccount } from "genlayer-js";
import { localnet, studionet } from "genlayer-js/chains";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
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
const RPC = rpcOverride || deployment.rpc;
const FAUCET = "https://testnet-faucet.genlayer.foundation";

const argv = process.argv.slice(2);
const flag = (name, dflt) =>
  (argv.find((a) => a.startsWith(`--${name}=`)) || "").split("=")[1] || dflt;
const only = flag("only", "");
const fast = argv.includes("--fast");
const skipOwner = argv.includes("--skip-owner");
const RETRIES = Number(flag("retries", 4));
// Sequential submission, but acceptance can take minutes, so we still track our un-accepted txs per
// account and pause when a small cap is hit (well under the network's
// ~20 PENDING/account limit).
const MAX_INFLIGHT = Number(flag("max-inflight", 8));

// ---- wallets ----------------------------------------------------------------

const OWNER_KEY = process.env.GENLAYER_PRIVATE_KEY;
if (!OWNER_KEY && !skipOwner) {
  console.error(
    "GENLAYER_PRIVATE_KEY missing from frontend/.env.local (or pass --skip-owner)",
  );
  process.exit(1);
}

let userKey = process.env.SEED_WALLET_KEY;
if (!userKey) {
  userKey = "0x" + randomBytes(32).toString("hex");
  appendFileSync(envPath, `\nSEED_WALLET_KEY=${userKey}\n`);
  console.log("generated NEW seed wallet, saved as SEED_WALLET_KEY in .env.local");
}

const user = createAccount(userKey);
const userClient = createClient({ chain, account: user });
const owner = skipOwner ? null : createAccount(OWNER_KEY);
const ownerClient = owner ? createClient({ chain, account: owner }) : null;

console.log(`user wallet : ${user.address}`);
if (owner) console.log(`owner wallet: ${owner.address}`);
console.log(`network=${chain.name || chain.id}  registry=${C.verBnb_registry}\n`);

// ---- helpers ----------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A human doesn't click at machine speed: 6-18s between txs, and roughly every
// 10th tx a longer "coffee" pause. --fast trims this for reruns/testing.
const humanPause = async (n) => {
  if (fast) return sleep(1000 + randomInt(2000));
  if (n > 0 && n % 10 === 0) {
    const brk = 30000 + randomInt(45000);
    console.log(`  .. taking a break (${Math.round(brk / 1000)}s)`);
    return sleep(brk);
  }
  return sleep(6000 + randomInt(12000));
};

async function getBalance(address) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
  });
  const j = await res.json();
  return BigInt(j.result || "0x0");
}

async function waitForFunds(address) {
  let bal = 0n;
  try {
    bal = await getBalance(address);
  } catch (e) {
    console.log(`balance check unavailable (${e.message}) - proceeding anyway`);
    return;
  }
  if (bal > 0n) {
    console.log(`wallet balance: ${bal} wei - funded, starting\n`);
    return;
  }
  console.log(`\nNEW wallet ${address} has no GEN yet.`);
  console.log(`Fund it at ${FAUCET} - waiting (checking every 20s) ...`);
  while (bal === 0n) {
    await sleep(20000);
    try {
      bal = await getBalance(address);
    } catch {
      /* transient RPC */
    }
  }
  console.log(`funded (${bal} wei), starting\n`);
}

// Contract UserError strings that mean "this record already exists".
const DUP_MARKERS = [
  "already registered",
  "already recorded",
  "already resolved",
  "already pending",
  "outcome already recorded",
  "an appeal is already pending",
];
const isDecided = (s) => Number(s) >= 5; // >=ACCEPTED frees a PENDING slot

const inflight = new Map(); // client -> Map(txHash -> label)
const flightOf = (client) => {
  if (!inflight.has(client)) inflight.set(client, new Map());
  return inflight.get(client);
};

async function drainBelow(client, limit) {
  const mine = flightOf(client);
  let waited = 0;
  while (mine.size >= limit) {
    for (const h of [...mine.keys()]) {
      try {
        const t = await client.getTransaction({ hash: h });
        if (isDecided(t.status)) mine.delete(h);
      } catch {
        /* transient RPC - re-check next sweep */
      }
    }
    if (mine.size >= limit) {
      if (waited % 30000 === 0)
        console.log(`  .. waiting for accepts (${mine.size} in flight)`);
      await sleep(6000);
      waited += 6000;
    }
  }
}

const readJson = async (address, functionName, args) => {
  try {
    return JSON.parse(
      await userClient.readContract({ address, functionName, args }),
    );
  } catch {
    return null;
  }
};

async function submit(client, address, functionName, args, label) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    await drainBelow(client, MAX_INFLIGHT);
    try {
      const tx = await client.writeContract({
        address,
        functionName,
        args,
        value: 0n,
      });
      flightOf(client).set(tx, label);
      console.log(`  ok   ${label}  tx=${tx}`);
      return "ok";
    } catch (e) {
      const msg = (e?.message || String(e)).toLowerCase();
      if (DUP_MARKERS.some((m) => msg.includes(m))) {
        console.log(`  skip ${label}  (already seeded)`);
        return "skip";
      }
      if (attempt < RETRIES) {
        await drainBelow(client, Math.max(3, Math.floor(MAX_INFLIGHT / 2)));
        await sleep(5000 * attempt);
        continue;
      }
      console.log(`  FAIL ${label}  ${(e?.message || String(e)).slice(0, 140)}`);
      return "fail";
    }
  }
}

// ---- content pools (shuffled per run so every run reads differently) --------

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (arr) => arr[randomInt(arr.length)];
const pad = (n) => String(n).padStart(2, "0");
const WIKI = (t) => `https://en.wikipedia.org/wiki/${t}`;
const runTag = flag("run", Date.now().toString(36).slice(-5));
const id = (kind, i) => `hs-${runTag}-${kind}-${pad(i + 1)}`;
console.log(`run tag: ${runTag}  (resume with --run=${runTag})\n`);

const RENTALS = shuffle([
  "Vacation_rental", "Boutique_hotel", "Farm_stay", "Ryokan", "Riad",
  "Treehouse", "Yurt", "Lighthouse", "Castle", "Barn", "Tiny_house_movement",
  "Houseboat", "Igloo", "Log_cabin", "Villa", "Penthouse_apartment",
]);
const RENTAL_COMPLAINTS = [
  "Consumer_complaint", "False_advertising", "Misrepresentation",
];
const PRODUCTS = shuffle([
  "Turntable", "Air_fryer", "Monitor_(computer)", "Skateboard", "Telescope",
  "Sewing_machine", "Microphone", "Projector", "Hair_dryer", "Rice_cooker",
  "Electric_bicycle", "Game_controller", "Soundbar", "Printer_(computing)",
  "Humidifier", "Toaster",
]);
const CITIES = shuffle([
  "Lisbon", "Oslo", "Prague", "Vienna", "Helsinki", "Dublin", "Copenhagen",
  "Zurich", "Barcelona", "Munich", "Stockholm", "Brussels", "Warsaw",
  "Budapest", "Athens", "Edinburgh",
]);
const DELIVERY_GRIPES = [
  "Package marked delivered but never arrived; no photo on file.",
  "Courier left the parcel at the wrong building entirely.",
  "Tracking froze for two weeks, then the order vanished.",
  "Box arrived crushed and resealed with different tape.",
  "Signature on the proof of delivery is not mine.",
];
const BRANDS = shuffle([
  "Patagonia", "Fairphone", "Tony's_Chocolonely", "Allbirds", "Veja_(brand)",
  "Lush_(company)", "Everlane", "Klean_Kanteen", "Alter_Eco", "Ecover",
  "Nudie_Jeans", "People_Tree_(company)", "Dr._Bronner's", "Pukka_Herbs",
  "The_Body_Shop", "Numi_Organic_Tea",
]);
const SOURCING_CLAIMS = [
  "Sourced from certified fair-trade suppliers with no forced labor.",
  "All cotton is organic and pickers are paid a living wage.",
  "Cocoa is traceable to cooperatives audited for child-labor compliance.",
];
const TOPICS = shuffle([
  ["noise cancelling headphones", "Headphones"],
  ["ergonomic office chair", "Office_chair"],
  ["trail running shoes", "Running_shoe"],
  ["french press", "French_press"],
  ["hiking backpack", "Backpack"],
  ["4k webcam", "Webcam"],
  ["cast iron skillet", "Cast-iron_cookware"],
  ["electric toothbrush", "Electric_toothbrush"],
  ["gravel bike", "Gravel_bicycle"],
  ["record player", "Turntable"],
  ["air purifier", "Air_purifier"],
  ["espresso machine", "Espresso_machine"],
  ["mechanical keyboard", "Keyboard_technology"],
  ["camping tent", "Tent"],
]);
const APPEAL_REASONS = [
  "New evidence shows the original verdict overlooked the delivery photo.",
  "The listing photos used in the ruling were from a different unit.",
  "Seller has since admitted the item was a different model.",
  "The courier's GPS log contradicts the proof-of-delivery timestamp.",
  "An independent audit report on the supplier surfaced after the ruling.",
];
// Deterministic pseudo counterparties (valid 20-byte hex), same as seed-data.
const USERS = Array.from({ length: 12 }, (_, i) =>
  ("0x" + (i + 0xa1).toString(16).padStart(2, "0").repeat(20)).toLowerCase(),
);
const nowSec = Math.floor(Date.now() / 1000);

// Per-contract tx targets (10-20 each).
const N_SPECIALIST = 12; // rental / product / delivery / sourcing each
const N_REGISTERED = 4; // of those, how many per category get registry entries (4x4=16 registry txs)
const N_APPEALS = 12;
const N_SUGGEST = 12;
const N_ANALYTICS = 14;
const N_FRAUD = 14;
const N_REPUTATION = 14;

// Specialist disputes are resolved on-chain (get_verdict.resolved) - a cheap
// read that lets --run=<tag> reruns skip already-adjudicated ids.
const verdictResolved = (addr, did) => async () => {
  const v = await readJson(addr, "get_verdict", [did]);
  return !!(v && v.resolved === true && !v.error);
};

// ---- action list (what one enthusiastic user would do in a session) ---------

const u = (address, fn, args, label, check) => ({
  client: userClient, address, fn, args, label, check,
});
const o = (address, fn, args, label, check) =>
  skipOwner ? null : { client: ownerClient, address, fn, args, label, check };

const groups = [];
const group = (name, items) => groups.push([name, items.filter(Boolean)]);

// registry + specialists, interleaved per dispute like the app flow:
// register the dispute, then immediately raise it with the specialist.
const rentalIds = [], productIds = [], deliveryIds = [], sourcingIds = [];
const registryItems = [], rentalItems = [], productItems = [], deliveryItems = [], sourcingItems = [];

for (let i = 0; i < N_SPECIALIST; i++) {
  const rid = id("rental", i);
  rentalIds.push(rid);
  if (i < N_REGISTERED)
    registryItems.push(u(C.verBnb_registry, "register_dispute",
      [rid, "RENTAL", C.listing_accuracy_judge], `register ${rid} [RENTAL]`));
  rentalItems.push(u(C.listing_accuracy_judge, "raise_dispute",
    [rid, WIKI(RENTALS[i]), WIKI(pick(RENTAL_COMPLAINTS)), BigInt(90 + randomInt(300))],
    `rental ${rid} (${RENTALS[i]})`, verdictResolved(C.listing_accuracy_judge, rid)));

  const pid = id("product", i);
  productIds.push(pid);
  if (i < N_REGISTERED)
    registryItems.push(u(C.verBnb_registry, "register_dispute",
      [pid, "PRODUCT", C.not_as_described], `register ${pid} [PRODUCT]`));
  productItems.push(u(C.not_as_described, "raise_dispute",
    [pid, WIKI(PRODUCTS[i]), WIKI("Counterfeit_consumer_goods")],
    `product ${pid} (${PRODUCTS[i]})`, verdictResolved(C.not_as_described, pid)));

  const did = id("delivery", i);
  deliveryIds.push(did);
  if (i < N_REGISTERED)
    registryItems.push(u(C.verBnb_registry, "register_dispute",
      [did, "DELIVERY", C.delivery_adjudicator], `register ${did} [DELIVERY]`));
  deliveryItems.push(u(C.delivery_adjudicator, "raise_dispute",
    [did, `ORD-${randomInt(9000) + 1000}`, WIKI("Proof_of_delivery"),
      pick(DELIVERY_GRIPES), `${randomInt(200) + 1} Main St, ${CITIES[i]}`],
    `delivery ${did} (${CITIES[i]})`, verdictResolved(C.delivery_adjudicator, did)));

  const sid = id("sourcing", i);
  const brand = BRANDS[i];
  const claim = pick(SOURCING_CLAIMS);
  sourcingIds.push(sid);
  if (i < N_REGISTERED)
    registryItems.push(u(C.verBnb_registry, "register_dispute",
      [sid, "SOURCING", C.ethical_sourcing], `register ${sid} [SOURCING]`));
  // Registered claims carry their dispute_id so the specialist persists the
  // evidence and the claim is appealable on-chain.
  sourcingItems.push(u(C.ethical_sourcing, "validate_claim",
    [`${brand}-${runTag}`, claim, WIKI("Fair_trade_certification"), WIKI("Supply_chain"),
      i < N_REGISTERED ? sid : ""],
    `sourcing ${sid} (${brand})`,
    async () => {
      const v = await readJson(C.ethical_sourcing, "get_claim_verdict",
        [`${brand}-${runTag}`, claim]);
      return !!(v && !v.error);
    }));
}
group("registry", registryItems);
group("rental", rentalItems);
group("product", productItems);
group("delivery", deliveryItems);
group("sourcing", sourcingItems);

// appeals: the new wallet appeals its own disputes (sender must be appellant).
const allDisputeIds = shuffle([...rentalIds, ...productIds, ...deliveryIds, ...sourcingIds]);
group("appeal", Array.from({ length: N_APPEALS }, (_, i) =>
  u(C.appeal_manager, "create_appeal",
    [allDisputeIds[i], user.address, BigInt(nowSec - 3600 * (1 + randomInt(48))),
      [0, 10, 25, 40, 100][randomInt(5)], user.address, USERS[i % USERS.length],
      pick(APPEAL_REASONS), i % 2 ? WIKI("Evidence") : ""],
    `create_appeal ${allDisputeIds[i]}`)));

// suggester: owner ensures wikipedia is trusted (idempotent), then the user
// refreshes topic suggestions like anyone browsing the app.
group("suggester", [
  o(C.product_suggester, "add_trusted_domain", ["en.wikipedia.org"],
    "add_trusted_domain en.wikipedia.org",
    async () =>
      (await readJson(C.product_suggester, "is_trusted_domain", ["en.wikipedia.org"])) === true),
  ...TOPICS.slice(0, N_SUGGEST).map(([topic, wiki]) =>
    u(C.product_suggester, "refresh_suggestions", [topic, WIKI(wiki)],
      `refresh "${topic}"`)),
]);

// owner back-office: analytics / fraud / reputation reference this run's
// dispute ids and the new wallet so the data cross-links.
const CATS = ["RENTAL", "PRODUCT", "DELIVERY", "SOURCING"];
group("analytics", Array.from({ length: N_ANALYTICS }, (_, i) => {
  const refund = [0, 100, 50, 30, 0, 75, 100, 0, 60, 25][i % 10];
  return o(C.analytics_tracker, "record_outcome",
    [id("ana", i), CATS[i % 4], refund > 0 ? "FAVORABLE" : "UNFAVORABLE",
      refund, 3600 * (2 + randomInt(12)), i % 3,
      "Item materially different from the listing description."],
    `record_outcome ${id("ana", i)} refund=${refund}`);
}));

const fraudParties = [user.address.toLowerCase(), USERS[0], USERS[1]];
group("fraud", Array.from({ length: N_FRAUD }, (_, i) => {
  const addr = i < 9 ? fraudParties[i % 3] : USERS[3 + (i % 9)];
  return o(C.fraud_detector, "check_and_flag_patterns",
    [addr, id("fraud", i), i % 2 === 0, BigInt(nowSec - 60 * i)],
    `check_and_flag ${addr.slice(0, 8)} ${id("fraud", i)}`);
}));

const repItems = [];
for (let i = 0; i < 6; i++)
  repItems.push(o(C.reputation_tracker, "record_dispute_filed",
    [i % 2 ? USERS[i] : user.address.toLowerCase(), allDisputeIds[i]],
    `record_dispute_filed ${allDisputeIds[i]}`));
for (let i = 0; i < 4; i++)
  repItems.push(o(C.reputation_tracker, "record_verdict",
    [i % 2 ? user.address.toLowerCase() : USERS[i], i % 2 ? USERS[i + 6] : user.address.toLowerCase(),
      allDisputeIds[6 + i], "REFUND_GRANTED"],
    `record_verdict ${allDisputeIds[6 + i]}`));
for (let i = 0; i < 2; i++)
  repItems.push(o(C.reputation_tracker, "record_validator_round",
    [USERS[i], i === 0], `record_validator_round ${USERS[i].slice(0, 8)}`));
for (let i = 0; i < 2; i++)
  repItems.push(o(C.reputation_tracker, "record_appeal_outcome",
    [i ? USERS[0] : user.address.toLowerCase(), i === 0],
    `record_appeal_outcome ${i === 0 ? "user won" : "lost"}`));
group("reputation", repItems);

// ---- run ---------------------------------------------------------------------

async function main() {
  await waitForFunds(user.address);

  let n = 0;
  for (const [name, items] of groups) {
    if (only && only !== name) continue;
    if (!items.length) continue;
    console.log(`\n=== ${name} (${items.length} tx) ===`);
    const tally = { ok: 0, skip: 0, fail: 0, exists: 0 };
    for (const it of items) {
      if (it.check && (await it.check())) {
        console.log(`  have ${it.label}  (already on-chain)`);
        tally.exists++;
        continue;
      }
      tally[await submit(it.client, it.address, it.fn, it.args, it.label)]++;
      await humanPause(++n);
    }
    console.log(
      `--- ${name}: ${tally.ok} ok, ${tally.exists} have, ${tally.skip} skip, ${tally.fail} fail`,
    );
  }

  for (const [client, mine] of inflight) {
    console.log(`\ndraining ${mine.size} in-flight tx(s) to accepted ...`);
    await drainBelow(client, 1);
  }
  console.log("\nhuman seed complete.");
  console.log(`wallet: ${user.address}  run: ${runTag}`);
}

main().catch((e) => {
  console.error("seed failed:", e?.message || e);
  process.exit(1);
});
