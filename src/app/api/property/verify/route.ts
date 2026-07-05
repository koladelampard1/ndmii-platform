import { NextResponse } from "next/server";
import { verifyPublicProperty } from "@/lib/data/public-property-explorer";

function normalizeLookup(value: string | null) {
  return value?.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 256) || undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  // TODO(property-rate-limit): plug request/IP scoped rate limiting middleware in here before Phase 5 public scale-up.
  const npin = normalizeLookup(url.searchParams.get("npin"));
  const token = normalizeLookup(url.searchParams.get("token"));
  if (!npin && !token) {
    return NextResponse.json({ error: "Provide an NPIN or verification token." }, { status: 400 });
  }

  try {
    const result = await verifyPublicProperty({ npin, token });
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Property verification is temporarily unavailable. Please try again later." },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
