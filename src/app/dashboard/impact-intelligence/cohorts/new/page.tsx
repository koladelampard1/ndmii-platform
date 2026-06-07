import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import { COHORT_MANAGE_ROLES, COHORT_STATUSES, createImpactCohort, listImpactProgrammes } from "@/lib/data/impact-intelligence";
import { EmptyState, ImpactPageHeader, SectionCard } from "../../_components";
import { logImpactRouteDiagnostic } from "../../_diagnostics";

const EXPECTED_COHORT_ERRORS = ["required", "valid", "programme", "cohort", "permission", "already exists"];

async function createCohortAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  let cohortId: string;
  try {
    cohortId = await createImpactCohort(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/cohorts/new", operation: "cohort_create_failed", error });
    if (!(error instanceof Error) || !EXPECTED_COHORT_ERRORS.some((message) => error.message.toLowerCase().includes(message))) throw error;
    redirect(`/dashboard/impact-intelligence/cohorts/new?error=${encodeURIComponent(error.message)}`);
  }
  redirect(`/dashboard/impact-intelligence/cohorts/${cohortId}`);
}

export default async function NewImpactCohortPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const query = (await searchParams) ?? {};
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let programmes: Awaited<ReturnType<typeof listImpactProgrammes>> = [];
  let loadError: string | null = null;
  try {
    ctx = await getCurrentUserContext();
    if (!COHORT_MANAGE_ROLES.includes(ctx.role)) redirect("/access-denied");
    programmes = await listImpactProgrammes(ctx, { limit: 100 });
  } catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof Error ? error.message : "Cohort creation is temporarily unavailable.";
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/cohorts/new", operation: "cohort_create_page_load_failed", error });
  }

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Create beneficiary cohort"
        title="New Cohort"
        description="Register a cohort under a programme before enrolling MSMEs for interventions, assessments, monitoring, and evidence collection."
        badge="Phase 2"
      />

      <SectionCard title="Cohort Details">
        {loadError ? (
          <EmptyState title="Cohort creation could not load" description="Programme options or the current session are temporarily unavailable. No cohort data has been changed." icon={UsersRound} />
        ) : (
        <>
        {query.error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{query.error}</div>}
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
        </>
        )}
      </SectionCard>
    </section>
  );
}
