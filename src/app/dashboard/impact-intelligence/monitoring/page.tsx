import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  createFieldVisit,
  listImpactCohortMemberOptions,
  listImpactCohorts,
  listFieldVisits,
  listImpactAssessments,
  listImpactInterventions,
  listImpactProgrammes,
  listUserPickerOptions,
  MONITORING_MANAGE_ROLES,
} from "@/lib/data/impact-intelligence";
import { EmptyState, ImpactPageHeader, QuickLink, SectionCard, StatusBadge, TableShell, tableCellClassName, tableClassName, tableHeadClassName, tableRowClassName } from "../_components";
import { CreateFieldVisitForm } from "./create-field-visit-form";

const DEFAULT_CHECKLIST = [
  "Confirm business location | verification | yes",
  "Capture facility photo placeholder | evidence | yes",
  "Validate intervention usage | monitoring | yes",
  "Record follow-up needs | follow_up | no",
].join("\n");

async function createVisitAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  let visitId: string;
  try {
    visitId = await createFieldVisit(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedCreateVisitError(error)) throw error;
    const params = new URLSearchParams();
    const programmeId = formData.get("programme_id");
    const cohortId = formData.get("cohort_id");
    if (typeof programmeId === "string" && programmeId) params.set("create_programme_id", programmeId);
    if (typeof cohortId === "string" && cohortId) params.set("create_cohort_id", cohortId);
    params.set("error", error instanceof Error ? error.message : "Field visit could not be created.");
    redirect(`/dashboard/impact-intelligence/monitoring?${params.toString()}`);
  }
  redirect(`/dashboard/impact-intelligence/monitoring/${visitId}`);
}

const EXPECTED_CREATE_VISIT_ERRORS = [
  "Field visit title is required.",
  "Select a programme for this field visit.",
  "Select a beneficiary cohort for this field visit.",
  "Select a cohort beneficiary for this field visit.",
  "Selected field visit cohort beneficiary does not exist.",
  "Selected field visit cohort beneficiary does not belong to the selected programme.",
  "Selected field visit cohort beneficiary does not belong to the selected cohort.",
  "Selected field officer does not exist.",
  "Selected assignee must have field_officer role.",
  "Selected field visit intervention does not exist.",
  "Selected field visit intervention does not belong to the selected programme.",
  "Selected field visit intervention does not belong to the selected cohort.",
  "Selected field visit intervention does not belong to the selected cohort beneficiary.",
  "Selected field visit intervention MSME does not match the selected cohort beneficiary.",
  "Selected field visit assessment does not exist.",
  "Selected field visit assessment does not belong to the selected programme.",
  "Selected field visit assessment does not belong to the selected cohort.",
  "Selected field visit assessment does not belong to the selected cohort beneficiary.",
  "Selected field visit assessment MSME does not match the selected cohort beneficiary.",
  "You do not have permission to manage field monitoring.",
];

function isExpectedCreateVisitError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return EXPECTED_CREATE_VISIT_ERRORS.some((message) => error.message.includes(message));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

export default async function MonitoringPage({
  searchParams,
}: {
  searchParams?: Promise<{ create_programme_id?: string; create_cohort_id?: string; error?: string }>;
}) {
  const filters = (await searchParams) ?? {};
  const ctx = await getCurrentUserContext();
  const canManage = MONITORING_MANAGE_ROLES.includes(ctx.role);
  let visits: Awaited<ReturnType<typeof listFieldVisits>> = [];
  let programmes: Awaited<ReturnType<typeof listImpactProgrammes>> = [];
  let createCohorts: Awaited<ReturnType<typeof listImpactCohorts>> = [];
  let cohortMembers: Awaited<ReturnType<typeof listImpactCohortMemberOptions>> = [];
  let interventions: Awaited<ReturnType<typeof listImpactInterventions>> = [];
  let assessments: Awaited<ReturnType<typeof listImpactAssessments>> = [];
  let fieldOfficers: Awaited<ReturnType<typeof listUserPickerOptions>> = [];
  let loadError: string | null = null;

  try {
    visits = await listFieldVisits(ctx, { limit: 100 });
    if (canManage) {
      [programmes, createCohorts, cohortMembers, interventions, assessments, fieldOfficers] = await Promise.all([
        listImpactProgrammes(ctx, { limit: 100 }),
        listImpactCohorts(ctx, { limit: 150, programmeId: filters.create_programme_id }),
        listImpactCohortMemberOptions(ctx, { limit: 150, programmeId: filters.create_programme_id, cohortId: filters.create_cohort_id }),
        listImpactInterventions(ctx, { limit: 150, programmeId: filters.create_programme_id, cohortId: filters.create_cohort_id }),
        listImpactAssessments(ctx, { limit: 150, programmeId: filters.create_programme_id, cohortId: filters.create_cohort_id }),
        listUserPickerOptions("field_officer"),
      ]);
    }
  } catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof Error ? error.message : "Impact Intelligence monitoring records are unavailable.";
    console.warn("[impact-intelligence] monitoring_page_load_failed", {
      role: ctx.role,
      authUserId: ctx.authUserId,
      appUserId: ctx.appUserId,
      error: loadError,
    });
  }
  const createProgrammeId = filters.create_programme_id ?? "";
  const createCohortId = filters.create_cohort_id ?? "";

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="BOI field monitoring"
        title="Monitoring"
        description="Assign field visits, track monitoring lifecycle, capture notes, and connect field evidence to BOI intervention records."
        badge={`${visits.length} visits`}
        actions={[{ href: "/dashboard/impact-intelligence/evidence", label: "Evidence repository", icon: CalendarCheck }]}
      />

      {loadError && (
        <SectionCard title="Monitoring Register Unavailable">
          <EmptyState
            title="Monitoring records could not load"
            description={loadError.includes("permission") ? "Your signed-in role does not currently have monitoring read access. Ask an administrator to verify your assigned role." : "Impact Intelligence monitoring records are temporarily unavailable. Try again after the data source is restored."}
            icon={CalendarCheck}
          />
        </SectionCard>
      )}

      {!loadError && filters.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {filters.error}
        </div>
      )}

      {!loadError && canManage && (
        <SectionCard title="Create cohort-anchored monitoring task">
          <CreateFieldVisitForm
            key={`${createProgrammeId}:${createCohortId}`}
            programmes={programmes}
            cohorts={createCohorts}
            cohortMembers={cohortMembers}
            interventions={interventions}
            assessments={assessments}
            fieldOfficers={fieldOfficers}
            selectedProgrammeId={createProgrammeId}
            selectedCohortId={createCohortId}
            defaultChecklist={DEFAULT_CHECKLIST}
            action={createVisitAction}
          />
        </SectionCard>
      )}

      {!loadError && <SectionCard title="Field Monitoring Queue" action={<QuickLink href="/dashboard/impact-intelligence/evidence">Evidence</QuickLink>}>
        {visits.length === 0 ? (
          <EmptyState
            title="No monitoring visits yet"
            description={canManage ? "Create the first monitoring task and assign it to a field officer so findings and evidence can be linked back to interventions." : "Assigned monitoring tasks will appear here."}
            icon={CalendarCheck}
          />
        ) : (
          <TableShell>
            <table className={tableClassName}>
              <thead className={tableHeadClassName}>
                <tr><th className="px-4 py-3">Visit</th><th className="px-4 py-3">MSME</th><th className="px-4 py-3">Programme</th><th className="px-4 py-3">Scheduled</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr key={visit.id} className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      <Link href={`/dashboard/impact-intelligence/monitoring/${visit.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{visit.title ?? "Field visit"}</Link>
                      <p className="mt-1 text-xs text-slate-500">{visit.location_text ?? "Location pending"}</p>
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>{visit.msmes?.business_name ?? "Unlinked"}</td>
                    <td className={`${tableCellClassName} text-slate-600`}>{visit.impact_programmes?.name ?? "Unassigned"}</td>
                    <td className={`${tableCellClassName} text-slate-600`}>{formatDate(visit.visit_date)}</td>
                    <td className={tableCellClassName}><StatusBadge value={visit.status ?? "pending"} /></td>
                    <td className={tableCellClassName}><QuickLink href={`/dashboard/impact-intelligence/monitoring/${visit.id}`}>Open</QuickLink></td>
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
