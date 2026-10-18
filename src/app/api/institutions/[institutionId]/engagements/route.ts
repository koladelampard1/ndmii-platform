import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { administrationErrorResponse, AdministrationError, findVerifiedExistingUser, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { parseServiceStates } from "@/lib/institutional/administration-policy";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ institutionId: string }> };

async function ensureEnroller(actor: Awaited<ReturnType<typeof requireInstitutionActor>>, state?: string) {
  if (actor.platformAdmin || ["institution_admin", "institution_officer"].includes(actor.membership?.role ?? "")) return;
  const { data: members, error } = await actor.db.from("institution_members")
    .select("id,expires_at").eq("institution_id", actor.institution.id).eq("user_id", actor.userId)
    .eq("role", "institution_agent").eq("status", "active");
  if (error) throw error;
  const member = (members ?? []).find((row) => !row.expires_at || Date.parse(row.expires_at) > Date.now());
  if (!member) throw new AdministrationError(403, "Enrolment access denied.");
  const { data: profile, error: profileError } = await actor.db.from("institution_agent_profiles")
    .select("service_states,bdsp_organisation_id").eq("member_id", member.id)
    .eq("institution_id", actor.institution.id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || (state && profile.service_states?.length && !profile.service_states.some((s: string) => s.toLowerCase() === state.toLowerCase())))
    throw new AdministrationError(403, "Agent is not approved for this service area.");
  if (profile.bdsp_organisation_id) {
    const { data: bdsp, error: bdspError } = await actor.db.from("institution_bdsp_organisations")
      .select("status,service_states").eq("id", profile.bdsp_organisation_id).eq("institution_id", actor.institution.id).maybeSingle();
    if (bdspError) throw bdspError;
    if (bdsp?.status !== "active" || (state && bdsp.service_states?.length && !bdsp.service_states.some((s: string) => s.toLowerCase() === state.toLowerCase())))
      throw new AdministrationError(403, "BDSP is not approved for this service area.");
  }
}

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    if (!actor.platformAdmin && actor.membership?.role === "institution_agent") await ensureEnroller(actor);
    let query = actor.db.from("institution_engagements")
      .select("id,relationship_status,passport_access_status,created_at,created_by_user_id")
      .eq("institution_id", actor.institution.id).order("created_at", { ascending: false }).limit(200);
    if (!actor.platformAdmin && actor.membership?.role === "institution_agent") {
      const { data: assignments, error } = await actor.db.from("institution_business_assignments")
        .select("engagement_id").eq("institution_id", actor.institution.id)
        .eq("agent_member_id", actor.membership.id).eq("status", "active");
      if (error) throw error;
      const ids = (assignments ?? []).map((row) => row.engagement_id);
      query = ids.length ? query.or(`created_by_user_id.eq.${actor.userId},id.in.(${ids.join(",")})`)
        : query.eq("created_by_user_id", actor.userId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ engagements: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    const body = await request.json().catch(() => null);
    const fields = ["businessName", "ownerName", "state", "sector"] as const;
    const values = Object.fromEntries(fields.map((field) => [field, typeof body?.[field] === "string" ? body[field].trim() : ""]));
    if (values.businessName.length < 2 || values.businessName.length > 160 || values.ownerName.length < 2 || values.ownerName.length > 160 ||
      values.state.length < 2 || values.state.length > 80 || values.sector.length < 2 || values.sector.length > 120 ||
      !parseServiceStates([values.state])) throw new AdministrationError(400, "Check the business details and state.");
    await ensureEnroller(actor, values.state);
    const owner = await findVerifiedExistingUser(actor.db, String(body?.ownerEmail ?? ""));
    if (owner.role !== "msme") throw new AdministrationError(400, "The owner needs a verified DBIN business account.");
    const publicId = `BIN-${values.state.slice(0, 3).toUpperCase()}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const { data, error } = await actor.db.rpc("enrol_institution_business", {
      p_institution_id: actor.institution.id, p_owner_user_id: owner.id, p_actor_user_id: actor.userId,
      p_public_id: publicId, p_business_name: values.businessName, p_owner_name: values.ownerName,
      p_state: values.state, p_sector: values.sector, p_contact_email: owner.email,
    });
    if (error?.code === "23505") throw new AdministrationError(409, "This business may already have a DBIN identity. Ask its owner to share the existing business.");
    if (error) throw error;
    return NextResponse.json({ engagement: data?.[0], passportAccess: "pending" }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
