import { NextResponse } from "next/server";
import { verifyPublicProperty } from "@/lib/data/public-property-explorer";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const npin = url.searchParams.get("npin") ?? undefined;
  const token = url.searchParams.get("token") ?? undefined;
  if (!npin && !token) {
    return NextResponse.json({ error: "Provide an NPIN or verification token." }, { status: 400 });
  }

  const result = await verifyPublicProperty({ npin, token });
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
