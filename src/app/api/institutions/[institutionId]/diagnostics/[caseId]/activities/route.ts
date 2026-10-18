import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { diagnosticCase } from "@/lib/institutional/diagnostics-server";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ institutionId: string; caseId: string }> }) {
  try {
    const { institutionId, caseId } = await context.params;
    const actor = await requireInstitutionActor(institutionId);
    const record = await diagnosticCase(actor, caseId, true);
    if (["submitted", "approved"].includes(record.status)) throw new AdministrationError(409, "Case is closed for edits at this stage.");
    const body = await request.json().catch(() => null);
    const summary = body?.summary?.trim();
    if (!["mentorship", "training", "document_review", "market_linkage", "other"].includes(body?.kind) ||
      typeof summary !== "string" || summary.length < 3 || summary.length > 2000 ||
      typeof body?.occurredAt !== "string" || Number.isNaN(Date.parse(body.occurredAt)) ||
      Date.parse(body.occurredAt) > Date.now() + 86400000)
      throw new AdministrationError(400, "Enter a valid service, date and summary.");
    const { data, error } = await actor.db.from("institution_diagnostic_activities").insert({
      institution_id: actor.institution.id, case_id: caseId, kind: body.kind, summary,
      occurred_at: body.occurredAt, created_by_user_id: actor.userId,
    }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ activity: data }, { status: 201 });
  } catch (error) { return administrationErrorResponse(error); }
}
