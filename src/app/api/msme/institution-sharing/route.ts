import { NextResponse } from "next/server";
import { administrationErrorResponse, AdministrationError, requireVerifiedActor } from "@/lib/institutional/administration-server";
import { isUuid } from "@/lib/institutional/administration-policy";

export const dynamic = "force-dynamic";
async function owner() {
  const actor = await requireVerifiedActor();
  if (actor.role !== "msme") throw new AdministrationError(403, "A business account is required.");
  return actor;
}

export async function GET() {
  try {
    const actor = await owner();
    const { data: businesses, error: businessError } = await actor.db.from("msmes")
      .select("id,msme_id,business_name,state,sector").eq("created_by", actor.userId)
      .order("created_at", { ascending: false }).limit(100);
    if (businessError) throw businessError;
    const { data: requests, error } = await actor.db.from("institution_engagements")
      .select("id,institution_id,msme_id,relationship_status,passport_access_status,created_at")
      .eq("owner_user_id", actor.userId).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const ids = [...new Set((requests ?? []).map((row) => row.institution_id))];
    const { data: institutions, error: institutionError } = ids.length
      ? await actor.db.from("institutions").select("id,name,status").in("id", ids)
      : { data: [], error: null };
    if (institutionError) throw institutionError;
    const businessIds = [...new Set((requests ?? []).map((row) => row.msme_id))];
    const { data: requestedBusinesses, error: requestedError } = businessIds.length
      ? await actor.db.from("msmes").select("id,msme_id,business_name,state,sector").in("id", businessIds)
      : { data: [], error: null };
    if (requestedError) throw requestedError;
    return NextResponse.json({ businesses: businesses ?? [], requests: (requests ?? []).map((row) => ({
      ...row, institution: institutions?.find((institution) => institution.id === row.institution_id) ?? null,
      business: requestedBusinesses?.find((business) => business.id === row.msme_id) ?? null,
    })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await owner();
    const body = await request.json().catch(() => null);
    if (!isUuid(body?.institutionId) || !isUuid(body?.businessId)) throw new AdministrationError(400, "Choose a valid institution and business.");
    const { data, error } = await actor.db.rpc("request_institution_business", {
      p_institution_id: body.institutionId, p_business_id: body.businessId, p_owner_user_id: actor.userId,
    });
    if (error?.code === "23505") throw new AdministrationError(409, "This institution already has a request for that business.");
    if (error?.code === "P0002") throw new AdministrationError(404, "Business or institution unavailable.");
    if (error) throw error;
    return NextResponse.json({ engagementId: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
