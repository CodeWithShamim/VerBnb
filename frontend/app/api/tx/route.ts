import { NextRequest, NextResponse } from "next/server";
import { getReadClient } from "@/lib/genLayerClient";

export const runtime = "nodejs";

// Returns the current status of a GenLayer transaction hash (for the consensus
// tracker to poll).
export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  if (!hash) {
    return NextResponse.json({ error: "Missing hash" }, { status: 400 });
  }
  try {
    const client = getReadClient();
    const tx: any = await client.getTransaction({ hash: hash as any });
    const status = tx?.statusName || tx?.status || "PENDING";
    return NextResponse.json({ hash, status });
  } catch (err: any) {
    return NextResponse.json({ hash, status: "PENDING" });
  }
}
