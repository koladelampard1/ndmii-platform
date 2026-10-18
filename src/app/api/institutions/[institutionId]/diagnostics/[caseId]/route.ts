import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { diagnosticCase, validActions, validQuestions } from "@/lib/institutional/diagnostics-server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ institutionId: string; caseId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { institutionId, caseId } = await context.params;
    const actor = await requireInstitutionActor(institutionId);
    const record = await diagnosticCase(actor, caseId);
    const { data: activities, error } = await actor.db.from("institution_diagnostic_activities").select("*")
      .eq("institution_id", actor.institution.id).eq("case_id", caseId).order("occurred_at", { ascending: false });
    if (error) throw error;
    const { data: evidence, error: evidenceError } = await actor.db.from("institution_diagnostic_evidence")
      .select("id,activity_id,file_name,mime_type,byte_size,created_at").eq("institution_id", actor.institution.id).eq("case_id", caseId);
    if (evidenceError) throw evidenceError;
    return NextResponse.json({ case: record, activities, evidence }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const { institutionId, caseId } = await context.params;
    const actor = await requireInstitutionActor(institutionId);
    const record = await diagnosticCase(actor, caseId, true);
    const body = await request.json().catch(() => null);
    if (!["draft", "returned"].includes(record.status)) throw new AdministrationError(409, "This plan is locked at its current stage.");
    const answers = body?.answers;
    const findings = body?.findings?.trim();
    const actions = body?.actions;
    if (!validQuestions(record.questions) || !answers || typeof answers !== "object" || Array.isArray(answers) ||
      Object.keys(answers).some(key => !record.questions.some((question: { id: string }) => question.id === key) ||
        typeof answers[key] !== "string" || answers[key].length > 2000) ||
      typeof findings !== "string" || findings.length > 5000 || !Array.isArray(actions) || actions.length > 30 ||
      (actions.length > 0 && !validActions(actions))) throw new AdministrationError(400, "Invalid answers, findings or actions.");
    if (body?.submitForAgreement && (record.questions.some((q: { id: string }) => !answers[q.id]?.trim()) ||
      findings.length < 10 || !validActions(actions))) throw new AdministrationError(400, "Answer all questions, describe findings and add a dated action before requesting agreement.");
    const { data, error } = await actor.db.from("institution_diagnostic_cases").update({
      answers, findings, actions, status: body?.submitForAgreement ? "awaiting_agreement" : "draft",
      owner_agreed_at: null, reviewed_at: null, reviewed_by_user_id: null, updated_at: new Date().toISOString(),
    }).eq("id", caseId).eq("institution_id", actor.institution.id).eq("status", record.status)
      .select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new AdministrationError(409, "Case changed; reload and try again.");
    return NextResponse.json({ case: data });
  } catch (error) { return administrationErrorResponse(error); }
}
