import { NextRequest, NextResponse } from "next/server";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury, localnet, studionet } from "genlayer-js/chains";
import { CATEGORIES, REGISTRY_ADDRESS, type Category } from "@/lib/contracts";

export const runtime = "nodejs";

const CHAINS: Record<string, any> = {
  testnet_bradbury: testnetBradbury,
  localnet,
  studionet,
};

function serverClient() {
  const key = process.env.GENLAYER_PRIVATE_KEY;
  if (!key) throw new Error("GENLAYER_PRIVATE_KEY not configured on the server");
  const chainKey = process.env.NEXT_PUBLIC_GL_NETWORK || "testnet_bradbury";
  const chain = CHAINS[chainKey] || testnetBradbury;
  const account = createAccount(key as `0x${string}`);
  return createClient({ chain, account });
}

/**
 * Build the specialist write args from the submitted dispute payload.
 * Returns the ordered argument array each specialist method expects.
 */
function buildSpecialistArgs(
  category: Category,
  disputeId: string,
  body: any
): any[] {
  switch (category) {
    case "RENTAL":
      return [
        disputeId,
        body.listingUrl,
        body.evidenceUrl,
        BigInt(body.claimedAmount || 0),
      ];
    case "PRODUCT":
      return [disputeId, body.listingUrl, body.evidenceUrl];
    case "SOURCING":
      return [
        body.brandId,
        body.claim,
        body.certificationUrl,
        body.supplierRegistryUrl,
      ];
    case "DELIVERY":
      return [
        disputeId,
        body.orderId,
        body.evidenceUrl,
        body.customerClaim,
        body.expectedAddress,
      ];
    default:
      throw new Error(`Unknown category: ${category}`);
  }
}

// Raises a dispute on the correct specialist (discovered via the registry) and
// records it in the registry. Returns the dispute id + both tx hashes.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const category = body.category as Category;
    const disputeId = body.disputeId as string;
    if (!category || !CATEGORIES[category]) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!disputeId) {
      return NextResponse.json({ error: "Missing disputeId" }, { status: 400 });
    }

    const registry = REGISTRY_ADDRESS;
    if (!registry) {
      return NextResponse.json(
        { error: "Registry address missing from deployments/bradbury.json" },
        { status: 500 }
      );
    }

    const client = serverClient();

    // 1. Discover the specialist contract address via the registry.
    const specialist = String(
      await client.readContract({
        address: registry,
        functionName: "get_contract_for_category",
        args: [category],
      })
    );

    if (!specialist) {
      return NextResponse.json(
        { error: `Registry has no contract for ${category}` },
        { status: 500 }
      );
    }

    // 2. Raise the dispute on the specialist contract.
    const method = CATEGORIES[category].method;
    const args = buildSpecialistArgs(category, disputeId, body);
    const specialistTx = await client.writeContract({
      address: specialist as `0x${string}`,
      functionName: method,
      args,
      value: 0n,
    });

    // 3. Register the dispute in the registry (tracking + stats).
    let registryTx: string | null = null;
    try {
      registryTx = (await client.writeContract({
        address: registry,
        functionName: "register_dispute",
        args: [disputeId, category, specialist],
        value: 0n,
      })) as string;
    } catch (e) {
      // Non-fatal: the specialist dispute was already submitted.
      registryTx = null;
    }

    return NextResponse.json({
      disputeId,
      category,
      specialist,
      specialistTx,
      registryTx,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to submit dispute" },
      { status: 500 }
    );
  }
}
