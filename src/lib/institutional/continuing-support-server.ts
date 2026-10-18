import { AdministrationError } from "@/lib/institutional/administration-server";
import { isUuid } from "@/lib/institutional/administration-policy";
import { diagnosticEngagement, requireDiagnosticAgent, type InstitutionActor } from "@/lib/institutional/diagnostics-server";
import { isFinanceOfficer } from "@/lib/institutional/finance-readiness-server";

export function isSupportSupervisor(actor: InstitutionActor) {
  return isFinanceOfficer(actor);
}

export async function supportPlan(actor: InstitutionActor, planId: string) {
  if (!isUuid(planId)) throw new AdministrationError(400, "Invalid continuing-support plan.");
  const { data, error } = await actor.db.from("institution_support_plans").select("*")
    .eq("institution_id", actor.institution.id).eq("id", planId).maybeSingle();
  if (error) throw error;
  if (!data) throw new AdministrationError(404, "Continuing-support plan unavailable.");
  await diagnosticEngagement(actor, data.engagement_id);
  if (!isSupportSupervisor(actor)) {
    const agentId = await requireDiagnosticAgent(actor, data.engagement_id);
    if (data.agent_member_id !== agentId) throw new AdministrationError(403, "Plan is assigned to another agent.");
  }
  return data;
}

export function requireOpenSupportPlan(plan: { status: string }) {
  if (plan.status === "closed") throw new AdministrationError(409, "This support plan is closed.");
}

export async function supportPlanItems(actor: Pick<InstitutionActor, "db">, institutionId: string, planId: string) {
  const [milestones, touchpoints, issues, referrals, history] = await Promise.all([
    actor.db.from("institution_support_milestones").select("*").eq("institution_id", institutionId).eq("plan_id", planId).order("due_date"),
    actor.db.from("institution_support_touchpoints").select("*").eq("institution_id", institutionId).eq("plan_id", planId).order("scheduled_at"),
    actor.db.from("institution_support_issues").select("*").eq("institution_id", institutionId).eq("plan_id", planId).order("created_at", { ascending: false }),
    actor.db.from("institution_market_referrals").select("*").eq("institution_id", institutionId).eq("plan_id", planId).order("created_at", { ascending: false }),
    actor.db.from("institution_support_history").select("*").eq("institution_id", institutionId).eq("plan_id", planId).order("occurred_at", { ascending: false }).limit(200),
  ]);
  const failed = [milestones, touchpoints, issues, referrals, history].find((result) => result.error);
  if (failed?.error) throw failed.error;
  return { milestones: milestones.data ?? [], touchpoints: touchpoints.data ?? [], issues: issues.data ?? [], referrals: referrals.data ?? [], history: history.data ?? [] };
}

export function cleanText(value: unknown, minimum: number, maximum: number, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < minimum || text.length > maximum) throw new AdministrationError(400, `Enter a valid ${label}.`);
  return text;
}

export function optionalText(value: unknown, maximum: number, label: string) {
  if (value === null || value === undefined || value === "") return null;
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maximum) throw new AdministrationError(400, `Enter a valid ${label}.`);
  return text;
}

export function isoDate(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))
    throw new AdministrationError(400, `Enter a valid ${label}.`);
  return value;
}

export function isoDateTime(value: unknown, label: string, optional = false) {
  if (optional && (value === null || value === undefined || value === "")) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new AdministrationError(400, `Enter a valid ${label}.`);
  return new Date(value).toISOString();
}
