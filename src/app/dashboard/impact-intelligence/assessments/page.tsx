import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  ASSESSMENT_MANAGE_ROLES,
  createAssessment,
  listAssessmentTemplates,
  listImpactAssessments,
  listImpactInterventions,
  listImpactProgrammes,
  listMsmePickerOptions,
} from "@/lib/data/impact-intelligence";
import { EmptyState, ImpactPageHeader, QuickLink, SectionCard, StatusBadge, TableShell, tableCellClassName, tableClassName, tableHeadClassName, tableRowClassName } from "../_components";

async function createAssessmentAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  const assessmentId = await createAssessment(ctx, formData);
  redirect(`/dashboard/impact-intelligence/assessments/${assessmentId}`);
}

export default async function ImpactAssessmentsPage() {
  const ctx = await getCurrentUserContext();
  const [assessments, templates, programmes, interventions, msmes] = await Promise.all([
    listImpactAssessments(ctx, { limit: 100 }),
    listAssessmentTemplates(ctx, { limit: 100 }),
    listImpactProgrammes(ctx, { limit: 100 }),
    listImpactInterventions(ctx, { limit: 100 }),
    listMsmePickerOptions({ limit: 150 }),
  ]);
  const canManage = ASSESSMENT_MANAGE_ROLES.includes(ctx.role);

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="DBIN assessment engine"
        title="Assessments"
        description="Create BOI MSME readiness, monitoring, compliance, and impact assessments from structured templates that feed intelligence and reporting."
        badge={`${assessments.length} records`}
        actions={[{ href: "/dashboard/impact-intelligence/assessments/templates", label: "Templates", icon: ClipboardCheck }]}
      />

      {canManage && (
        <form action={createAssessmentAction} className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm lg:grid-cols-3">
          <h2 className="font-semibold text-slate-950 lg:col-span-3">Create assessment</h2>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Template
            <select required name="template_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Select template</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name} v{template.version}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            MSME
            <select required name="msme_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Select MSME</option>
              {msmes.map((msme) => <option key={msme.id} value={msme.id}>{msme.business_name} ({msme.msme_id ?? msme.state ?? "DBIN"})</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Title
            <input name="title" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Q2 readiness assessment" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Programme
            <select name="programme_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Unassigned</option>
              {programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Intervention
            <select name="intervention_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Unassigned</option>
              {interventions.map((intervention) => <option key={intervention.id} value={intervention.id}>{intervention.title}</option>)}
            </select>
          </label>
          <div className="flex items-end justify-end lg:col-span-1">
            <Button type="submit" className="w-full gap-2"><Plus className="h-4 w-4" /> Create assessment</Button>
          </div>
        </form>
      )}

      <SectionCard title="Assessment Register" action={<QuickLink href="/dashboard/impact-intelligence/analytics">Readiness analytics</QuickLink>}>
        {assessments.length === 0 ? (
          <EmptyState
            title="No assessments yet"
            description="Create a template first, then assign assessments to MSMEs, programmes, and interventions so readiness and risk intelligence has structured input."
            actionHref={canManage ? "/dashboard/impact-intelligence/assessments/templates/new" : undefined}
            actionLabel={canManage ? "Create template" : undefined}
            icon={ClipboardCheck}
          />
        ) : (
          <TableShell>
            <table className={tableClassName}>
              <thead className={tableHeadClassName}>
                <tr><th className="px-4 py-3">Assessment</th><th className="px-4 py-3">MSME</th><th className="px-4 py-3">Programme</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody>
                {assessments.map((assessment) => (
                  <tr key={assessment.id} className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      <Link href={`/dashboard/impact-intelligence/assessments/${assessment.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{assessment.title ?? assessment.impact_assessment_templates?.name ?? "Assessment"}</Link>
                      <p className="mt-1 text-xs text-slate-500">{assessment.assessment_type ?? "baseline"} • template v{assessment.template_version ?? assessment.impact_assessment_templates?.version ?? 1}</p>
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>{assessment.msmes?.business_name ?? "Unlinked"}</td>
                    <td className={`${tableCellClassName} text-slate-600`}>{assessment.impact_programmes?.name ?? "Unassigned"}</td>
                    <td className={tableCellClassName}><StatusBadge value={assessment.status ?? "draft"} /></td>
                    <td className={`${tableCellClassName} text-slate-600`}>{typeof assessment.score === "number" ? `${assessment.score.toFixed(1)}%` : "Pending"}</td>
                    <td className={tableCellClassName}><QuickLink href={`/dashboard/impact-intelligence/assessments/${assessment.id}`}>Open</QuickLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </SectionCard>
    </section>
  );
}
