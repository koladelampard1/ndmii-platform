import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { diagnosticEngagement, requireDiagnosticAgent } from "@/lib/institutional/diagnostics-server";
import { isUuid } from "@/lib/institutional/administration-policy";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ institutionId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    const manager = actor.platformAdmin || actor.membership?.role === "institution_admin";
    if (!manager && actor.membership?.role !== "institution_agent") throw new AdministrationError(403, "Agent access required.");
    let query = actor.db.from("institution_diagnostic_cases").select("*").eq("institution_id", actor.institution.id)
      .order("updated_at", { ascending: false }).limit(200);
    if (!manager) query = query.eq("agent_member_id", actor.membership!.id);
    const { data, error } = await query;
    if (error) throw error;
    const cases = [];
    const available: { engagementId: string; businessName: string }[] = [];
    for (const record of data ?? []) {
      try {
        if (manager) await diagnosticEngagement(actor, record.engagement_id);
        else await requireDiagnosticAgent(actor, record.engagement_id);
        cases.push(record);
      } catch (err) { if (!(err instanceof AdministrationError && [403,404].includes(err.status))) throw err; }
    }
    const { data: assigned, error: assignmentError } = manager ? { data: [], error: null } :
      await actor.db.from("institution_business_assignments").select("engagement_id")
        .eq("institution_id", actor.institution.id).eq("agent_member_id", actor.membership!.id).eq("status", "active");
    if (assignmentError) throw assignmentError;
    const ids = manager ? cases.map(record => record.engagement_id) : (assigned ?? []).map(row => row.engagement_id);
    for (const engagementId of [...new Set(ids)]) {
      try {
        const engagement = manager ? await diagnosticEngagement(actor, engagementId) :
          await diagnosticEngagement(actor, engagementId).then(async value => { await requireDiagnosticAgent(actor, engagementId); return value; });
        const { data: business, error: businessError } = await actor.db.from("msmes").select("business_name")
          .eq("id", engagement.msme_id).maybeSingle();
        if (businessError) throw businessError;
        if (business) available.push({ engagementId, businessName: business.business_name });
      } catch (err) { if (!(err instanceof AdministrationError && [403,404].includes(err.status))) throw err; }
    }
    return NextResponse.json({ cases, available }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    const body = await request.json().catch(() => null);
    if (!isUuid(body?.engagementId) || !isUuid(body?.templateId)) throw new AdministrationError(400, "Select an engagement and template.");
    const agentId = await requireDiagnosticAgent(actor, body.engagementId);
    const { data: template, error: templateError } = await actor.db.from("institution_diagnostic_templates")
      .select("id,questions").eq("institution_id", actor.institution.id).eq("id", body.templateId).eq("active", true).maybeSingle();
    if (templateError) throw templateError;
    if (!template) throw new AdministrationError(404, "Template unavailable.");
    const { data, error } = await actor.db.from("institution_diagnostic_cases").insert({
      institution_id: actor.institution.id, engagement_id: body.engagementId,
      template_id: template.id, questions: template.questions, agent_member_id: agentId,
    }).select("*").single();
    if (error?.code === "23505") throw new AdministrationError(409, "A diagnostic already exists for this engagement.");
    if (error) throw error;
    return NextResponse.json({ case: data }, { status: 201 });
  } catch (error) { return administrationErrorResponse(error); }
}
