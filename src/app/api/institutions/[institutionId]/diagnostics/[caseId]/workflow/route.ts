import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor, requireManager } from "@/lib/institutional/administration-server";
import { diagnosticCase, requireDiagnosticAgent } from "@/lib/institutional/diagnostics-server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ institutionId: string; caseId: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const { institutionId, caseId } = await context.params;
    const actor = await requireInstitutionActor(institutionId);
    const record = await diagnosticCase(actor, caseId);
    const body = await request.json().catch(() => null);
    const action = body?.action;
    let values: Record<string, unknown>;
    let expected: string;
    if (action === "submit") {
      const memberId = await requireDiagnosticAgent(actor, record.engagement_id);
      if (memberId !== record.agent_member_id) throw new AdministrationError(403, "Assigned agent required.");
      expected = "agreed";
      if (!record.owner_agreed_at) throw new AdministrationError(409, "Business agreement is required.");
      values = { status: "submitted", submitted_at: new Date().toISOString() };
    } else {
      requireManager(actor);
      expected = "submitted";
      if (action === "approve") values = { status: "approved", review_reason: null, next_action: null };
      else if (action === "return") {
        const reason = body?.reason?.trim();
        const nextAction = body?.nextAction?.trim();
        if (typeof reason !== "string" || reason.length < 10 || reason.length > 2000 ||
          typeof nextAction !== "string" || nextAction.length < 3 || nextAction.length > 1000)
          throw new AdministrationError(400, "Give a reason and a specific next action.");
        values = { status: "returned", review_reason: reason, next_action: nextAction, owner_agreed_at: null };
      } else throw new AdministrationError(400, "Invalid workflow action.");
      values.reviewed_at = new Date().toISOString();
      values.reviewed_by_user_id = actor.userId;
    }
    if (record.status !== expected) throw new AdministrationError(409, "Case changed; reload and try again.");
    const { data, error } = await actor.db.from("institution_diagnostic_cases").update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", caseId).eq("institution_id", actor.institution.id).eq("status", expected).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new AdministrationError(409, "Case changed; reload and try again.");
    return NextResponse.json({ case: data });
  } catch (error) { return administrationErrorResponse(error); }
}
