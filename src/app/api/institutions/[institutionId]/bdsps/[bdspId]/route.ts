import { NextResponse } from "next/server";
import { isUuid, parseServiceStates } from "@/lib/institutional/administration-policy";
import { AdministrationError, administrationErrorResponse, recordInstitutionAudit, requireInstitutionActor, requireManager } from "@/lib/institutional/administration-server";

type Context = { params: Promise<{ institutionId: string; bdspId: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const { institutionId, bdspId } = await context.params;
    if (!isUuid(bdspId)) throw new AdministrationError(400, "Invalid BDSP.");
    const actor = await requireInstitutionActor(institutionId);
    requireManager(actor);
    const body = await request.json().catch(() => null);
    const status = body?.status;
    const serviceStates = body?.serviceStates === undefined ? undefined : parseServiceStates(body.serviceStates);
    if ((status !== undefined && !["active", "suspended", "revoked"].includes(status)) ||
        serviceStates === null || (status === undefined && serviceStates === undefined)) {
      throw new AdministrationError(400, "Invalid BDSP update.");
    }
    const { data: current, error: lookupError } = await actor.db.from("institution_bdsp_organisations")
      .select("id,status").eq("id", bdspId).eq("institution_id", institutionId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!current) throw new AdministrationError(404, "BDSP not found.");
    const { data, error } = await actor.db.from("institution_bdsp_organisations")
      .update({ ...(status ? { status } : {}), ...(serviceStates ? { service_states: serviceStates } : {}),
        updated_at: new Date().toISOString() })
      .eq("id", bdspId).eq("institution_id", institutionId).eq("status", current.status)
      .select("id,name,status,service_states").maybeSingle();
    if (error) throw error;
    if (!data) throw new AdministrationError(409, "BDSP changed; reload and try again.");
    await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId,
      eventType: "institution.bdsp.updated", entityType: "institution_bdsp_organisations", entityId: bdspId,
      metadata: { status: data.status } });
    return NextResponse.json({ bdsp: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
