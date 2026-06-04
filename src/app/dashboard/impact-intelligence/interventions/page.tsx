import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  createImpactIntervention,
  getInterventionStage,
  IMPACT_READ_ROLES,
  IMPACT_WRITE_ROLES,
  INTERVENTION_STAGES,
  INTERVENTION_STATUSES,
  listImpactCohortMemberOptions,
  listImpactCohorts,
  listImpactInterventions,
  listImpactProgrammes,
  listUserPickerOptions,
} from "@/lib/data/impact-intelligence";
import { EmptyState, ImpactPageHeader, QuickLink, SectionCard, StatusBadge, TableShell, tableCellClassName, tableClassName, tableHeadClassName, tableRowClassName } from "../_components";

type PageProps = {
  searchParams?: Promise<{
    programme_id?: string;
    cohort_id?: string;
    status?: string;
    stage?: string;
    intervention_type?: string;
    assigned_officer_id?: string;
    create_programme_id?: string;
    create_cohort_id?: string;
    error?: string;
  }>;
};

const EXPECTED_CREATE_INTERVENTION_ERRORS = [
  "Select a programme.",
  "Select a beneficiary cohort.",
  "Select a cohort beneficiary.",
  "Selected cohort beneficiary was not found.",
  "Selected cohort beneficiary does not belong to the selected programme.",
  "Selected cohort beneficiary does not belong to the selected cohort.",
  "An open intervention of this type already exists for this cohort beneficiary.",
  "Record an approved amount before recording disbursement.",
  "Approved amount is required before recording disbursement.",
  "Disbursed amount cannot exceed approved amount.",
  "Move interventions through one lifecycle stage at a time.",
  "Record approval before moving an intervention to disbursement.",
  "Closure reason and closure note are required before closing an intervention.",
  "Completed interventions require closure reason and closure note.",
  "Closure-stage interventions require closure reason and closure note.",
  "You do not have permission to manage impact intelligence records.",
];

function isExpectedCreateInterventionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return EXPECTED_CREATE_INTERVENTION_ERRORS.some((message) => error.message.includes(message));
}

function createInterventionErrorRedirect(formData: FormData, message: string) {
  const params = new URLSearchParams();
  const programmeId = formData.get("programme_id");
  const cohortId = formData.get("cohort_id");

  if (typeof programmeId === "string" && programmeId) params.set("create_programme_id", programmeId);
  if (typeof cohortId === "string" && cohortId) params.set("create_cohort_id", cohortId);
  params.set("error", message);

  return `/dashboard/impact-intelligence/interventions?${params.toString()}`;
}

async function createInterventionAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  let interventionId: string;
  try {
    interventionId = await createImpactIntervention(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedCreateInterventionError(error)) throw error;
    const message = error instanceof Error ? error.message : "Intervention could not be created.";
    redirect(createInterventionErrorRedirect(formData, message));
  }
  redirect(`/dashboard/impact-intelligence/interventions/${interventionId}`);
}

function formatCurrency(value: number | null) {
  if (!value) return "Not set";
  return `NGN ${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function legacyAnchorStatus(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.legacy_cohort_anchor_status;
  return typeof value === "string" ? value : null;
}

export default async function ImpactInterventionsPage({ searchParams }: PageProps) {
  const filters = (await searchParams) ?? {};
  const ctx = await getCurrentUserContext();
  let interventions: Awaited<ReturnType<typeof listImpactInterventions>> = [];
  let programmes: Awaited<ReturnType<typeof listImpactProgrammes>> = [];
  let cohorts: Awaited<ReturnType<typeof listImpactCohorts>> = [];
  let createCohorts: Awaited<ReturnType<typeof listImpactCohorts>> = [];
  let cohortMembers: Awaited<ReturnType<typeof listImpactCohortMemberOptions>> = [];
  let officers: Awaited<ReturnType<typeof listUserPickerOptions>> = [];
  let loadError: string | null = null;

  try {
    [interventions, programmes, cohorts, createCohorts, cohortMembers, officers] = await Promise.all([
      listImpactInterventions(ctx, {
        limit: 100,
        programmeId: filters.programme_id,
        cohortId: filters.cohort_id,
        status: filters.status,
        stage: filters.stage,
        interventionType: filters.intervention_type,
        assignedOfficerId: filters.assigned_officer_id,
      }),
      listImpactProgrammes(ctx, { limit: 100 }),
      listImpactCohorts(ctx, { limit: 150, programmeId: filters.programme_id }),
      listImpactCohorts(ctx, { limit: 150, programmeId: filters.create_programme_id }),
      listImpactCohortMemberOptions(ctx, { limit: 150, programmeId: filters.create_programme_id, cohortId: filters.create_cohort_id }),
      listUserPickerOptions("field_officer"),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Impact Intelligence portfolio records are unavailable.";
    console.warn("[impact-intelligence] interventions_page_load_failed", {
      role: ctx.role,
      authUserId: ctx.authUserId,
      appUserId: ctx.appUserId,
      error: loadError,
    });
  }

  const canWrite = IMPACT_WRITE_ROLES.includes(ctx.role);
  const canRead = IMPACT_READ_ROLES.includes(ctx.role);
  const interventionTypes = Array.from(new Set(interventions.map((item) => item.intervention_type).filter(Boolean))).sort();
  const unanchoredCount = interventions.filter((item) => !item.cohort_id || !item.cohort_member_id).length;
  const createProgrammeId = filters.create_programme_id ?? "";
  const createCohortId = filters.create_cohort_id ?? "";
  const createValidationHint = createProgrammeId && !createCohortId
    ? "Select a beneficiary cohort before creating an intervention."
    : createCohortId && cohortMembers.length === 0
      ? "Select a cohort beneficiary before creating an intervention."
      : null;
  const canShowCreateSubmit = Boolean(createProgrammeId && createCohortId && cohortMembers.length > 0);

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="MSME intervention tracking"
        title="Interventions"
        description="Track MSME-level support, financing, advisory, and monitoring activities against BOI programmes with clear lifecycle status and beneficiary context."
        badge={`${interventions.length} records`}
      />

      {loadError && (
        <SectionCard title="Intervention Portfolio Unavailable">
          <EmptyState
            title="Intervention records could not load"
            description={loadError.includes("permission") ? "Your signed-in role does not currently have portfolio read access. Ask an administrator to verify your assigned role." : "Impact Intelligence intervention records are temporarily unavailable. Try again after the data source is restored."}
            icon={HandCoins}
          />
        </SectionCard>
      )}

      {!loadError && filters.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {filters.error}
        </div>
      )}

      {!loadError && canWrite && (
        <SectionCard title="Create Cohort-Anchored Intervention">
          <form method="get" className="grid gap-4 rounded-lg border bg-slate-50 p-4 lg:grid-cols-3">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Programme
              <select required name="create_programme_id" defaultValue={createProgrammeId} className="w-full rounded-md border px-3 py-2 text-sm font-normal">
                <option value="">Select programme</option>
                {programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Cohort
              <select name="create_cohort_id" defaultValue={createCohortId} className="w-full rounded-md border px-3 py-2 text-sm font-normal">
                <option value="">Select cohort</option>
                {createCohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name} ({cohort.member_count ?? cohort.current_beneficiaries} members)</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="w-full">Load cohort members</Button>
            </div>
          </form>

          {createValidationHint && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {createValidationHint}
            </p>
          )}

          <form action={createInterventionAction} className="mt-4 grid gap-4 lg:grid-cols-3">
          <input type="hidden" name="programme_id" value={createProgrammeId} />
          <input type="hidden" name="cohort_id" value={createCohortId} />
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Title
            <input required name="title" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Working capital support" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Cohort beneficiary
            <select required name="cohort_member_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal" disabled={!createCohortId || cohortMembers.length === 0}>
              <option value="">{createCohortId ? "Select cohort member" : "Load a cohort first"}</option>
              {cohortMembers.map((member) => <option key={member.id} value={member.id}>{member.msmes?.business_name ?? "Unknown MSME"} ({member.msmes?.msme_id ?? member.member_status})</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Type
            <input name="intervention_type" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="finance, advisory, equipment" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Status
            <select name="status" defaultValue="planned" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              {INTERVENTION_STATUSES.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Stage
            <select name="stage" defaultValue="intake" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              {INTERVENTION_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Approved amount
            <input name="approved_amount" type="number" min="0" step="1000" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Disbursed amount
            <input name="disbursed_amount" type="number" min="0" step="1000" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Start date
            <input name="start_date" type="date" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Assigned officer
            <select name="assigned_officer_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Unassigned</option>
              {officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name ?? officer.email ?? officer.id}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-3">
            Description
            <textarea name="description" rows={3} className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <div className="flex justify-end lg:col-span-3">
            {canShowCreateSubmit && <Button type="submit">Create intervention</Button>}
          </div>
        </form>
        </SectionCard>
      )}

      {!loadError && canRead && (
        <SectionCard title="Filters">
          <form method="get" className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
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
              Status
              <select name="status" defaultValue={filters.status ?? ""} className="w-full rounded-md border px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700">
                <option value="">All statuses</option>
                {INTERVENTION_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Stage
              <select name="stage" defaultValue={filters.stage ?? ""} className="w-full rounded-md border px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700">
                <option value="">All stages</option>
                {INTERVENTION_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Type
              <select name="intervention_type" defaultValue={filters.intervention_type ?? ""} className="w-full rounded-md border px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700">
                <option value="">All types</option>
                {interventionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Officer
              <select name="assigned_officer_id" defaultValue={filters.assigned_officer_id ?? ""} className="w-full rounded-md border px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700">
                <option value="">All officers</option>
                {officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name ?? officer.email ?? officer.id}</option>)}
              </select>
            </label>
            <div className="flex items-end gap-2 lg:col-span-6">
              <Button type="submit" variant="secondary">Apply filters</Button>
              <Link href="/dashboard/impact-intelligence/interventions" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Clear</Link>
            </div>
          </form>
        </SectionCard>
      )}

      {!loadError && unanchoredCount > 0 && (
        <SectionCard title="Legacy Anchor Warning">
          <p className="text-sm leading-6 text-amber-700">{unanchoredCount} intervention record(s) are not linked to a beneficiary cohort/member. They remain visible for continuity, but new interventions must be cohort anchored.</p>
        </SectionCard>
      )}

      {!loadError && <SectionCard title="Intervention Portfolio" action={<QuickLink href="/dashboard/impact-intelligence/analytics">Analytics</QuickLink>}>
        {interventions.length === 0 ? (
          <EmptyState
            title="No interventions yet"
            description="Programme officers can create the first MSME intervention once a beneficiary is available, then connect assessments, monitoring, and evidence."
            icon={HandCoins}
          />
        ) : (
          <TableShell>
            <table className={tableClassName}>
              <thead className={tableHeadClassName}><tr><th className="px-4 py-3">Intervention</th><th className="px-4 py-3">Programme / cohort</th><th className="px-4 py-3">Beneficiary</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Officer</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Action</th></tr></thead>
              <tbody>
                {interventions.map((item) => {
                  const anchorStatus = legacyAnchorStatus(item.metadata);
                  return (
                    <tr key={item.id} className={tableRowClassName}>
                      <td className={tableCellClassName}>
                        <Link href={`/dashboard/impact-intelligence/interventions/${item.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{item.title}</Link>
                        <p className="mt-1 text-xs text-slate-500">{item.intervention_type} • {getInterventionStage(item)}</p>
                        {(!item.cohort_id || !item.cohort_member_id) && <p className="mt-2 text-xs font-medium text-amber-700">Legacy/unanchored{anchorStatus ? `: ${anchorStatus.replaceAll("_", " ")}` : ""}</p>}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        <span className="font-medium text-slate-700">{item.impact_programmes?.name ?? "Unassigned programme"}</span>
                        <p className="mt-1 text-xs text-slate-500">{item.impact_beneficiary_cohorts?.name ?? "No cohort anchor"}</p>
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}><span className="font-medium text-slate-700">{item.msmes?.business_name ?? "Unlinked"}</span><p className="mt-1 text-xs text-slate-500">{item.impact_cohort_members?.member_status ?? item.msmes?.state ?? "Beneficiary metadata pending"}</p></td>
                      <td className={tableCellClassName}><StatusBadge value={item.status ?? "planned"} /></td>
                      <td className={`${tableCellClassName} text-slate-600`}>{item.assigned_officers?.full_name ?? item.assigned_officers?.email ?? "Unassigned"}</td>
                      <td className={`${tableCellClassName} text-slate-600`}>{formatCurrency(item.approved_amount)}</td>
                      <td className={tableCellClassName}><QuickLink href={`/dashboard/impact-intelligence/interventions/${item.id}`}>Open</QuickLink></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        )}
      </SectionCard>}
    </section>
  );
}
