import { NextResponse } from "next/server";
import { verifyAssociationTemporaryAccess } from "@/lib/associations/access";
import { checkRateLimit } from "@/lib/http/rate-limit";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const rate = await checkRateLimit({ scope: "association-temporary-access", limit: 8, windowMs: 15 * 60 * 1000 });
  if (!rate.ok) return NextResponse.json({ ok: false, error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  const body = await request.json().catch(() => ({})) as { identifier?: string; pin?: string };
  const supabase = await createServiceRoleSupabaseClient();
  const result = await verifyAssociationTemporaryAccess(supabase, { identifier: String(body.identifier ?? ""), pin: String(body.pin ?? "") });
  return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
}

