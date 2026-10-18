import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor, requireManager, recordInstitutionAudit } from "@/lib/institutional/administration-server";
import { parseServiceStates } from "@/lib/institutional/administration-policy";

type Context = { params: Promise<{ institutionId: string }> };
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    const { data, error } = await actor.db.from("institution_settings")
      .select("setting_key,setting_value,updated_at").eq("institution_id", actor.institution.id)
      .eq("is_sensitive", false).in("setting_key", ["support_email", "brand_color", "service_states"]);
    if (error) throw error;
    return NextResponse.json({ institution: actor.institution, settings: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    requireManager(actor);
    const body = await request.json().catch(() => null);
    const key = body?.key;
    let value: string | string[];
    if (key === "support_email" && typeof body.value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.value) && body.value.length <= 254) value = body.value.trim();
    else if (key === "brand_color" && typeof body.value === "string" && /^#[a-fA-F0-9]{6}$/.test(body.value)) value = body.value;
    else if (key === "service_states" && parseServiceStates(body?.value)) value = parseServiceStates(body.value)!;
    else throw new AdministrationError(400, "Invalid setting.");
    const { data, error } = await actor.db.from("institution_settings").upsert({
      institution_id: actor.institution.id, setting_key: key, setting_value: { value },
      is_sensitive: false, updated_by: actor.userId, updated_at: new Date().toISOString(),
    }, { onConflict: "institution_id,setting_key" }).select("id,setting_key,setting_value,updated_at").single();
    if (error) throw error;
    await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId: actor.institution.id,
      eventType: "institution.setting.updated", entityType: "institution_settings", entityId: data.id ?? actor.institution.id,
      metadata: { key } });
    return NextResponse.json({ setting: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
