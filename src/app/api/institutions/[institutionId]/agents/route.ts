import { NextResponse } from "next/server";
import { canManageMember, isUuid, parseServiceStates } from "@/lib/institutional/administration-policy";
import { AdministrationError, administrationErrorResponse, findVerifiedExistingUser, recordInstitutionAudit, requireInstitutionActor, requireManager } from "@/lib/institutional/administration-server";

type Context = { params: Promise<{ institutionId: string }> };
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    requireManager(actor);
    const { data, error } = await actor.db.from("institution_agent_profiles")
      .select("id,member_id,bdsp_organisation_id,service_states")
      .eq("institution_id", actor.institution.id).limit(200);
    if (error) throw error;
    const memberIds = (data ?? []).map((row) => row.member_id);
    if (!memberIds.length) return NextResponse.json({ agents: [] }, { headers: { "Cache-Control": "private, no-store" } });
    const { data: members, error: memberError } = await actor.db.from("institution_members")
      .select("id,user_id,role,status,users!institution_members_user_id_fkey(email,full_name)")
      .eq("institution_id", actor.institution.id).in("id", memberIds);
    if (memberError) throw memberError;
    const byMember = new Map((members ?? []).map((row) => [row.id, row]));
    return NextResponse.json({ agents: (data ?? []).map((row) => ({ ...row, member: byMember.get(row.member_id) ?? null })) },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    requireManager(actor);
    const body = await request.json().catch(() => null);
    const serviceStates = parseServiceStates(body?.serviceStates ?? []);
    if (!serviceStates) throw new AdministrationError(400, "Invalid agent service areas.");
    const bdspId = body?.bdspOrganisationId || null;
    if (bdspId && !isUuid(bdspId)) throw new AdministrationError(400, "Invalid BDSP.");
    if (bdspId) {
      const { data: bdsp } = await actor.db.from("institution_bdsp_organisations")
        .select("id,service_states").eq("id", bdspId).eq("institution_id", actor.institution.id).eq("status", "active").maybeSingle();
      if (!bdsp) throw new AdministrationError(404, "Active BDSP not found at this institution.");
      if (bdsp.service_states?.length && serviceStates.some((state) =>
        !bdsp.service_states.some((area: string) => area.toLowerCase() === state.toLowerCase()))) {
        throw new AdministrationError(400, "Agent service areas must be within the BDSP's areas.");
      }
    }
    const user = await findVerifiedExistingUser(actor.db, String(body?.email ?? ""));
    if (!canManageMember({ platformAdmin: actor.platformAdmin, actorRole: actor.membership?.role ?? null,
      targetRole: "institution_agent", actorUserId: actor.userId, targetUserId: user.id, action: "invite" })) {
      throw new AdministrationError(403, "Agent invitation is not permitted.");
    }
    const { data: existing } = await actor.db.from("institution_members").select("id")
      .eq("institution_id", actor.institution.id).eq("user_id", user.id)
      .eq("role", "institution_agent").in("status", ["active", "invited"]).maybeSingle();
    if (existing) throw new AdministrationError(409, "This agent is already affiliated with the institution.");
    const { data: member, error: memberError } = await actor.db.from("institution_members")
      .insert({ institution_id: actor.institution.id, user_id: user.id,
        role: "institution_agent", status: "invited", invited_by: actor.userId })
      .select("id,role,status").single();
    if (memberError?.code === "23505") throw new AdministrationError(409, "This agent is already affiliated.");
    if (memberError || !member) throw memberError ?? new Error("Agent invitation failed.");
    const { data: profile, error: profileError } = await actor.db.from("institution_agent_profiles")
      .insert({ institution_id: actor.institution.id, member_id: member.id,
        bdsp_organisation_id: bdspId, service_states: serviceStates })
      .select("id,member_id,bdsp_organisation_id,service_states").single();
    if (profileError || !profile) {
      await actor.db.from("institution_members").update({ status: "revoked" }).eq("id", member.id).eq("status", "invited");
      throw profileError ?? new Error("Agent profile failed.");
    }
    await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId: actor.institution.id,
      eventType: "institution.agent.invited", entityType: "institution_agent_profiles", entityId: profile.id,
      metadata: { bdspOrganisationId: bdspId } });
    return NextResponse.json({ agent: profile, member }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
