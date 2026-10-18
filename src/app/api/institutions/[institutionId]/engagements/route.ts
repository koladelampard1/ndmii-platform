import { NextResponse } from "next/server";
import { InstitutionAccessError, requireInstitutionEngagementAccess } from "@/lib/institutional/engagement-access-server";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ institutionId: string }> }) {
  const { institutionId } = await context.params;
  if (!UUID.test(institutionId)) return NextResponse.json({ error: "Invalid institution." }, { status: 400 });

  try {
    const { db } = await requireInstitutionEngagementAccess(institutionId);
    const { data, error } = await db.from("institution_engagements")
      .select("id,relationship_status,passport_access_status,created_at,updated_at")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ engagements: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof InstitutionAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    console.error("[institution-engagements] list failed", { institutionId, error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Engagements are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
