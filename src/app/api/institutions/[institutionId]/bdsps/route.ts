import { NextResponse } from "next/server";
import { parseServiceStates } from "@/lib/institutional/administration-policy";
import { AdministrationError, administrationErrorResponse, recordInstitutionAudit, requireInstitutionActor, requireManager } from "@/lib/institutional/administration-server";

type Context = { params: Promise<{ institutionId: string }> };
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    requireManager(actor);
    const { data, error } = await actor.db.from("institution_bdsp_organisations")
      .select("id,name,registration_number,service_states,status,created_at")
      .eq("institution_id", actor.institution.id).order("name").limit(200);
    if (error) throw error;
    return NextResponse.json({ bdsps: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    requireManager(actor);
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const registrationNumber = typeof body?.registrationNumber === "string" ? body.registrationNumber.trim() : "";
    const serviceStates = parseServiceStates(body?.serviceStates ?? []);
    if (name.length < 2 || name.length > 160 || registrationNumber.length > 80 || !serviceStates) {
      throw new AdministrationError(400, "Check the BDSP name and service areas.");
    }
    const { data, error } = await actor.db.from("institution_bdsp_organisations")
      .insert({ institution_id: actor.institution.id, name,
        registration_number: registrationNumber || null, service_states: serviceStates,
        created_by_user_id: actor.userId })
      .select("id,name,registration_number,service_states,status").single();
    if (error?.code === "23505") throw new AdministrationError(409, "This BDSP is already registered at this institution.");
    if (error || !data) throw error ?? new Error("BDSP could not be registered.");
    await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId: actor.institution.id,
      eventType: "institution.bdsp.created", entityType: "institution_bdsp_organisations", entityId: data.id });
    return NextResponse.json({ bdsp: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
