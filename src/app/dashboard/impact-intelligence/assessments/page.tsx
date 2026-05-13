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

async function createAssessmentAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  const assessmentId = await createAssessment(ctx, formData);
  redirect(`/dashboard/impact-intelligence/assessments/${assessmentId}`);
}

function statusClass(status: string | null) {
  if (status === "reviewed" || status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "completed") return "bg-blue-100 text-blue-700";
  if (status === "in_progress" || status === "submitted") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
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
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">DBIN assessment engine</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Assessments</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Create BOI MSME readiness, monitoring, and impact assessments from structured templates.</p>
          </div>
          <Link href="/dashboard/impact-intelligence/assessments/templates" className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <ClipboardCheck className="h-4 w-4" /> Templates
          </Link>
        </div>
      </header>

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

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        {assessments.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-center">
            <h2 className="font-semibold text-slate-950">No assessments yet</h2>
            <p className="mt-2 text-sm text-slate-600">Create a template first, then assign assessments to MSMEs, programmes, and interventions.</p>
            {canManage && <Link href="/dashboard/impact-intelligence/assessments/templates/new" className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create template</Link>}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Assessment</th><th className="px-4 py-3">MSME</th><th className="px-4 py-3">Programme</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score</th></tr>
              </thead>
              <tbody className="divide-y">
                {assessments.map((assessment) => (
                  <tr key={assessment.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/impact-intelligence/assessments/${assessment.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{assessment.title ?? assessment.impact_assessment_templates?.name ?? "Assessment"}</Link>
                      <p className="mt-1 text-xs text-slate-500">{assessment.assessment_type ?? "baseline"} • template v{assessment.template_version ?? assessment.impact_assessment_templates?.version ?? 1}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{assessment.msmes?.business_name ?? "Unlinked"}</td>
                    <td className="px-4 py-3 text-slate-600">{assessment.impact_programmes?.name ?? "Unassigned"}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(assessment.status)}`}>{assessment.status ?? "draft"}</span></td>
                    <td className="px-4 py-3 text-slate-600">{typeof assessment.score === "number" ? `${assessment.score.toFixed(1)}%` : "Pending"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
