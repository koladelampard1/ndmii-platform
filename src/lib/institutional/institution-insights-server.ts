import { AdministrationError } from "@/lib/institutional/administration-server";
import type { InstitutionActor } from "@/lib/institutional/diagnostics-server";
import { defaultProfile, type InstitutionProfileInput } from "@/lib/institutional/institution-insights-policy";

export function requireInsightsViewer(actor: InstitutionActor) {
  if (!actor.platformAdmin && !["institution_admin","institution_officer","institution_reviewer"].includes(actor.membership?.role ?? ""))
    throw new AdministrationError(403,"Institution management access is required.");
}

export async function loadInstitutionProfile(actor: InstitutionActor) {
  const { data, error } = await actor.db.from("institution_operating_profiles").select("*")
    .eq("institution_id",actor.institution.id).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const fallback = defaultProfile(actor.institution.institution_type,actor.institution.name);
  return profileRow(actor.institution.id,fallback);
}

export function profileRow(institutionId: string, input: InstitutionProfileInput, userId?: string) {
  return { institution_id: institutionId, operating_model: input.operatingModel, short_name: input.shortName.trim(),
    logo_url: input.logoUrl?.trim() || null, primary_color: input.primaryColor.toUpperCase(), accent_color: input.accentColor.toUpperCase(),
    agent_label_singular: input.agentLabelSingular.trim(), agent_label_plural: input.agentLabelPlural.trim(),
    business_label_singular: input.businessLabelSingular.trim(), business_label_plural: input.businessLabelPlural.trim(),
    diagnostic_label: input.diagnosticLabel.trim(), finance_label: input.financeLabel.trim(), support_label: input.supportLabel.trim(),
    follow_up_warning_days: input.followUpWarningDays, critical_issue_sla_days: input.criticalIssueSlaDays,
    post_finance_days: input.postFinanceDays, development_return_days: input.developmentReturnDays,
    additional_information_days: input.additionalInformationDays, default_follow_up_days: input.defaultFollowUpDays,
    export_formats: input.exportFormats, updated_by_user_id: userId, updated_at: new Date().toISOString() };
}
