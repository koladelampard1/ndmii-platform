import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor, requireManager } from "@/lib/institutional/administration-server";
import { validQuestions } from "@/lib/institutional/diagnostics-server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ institutionId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    const { data, error } = await actor.db.from("institution_diagnostic_templates").select("id,name,version,questions,active,created_at")
      .eq("institution_id", actor.institution.id).eq("active", true).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ templates: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    requireManager(actor);
    const body = await request.json().catch(() => null);
    const name = body?.name?.trim();
    if (typeof name !== "string" || name.length < 3 || name.length > 120 || !validQuestions(body?.questions))
      throw new AdministrationError(400, "Enter a template name and 1–30 unique questions.");
    const { data: latest, error: lastError } = await actor.db.from("institution_diagnostic_templates").select("version")
      .eq("institution_id", actor.institution.id).eq("name", name).order("version", { ascending: false }).limit(1).maybeSingle();
    if (lastError) throw lastError;
    const { data, error } = await actor.db.from("institution_diagnostic_templates").insert({
      institution_id: actor.institution.id, name, version: (latest?.version ?? 0) + 1,
      questions: body.questions, created_by_user_id: actor.userId,
    }).select("id,name,version,questions").single();
    if (error?.code === "23505") throw new AdministrationError(409, "Template changed; reload and try again.");
    if (error) throw error;
    return NextResponse.json({ template: data }, { status: 201 });
  } catch (error) { return administrationErrorResponse(error); }
}
