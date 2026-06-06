"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EVIDENCE_CATEGORIES } from "@/lib/data/impact-intelligence";
import type { ImpactEvidenceUploadOptions } from "@/lib/data/impact-evidence";

type Props = {
  options: ImpactEvidenceUploadOptions;
  selectedProgrammeId: string;
  selectedCohortId: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function CreateEvidenceForm({ options, selectedProgrammeId, selectedCohortId, action }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [programmeId, setProgrammeId] = useState(selectedProgrammeId);
  const [cohortId, setCohortId] = useState(selectedCohortId);
  const [memberId, setMemberId] = useState("");
  const [interventionId, setInterventionId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [visitId, setVisitId] = useState("");

  function replaceSelection(nextProgrammeId: string, nextCohortId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextProgrammeId) params.set("create_programme_id", nextProgrammeId);
    else params.delete("create_programme_id");
    if (nextCohortId) params.set("create_cohort_id", nextCohortId);
    else params.delete("create_cohort_id");
    params.delete("error");
    params.delete("success");
    startTransition(() => router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false }));
  }

  function selectProgramme(value: string) {
    setProgrammeId(value);
    setCohortId("");
    setMemberId("");
    setInterventionId("");
    setAssessmentId("");
    setVisitId("");
    replaceSelection(value, "");
  }

  function selectCohort(value: string) {
    setCohortId(value);
    setMemberId("");
    setInterventionId("");
    setAssessmentId("");
    setVisitId("");
    replaceSelection(programmeId, value);
  }

  function selectMember(value: string) {
    setMemberId(value);
    setInterventionId("");
    setAssessmentId("");
    setVisitId("");
  }

  const interventions = useMemo(
    () => options.interventions.filter((item) => item.cohort_member_id === memberId),
    [memberId, options.interventions],
  );
  const assessments = useMemo(
    () => options.assessments.filter((item) => item.cohort_member_id === memberId && (!interventionId || !item.intervention_id || item.intervention_id === interventionId)),
    [interventionId, memberId, options.assessments],
  );
  const visits = useMemo(
    () => options.visits.filter((item) => (
      item.cohort_member_id === memberId
      && (!interventionId || item.intervention_id === interventionId)
      && (!assessmentId || item.assessment_id === assessmentId)
    )),
    [assessmentId, interventionId, memberId, options.visits],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-lg border bg-slate-50 p-4 lg:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Programme
          <select value={programmeId} onChange={(event) => selectProgramme(event.target.value)} className="w-full rounded-md border px-3 py-2 text-sm font-normal">
            <option value="">Select programme</option>
            {options.programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Beneficiary cohort
          <select value={cohortId} onChange={(event) => selectCohort(event.target.value)} disabled={!programmeId || isPending} className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100">
            <option value="">{programmeId ? "Select cohort" : "Select programme first"}</option>
            {options.cohorts.filter((cohort) => cohort.programme_id === programmeId).map((cohort) => (
              <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
            ))}
          </select>
        </label>
      </div>

      <form action={action} className="grid gap-4 lg:grid-cols-3">
        <input type="hidden" name="programme_id" value={programmeId} />
        <input type="hidden" name="cohort_id" value={cohortId} />
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Beneficiary
          <select required name="cohort_member_id" value={memberId} onChange={(event) => selectMember(event.target.value)} disabled={!cohortId || isPending} className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100">
            <option value="">{cohortId ? "Select beneficiary" : "Select cohort first"}</option>
            {options.members.filter((member) => member.cohort_id === cohortId).map((member) => (
              <option key={member.id} value={member.id}>{member.msmes?.business_name ?? "Unknown MSME"} ({member.msmes?.msme_id ?? member.member_status})</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Intervention
          <select name="intervention_id" value={interventionId} onChange={(event) => { setInterventionId(event.target.value); setAssessmentId(""); setVisitId(""); }} disabled={!memberId} className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100">
            <option value="">{memberId ? "No intervention" : "Select beneficiary first"}</option>
            {interventions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Assessment
          <select name="assessment_id" value={assessmentId} onChange={(event) => { setAssessmentId(event.target.value); setVisitId(""); }} disabled={!memberId} className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100">
            <option value="">{memberId ? "No assessment" : "Select beneficiary first"}</option>
            {assessments.map((item) => <option key={item.id} value={item.id}>{item.title ?? item.assessment_type ?? "Assessment"}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Field visit
          <select name="field_visit_id" value={visitId} onChange={(event) => setVisitId(event.target.value)} disabled={!memberId} className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100">
            <option value="">{memberId ? "No field visit" : "Select beneficiary first"}</option>
            {visits.map((item) => <option key={item.id} value={item.id}>{item.title ?? "Field visit"} ({item.status ?? "pending"})</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Category
          <select name="evidence_category" defaultValue="monitoring_photo" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
            {EVIDENCE_CATEGORIES.map((category) => <option key={category} value={category}>{category.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Captured date
          <input name="captured_at" type="datetime-local" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-3">
          Evidence file
          <input required name="evidence_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="w-full rounded-md border px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white" />
          <span className="block text-xs font-normal text-slate-500">PDF, JPEG, PNG, or WebP. Maximum 10MB.</span>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-3">
          Context note
          <textarea name="description" rows={3} className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="What this file demonstrates and when it was captured." />
        </label>
        <div className="flex justify-end lg:col-span-3">
          <Button type="submit" disabled={!programmeId || !cohortId || !memberId} className="gap-2">
            <Upload className="h-4 w-4" /> Upload evidence
          </Button>
        </div>
      </form>
    </div>
  );
}

