import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, recordInstitutionAudit, requireInstitutionActor, requireManager } from "@/lib/institutional/administration-server";
import { loadOnboarding, requirePlatformOnboardingManager } from "@/lib/institutional/onboarding-server";
import { validCheckUpdate, validOnboardingSetup } from "@/lib/institutional/onboarding-policy";

type Context = { params: Promise<{ institutionId: string }> };
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId); requireManager(actor);
    return NextResponse.json(await loadOnboarding(actor), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId); requireManager(actor); requirePlatformOnboardingManager(actor);
    const body = await request.json().catch(() => null);
    if (body?.action !== "initialize" || !validOnboardingSetup(body?.setup)) throw new AdministrationError(400, "Check the onboarding setup.");
    const setup = body.setup;
    const { error } = await actor.db.rpc("institution_initialize_onboarding", {
      p_institution_id: actor.institution.id, p_operating_model: setup.operatingModel, p_user_id: actor.userId,
    });
    if (error) throw error;
    const { error: projectError } = await actor.db.from("institution_onboarding_projects").update({
      target_go_live_date: setup.targetGoLiveDate || null, expected_agents: setup.expectedAgents,
      expected_businesses: setup.expectedBusinesses, programme_owner: setup.programmeOwner.trim() || null,
      technical_owner: setup.technicalOwner.trim() || null, updated_by_user_id: actor.userId,
    }).eq("institution_id", actor.institution.id);
    if (projectError) throw projectError;
    await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId: actor.institution.id,
      eventType: "institution.onboarding.initialized", entityType: "institution_onboarding_projects", entityId: actor.institution.id,
      metadata: { operatingModel: setup.operatingModel } });
    return NextResponse.json(await loadOnboarding(actor), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId); requireManager(actor);
    const body = await request.json().catch(() => null);
    if (body?.action === "update_check") {
      if (!validCheckUpdate(body)) throw new AdministrationError(400, "Check the UAT evidence entry.");
      const { data: currentCheck, error: currentCheckError } = await actor.db.from("institution_onboarding_checks").select("id,required")
        .eq("id", body.checkId).eq("institution_id", actor.institution.id).maybeSingle();
      if (currentCheckError) throw currentCheckError; if (!currentCheck) throw new AdministrationError(404, "Onboarding check not found.");
      if (currentCheck.required && body.status === "not_applicable") throw new AdministrationError(400, "A mandatory control must be passed; it cannot be marked not applicable.");
      const completed = ["passed", "failed", "not_applicable"].includes(body.status);
      const { data, error } = await actor.db.from("institution_onboarding_checks").update({
        status: body.status, evidence_note: body.evidenceNote.trim() || null, evidence_url: body.evidenceUrl?.trim() || null,
        checked_by_user_id: completed ? actor.userId : null, checked_at: completed ? new Date().toISOString() : null,
      }).eq("id", body.checkId).eq("institution_id", actor.institution.id).select("id,check_key,status").maybeSingle();
      if (error) throw error; if (!data) throw new AdministrationError(404, "Onboarding check not found.");
      await actor.db.from("institution_onboarding_projects").update({ status: "uat", updated_by_user_id: actor.userId }).eq("institution_id", actor.institution.id).neq("status", "live");
      await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId: actor.institution.id,
        eventType: "institution.onboarding.check_updated", entityType: "institution_onboarding_checks", entityId: data.id,
        metadata: { checkKey: data.check_key, status: data.status } });
      return NextResponse.json(await loadOnboarding(actor), { headers: { "Cache-Control": "no-store" } });
    }
    if (body?.action === "activate") {
      requirePlatformOnboardingManager(actor);
      const note = typeof body?.signoffNote === "string" ? body.signoffNote.trim() : "";
      if (note.length < 10 || note.length > 4000) throw new AdministrationError(400, "Provide a concise activation sign-off note.");
      const { error } = await actor.db.rpc("institution_activate_onboarding", { p_institution_id: actor.institution.id,
        p_user_id: actor.userId, p_signoff_note: note });
      if (error?.message?.includes("has not passed")) throw new AdministrationError(409, "The institution has not passed every required go-live control.");
      if (error?.message?.includes("already live") || error?.message?.includes("unavailable")) throw new AdministrationError(409, "The institution is already live or onboarding is unavailable.");
      if (error) throw error;
      await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId: actor.institution.id,
        eventType: "institution.onboarding.activated", entityType: "institution_onboarding_projects", entityId: actor.institution.id });
      return NextResponse.json(await loadOnboarding(actor), { headers: { "Cache-Control": "no-store" } });
    }
    throw new AdministrationError(400, "Unsupported onboarding action.");
  } catch (error) { return administrationErrorResponse(error); }
}
