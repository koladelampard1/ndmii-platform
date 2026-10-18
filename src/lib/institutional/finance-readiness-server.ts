import { AdministrationError, requireVerifiedActor } from "@/lib/institutional/administration-server";
import { diagnosticEngagement, requireDiagnosticAgent, type InstitutionActor } from "@/lib/institutional/diagnostics-server";
import { isUuid } from "@/lib/institutional/administration-policy";

export type FinanceRequirement = { key: string; label: string; description: string; required: boolean };
export function validFinanceRequirements(value: unknown): value is FinanceRequirement[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 40 && value.every(item => item &&
    typeof item.key === "string" && /^[a-z0-9_]{2,40}$/.test(item.key) && typeof item.label === "string" &&
    item.label.trim().length >= 3 && item.label.length <= 200 && typeof item.description === "string" &&
    item.description.length <= 1000 && typeof item.required === "boolean") && new Set(value.map(item => item.key)).size === value.length;
}

export function isFinanceOfficer(actor: InstitutionActor) {
  return actor.platformAdmin || ["institution_admin", "institution_officer", "institution_reviewer"].includes(actor.membership?.role ?? "");
}
export function requireFinanceOfficer(actor: InstitutionActor) {
  if (!isFinanceOfficer(actor)) throw new AdministrationError(403, "Institution officer access is required.");
}

export async function financeCase(actor: InstitutionActor, caseId: string, agentMutation = false) {
  if (!isUuid(caseId)) throw new AdministrationError(400, "Invalid finance readiness case.");
  const { data, error } = await actor.db.from("institution_finance_cases").select("*")
    .eq("institution_id", actor.institution.id).eq("id", caseId).maybeSingle();
  if (error) throw error;
  if (!data) throw new AdministrationError(404, "Finance readiness case unavailable.");
  await diagnosticEngagement(actor, data.engagement_id);
  if (!isFinanceOfficer(actor) || agentMutation) {
    const agentId = await requireDiagnosticAgent(actor, data.engagement_id);
    if (data.agent_member_id !== agentId) throw new AdministrationError(403, "Case is assigned to another agent.");
  }
  return data;
}

export async function ownerFinanceCase(caseId: string) {
  const actor = await requireVerifiedActor();
  if (actor.role !== "msme" || !isUuid(caseId)) throw new AdministrationError(403, "Business owner access required.");
  const { data: record, error } = await actor.db.from("institution_finance_cases").select("*").eq("id", caseId).maybeSingle();
  if (error) throw error;
  if (!record) throw new AdministrationError(404, "Finance readiness case unavailable.");
  const { data: engagement, error: engagementError } = await actor.db.from("institution_engagements")
    .select("owner_user_id,relationship_status,passport_access_status").eq("institution_id", record.institution_id)
    .eq("id", record.engagement_id).maybeSingle();
  if (engagementError) throw engagementError;
  if (!engagement || engagement.owner_user_id !== actor.userId || engagement.relationship_status === "closed" || engagement.passport_access_status !== "granted")
    throw new AdministrationError(403, "Finance case access denied.");
  const { data: consent } = await actor.db.from("institution_passport_consents").select("status")
    .eq("institution_id", record.institution_id).eq("engagement_id", record.engagement_id).maybeSingle();
  if (consent?.status !== "granted") throw new AdministrationError(403, "Finance case access denied.");
  return { actor, record };
}

export async function caseItems(actor: Pick<InstitutionActor,"db">, institutionId: string, caseId: string) {
  const { data, error } = await actor.db.from("institution_finance_requirement_items").select("*")
    .eq("institution_id", institutionId).eq("case_id", caseId).order("label");
  if (error) throw error;
  return data ?? [];
}

export function preparationComplete(items: { required: boolean; status: string }[]) {
  return items.filter(item => item.required).every(item => ["verified", "waived"].includes(item.status));
}
