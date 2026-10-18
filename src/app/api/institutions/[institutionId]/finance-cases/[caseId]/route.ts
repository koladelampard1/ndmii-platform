import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { caseItems, financeCase, isFinanceOfficer, preparationComplete } from "@/lib/institutional/finance-readiness-server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ institutionId: string; caseId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { institutionId, caseId } = await context.params; const actor = await requireInstitutionActor(institutionId);
    const record = await financeCase(actor, caseId); const items = await caseItems(actor, institutionId, caseId);
    const { data: documents, error } = await actor.db.from("institution_finance_documents")
      .select("id,requirement_item_id,file_name,mime_type,byte_size,created_at").eq("institution_id", institutionId).eq("case_id", caseId);
    if (error) throw error;
    const { data: application, error: appError } = await actor.db.from("institution_finance_applications").select("*")
      .eq("institution_id", institutionId).eq("case_id", caseId).maybeSingle();
    if (appError) throw appError;
    let outcome = null;
    if (application) { const result = await actor.db.from("institution_finance_outcomes").select("*")
      .eq("institution_id", institutionId).eq("application_id", application.id).maybeSingle(); if (result.error) throw result.error; outcome = result.data; }
    return NextResponse.json({ case: record, items, documents: documents ?? [], application, outcome,
      preparationComplete: preparationComplete(items), officer: isFinanceOfficer(actor) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const { institutionId, caseId } = await context.params; const actor = await requireInstitutionActor(institutionId);
    const record = await financeCase(actor, caseId, true);
    if (["handed_over","accepted","closed"].includes(record.status)) throw new AdministrationError(409, "The case is locked at this stage.");
    const body = await request.json().catch(() => null); const gapSummary = body?.gapSummary?.trim(); const readinessNote = body?.readinessNote?.trim();
    if (typeof gapSummary !== "string" || gapSummary.length > 5000 || typeof readinessNote !== "string" || readinessNote.length > 5000)
      throw new AdministrationError(400, "Check the gap summary and readiness note.");
    const { data, error } = await actor.db.from("institution_finance_cases").update({ gap_summary: gapSummary, readiness_note: readinessNote,
      updated_at: new Date().toISOString() }).eq("id", caseId).eq("institution_id", institutionId).eq("status", record.status).select("*").maybeSingle();
    if (error) throw error; if (!data) throw new AdministrationError(409, "Case changed; reload and try again.");
    return NextResponse.json({ case: data });
  } catch (error) { return administrationErrorResponse(error); }
}
