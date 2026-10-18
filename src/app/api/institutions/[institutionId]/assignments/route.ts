import { NextResponse } from "next/server";
import { canSeeAgentQueue, isUuid } from "@/lib/institutional/administration-policy";
import { AdministrationError, administrationErrorResponse, recordInstitutionAudit, requireInstitutionActor, requireManager } from "@/lib/institutional/administration-server";

type Context = { params: Promise<{ institutionId: string }> };
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    const manager = actor.platformAdmin || actor.membership?.role === "institution_admin";
    let agentMemberId: string | null = null;
    if (!manager) {
      const { data: agentMemberships, error: membershipError } = await actor.db.from("institution_members")
        .select("id,role,status,expires_at").eq("institution_id", actor.institution.id)
        .eq("user_id", actor.userId).eq("role", "institution_agent").eq("status", "active");
      if (membershipError) throw membershipError;
      const member = (agentMemberships ?? []).find((row) => !row.expires_at || Date.parse(row.expires_at) > Date.now());
      if (!member) throw new AdministrationError(403, "Agent access denied.");
      const { data: profile, error: profileError } = await actor.db.from("institution_agent_profiles")
        .select("institution_id").eq("institution_id", actor.institution.id).eq("member_id", member.id).maybeSingle();
      if (profileError) throw profileError;
      if (!canSeeAgentQueue({ role: member.role, membershipStatus: member.status,
        expiresAt: member.expires_at, profileInstitutionId: profile?.institution_id ?? null,
        institutionId: actor.institution.id })) throw new AdministrationError(403, "Agent access denied.");
      const { data: affiliation, error: affiliationError } = await actor.db.from("institution_agent_profiles")
        .select("bdsp_organisation_id").eq("member_id", member.id).eq("institution_id", actor.institution.id).maybeSingle();
      if (affiliationError) throw affiliationError;
      if (affiliation?.bdsp_organisation_id) {
        const { data: bdsp, error: bdspError } = await actor.db.from("institution_bdsp_organisations")
          .select("status").eq("id", affiliation.bdsp_organisation_id).eq("institution_id", actor.institution.id).maybeSingle();
        if (bdspError) throw bdspError;
        if (bdsp?.status !== "active") throw new AdministrationError(403, "Agent access denied.");
      }
      agentMemberId = member.id;
    }
    let query = actor.db.from("institution_business_assignments")
      .select("id,engagement_id,agent_member_id,assigned_at,status")
      .eq("institution_id", actor.institution.id).eq("status", "active")
      .order("assigned_at", { ascending: false }).limit(200);
    if (agentMemberId) query = query.eq("agent_member_id", agentMemberId);
    const { data, error } = await query;
    if (error) throw error;
    let engagements: { id: string; relationship_status: string }[] = [];
    if (manager) {
      const { data: eligible, error: engagementError } = await actor.db.from("institution_engagements")
        .select("id,relationship_status").eq("institution_id", actor.institution.id)
        .neq("relationship_status", "closed").order("created_at", { ascending: false }).limit(200);
      if (engagementError) throw engagementError;
      engagements = eligible ?? [];
    }
    // Assignment IDs only. Business passport access remains a later, consent-gated sprint.
    return NextResponse.json({ assignments: data ?? [], engagements, institutionId: actor.institution.id },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}

export async function PUT(request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    requireManager(actor);
    const body = await request.json().catch(() => null);
    const engagementId = body?.engagementId;
    const agentMemberId = body?.agentMemberId;
    if (!isUuid(engagementId) || !isUuid(agentMemberId)) throw new AdministrationError(400, "Invalid engagement or agent.");
    const { data: engagement, error: engagementError } = await actor.db.from("institution_engagements")
      .select("id,msme_id,relationship_status").eq("id", engagementId)
      .eq("institution_id", actor.institution.id).maybeSingle();
    if (engagementError) throw engagementError;
    if (!engagement || engagement.relationship_status === "closed") throw new AdministrationError(404, "Open engagement not found.");
    const { data: member, error: memberError } = await actor.db.from("institution_members")
      .select("id,role,status,expires_at").eq("id", agentMemberId)
      .eq("institution_id", actor.institution.id).maybeSingle();
    if (memberError) throw memberError;
    const { data: profile, error: profileError } = await actor.db.from("institution_agent_profiles")
      .select("id,service_states,bdsp_organisation_id").eq("member_id", agentMemberId)
      .eq("institution_id", actor.institution.id).maybeSingle();
    if (profileError) throw profileError;
    if (!member || !profile || member.role !== "institution_agent" || member.status !== "active" ||
        (member.expires_at && Date.parse(member.expires_at) <= Date.now())) {
      throw new AdministrationError(403, "Only an active institution agent may receive work.");
    }
    const { data: business, error: businessError } = await actor.db.from("msmes")
      .select("state").eq("id", engagement.msme_id).maybeSingle();
    if (businessError) throw businessError;
    if (!business) throw new AdministrationError(404, "Business unavailable.");
    if (profile.bdsp_organisation_id) {
      const { data: bdsp, error: bdspError } = await actor.db.from("institution_bdsp_organisations")
        .select("status,service_states").eq("id", profile.bdsp_organisation_id)
        .eq("institution_id", actor.institution.id).maybeSingle();
      if (bdspError) throw bdspError;
      if (bdsp?.status !== "active") throw new AdministrationError(403, "The agent's BDSP is inactive.");
      if (bdsp.service_states?.length && !bdsp.service_states.some((state: string) =>
        state.toLowerCase() === business.state.toLowerCase())) {
        throw new AdministrationError(400, "The business is outside the BDSP's service areas.");
      }
    }
    if (profile.service_states?.length) {
      if (!profile.service_states.some((state: string) => state.toLowerCase() === business.state.toLowerCase())) {
        throw new AdministrationError(400, "The business is outside this agent's service areas.");
      }
    }
    const { data: previous, error: previousError } = await actor.db.from("institution_business_assignments")
      .select("id,agent_member_id,status").eq("institution_id", actor.institution.id)
      .eq("engagement_id", engagementId).maybeSingle();
    if (previousError) throw previousError;
    if (previous && previous.agent_member_id === agentMemberId && previous.status === "active") {
      throw new AdministrationError(409, "This agent is already assigned.");
    }
    const now = new Date().toISOString();
    const mutation = previous
      ? await actor.db.from("institution_business_assignments").update({
        agent_member_id: agentMemberId, status: "active", assigned_by_user_id: actor.userId,
        assigned_at: now, updated_at: now,
      }).eq("id", previous.id).eq("institution_id", actor.institution.id)
        .eq("agent_member_id", previous.agent_member_id).eq("status", previous.status)
        .select("id,engagement_id,agent_member_id,status").maybeSingle()
      : await actor.db.from("institution_business_assignments").insert({
        institution_id: actor.institution.id, engagement_id: engagementId,
        agent_member_id: agentMemberId, status: "active",
        assigned_by_user_id: actor.userId, assigned_at: now,
      }).select("id,engagement_id,agent_member_id,status").maybeSingle();
    if (mutation.error?.code === "23505") throw new AdministrationError(409, "Assignment changed; reload and try again.");
    if (mutation.error) throw mutation.error;
    const data = mutation.data;
    if (!data) throw new AdministrationError(409, "Assignment changed; reload and try again.");
    const eventResult = await actor.db.from("institution_engagement_events").insert({
      institution_id: actor.institution.id, engagement_id: engagementId, actor_user_id: actor.userId,
      event_type: previous ? "agent_reassigned" : "agent_assigned",
      event_data: { previousAgentMemberId: previous?.agent_member_id ?? null, agentMemberId },
    });
    if (eventResult.error) console.error("[assignment-event]", eventResult.error.message);
    await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId: actor.institution.id,
      eventType: previous ? "institution.assignment.reassigned" : "institution.assignment.created",
      entityType: "institution_business_assignments", entityId: data.id });
    return NextResponse.json({ assignment: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    requireManager(actor);
    const body = await request.json().catch(() => null);
    if (!isUuid(body?.engagementId) || body?.action !== "revoke") throw new AdministrationError(400, "Invalid assignment action.");
    const { data: current, error: lookupError } = await actor.db.from("institution_business_assignments")
      .select("id,agent_member_id,status").eq("institution_id", actor.institution.id)
      .eq("engagement_id", body.engagementId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!current || current.status !== "active") throw new AdministrationError(404, "Active assignment not found.");
    const { data, error } = await actor.db.from("institution_business_assignments")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", current.id).eq("institution_id", actor.institution.id)
      .eq("agent_member_id", current.agent_member_id).eq("status", "active")
      .select("id,status").maybeSingle();
    if (error) throw error;
    if (!data) throw new AdministrationError(409, "Assignment changed; reload and try again.");
    const eventResult = await actor.db.from("institution_engagement_events").insert({
      institution_id: actor.institution.id, engagement_id: body.engagementId,
      actor_user_id: actor.userId, event_type: "agent_assignment_revoked",
      event_data: { previousAgentMemberId: current.agent_member_id },
    });
    if (eventResult.error) console.error("[assignment-event]", eventResult.error.message);
    await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId: actor.institution.id,
      eventType: "institution.assignment.revoked", entityType: "institution_business_assignments", entityId: data.id });
    return NextResponse.json({ assignment: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
