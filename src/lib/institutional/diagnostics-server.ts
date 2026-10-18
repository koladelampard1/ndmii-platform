import { AdministrationError, requireInstitutionActor, requireVerifiedActor } from "@/lib/institutional/administration-server";
import { isUuid } from "@/lib/institutional/administration-policy";

export type InstitutionActor = Awaited<ReturnType<typeof requireInstitutionActor>>;

export async function diagnosticEngagement(actor: InstitutionActor, engagementId: string) {
  if (!isUuid(engagementId)) throw new AdministrationError(400, "Invalid engagement.");
  const { data: engagement, error } = await actor.db.from("institution_engagements")
    .select("id,msme_id,owner_user_id,relationship_status,passport_access_status")
    .eq("institution_id", actor.institution.id).eq("id", engagementId).maybeSingle();
  if (error) throw error;
  if (!engagement || engagement.relationship_status === "closed") throw new AdministrationError(404, "Engagement unavailable.");
  const { data: consent, error: consentError } = await actor.db.from("institution_passport_consents")
    .select("status,data_categories").eq("institution_id", actor.institution.id).eq("engagement_id", engagementId).maybeSingle();
  if (consentError) throw consentError;
  if (engagement.passport_access_status !== "granted" || consent?.status !== "granted" ||
    !consent.data_categories?.includes("business_identity")) throw new AdministrationError(403, "Business sharing is required.");
  return engagement;
}

export async function requireDiagnosticAgent(actor: InstitutionActor, engagementId: string) {
  await diagnosticEngagement(actor, engagementId);
  const { data: assignments, error } = await actor.db.from("institution_business_assignments")
    .select("agent_member_id").eq("institution_id", actor.institution.id).eq("engagement_id", engagementId).eq("status", "active");
  if (error) throw error;
  const member = assignments?.find(row => row.agent_member_id === actor.membership?.id);
  if (!member || actor.membership?.role !== "institution_agent") throw new AdministrationError(403, "Active assignment required.");
  const { data: profile, error: profileError } = await actor.db.from("institution_agent_profiles")
    .select("bdsp_organisation_id,service_states").eq("institution_id", actor.institution.id).eq("member_id", member.agent_member_id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new AdministrationError(403, "Agent profile unavailable.");
  if (profile.bdsp_organisation_id) {
    const { data: bdsp, error: bdspError } = await actor.db.from("institution_bdsp_organisations")
      .select("status,service_states").eq("institution_id", actor.institution.id).eq("id", profile.bdsp_organisation_id).maybeSingle();
    if (bdspError) throw bdspError;
    if (bdsp?.status !== "active") throw new AdministrationError(403, "BDSP is inactive.");
    await checkServiceArea(actor, engagementId, [profile.service_states ?? [], bdsp.service_states ?? []]);
  } else await checkServiceArea(actor, engagementId, [profile.service_states ?? []]);
  return member.agent_member_id;
}

async function checkServiceArea(actor: InstitutionActor, engagementId: string, areas: string[][]) {
  const { data: engagement } = await actor.db.from("institution_engagements").select("msme_id")
    .eq("institution_id", actor.institution.id).eq("id", engagementId).single();
  const { data: business, error } = await actor.db.from("msmes").select("state").eq("id", engagement?.msme_id).maybeSingle();
  if (error || !business) throw new AdministrationError(404, "Business unavailable.");
  if (areas.some(states => states.length && !states.some(state => state.toLowerCase() === business.state?.toLowerCase())))
    throw new AdministrationError(403, "Business is outside the agent service area.");
}

export async function diagnosticCase(actor: InstitutionActor, caseId: string, mutate = false) {
  if (!isUuid(caseId)) throw new AdministrationError(400, "Invalid diagnostic case.");
  const { data, error } = await actor.db.from("institution_diagnostic_cases").select("*")
    .eq("institution_id", actor.institution.id).eq("id", caseId).maybeSingle();
  if (error) throw error;
  if (!data) throw new AdministrationError(404, "Diagnostic case unavailable.");
  await diagnosticEngagement(actor, data.engagement_id);
  if (mutate || (!actor.platformAdmin && actor.membership?.role !== "institution_admin")) {
    const agentId = await requireDiagnosticAgent(actor, data.engagement_id);
    if (data.agent_member_id !== agentId) throw new AdministrationError(403, "Case is assigned to another agent.");
  }
  return data;
}

export async function ownerDiagnosticCase(caseId: string) {
  const actor = await requireVerifiedActor();
  if (actor.role !== "msme" || !isUuid(caseId)) throw new AdministrationError(403, "Business owner access required.");
  const { data: record, error } = await actor.db.from("institution_diagnostic_cases").select("*").eq("id", caseId).maybeSingle();
  if (error) throw error;
  if (!record) throw new AdministrationError(404, "Plan unavailable.");
  const { data: engagement, error: engagementError } = await actor.db.from("institution_engagements")
    .select("owner_user_id,relationship_status,passport_access_status").eq("institution_id", record.institution_id)
    .eq("id", record.engagement_id).maybeSingle();
  if (engagementError) throw engagementError;
  if (!engagement || engagement.owner_user_id !== actor.userId || engagement.relationship_status === "closed" || engagement.passport_access_status !== "granted")
    throw new AdministrationError(403, "Plan access denied.");
  const { data: consent } = await actor.db.from("institution_passport_consents").select("status")
    .eq("institution_id", record.institution_id).eq("engagement_id", record.engagement_id).maybeSingle();
  if (consent?.status !== "granted") throw new AdministrationError(403, "Plan access denied.");
  return { actor, record };
}

export function validQuestions(value: unknown): value is { id: string; label: string }[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 30 &&
    value.every(item => item && typeof item.id === "string" && /^[a-z0-9_]{2,40}$/.test(item.id) &&
      typeof item.label === "string" && item.label.trim().length >= 5 && item.label.length <= 300) &&
    new Set(value.map(item => item.id)).size === value.length;
}

export function validActions(value: unknown): value is { title: string; owner: string; dueDate: string }[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 30 && value.every(item =>
    item && typeof item.title === "string" && item.title.trim().length >= 3 && item.title.length <= 500 &&
    ["agent", "business", "institution"].includes(item.owner) &&
    typeof item.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) && !Number.isNaN(Date.parse(item.dueDate)));
}
