import { NextResponse } from "next/server";
import { administrationErrorResponse, AdministrationError, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { isUuid } from "@/lib/institutional/administration-policy";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ institutionId: string; engagementId: string }> }) {
  try {
    const { institutionId, engagementId } = await context.params;
    if (!isUuid(engagementId)) throw new AdministrationError(400, "Invalid engagement.");
    const actor = await requireInstitutionActor(institutionId);
    let agentStates: string[] = [];
    let bdspStates: string[] = [];
    if (!actor.platformAdmin && actor.membership?.role === "institution_agent") {
      const { data: assignments, error: assignmentError } = await actor.db.from("institution_business_assignments")
        .select("agent_member_id").eq("institution_id", actor.institution.id)
        .eq("engagement_id", engagementId).eq("status", "active");
      if (assignmentError) throw assignmentError;
      const own = (assignments ?? []).find((row) => row.agent_member_id === actor.membership?.id);
      if (!own) throw new AdministrationError(403, "This business is not assigned to you.");
      const { data: profile, error: profileError } = await actor.db.from("institution_agent_profiles")
        .select("bdsp_organisation_id,service_states").eq("institution_id", actor.institution.id)
        .eq("member_id", own.agent_member_id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw new AdministrationError(403, "Agent access denied.");
      agentStates = profile.service_states ?? [];
      if (profile.bdsp_organisation_id) {
        const { data: bdsp, error: bdspError } = await actor.db.from("institution_bdsp_organisations")
          .select("status,service_states").eq("institution_id", actor.institution.id).eq("id", profile.bdsp_organisation_id).maybeSingle();
        if (bdspError) throw bdspError;
        if (bdsp?.status !== "active") throw new AdministrationError(403, "Agent access denied.");
        bdspStates = bdsp.service_states ?? [];
      }
    }
    const { data: engagement, error } = await actor.db.from("institution_engagements")
      .select("id,msme_id,passport_access_status,relationship_status")
      .eq("id", engagementId).eq("institution_id", actor.institution.id).maybeSingle();
    if (error) throw error;
    if (!engagement || engagement.relationship_status === "closed") throw new AdministrationError(404, "Engagement unavailable.");
    const { data: consent, error: consentError } = await actor.db.from("institution_passport_consents")
      .select("status,data_categories,granted_at,revoked_at")
      .eq("engagement_id", engagement.id).eq("institution_id", actor.institution.id).maybeSingle();
    if (consentError) throw consentError;
    if (engagement.passport_access_status !== "granted" || consent?.status !== "granted" ||
      !consent.data_categories.includes("business_identity")) throw new AdministrationError(403, "Business passport has not been shared.");
    const { data: business, error: businessError } = await actor.db.from("msmes")
      .select("msme_id,business_name,state,sector,verification_status")
      .eq("id", engagement.msme_id).maybeSingle();
    if (businessError) throw businessError;
    if (!business) throw new AdministrationError(404, "Business unavailable.");
    if ([agentStates, bdspStates].some((states) => states.length && !states.some((state) => state.toLowerCase() === business.state.toLowerCase())))
      throw new AdministrationError(403, "This business is outside your service area.");
    return NextResponse.json({ passport: business, consent: { dataCategories: consent.data_categories, grantedAt: consent.granted_at } },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
