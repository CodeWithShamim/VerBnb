import { NextRequest, NextResponse } from "next/server";
import { getReadClient } from "@/lib/genLayerClient";
import { REGISTRY_ADDRESS, CATEGORIES, type Category } from "@/lib/contracts";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Evidence URL extraction (additive).
//
// The specialist contracts store the evidence/listing URLs in state but none
// of their view methods return them, so the only on-chain source is the
// original raise_dispute transaction calldata. When the caller supplies the
// specialist tx hash (?tx=0x...), we fetch the transaction and scan its
// decoded calldata for http(s) URLs, then label them by the known positional
// argument order for the category.
// ---------------------------------------------------------------------------

const URL_RE = /https?:\/\/[^\s"'<>\\)\]}]+/g;

/** Recursively collect http(s) URLs from any decoded structure, in order. */
function collectUrls(value: unknown, out: string[], depth = 0): void {
  if (depth > 8 || value == null) return;
  if (typeof value === "string") {
    const matches = value.match(URL_RE);
    if (matches) {
      for (const m of matches) out.push(m);
    }
    return;
  }
  if (value instanceof Uint8Array) {
    try {
      collectUrls(new TextDecoder().decode(value), out, depth + 1);
    } catch {
      /* not text */
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectUrls(v, out, depth + 1);
    return;
  }
  if (value instanceof Map) {
    for (const v of value.values()) collectUrls(v, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectUrls(v, out, depth + 1);
    }
  }
}

/** Positional labels matching buildSpecialistArgs in app/api/dispute/route.ts. */
const CATEGORY_LABELS: Record<string, string[]> = {
  RENTAL: ["Listing page", "Guest evidence"],
  PRODUCT: ["Seller listing", "Buyer evidence"],
  DELIVERY: ["Courier evidence"],
  SOURCING: ["Certification", "Supplier registry"],
};

function isIpfsLike(url: string): boolean {
  return url.includes("/ipfs/") || /pinata|ipfs|w3s\.link|dweb\.link/i.test(url);
}

function labelUrls(
  urls: string[],
  category: string
): { url: string; label?: string }[] {
  const unique = Array.from(new Set(urls));
  const labels = CATEGORY_LABELS[category];
  if (labels && unique.length === labels.length) {
    return unique.map((url, i) => ({ url, label: labels[i] }));
  }
  // Arg order unknown or unexpected count - fall back to a heuristic.
  return unique.map((url) => ({
    url,
    label: isIpfsLike(url) ? "Evidence file" : "Reference link",
  }));
}

/** Fetch the dispute tx and extract labelled evidence URLs. Never throws. */
async function evidenceFromTx(
  client: ReturnType<typeof getReadClient>,
  txHash: string,
  category: string
): Promise<{ url: string; label?: string }[]> {
  try {
    const tx: any = await client.getTransaction({ hash: txHash as any });
    const urls: string[] = [];
    // Prefer the SDK-decoded calldata; fall back to scanning the whole tx.
    collectUrls(tx?.txDataDecoded ?? tx?.data ?? null, urls);
    if (urls.length === 0) collectUrls(tx, urls);
    return labelUrls(urls, category);
  } catch {
    return [];
  }
}

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

    // Evidence URLs (additive; existing consumers keep working unchanged).
    const txHash = req.nextUrl.searchParams.get("tx") || "";
    const evidence = txHash
      ? await evidenceFromTx(client, txHash, category)
      : [];

    return NextResponse.json(
      { id, specialist, record, verdict, evidence },
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
