import Link from "next/link";
import { Plus } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { ASSESSMENT_MANAGE_ROLES, listAssessmentTemplates } from "@/lib/data/impact-intelligence";

function statusClass(status: string) {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "archived") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

export default async function AssessmentTemplatesPage() {
  const [ctx, templates] = await Promise.all([getCurrentUserContext(), listAssessmentTemplates({ limit: 100 })]);
  const canManage = ASSESSMENT_MANAGE_ROLES.includes(ctx.role);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Assessment template engine</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Templates</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Manage sectioned BOI assessment instruments with weighted questions and versioned definitions.</p>
          </div>
          {canManage && (
            <Link href="/dashboard/impact-intelligence/assessments/templates/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
              <Plus className="h-4 w-4" /> New template
            </Link>
          )}
        </div>
      </header>

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        {templates.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-center">
            <h2 className="font-semibold text-slate-950">No templates yet</h2>
            <p className="mt-2 text-sm text-slate-600">Create the first readiness or monitoring template before assigning assessments to MSMEs.</p>
            {canManage && <Link href="/dashboard/impact-intelligence/assessments/templates/new" className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create template</Link>}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Template</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/impact-intelligence/assessments/templates/${template.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{template.name}</Link>
                      <p className="mt-1 text-xs text-slate-500">{template.description ?? "No description"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{template.assessment_type}</td>
                    <td className="px-4 py-3 text-slate-600">v{template.version}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(template.status)}`}>{template.status}</span></td>
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
