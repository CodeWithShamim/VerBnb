import { NextRequest, NextResponse } from "next/server";
import { getReadClient } from "@/lib/genLayerClient";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";

export const runtime = "nodejs";

// Read-only chain views: cache briefly at the edge/browser and serve stale
// while revalidating - same policy as /api/trackers so a page full of cards
// shares one chain read per window.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=15, max-age=10, stale-while-revalidate=60",
};

function ok(body: any) {
  return NextResponse.json(body, { headers: CACHE_HEADERS });
}

/**
 * Read-only gateway to the product_suggester contract (validator-curated
 * product picks fetched from trusted review sites).
 *
 * GET /api/suggestions?resource=<name>&...params
 *
 * resource values:
 *   topics                       -> get_topics()
 *   suggestions   ?topic=...     -> get_suggestions(topic)
 *   last_updated  ?topic=...     -> get_last_updated(topic)
 *
 * All values come straight from contract views and are JSON-decoded where the
 * view returns a JSON string. A missing contract address returns a soft
 * { configured: false } payload so the UI can degrade gracefully.
 */

type Reader = ReturnType<typeof getReadClient>;

async function readJson(
  client: Reader,
  address: string,
  functionName: string,
  args: any[]
): Promise<any> {
  const raw = (await client.readContract({
    address: address as `0x${string}`,
    functionName,
    args,
  })) as string;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const resource = sp.get("resource") || "";
  const client = getReadClient();
  const { product_suggester } = CONTRACT_ADDRESSES;

  try {
    switch (resource) {
      case "topics": {
        if (!product_suggester) return ok({ configured: false, topics: [] });
        return ok(await readJson(client, product_suggester, "get_topics", []));
      }
      case "suggestions": {
        if (!product_suggester) return ok({ configured: false });
        const topic = sp.get("topic") || "";
        return ok(
          await readJson(client, product_suggester, "get_suggestions", [topic])
        );
      }
      case "last_updated": {
        if (!product_suggester)
          return ok({ configured: false, last_updated: 0 });
        const topic = sp.get("topic") || "";
        const ts = await client.readContract({
          address: product_suggester as `0x${string}`,
          functionName: "get_last_updated",
          args: [topic],
        });
        return ok({ last_updated: Number(ts) });
      }
      default:
        return NextResponse.json(
          { error: `unknown resource: ${resource}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "suggestions read failed", configured: true },
      { status: 200 }
    );
  }
}
