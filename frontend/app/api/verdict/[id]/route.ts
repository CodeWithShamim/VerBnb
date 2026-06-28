import { NextRequest, NextResponse } from "next/server";
import { getReadClient } from "@/lib/genLayerClient";
import { REGISTRY_ADDRESS, CATEGORIES, type Category } from "@/lib/contracts";

export const runtime = "nodejs";

// Returns the verdict JSON for a dispute by discovering the specialist contract
// via the registry, plus the registry's own record. Read-only.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = decodeURIComponent(params.id);
    const category = (req.nextUrl.searchParams.get("category") || "") as Category;
    const client = getReadClient();

    if (!REGISTRY_ADDRESS) {
      return NextResponse.json(
        { error: "Registry address not configured" },
        { status: 500 }
      );
    }

    // Resolve specialist address through the registry.
    let specialist = "";
    if (category && CATEGORIES[category]) {
      specialist = String(
        await client.readContract({
          address: REGISTRY_ADDRESS,
          functionName: "get_contract_for_category",
          args: [category],
        })
      );
    }

    // Registry record (tracking + resolved flag).
    let record: any = null;
    try {
      const raw = (await client.readContract({
        address: REGISTRY_ADDRESS,
        functionName: "get_dispute",
        args: [id],
      })) as string;
      record = JSON.parse(raw);
    } catch {
      record = null;
    }

    // Specialist verdict.
    let verdict: any = null;
    if (specialist) {
      try {
        if (category === "SOURCING") {
          // Sourcing keys verdicts by brand:claim; surface trust score by brand.
          const brandId = req.nextUrl.searchParams.get("brandId") || "";
          const claim = req.nextUrl.searchParams.get("claim") || "";
          if (brandId && claim) {
            const raw = (await client.readContract({
              address: specialist as `0x${string}`,
              functionName: "get_claim_verdict",
              args: [brandId, claim],
            })) as string;
            verdict = JSON.parse(raw);
          }
        } else {
          const raw = (await client.readContract({
            address: specialist as `0x${string}`,
            functionName: "get_verdict",
            args: [id],
          })) as string;
          verdict = JSON.parse(raw);
        }
      } catch {
        verdict = null;
      }
    }

    return NextResponse.json(
      { id, specialist, record, verdict },
      {
        headers: {
          // Short TTL: verdicts settle quickly and the client polls; this just
          // dedupes bursts without hiding a fresh finalization for long.
          "Cache-Control": "public, s-maxage=8, max-age=5, stale-while-revalidate=20",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to read dispute" },
      { status: 500 }
    );
  }
}
