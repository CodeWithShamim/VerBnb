#!/usr/bin/env node
/**
 * Live end-to-end acceptance check of the round-bound PRODUCT appeal flow on
 * the CURRENT Bradbury deployment (addresses from deployments/bradbury.json):
 *
 *   1. registry.register_dispute            (PRODUCT, routed address enforced)
 *   2. product.raise_dispute                (real validator consensus)
 *   3. appeal_manager.create_appeal         (round 1 bookkeeping)
 *   4. product.resolve_appeal(id, 1)        (on-chain re-run, stricter bar)
 *   5. round binding: outcome readable ONLY under round 1 (round 2 = not_found)
 *   6. appeal_manager.finalize_appeal_from_state  (cross-contract, round-bound)
 *   7. final record matches the specialist's round-1 outcome exactly
 *   8. best-effort negative: resolve_appeal with a wrong round must NOT land
 *
 * Needs the owner GENLAYER_PRIVATE_KEY (root .env or frontend/.env.local).
 * Run:  cd frontend && node scripts/e2e-appeal-live.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const frontendDir = dirname(dirname(fileURLToPath(import.meta.url)));
const rootDir = dirname(frontendDir);

for (const envPath of [join(rootDir, ".env"), join(frontendDir, ".env.local")]) {
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

let key = (process.env.GENLAYER_PRIVATE_KEY || "").trim();
if (key && !key.startsWith("0x")) key = `0x${key}`;
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
  console.error("GENLAYER_PRIVATE_KEY missing or malformed in .env / .env.local");
  process.exit(1);
}

const dep = JSON.parse(readFileSync(join(rootDir, "deployments/bradbury.json"), "utf8"));
const C = dep.contracts;
const account = createAccount(key);
const client = createClient({ chain: testnetBradbury, account });

// Known validator-reachable pages (same ones the gltest integration suite uses).
const LISTING_URL = "https://test-server.genlayer.com/static/genvm/hello.html";
const EVIDENCE_URL = "https://test-server.genlayer.com/static/genvm/hello.html";

const tag = Math.random().toString(36).slice(2, 8);
const DISPUTE = `e2e-rb-${tag}`;
const APPEAL_ID = `${DISPUTE}-appeal-1`;

const t0 = Date.now();
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${msg}`);

async function read(address, functionName, args) {
  const raw = await client.readContract({ address, functionName, args });
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// Bradbury's public RPC flaps (transient consensus-contract reverts, 502s).
// Retry each write with backoff, like tools/deploy.py does.
async function write(address, functionName, args, label, attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    try {
      log(`write ${label} ...`);
      const hash = await client.writeContract({ address, functionName, args, value: 0n });
      log(`  tx=${hash}`);
      return hash;
    } catch (e) {
      if (i === attempts) throw e;
      const wait = 15 * i;
      log(`  ! ${label} attempt ${i}/${attempts} failed (${String(e.message).slice(0, 100)}); retrying in ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
    }
  }
}

/** State-based wait: poll a read until pred passes (robust to PENDING lag). */
async function until(label, fn, pred, tries = 90, delayMs = 10_000) {
  for (let i = 0; i < tries; i++) {
    try {
      const v = await fn();
      if (pred(v)) {
        log(`  ✓ ${label}`);
        return v;
      }
    } catch {
      /* transient RPC flap — keep polling */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`timeout waiting for: ${label}`);
}

async function txStatus(hash) {
  try {
    const r = await fetch(
      `https://explorer-bradbury.genlayer.com/api/v1/transactions?address=${account.address}&limit=20`,
    ).then((x) => x.json());
    return r.transactions?.find((t) => t.hash === hash)?.status || "unknown";
  } catch {
    return "unknown";
  }
}

// Bradbury nondet consensus flaps (leader_timeout / validators_timeout /
// undetermined) on web+LLM rounds. A consensus write is only done when the
// TARGET STATE is readable, so: submit, poll state, and resubmit whenever the
// tx dies with a terminal failure status.
const DEAD = ["leader_timeout", "validators_timeout", "undetermined", "canceled", "failed", "reverted"];

async function consensusWrite(address, functionName, args, label, readFn, pred, submits = 4) {
  for (let attempt = 1; attempt <= submits; attempt++) {
    const hash = await write(address, functionName, args, `${label} (submit ${attempt}/${submits})`);
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 15_000));
      try {
        const v = await readFn();
        if (pred(v)) {
          log(`  ✓ ${label}`);
          return v;
        }
      } catch {
        /* transient read flap */
      }
      const st = await txStatus(hash);
      if (DEAD.includes(String(st).toLowerCase())) {
        log(`  ! ${label} tx ${hash.slice(0, 12)} died with '${st}' — resubmitting`);
        break;
      }
    }
  }
  throw new Error(`consensus write never landed: ${label}`);
}

console.log(`E2E round-bound appeal flow on Bradbury — dispute ${DISPUTE}`);
console.log(`registry=${C.verBnb_registry} product=${C.not_as_described} appeals=${C.appeal_manager}`);

// 1. Register the dispute in the registry (validates the routed address).
await write(C.verBnb_registry, "register_dispute", [DISPUTE, "PRODUCT", C.not_as_described], "register_dispute");
await until(
  "registry knows the dispute",
  () => read(C.verBnb_registry, "get_dispute", [DISPUTE]),
  (r) => r?.dispute_id === DISPUTE,
);

// 2. Original consensus verdict on the PRODUCT judge.
const verdict = await consensusWrite(
  C.not_as_described,
  "raise_dispute",
  [DISPUTE, LISTING_URL, EVIDENCE_URL],
  "raise_dispute (consensus)",
  () => read(C.not_as_described, "get_verdict", [DISPUTE]),
  (v) => v?.resolved === true,
);
log(`  verdict=${verdict.verdict} refund=${verdict.refund_percentage}%`);

// 3. File the round-1 appeal (owner files on the submitter's behalf).
const now = Math.floor(Date.now() / 1000);
await write(
  C.appeal_manager,
  "create_appeal",
  [DISPUTE, account.address, now, verdict.refund_percentage, account.address,
   "0xbBbB000000000000000000000000000000000002", "e2e acceptance: stricter panel please", ""],
  "create_appeal",
);
const appeal = await until(
  "appeal recorded as PENDING round 1",
  () => read(C.appeal_manager, "get_appeal", [APPEAL_ID]),
  (a) => a?.appeal_status === "PENDING" && a?.new_consensus_round === 1,
);
log(`  appeal=${appeal.appeal_id} validators_this_round=${appeal.validators_this_round}`);
if (appeal.validators_this_round <= 3) throw new Error("appeal round must use MORE validators");

// 4. Specialist re-runs consensus for round 1 over its OWN stored evidence.
const outcome = await consensusWrite(
  C.not_as_described,
  "resolve_appeal",
  [DISPUTE, 1],
  "resolve_appeal round 1 (consensus)",
  () => read(C.not_as_described, "get_appeal_outcome_for_round", [DISPUTE, 1]),
  (o) => o?.resolved === true && o?.round_no === 1,
);
log(`  outcome verdict=${outcome.appeal_verdict} refund=${outcome.appeal_refund_pct}% tolerance=±${outcome.tolerance} overturned=${outcome.overturned}`);
if (outcome.tolerance !== 10) throw new Error(`round-1 tolerance must be 10, got ${outcome.tolerance}`);

// 5. Round binding: the outcome exists ONLY under its recorded round.
const round2 = await read(C.not_as_described, "get_appeal_outcome_for_round", [DISPUTE, 2]);
if (round2?.resolved !== false) throw new Error("round-2 view must be not_found before round 2 runs");
log("  ✓ outcome bound to round 1 (round-2 view is not_found)");

// 6. Manager finalizes from the round-bound on-chain state (cross-contract read).
const final = await consensusWrite(
  C.appeal_manager,
  "finalize_appeal_from_state",
  [APPEAL_ID, C.not_as_described],
  "finalize_appeal_from_state",
  () => read(C.appeal_manager, "get_appeal", [APPEAL_ID]),
  (a) => a?.appeal_status === "FINALIZED",
);

// 7. The finalized record must equal the specialist's round-1 outcome.
if (final.appeal_verdict !== outcome.appeal_verdict)
  throw new Error(`verdict mismatch: ${final.appeal_verdict} != ${outcome.appeal_verdict}`);
if (final.appeal_refund_pct !== outcome.appeal_refund_pct)
  throw new Error(`refund mismatch: ${final.appeal_refund_pct} != ${outcome.appeal_refund_pct}`);
log("  ✓ finalized record matches the specialist's round-1 outcome exactly");

// 8. Best-effort negative: an out-of-order round must not land.
const badHash = await write(C.not_as_described, "resolve_appeal", [DISPUTE, 3], "resolve_appeal round 3 (must fail)");
await new Promise((r) => setTimeout(r, 60_000));
const badStatus = await txStatus(badHash);
log(`  wrong-round tx status after 60s: ${badStatus} (must never become accepted/finalized)`);
if (["accepted", "finalized"].includes(String(badStatus).toLowerCase()))
  throw new Error("round-3 resolve_appeal must not be accepted");
const round3 = await read(C.not_as_described, "get_appeal_outcome_for_round", [DISPUTE, 3]);
if (round3?.resolved !== false) throw new Error("round-3 outcome must not exist");
log("  ✓ out-of-order round left no outcome on-chain");

console.log(`\nE2E ACCEPTANCE FLOW PASSED — dispute ${DISPUTE}, appeal ${APPEAL_ID}`);
