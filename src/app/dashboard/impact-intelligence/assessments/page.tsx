import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_MANAGE_ROLES,
  ASSESSMENT_TYPES,
  createAssessment,
  listImpactCohortMemberOptions,
  listImpactCohorts,
  listAssessmentTemplates,
  listImpactAssessments,
  listImpactInterventions,
  listImpactProgrammes,
} from "@/lib/data/impact-intelligence";
import { EmptyState, ImpactPageHeader, QuickLink, SectionCard, StatusBadge, TableShell, tableCellClassName, tableClassName, tableHeadClassName, tableRowClassName } from "../_components";
import { CreateAssessmentForm } from "./create-assessment-form";

type PageProps = {
  searchParams?: Promise<{
    programme_id?: string;
    cohort_id?: string;
    assessment_type?: string;
    status?: string;
    intervention_id?: string;
    create_programme_id?: string;
    create_cohort_id?: string;
    error?: string;
  }>;
};

const EXPECTED_ASSESSMENT_CREATE_ERRORS = [
  "Select an assessment template.",
  "Select a programme.",
  "Select a beneficiary cohort.",
  "Select a cohort beneficiary.",
  "Selected cohort beneficiary was not found.",
  "Selected cohort beneficiary does not belong to the selected programme.",
  "Selected cohort beneficiary does not belong to the selected cohort.",
  "Selected intervention was not found.",
  "Selected intervention does not belong to the selected programme.",
  "Selected intervention does not belong to the selected cohort.",
  "Selected intervention does not belong to the selected cohort beneficiary.",
  "Selected intervention MSME does not match the selected cohort beneficiary.",
  "You do not have permission to manage impact assessments.",
];

function isExpectedCreateError(error: unknown) {
  return error instanceof Error && EXPECTED_ASSESSMENT_CREATE_ERRORS.some((message) => error.message.includes(message));
}

async function createAssessmentAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  let assessmentId: string;
  try {
    assessmentId = await createAssessment(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedCreateError(error)) throw error;
    const params = new URLSearchParams();
    const programmeId = formData.get("programme_id");
    const cohortId = formData.get("cohort_id");
    if (typeof programmeId === "string" && programmeId) params.set("create_programme_id", programmeId);
    if (typeof cohortId === "string" && cohortId) params.set("create_cohort_id", cohortId);
    params.set("error", error instanceof Error ? error.message : "Assessment could not be created.");
    redirect(`/dashboard/impact-intelligence/assessments?${params.toString()}`);
  }
  redirect(`/dashboard/impact-intelligence/assessments/${assessmentId}`);
}

function legacyAnchorStatus(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.legacy_cohort_anchor_status;
  return typeof value === "string" ? value : null;
}

export default async function ImpactAssessmentsPage({ searchParams }: PageProps) {
  const filters = (await searchParams) ?? {};
  const ctx = await getCurrentUserContext();
  const createProgrammeId = filters.create_programme_id ?? "";
  const createCohortId = filters.create_cohort_id ?? "";
  let assessments: Awaited<ReturnType<typeof listImpactAssessments>> = [];
  let templates: Awaited<ReturnType<typeof listAssessmentTemplates>> = [];
  let programmes: Awaited<ReturnType<typeof listImpactProgrammes>> = [];
  let cohorts: Awaited<ReturnType<typeof listImpactCohorts>> = [];
  let createCohorts: Awaited<ReturnType<typeof listImpactCohorts>> = [];
  let cohortMembers: Awaited<ReturnType<typeof listImpactCohortMemberOptions>> = [];
  let interventions: Awaited<ReturnType<typeof listImpactInterventions>> = [];
  let loadError: string | null = null;

  try {
    [assessments, templates, programmes, cohorts, createCohorts, cohortMembers, interventions] = await Promise.all([
      listImpactAssessments(ctx, {
        limit: 100,
        programmeId: filters.programme_id,
        cohortId: filters.cohort_id,
        assessmentType: filters.assessment_type,
        status: filters.status,
        interventionId: filters.intervention_id,
      }),
      listAssessmentTemplates(ctx, { limit: 100 }),
      listImpactProgrammes(ctx, { limit: 100 }),
      listImpactCohorts(ctx, { limit: 150, programmeId: filters.programme_id }),
      listImpactCohorts(ctx, { limit: 150, programmeId: createProgrammeId }),
      listImpactCohortMemberOptions(ctx, { limit: 150, programmeId: createProgrammeId, cohortId: createCohortId }),
      listImpactInterventions(ctx, { limit: 150, programmeId: createProgrammeId, cohortId: createCohortId }),
    ]);
  } catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof Error ? error.message : "Impact Intelligence assessment records are unavailable.";
    console.warn("[impact-intelligence] assessments_page_load_failed", {
      role: ctx.role,
      authUserId: ctx.authUserId,
      appUserId: ctx.appUserId,
      error: loadError,
    });
  }

  const canManage = ASSESSMENT_MANAGE_ROLES.includes(ctx.role);
  const createInterventions = interventions.filter((intervention) => !intervention.cohort_member_id || cohortMembers.some((member) => member.id === intervention.cohort_member_id));

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="DBIN assessment engine"
        title="Assessments"
        description="Create BOI MSME readiness, monitoring, compliance, and impact assessments from structured templates that feed intelligence and reporting."
        badge={`${assessments.length} records`}
        actions={[{ href: "/dashboard/impact-intelligence/assessments/templates", label: "Templates", icon: ClipboardCheck }]}
      />

      {loadError && (
        <SectionCard title="Assessment Register Unavailable">
          <EmptyState
            title="Assessment records could not load"
            description={loadError.includes("permission") ? "Your signed-in role does not currently have assessment or cohort read access. Ask an administrator to verify your assigned role." : "Impact Intelligence assessment records are temporarily unavailable. Try again after the data source is restored."}
            icon={ClipboardCheck}
          />
        </SectionCard>
      )}

      {!loadError && filters.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {filters.error}
        </div>
      )}

      {!loadError && canManage && (
        <SectionCard title="Create Cohort-Anchored Assessment">
          <CreateAssessmentForm
            key={`${createProgrammeId}:${createCohortId}`}
            programmes={programmes}
            cohorts={createCohorts}
            cohortMembers={cohortMembers}
            interventions={createInterventions}
            templates={templates}
            selectedProgrammeId={createProgrammeId}
            selectedCohortId={createCohortId}
            action={createAssessmentAction}
          />
        </SectionCard>
      )}

      {!loadError && <SectionCard title="Filters">
        <form method="get" className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Programme
            <select name="programme_id" defaultValue={filters.programme_id ?? ""} className="w-full rounded-md border px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700">
              <option value="">All programmes</option>
              {programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Cohort
            <select name="cohort_id" defaultValue={filters.cohort_id ?? ""} className="w-full rounded-md border px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700">
              <option value="">All cohorts</option>
              {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Type
            <select name="assessment_type" defaultValue={filters.assessment_type ?? ""} className="w-full rounded-md border px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700">
              <option value="">All types</option>
              {ASSESSMENT_TYPES.map((assessmentType) => <option key={assessmentType} value={assessmentType}>{assessmentType.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Status
            <select name="status" defaultValue={filters.status ?? ""} className="w-full rounded-md border px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700">
              <option value="">All statuses</option>
              {ASSESSMENT_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="secondary">Apply</Button>
            <Link href="/dashboard/impact-intelligence/assessments" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Clear</Link>
          </div>
        </form>
      </SectionCard>}

      {!loadError && <SectionCard title="Assessment Register" action={<QuickLink href="/dashboard/impact-intelligence/analytics">Readiness analytics</QuickLink>}>
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
                <tr><th className="px-4 py-3">Assessment</th><th className="px-4 py-3">Beneficiary</th><th className="px-4 py-3">Programme / cohort</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody>
                {assessments.map((assessment) => (
                  <tr key={assessment.id} className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      <Link href={`/dashboard/impact-intelligence/assessments/${assessment.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{assessment.title ?? assessment.impact_assessment_templates?.name ?? "Assessment"}</Link>
                      <p className="mt-1 text-xs text-slate-500">{assessment.assessment_type ?? "baseline"} • template v{assessment.template_version ?? assessment.impact_assessment_templates?.version ?? 1}</p>
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>{assessment.msmes?.business_name ?? "Unlinked"}</td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      <p>{assessment.impact_programmes?.name ?? "Unassigned"}</p>
                      <p className="mt-1 text-xs text-slate-500">{assessment.impact_beneficiary_cohorts?.name ?? "Legacy/unanchored"}{!assessment.cohort_id && legacyAnchorStatus(assessment.metadata) ? ` • ${legacyAnchorStatus(assessment.metadata)?.replaceAll("_", " ")}` : ""}</p>
                    </td>
                    <td className={tableCellClassName}><StatusBadge value={assessment.status ?? "draft"} /></td>
                    <td className={`${tableCellClassName} text-slate-600`}>{typeof assessment.score === "number" ? `${assessment.score.toFixed(1)}%` : "Pending"}</td>
                    <td className={tableCellClassName}><QuickLink href={`/dashboard/impact-intelligence/assessments/${assessment.id}`}>Open</QuickLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </SectionCard>}
    </section>
  );
}
