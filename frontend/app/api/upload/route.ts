import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata";

export const runtime = "nodejs";

// Uploads an evidence file to IPFS via Pinata and returns the gateway URL.
// PINATA_JWT stays server-side and is never exposed to the browser.
export async function POST(req: NextRequest) {
  try {
    const jwt = process.env.PINATA_JWT;
    const gateway = process.env.PINATA_GATEWAY || "gateway.pinata.cloud";
    if (!jwt) {
      return NextResponse.json(
        { error: "PINATA_JWT not configured on the server" },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const pinata = new PinataSDK({ pinataJwt: jwt, pinataGateway: gateway });
    const result = await pinata.upload.public.file(file);
    const cid = result.cid;
    const url = `https://${gateway}/ipfs/${cid}`;

    return NextResponse.json({ cid, url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
