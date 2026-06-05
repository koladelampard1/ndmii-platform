"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImpactAssessment, ImpactBeneficiaryCohort, ImpactCohortMember, ImpactIntervention, ImpactProgramme, UserPickerOption } from "@/lib/data/impact-intelligence";
import { FIELD_VISIT_STATUSES } from "@/lib/data/impact-intelligence";

type CreateFieldVisitFormProps = {
  programmes: ImpactProgramme[];
  cohorts: ImpactBeneficiaryCohort[];
  cohortMembers: ImpactCohortMember[];
  interventions: ImpactIntervention[];
  assessments: ImpactAssessment[];
  fieldOfficers: UserPickerOption[];
  selectedProgrammeId: string;
  selectedCohortId: string;
  defaultChecklist: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function CreateFieldVisitForm({
  programmes,
  cohorts,
  cohortMembers,
  interventions,
  assessments,
  fieldOfficers,
  selectedProgrammeId,
  selectedCohortId,
  defaultChecklist,
  action,
}: CreateFieldVisitFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [programmeId, setProgrammeId] = useState(selectedProgrammeId);
  const [cohortId, setCohortId] = useState(selectedCohortId);
  const [cohortMemberId, setCohortMemberId] = useState("");
  const [interventionId, setInterventionId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");

  function replaceCreateSelection(nextProgrammeId: string, nextCohortId: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextProgrammeId) params.set("create_programme_id", nextProgrammeId);
    else params.delete("create_programme_id");

    if (nextCohortId) params.set("create_cohort_id", nextCohortId);
    else params.delete("create_cohort_id");

    params.delete("error");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function handleProgrammeChange(nextProgrammeId: string) {
    setProgrammeId(nextProgrammeId);
    setCohortId("");
    setCohortMemberId("");
    setInterventionId("");
    setAssessmentId("");
    replaceCreateSelection(nextProgrammeId, "");
  }

  function handleCohortChange(nextCohortId: string) {
    setCohortId(nextCohortId);
    setCohortMemberId("");
    setInterventionId("");
    setAssessmentId("");
    replaceCreateSelection(programmeId, nextCohortId);
  }

  function handleMemberChange(nextCohortMemberId: string) {
    setCohortMemberId(nextCohortMemberId);
    setInterventionId("");
    setAssessmentId("");
  }

  const interventionOptions = useMemo(
    () => interventions.filter((intervention) => !intervention.cohort_member_id || intervention.cohort_member_id === cohortMemberId),
    [cohortMemberId, interventions],
  );

  const assessmentOptions = useMemo(
    () => assessments.filter((assessment) => !assessment.cohort_member_id || assessment.cohort_member_id === cohortMemberId),
    [assessments, cohortMemberId],
  );

  const memberPlaceholder = !cohortId
    ? "Select a cohort first"
    : cohortMembers.length === 0
      ? "No beneficiaries enrolled in this cohort"
      : "Select beneficiary";
  const canCreate = Boolean(programmeId && cohortId && cohortMemberId);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-lg border bg-slate-50 p-4 lg:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Programme
          <select
            required
            value={programmeId}
            onChange={(event) => handleProgrammeChange(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm font-normal"
          >
            <option value="">Select programme</option>
            {programmes.map((programme) => (
              <option key={programme.id} value={programme.id}>{programme.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Cohort
          <select
            value={cohortId}
            onChange={(event) => handleCohortChange(event.target.value)}
            disabled={!programmeId || isPending}
            className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">{programmeId ? "Select cohort" : "Select programme first"}</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>{cohort.name} ({cohort.member_count ?? cohort.current_beneficiaries} members)</option>
            ))}
          </select>
        </label>
      </div>

      <form action={action} className="grid gap-4 lg:grid-cols-3">
        <input type="hidden" name="programme_id" value={programmeId} />
        <input type="hidden" name="cohort_id" value={cohortId} />
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Beneficiary
          <select
            required
            name="cohort_member_id"
            value={cohortMemberId}
            onChange={(event) => handleMemberChange(event.target.value)}
            disabled={!cohortId || isPending || cohortMembers.length === 0}
            className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">{isPending && cohortId ? "Loading beneficiaries..." : memberPlaceholder}</option>
            {cohortMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.msmes?.business_name ?? "Unknown MSME"} ({member.msmes?.msme_id ?? member.member_status})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Intervention
          <select
            name="intervention_id"
            value={interventionId}
            onChange={(event) => setInterventionId(event.target.value)}
            disabled={!cohortMemberId}
            className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">{cohortMemberId ? "No intervention" : "Select beneficiary first"}</option>
            {interventionOptions.map((intervention) => (
              <option key={intervention.id} value={intervention.id}>{intervention.title}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Assessment
          <select
            name="assessment_id"
            value={assessmentId}
            onChange={(event) => setAssessmentId(event.target.value)}
            disabled={!cohortMemberId}
            className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">{cohortMemberId ? "No assessment" : "Select beneficiary first"}</option>
            {assessmentOptions.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>{assessment.title ?? assessment.assessment_type ?? "Assessment"}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Visit title
          <input required name="title" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Post-disbursement monitoring visit" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Field officer
          <select name="assigned_to_user_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
            <option value="">Assign later</option>
            {fieldOfficers.map((officer) => (
              <option key={officer.id} value={officer.id}>{officer.full_name ?? officer.email ?? "Field officer"}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Scheduled date
          <input name="visit_date" type="date" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Status
          <select name="status" defaultValue="pending" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
            {FIELD_VISIT_STATUSES.map((status) => (
              <option key={status} value={status}>{status.replace("_", " ")}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Location
          <input name="location_text" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Ikeja, Lagos" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-3">
          Checklist
          <textarea name="checklist_blueprint" rows={4} defaultValue={defaultChecklist} className="w-full rounded-md border px-3 py-2 font-mono text-xs font-normal" />
        </label>
        <div className="flex justify-end lg:col-span-3">
          {canCreate && <Button type="submit" className="gap-2"><Plus className="h-4 w-4" /> Create task</Button>}
        </div>
      </form>
    </div>
  );
}
