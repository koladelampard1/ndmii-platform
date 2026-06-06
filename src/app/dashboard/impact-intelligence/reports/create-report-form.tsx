"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REPORT_PHASE1A_TYPES, type ReportFormOptions } from "@/lib/data/impact-reports";

export function CreateReportForm({
  options,
  action,
}: {
  options: ReportFormOptions;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [programmeId, setProgrammeId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [interventionId, setInterventionId] = useState("");

  const cohorts = useMemo(
    () => options.cohorts.filter((item) => item.programme_id === programmeId),
    [options.cohorts, programmeId],
  );
  const members = useMemo(
    () => options.members.filter((item) => item.programme_id === programmeId && (!cohortId || item.cohort_id === cohortId)),
    [cohortId, options.members, programmeId],
  );
  const selectedMember = members.find((item) => item.id === memberId) ?? null;
  const interventions = useMemo(
    () => options.interventions.filter((item) => (
      item.programme_id === programmeId
      && (!cohortId || item.cohort_id === cohortId)
      && (!memberId || item.cohort_member_id === memberId)
    )),
    [cohortId, memberId, options.interventions, programmeId],
  );

  function changeProgramme(value: string) {
    setProgrammeId(value);
    setCohortId("");
    setMemberId("");
    setInterventionId("");
  }

  function changeCohort(value: string) {
    setCohortId(value);
    setMemberId("");
    setInterventionId("");
  }

  function changeMember(value: string) {
    setMemberId(value);
    setInterventionId("");
  }

  return (
    <form action={action} className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm lg:grid-cols-3">
      <h2 className="font-semibold text-slate-950 lg:col-span-3">Create Institutional Report Draft</h2>
      <input type="hidden" name="msme_id" value={selectedMember?.msme_id ?? ""} />
      <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
        Title
        <input required name="title" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Programme performance report" />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Report type
        <select name="report_type" defaultValue="programme_performance" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
          {REPORT_PHASE1A_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Programme
        <select required name="programme_id" value={programmeId} onChange={(event) => changeProgramme(event.target.value)} className="w-full rounded-md border px-3 py-2 text-sm font-normal">
          <option value="">Select programme</option>
          {options.programmes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Beneficiary cohort
        <select name="cohort_id" value={cohortId} onChange={(event) => changeCohort(event.target.value)} disabled={!programmeId} className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100">
          <option value="">{programmeId ? "All programme cohorts" : "Select programme first"}</option>
          {cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Beneficiary / MSME
        <select name="cohort_member_id" value={memberId} onChange={(event) => changeMember(event.target.value)} disabled={!cohortId} className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100">
          <option value="">{cohortId ? "All cohort beneficiaries" : "Select cohort first"}</option>
          {members.map((item) => <option key={item.id} value={item.id}>{item.msmes?.business_name ?? "Unknown MSME"} ({item.msmes?.msme_id ?? item.member_status})</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Intervention
        <select name="intervention_id" value={interventionId} onChange={(event) => setInterventionId(event.target.value)} disabled={!programmeId} className="w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-100">
          <option value="">{programmeId ? "All matching interventions" : "Select programme first"}</option>
          {interventions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
        Summary
        <textarea name="summary" rows={3} className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Purpose, reporting period, or institutional context." />
      </label>
      <div className="flex items-end justify-end">
        <Button type="submit" disabled={!programmeId} className="gap-2">
          <Plus className="h-4 w-4" /> Create draft
        </Button>
      </div>
    </form>
  );
}

