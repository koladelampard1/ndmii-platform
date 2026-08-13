import { NextResponse } from "next/server";
import { getPublicCorrespondenceVerification } from "@/lib/data/lcdbo-correspondence";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  try {
    // TODO: Attach middleware-backed rate limiting before public launch.
    const verification = await getPublicCorrespondenceVerification(token);
    if (!verification) return NextResponse.json({ ok: false, error: "Correspondence record not found." }, { status: 404 });
    return NextResponse.json({ ok: true, correspondence: verification });
  } catch {
    return NextResponse.json({ ok: false, error: "Verification is temporarily unavailable." }, { status: 503 });
  }
}
