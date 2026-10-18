import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { diagnosticEngagement, requireDiagnosticAgent } from "@/lib/institutional/diagnostics-server";
import { isSupportSupervisor } from "@/lib/institutional/continuing-support-server";
import { isOverdue } from "@/lib/institutional/continuing-support-policy";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ institutionId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { institutionId } = await context.params;
    const actor = await requireInstitutionActor(institutionId);
    const supervisor = isSupportSupervisor(actor);
    if (!supervisor && actor.membership?.role !== "institution_agent") throw new AdministrationError(403, "Continuing-support access denied.");
    let query = actor.db.from("institution_support_plans").select("*").eq("institution_id", institutionId)
      .order("updated_at", { ascending: false }).limit(200);
    if (!supervisor) query = query.eq("agent_member_id", actor.membership!.id);
    const { data, error } = await query;
    if (error) throw error;
    const visible = await Promise.all((data ?? []).map(async (plan) => {
      try {
        const engagement = await diagnosticEngagement(actor, plan.engagement_id);
        if (!supervisor) await requireDiagnosticAgent(actor, plan.engagement_id);
        const { data: business } = await actor.db.from("msmes").select("business_name,msme_id").eq("id", engagement.msme_id).maybeSingle();
        return { plan, business: business ? { engagementId: plan.engagement_id, businessName: business.business_name, msmeId: business.msme_id } : null };
      } catch (cause) {
        if (!(cause instanceof AdministrationError && [403, 404].includes(cause.status))) throw cause;
        return null;
      }
    }));
    const plans = visible.flatMap((item) => item ? [item.plan] : []);
    const businesses = visible.flatMap((item) => item?.business ? [item.business] : []);
    const planIds = plans.map((plan) => plan.id);
    const empty = { data: [] as Record<string, unknown>[], error: null };
    const [milestones, touchpoints, issues, referrals] = planIds.length ? await Promise.all([
      actor.db.from("institution_support_milestones").select("id,plan_id,status,due_date").eq("institution_id", institutionId).in("plan_id", planIds),
      actor.db.from("institution_support_touchpoints").select("id,plan_id,status,scheduled_at").eq("institution_id", institutionId).in("plan_id", planIds),
      actor.db.from("institution_support_issues").select("id,plan_id,status,severity,due_date").eq("institution_id", institutionId).in("plan_id", planIds),
      actor.db.from("institution_market_referrals").select("id,plan_id,status,follow_up_at").eq("institution_id", institutionId).in("plan_id", planIds),
    ]) : [empty, empty, empty, empty];
    const failed = [milestones, touchpoints, issues, referrals].find((result) => result.error);
    if (failed?.error) throw failed.error;
    const queue = plans.map((plan) => ({
      planId: plan.id,
      overdueMilestones: (milestones.data ?? []).filter((item) => item.plan_id === plan.id && isOverdue({ status: String(item.status), dueAt: String(item.due_date) })).length,
      overdueTouchpoints: (touchpoints.data ?? []).filter((item) => item.plan_id === plan.id && isOverdue({ status: String(item.status), dueAt: String(item.scheduled_at) })).length,
      openCriticalIssues: (issues.data ?? []).filter((item) => item.plan_id === plan.id && !["resolved", "closed"].includes(String(item.status)) && item.severity === "critical").length,
      overdueReferrals: (referrals.data ?? []).filter((item) => item.plan_id === plan.id && isOverdue({ status: String(item.status), dueAt: item.follow_up_at ? String(item.follow_up_at) : null })).length,
    }));
    return NextResponse.json({ plans, businesses, queue, supervisor }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
