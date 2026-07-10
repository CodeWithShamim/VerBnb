#!/usr/bin/env node
/**
 * Backfill the analytics tracker (and registry resolved flags) from disputes
 * already on-chain.
 *
 * The analytics_tracker only aggregates what record_outcome is fed; disputes
 * resolved before that hook existed were never recorded, so /analytics showed
 * zeros. This walks every dispute the server signer registered, and for each
 * one with a resolved specialist verdict: marks it resolved in the registry
 * (idempotent) and records the outcome in the analytics tracker (skips
 * duplicates).
 *
 * Usage: node scripts/backfill-analytics.mjs [--dry-run]
 * Contract addresses come from deployments/bradbury.json; .env.local supplies
 * GENLAYER_PRIVATE_KEY and NEXT_PUBLIC_GL_NETWORK.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury, localnet, studionet } from "genlayer-js/chains";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const CHAINS = { testnet_bradbury: testnetBradbury, localnet, studionet };
const chain =
  CHAINS[process.env.NEXT_PUBLIC_GL_NETWORK || "testnet_bradbury"] ||
  testnetBradbury;
const deployment = JSON.parse(
  readFileSync(join(dirname(root), "deployments", "bradbury.json"), "utf8"),
);
const REGISTRY = deployment.contracts.verBnb_registry;
const ANALYTICS = deployment.contracts.analytics_tracker;
const KEY = process.env.GENLAYER_PRIVATE_KEY;
const dryRun = process.argv.includes("--dry-run");

if (!REGISTRY || !ANALYTICS || !KEY) {
  console.error(
    "Missing registry/analytics address in deployments/bradbury.json or GENLAYER_PRIVATE_KEY",
  );
  process.exit(1);
}

const account = createAccount(KEY);
const client = createClient({ chain, account });

const readJson = async (address, functionName, args) =>
  JSON.parse(await client.readContract({ address, functionName, args }));

const EXPLORER_API = `${(process.env.NEXT_PUBLIC_GL_EXPLORER || "https://explorer-bradbury.genlayer.com").replace(/\/+$/, "")}/api/v1`;

/** Dispute ids seen in register_dispute / raise_dispute / mark_resolved
 *  calldata of an address's transaction history (all pages). */
async function disputeIdsFromExplorer(address) {
  const ids = new Set();
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(
      `${EXPLORER_API}/transactions?address=${address}&page=${page}&page_size=50`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) break;
    const txs = (await res.json())?.transactions;
    if (!Array.isArray(txs) || txs.length === 0) break;
    for (const t of txs) {
      const c = t?.data?.params?.encoded_data?.calldata;
      if (!c || c.encoding !== "base64" || !c.content) continue;
      try {
        const p = JSON.parse(Buffer.from(c.content, "base64").toString());
        if (
          ["register_dispute", "raise_dispute", "mark_resolved"].includes(
            p?.method,
          ) &&
          typeof p?.args?.[0] === "string"
        ) {
          ids.add(p.args[0]);
        }
      } catch {
        /* undecodable calldata */
      }
    }
    if (txs.length < 50) break;
  }
  return ids;
}

async function main() {
  console.log(`signer: ${account.address}${dryRun ? "  (dry run)" : ""}`);

  // Specialist addresses (and their categories) from the live registry.
  const specialists = await readJson(REGISTRY, "get_addresses", []);

  // Collect dispute ids per category from explorer calldata: the registry's
  // register_dispute/mark_resolved history plus each specialist's own
  // raise_dispute history (covers disputes never registered in this registry).
  const byId = new Map(); // id -> { category, specialist }
  for (const [category, specialist] of Object.entries(specialists)) {
    if (!specialist || category === "SOURCING") continue; // sourcing has no per-dispute verdict view
    for (const id of await disputeIdsFromExplorer(specialist)) {
      byId.set(id, { category, specialist });
    }
  }
  for (const id of await disputeIdsFromExplorer(REGISTRY)) {
    if (byId.has(id)) continue;
    try {
      const rec = await readJson(REGISTRY, "get_dispute", [id]);
      if (rec?.contract_address && rec.category !== "SOURCING") {
        byId.set(id, {
          category: rec.category,
          specialist: rec.contract_address,
        });
      }
    } catch {
      /* registry doesn't know this id */
    }
  }
  console.log(`found ${byId.size} candidate dispute id(s)`);

  const recorded = await readJson(ANALYTICS, "get_all_stats", []);
  console.log(
    "analytics before:",
    Object.fromEntries(
      Object.entries(recorded).map(([k, v]) => [k, v.total_disputes]),
    ),
  );

  for (const [id, { category, specialist }] of byId) {
    let verdict = null;
    try {
      verdict = await readJson(specialist, "get_verdict", [id]);
    } catch {
      /* view call failed */
    }
    const resolved = verdict && verdict.resolved === true && !verdict.error;
    console.log(
      `- ${id} [${category}] resolved=${resolved} verdict=${verdict?.verdict ?? "-"} refund=${verdict?.refund_percentage ?? "-"}`,
    );
    if (!resolved || dryRun) continue;

    try {
      const rec = await readJson(REGISTRY, "get_dispute", [id]);
      if (rec && !rec.error && !rec.resolved) {
        const tx = await client.writeContract({
          address: REGISTRY,
          functionName: "mark_resolved",
          args: [id],
          value: 0n,
        });
        console.log(`    mark_resolved tx: ${tx}`);
      }
    } catch {
      /* not in this registry - analytics record still worth writing */
    }

    try {
      const tx = await client.writeContract({
        address: ANALYTICS,
        functionName: "record_outcome",
        args: [
          id,
          String(category || ""),
          String(verdict.verdict || ""),
          Math.min(100, Math.max(0, Number(verdict.refund_percentage) || 0)),
          0, // filed→resolved duration unknown for historical disputes
          0,
          "",
        ],
        value: 0n,
      });
      console.log(`    record_outcome tx: ${tx}`);
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg.includes("already recorded"))
        console.log("    already recorded - skipped");
      else console.log(`    record_outcome failed: ${msg.slice(0, 120)}`);
    }
  }

  const after = await readJson(ANALYTICS, "get_all_stats", []);
  console.log(
    "analytics after:",
    Object.fromEntries(
      Object.entries(after).map(([k, v]) => [k, v.total_disputes]),
    ),
  );
}

main().catch((e) => {
  console.error("backfill failed:", e?.message || e);
  process.exit(1);
});
