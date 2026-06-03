import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import { COHORT_MANAGE_ROLES, COHORT_STATUSES, createImpactCohort, listImpactProgrammes } from "@/lib/data/impact-intelligence";
import { ImpactPageHeader, SectionCard } from "../../_components";

async function createCohortAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  const cohortId = await createImpactCohort(ctx, formData);
  redirect(`/dashboard/impact-intelligence/cohorts/${cohortId}`);
}

export default async function NewImpactCohortPage() {
  const ctx = await getCurrentUserContext();
  if (!COHORT_MANAGE_ROLES.includes(ctx.role)) redirect("/access-denied");
  const programmes = await listImpactProgrammes(ctx, { limit: 100 });

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Create beneficiary cohort"
        title="New Cohort"
        description="Register a cohort under a programme before enrolling MSMEs for interventions, assessments, monitoring, and evidence collection."
        badge="Phase 2"
      />

      <SectionCard title="Cohort Details">
        <form action={createCohortAction} className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
            Name
            <input required name="name" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Lagos Fashion Cluster 2026" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Programme
            <select required name="programme_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Select programme</option>
              {programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            State
            <input name="state" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Lagos" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            LGA
            <input name="lga" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Surulere" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Sector
            <input name="sector" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Fashion and textiles" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Target beneficiaries
            <input name="target_beneficiaries" type="number" min="0" step="1" defaultValue="0" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Status
            <select name="status" defaultValue="draft" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              {COHORT_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Start date
            <input name="start_date" type="date" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            End date
            <input name="end_date" type="date" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-3">
            Description
            <textarea name="description" rows={4} className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Eligibility, recruitment source, delivery model, and any operational notes." />
          </label>
          <div className="flex flex-wrap justify-end gap-2 lg:col-span-3">
            <Link href="/dashboard/impact-intelligence/cohorts" className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link>
            <Button type="submit">Create cohort</Button>
          </div>
        </form>
      </SectionCard>
    </section>
  );
}
