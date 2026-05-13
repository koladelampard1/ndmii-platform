import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  ASSESSMENT_MANAGE_ROLES,
  ASSESSMENT_QUESTION_TYPES,
  ASSESSMENT_TEMPLATE_STATUSES,
  ASSESSMENT_TYPES,
  createAssessmentTemplate,
} from "@/lib/data/impact-intelligence";

const DEFAULT_BLUEPRINT = [
  "Business profile | Is the business registration information current? | boolean | compliance | 10 | yes | |",
  "Business profile | Primary operating challenge | textarea | operations | 5 | no | |",
  "Finance readiness | Monthly revenue band | select | finance | 15 | yes | Below NGN 500k, NGN 500k-2m, Above NGN 2m |",
  "Finance readiness | Does the MSME keep sales records? | boolean | finance | 15 | yes | |",
  "Monitoring | Evidence file reference | file_upload | evidence | 5 | no | | Placeholder for future upload integration",
].join("\n");

async function createTemplateAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  const templateId = await createAssessmentTemplate(ctx, formData);
  redirect(`/dashboard/impact-intelligence/assessments/templates/${templateId}`);
}

export default async function NewAssessmentTemplatePage() {
  const ctx = await getCurrentUserContext();
  if (!ASSESSMENT_MANAGE_ROLES.includes(ctx.role)) redirect("/access-denied");

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Template setup</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Create Assessment Template</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Define the sections, question order, question types, required flags, and weights used for BOI MSME assessments.</p>
      </header>

      <form action={createTemplateAction} className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm lg:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Template name
          <input required name="name" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="BOI MSME Readiness Assessment" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Assessment type
          <select name="assessment_type" defaultValue="credit_readiness" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
            {ASSESSMENT_TYPES.map((assessmentType) => (
              <option key={assessmentType} value={assessmentType}>{assessmentType}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Version
          <input required name="version" type="number" min="1" defaultValue="1" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Status
          <select name="status" defaultValue="draft" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
            {ASSESSMENT_TEMPLATE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
          Description
          <textarea name="description" rows={3} className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Purpose, target MSME segment, and usage notes." />
        </label>
        <label className="space-y-2 text-sm font-medium text-slate-700 lg:col-span-2">
          Question blueprint
          <textarea required name="question_blueprint" rows={10} defaultValue={DEFAULT_BLUEPRINT} className="w-full rounded-md border px-3 py-2 font-mono text-xs font-normal leading-5" />
          <span className="block text-xs font-normal leading-5 text-slate-500">
            One question per line: Section | Question | Type | Category | Weight | Required yes/no | Options comma list | Help text. Supported types: {ASSESSMENT_QUESTION_TYPES.join(", ")}.
          </span>
        </label>
        <div className="flex justify-end lg:col-span-2">
          <Button type="submit">Create template</Button>
        </div>
      </form>
    </section>
  );
}
