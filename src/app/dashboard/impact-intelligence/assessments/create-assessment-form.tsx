"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImpactAssessmentTemplate, ImpactBeneficiaryCohort, ImpactCohortMember, ImpactIntervention, ImpactProgramme } from "@/lib/data/impact-intelligence";
import { ASSESSMENT_TYPES } from "@/lib/data/impact-intelligence";

type CreateAssessmentFormProps = {
  programmes: ImpactProgramme[];
  cohorts: ImpactBeneficiaryCohort[];
  cohortMembers: ImpactCohortMember[];
  interventions: ImpactIntervention[];
  templates: ImpactAssessmentTemplate[];
  selectedProgrammeId: string;
  selectedCohortId: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function CreateAssessmentForm({
  programmes,
  cohorts,
  cohortMembers,
  interventions,
  templates,
  selectedProgrammeId,
  selectedCohortId,
  action,
}: CreateAssessmentFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [programmeId, setProgrammeId] = useState(selectedProgrammeId);
  const [cohortId, setCohortId] = useState(selectedCohortId);
  const [cohortMemberId, setCohortMemberId] = useState("");
  const [interventionId, setInterventionId] = useState("");
  const [assessmentType, setAssessmentType] = useState("");
  const [templateId, setTemplateId] = useState("");

  function replaceCreateSelection(nextProgrammeId: string, nextCohortId: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextProgrammeId) {
      params.set("create_programme_id", nextProgrammeId);
    } else {
      params.delete("create_programme_id");
    }

    if (nextCohortId) {
      params.set("create_cohort_id", nextCohortId);
    } else {
      params.delete("create_cohort_id");
    }

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
    replaceCreateSelection(nextProgrammeId, "");
  }

  function handleCohortChange(nextCohortId: string) {
    setCohortId(nextCohortId);
    setCohortMemberId("");
    setInterventionId("");
    replaceCreateSelection(programmeId, nextCohortId);
  }

  function handleMemberChange(nextCohortMemberId: string) {
    setCohortMemberId(nextCohortMemberId);
    setInterventionId("");
  }

  const memberPlaceholder = !cohortId
    ? "Select a cohort first"
    : cohortMembers.length === 0
      ? "No beneficiaries enrolled in this cohort"
      : "Select beneficiary";

  const interventionOptions = useMemo(
    () => interventions.filter((intervention) => !intervention.cohort_member_id || intervention.cohort_member_id === cohortMemberId),
    [cohortMemberId, interventions],
  );
  const canCreate = Boolean(programmeId && cohortId && cohortMemberId && assessmentType && templateId);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-lg border bg-slate-50 p-4 lg:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Programme
          <select
            required
            name="create_programme_id"
            value={programmeId}
            onChange={(event) => handleProgrammeChange(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm font-normal"
          >
            <option value="">Select programme</option>
            {programmes.map((programme) => (
              <option key={programme.id} value={programme.id}>
                {programme.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Cohort
          <select
            name="create_cohort_id"
            value={cohortId}
            onChange={(event) => handleCohortChange(event.target.value)}
            disabled={!programmeId || isPending}
            className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">{programmeId ? "Select cohort" : "Select programme first"}</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name} ({cohort.member_count ?? cohort.current_beneficiaries} members)
              </option>
            ))}
          </select>
        </label>
      </div>

      <form action={action} className="grid gap-4 lg:grid-cols-3">
        <input type="hidden" name="programme_id" value={programmeId} />
        <input type="hidden" name="cohort_id" value={cohortId} />
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Cohort beneficiary
          <select
            required
            name="cohort_member_id"
            value={cohortMemberId}
            onChange={(event) => handleMemberChange(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100 disabled:text-slate-500"
            disabled={!cohortId || isPending || cohortMembers.length === 0}
          >
            <option value="">{isPending && cohortId ? "Loading cohort beneficiaries..." : memberPlaceholder}</option>
            {cohortMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.msmes?.business_name ?? member.msme_id} ({member.msmes?.msme_id ?? member.member_status})
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
            className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100 disabled:text-slate-500"
            disabled={!cohortId || isPending}
          >
            <option value="">{cohortId ? "No intervention" : "Select a cohort first"}</option>
            {interventionOptions.map((intervention) => (
              <option key={intervention.id} value={intervention.id}>
                {intervention.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Assessment type
          <select
            required
            name="assessment_type"
            value={assessmentType}
            onChange={(event) => setAssessmentType(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm font-normal"
          >
            <option value="">Select type</option>
            {ASSESSMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Template
          <select
            required
            name="template_id"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm font-normal"
          >
            <option value="">Select template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} v{template.version}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
          Title
          <input name="title" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Baseline assessment" />
        </label>
        <div className="flex items-end justify-end lg:col-span-3">
          {canCreate && (
            <Button type="submit" className="w-full gap-2 md:w-auto">
              <Plus className="h-4 w-4" /> Create assessment
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
