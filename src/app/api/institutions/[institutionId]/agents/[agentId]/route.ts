import { NextResponse } from "next/server";
import { isUuid, parseServiceStates } from "@/lib/institutional/administration-policy";
import { AdministrationError, administrationErrorResponse, recordInstitutionAudit, requireInstitutionActor, requireManager } from "@/lib/institutional/administration-server";

type Context = { params: Promise<{ institutionId: string; agentId: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const { institutionId, agentId } = await context.params;
    if (!isUuid(agentId)) throw new AdministrationError(400, "Invalid agent.");
    const actor = await requireInstitutionActor(institutionId);
    requireManager(actor);
    const body = await request.json().catch(() => null);
    const states = body?.serviceStates === undefined ? undefined : parseServiceStates(body.serviceStates);
    const bdspId = body?.bdspOrganisationId === undefined ? undefined : body.bdspOrganisationId || null;
    if (states === null || (bdspId !== undefined && bdspId !== null && !isUuid(bdspId)) ||
        (states === undefined && bdspId === undefined)) throw new AdministrationError(400, "Invalid agent update.");
    const { data: current, error: currentError } = await actor.db.from("institution_agent_profiles")
      .select("id,bdsp_organisation_id,service_states").eq("id", agentId).eq("institution_id", institutionId).maybeSingle();
    if (currentError) throw currentError;
    if (!current) throw new AdministrationError(404, "Agent not found.");
    const effectiveBdspId = bdspId === undefined ? current.bdsp_organisation_id : bdspId;
    const effectiveStates = states === undefined ? current.service_states : states;
    if (effectiveBdspId) {
      const { data: bdsp } = await actor.db.from("institution_bdsp_organisations")
        .select("id,service_states").eq("id", effectiveBdspId).eq("institution_id", institutionId).eq("status", "active").maybeSingle();
      if (!bdsp) throw new AdministrationError(404, "Active BDSP not found at this institution.");
      if (bdsp.service_states?.length && effectiveStates.some((state: string) =>
        !bdsp.service_states.some((area: string) => area.toLowerCase() === state.toLowerCase()))) {
        throw new AdministrationError(400, "Agent service areas must be within the BDSP's areas.");
      }
    }
    const { data, error } = await actor.db.from("institution_agent_profiles")
      .update({ ...(states ? { service_states: states } : {}),
        ...(bdspId !== undefined ? { bdsp_organisation_id: bdspId } : {}),
        updated_at: new Date().toISOString() })
      .eq("id", agentId).eq("institution_id", institutionId)
      .select("id,member_id,bdsp_organisation_id,service_states").maybeSingle();
    if (error) throw error;
    if (!data) throw new AdministrationError(404, "Agent not found.");
    await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId,
      eventType: "institution.agent.updated", entityType: "institution_agent_profiles", entityId: agentId });
    return NextResponse.json({ agent: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
