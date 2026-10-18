import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireVerifiedActor } from "@/lib/institutional/administration-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireVerifiedActor();
    if (actor.role !== "msme") throw new AdministrationError(403, "Business owner access required.");
    const { data: engagements, error } = await actor.db.from("institution_engagements").select("id,institution_id")
      .eq("owner_user_id", actor.userId).neq("relationship_status", "closed").eq("passport_access_status", "granted");
    if (error) throw error;
    const loaded = await Promise.all((engagements ?? []).map(async (engagement) => {
      const { data: consent, error: consentError } = await actor.db.from("institution_passport_consents").select("status")
        .eq("institution_id", engagement.institution_id).eq("engagement_id", engagement.id).maybeSingle();
      if (consentError) throw consentError;
      if (consent?.status !== "granted") return null;
      const { data: plan, error: planError } = await actor.db.from("institution_support_plans").select("*")
        .eq("institution_id", engagement.institution_id).eq("engagement_id", engagement.id).maybeSingle();
      if (planError) throw planError; if (!plan) return null;
      const [institution, outcome, milestones, touchpoints, issues, referrals] = await Promise.all([
        actor.db.from("institutions").select("name").eq("id", engagement.institution_id).maybeSingle(),
        actor.db.from("institution_finance_outcomes").select("outcome,decision_date,reason,approved_amount,currency").eq("institution_id", engagement.institution_id).eq("id", plan.finance_outcome_id).maybeSingle(),
        actor.db.from("institution_support_milestones").select("id,title,category,owner_type,due_date,status,completion_note,completed_at").eq("institution_id", engagement.institution_id).eq("plan_id", plan.id).order("due_date"),
        actor.db.from("institution_support_touchpoints").select("id,kind,scheduled_at,status,summary,outcome_note,next_follow_up_at,completed_at").eq("institution_id", engagement.institution_id).eq("plan_id", plan.id).order("scheduled_at"),
        actor.db.from("institution_support_issues").select("id,category,severity,summary,status,due_date,resolution_note,resolved_at").eq("institution_id", engagement.institution_id).eq("plan_id", plan.id).order("created_at", { ascending: false }),
        actor.db.from("institution_market_referrals").select("id,kind,partner_name,opportunity,status,follow_up_at,outcome_note").eq("institution_id", engagement.institution_id).eq("plan_id", plan.id).order("created_at", { ascending: false }),
      ]);
      const failed = [institution, outcome, milestones, touchpoints, issues, referrals].find((result) => result.error);
      if (failed?.error) throw failed.error;
      return { ...plan, institutionName: institution.data?.name ?? "Institution", outcome: outcome.data,
        milestones: milestones.data ?? [], touchpoints: touchpoints.data ?? [], issues: issues.data ?? [], referrals: referrals.data ?? [] };
    }));
    const plans = loaded.flatMap((plan) => plan ? [plan] : []);
    return NextResponse.json({ plans }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
