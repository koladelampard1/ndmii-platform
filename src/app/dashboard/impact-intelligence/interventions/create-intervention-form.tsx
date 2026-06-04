"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ImpactBeneficiaryCohort, ImpactCohortMember, ImpactProgramme } from "@/lib/data/impact-intelligence";
import { INTERVENTION_STAGES, INTERVENTION_STATUSES } from "@/lib/data/impact-intelligence";

type CreateInterventionFormProps = {
  programmes: ImpactProgramme[];
  cohorts: ImpactBeneficiaryCohort[];
  cohortMembers: ImpactCohortMember[];
  officers: { id: string; full_name?: string | null; email?: string | null }[];
  selectedProgrammeId: string;
  selectedCohortId: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function CreateInterventionForm({
  programmes,
  cohorts,
  cohortMembers,
  officers,
  selectedProgrammeId,
  selectedCohortId,
  action,
}: CreateInterventionFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [programmeId, setProgrammeId] = useState(selectedProgrammeId);
  const [cohortId, setCohortId] = useState(selectedCohortId);
  const [cohortMemberId, setCohortMemberId] = useState("");

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
    replaceCreateSelection(nextProgrammeId, "");
  }

  function handleCohortChange(nextCohortId: string) {
    setCohortId(nextCohortId);
    setCohortMemberId("");
    replaceCreateSelection(programmeId, nextCohortId);
  }

  const memberPlaceholder = !cohortId
    ? "Select a cohort first"
    : cohortMembers.length === 0
      ? "No beneficiaries enrolled in this cohort"
      : "Select cohort member";
  const canCreate = Boolean(programmeId && cohortId && cohortMemberId);

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
          Title
          <input required name="title" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Working capital support" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Cohort beneficiary
          <select
            required
            name="cohort_member_id"
            value={cohortMemberId}
            onChange={(event) => setCohortMemberId(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100 disabled:text-slate-500"
            disabled={!cohortId || isPending || cohortMembers.length === 0}
          >
            <option value="">{isPending && cohortId ? "Loading cohort beneficiaries..." : memberPlaceholder}</option>
            {cohortMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.msmes?.business_name ?? "Unknown MSME"} ({member.msmes?.msme_id ?? member.member_status})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Type
          <input name="intervention_type" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="finance, advisory, equipment" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Status
          <select name="status" defaultValue="planned" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
            {INTERVENTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Stage
          <select name="stage" defaultValue="intake" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
            {INTERVENTION_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
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
            {officers.map((officer) => (
              <option key={officer.id} value={officer.id}>
                {officer.full_name ?? officer.email ?? officer.id}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-3">
          Description
          <textarea name="description" rows={3} className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
        </label>
        <div className="flex justify-end lg:col-span-3">
          {canCreate && <Button type="submit">Create intervention</Button>}
        </div>
      </form>
    </div>
  );
}
