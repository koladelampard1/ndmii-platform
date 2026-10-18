import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { diagnosticEngagement, requireDiagnosticAgent } from "@/lib/institutional/diagnostics-server";
import { isFinanceOfficer } from "@/lib/institutional/finance-readiness-server";
import { isUuid } from "@/lib/institutional/administration-policy";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ institutionId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId); const officer = isFinanceOfficer(actor);
    if (!officer && actor.membership?.role !== "institution_agent") throw new AdministrationError(403, "Finance readiness access denied.");
    let query = actor.db.from("institution_finance_cases").select("*").eq("institution_id", actor.institution.id)
      .order("updated_at", { ascending: false }).limit(200);
    if (!officer) query = query.eq("agent_member_id", actor.membership!.id);
    const { data, error } = await query; if (error) throw error;
    const cases = [] as typeof data; const businesses: { engagementId: string; businessName: string }[] = [];
    for (const record of data ?? []) {
      try {
        const engagement = officer ? await diagnosticEngagement(actor, record.engagement_id) :
          await diagnosticEngagement(actor, record.engagement_id).then(async value => { await requireDiagnosticAgent(actor, record.engagement_id); return value; });
        const { data: business } = await actor.db.from("msmes").select("business_name,msme_id").eq("id", engagement.msme_id).maybeSingle();
        cases.push(record); if (business) businesses.push({ engagementId: record.engagement_id, businessName: business.business_name });
      } catch (error) { if (!(error instanceof AdministrationError && [403,404].includes(error.status))) throw error; }
    }
    const eligible: { diagnosticCaseId: string; engagementId: string; businessName: string }[] = [];
    if (!officer) {
      const { data: diagnostics, error: diagnosticError } = await actor.db.from("institution_diagnostic_cases")
        .select("id,engagement_id,status").eq("institution_id", actor.institution.id).eq("agent_member_id", actor.membership!.id).eq("status", "approved");
      if (diagnosticError) throw diagnosticError;
      for (const diagnostic of diagnostics ?? []) {
        if ((data ?? []).some(row => row.engagement_id === diagnostic.engagement_id)) continue;
        try {
          const engagement = await diagnosticEngagement(actor, diagnostic.engagement_id); await requireDiagnosticAgent(actor, diagnostic.engagement_id);
          const { data: business } = await actor.db.from("msmes").select("business_name").eq("id", engagement.msme_id).maybeSingle();
          if (business) eligible.push({ diagnosticCaseId: diagnostic.id, engagementId: diagnostic.engagement_id, businessName: business.business_name });
        } catch (error) { if (!(error instanceof AdministrationError && [403,404].includes(error.status))) throw error; }
      }
    }
    return NextResponse.json({ cases, businesses, eligible, officer }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId); const body = await request.json().catch(() => null);
    if (!isUuid(body?.diagnosticCaseId) || !isUuid(body?.templateId)) throw new AdministrationError(400, "Choose an approved diagnostic and checklist.");
    const { data: diagnostic, error: diagnosticError } = await actor.db.from("institution_diagnostic_cases").select("id,engagement_id,status")
      .eq("institution_id", actor.institution.id).eq("id", body.diagnosticCaseId).maybeSingle();
    if (diagnosticError) throw diagnosticError;
    if (!diagnostic || diagnostic.status !== "approved") throw new AdministrationError(409, "An approved diagnostic is required.");
    const agentId = await requireDiagnosticAgent(actor, diagnostic.engagement_id);
    const { data: template, error: templateError } = await actor.db.from("institution_finance_templates").select("id,requirements")
      .eq("institution_id", actor.institution.id).eq("id", body.templateId).eq("active", true)
      .eq("configuration_status", "institution_confirmed").maybeSingle();
    if (templateError) throw templateError; if (!template) throw new AdministrationError(404, "Checklist unavailable.");
    const { data: record, error } = await actor.db.from("institution_finance_cases").insert({ institution_id: actor.institution.id,
      engagement_id: diagnostic.engagement_id, diagnostic_case_id: diagnostic.id, template_id: template.id,
      agent_member_id: agentId, requirements: template.requirements }).select("*").single();
    if (error?.code === "23505") throw new AdministrationError(409, "Finance readiness already exists for this business.");
    if (error) throw error;
    const items = (template.requirements as {key:string;label:string;description:string;required:boolean}[]).map(item => ({ institution_id: actor.institution.id,
      case_id: record.id, requirement_key: item.key, label: item.label, description: item.description, required: item.required }));
    const { error: itemError } = await actor.db.from("institution_finance_requirement_items").insert(items);
    if (itemError) { await actor.db.from("institution_finance_cases").delete().eq("id", record.id); throw itemError; }
    return NextResponse.json({ case: record }, { status: 201 });
  } catch (error) { return administrationErrorResponse(error); }
}
