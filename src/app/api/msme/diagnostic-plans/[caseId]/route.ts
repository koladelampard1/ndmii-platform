import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse } from "@/lib/institutional/administration-server";
import { ownerDiagnosticCase } from "@/lib/institutional/diagnostics-server";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await context.params;
    const { actor, record } = await ownerDiagnosticCase(caseId);
    if (record.status !== "awaiting_agreement") throw new AdministrationError(409, "Plan is not awaiting your agreement.");
    const body = await request.json().catch(() => null);
    const agree = body?.action === "agree";
    const reason = body?.reason?.trim();
    if (!agree && (body?.action !== "request_changes" || typeof reason !== "string" || reason.length < 10 || reason.length > 2000))
      throw new AdministrationError(400, "Describe the changes needed.");
    const { data, error } = await actor.db.from("institution_diagnostic_cases").update({
      status: agree ? "agreed" : "returned", owner_agreed_at: agree ? new Date().toISOString() : null,
      review_reason: agree ? null : reason, next_action: agree ? null : "Agent to revise the plan and request agreement again.",
      updated_at: new Date().toISOString(),
    }).eq("id", caseId).eq("institution_id", record.institution_id).eq("status", "awaiting_agreement")
      .select("id,status").maybeSingle();
    if (error) throw error;
    if (!data) throw new AdministrationError(409, "Plan changed; reload and try again.");
    return NextResponse.json({ plan: data });
  } catch (error) { return administrationErrorResponse(error); }
}
