import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { cleanText, isoDate, isoDateTime, requireOpenSupportPlan, supportPlan, supportPlanItems } from "@/lib/institutional/continuing-support-server";
import { validSupportPlanStatusTransition } from "@/lib/institutional/continuing-support-policy";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ institutionId: string; planId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { institutionId, planId } = await context.params;
    const actor = await requireInstitutionActor(institutionId);
    const plan = await supportPlan(actor, planId);
    const items = await supportPlanItems(actor, institutionId, planId);
    const { data: outcome, error } = await actor.db.from("institution_finance_outcomes").select("outcome,decision_date,reason,approved_amount,currency")
      .eq("institution_id", institutionId).eq("id", plan.finance_outcome_id).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ plan, outcome, ...items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { institutionId, planId } = await context.params;
    const actor = await requireInstitutionActor(institutionId);
    const plan = await supportPlan(actor, planId);
    requireOpenSupportPlan(plan);
    const body = await request.json().catch(() => null);
    const objective = cleanText(body?.objective, 3, 3000, "support objective");
    const targetEndDate = body?.targetEndDate ? isoDate(body.targetEndDate, "target date") : null;
    const nextFollowUpAt = isoDateTime(body?.nextFollowUpAt, "next follow-up", true);
    const status = typeof body?.status === "string" ? body.status : plan.status;
    if (status !== plan.status && !validSupportPlanStatusTransition(plan.status, status)) throw new AdministrationError(409, "That plan status change is not allowed.");
    if (targetEndDate && targetEndDate < plan.start_date) throw new AdministrationError(400, "Target date cannot be before the plan start date.");
    const completedAt = status === "completed" ? new Date().toISOString() : null;
    const { data, error } = await actor.db.from("institution_support_plans").update({ objective, target_end_date: targetEndDate,
      next_follow_up_at: nextFollowUpAt, status, completed_at: completedAt, updated_at: new Date().toISOString() })
      .eq("institution_id", institutionId).eq("id", planId).eq("status", plan.status).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new AdministrationError(409, "Plan changed; reload and try again.");
    return NextResponse.json({ plan: data });
  } catch (error) { return administrationErrorResponse(error); }
}
