"use client";

import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  FileCheck2,
  FileText,
  Fingerprint,
  Info,
  Link2,
  LockKeyhole,
  ShieldCheck,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DragEvent, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EVIDENCE_CATEGORIES } from "@/lib/data/impact-intelligence";
import type { ImpactEvidenceUploadOptions } from "@/lib/data/impact-evidence";
import { cn } from "@/lib/utils";

type Props = {
  options: ImpactEvidenceUploadOptions;
  selectedProgrammeId: string;
  selectedCohortId: string;
  action: (formData: FormData) => void | Promise<void>;
  currentUserName: string;
  currentRole: string;
  maxFileSizeBytes: number;
  acceptedMimeTypes: string[];
  acceptedExtensions: string[];
};

const UNAVAILABLE = "Unavailable";

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function FieldLabel({ children, optional = false }: { children: ReactNode; optional?: boolean }) {
  return (
    <span className="mb-2 flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">
      {children}
      {optional && <span className="text-[9px] font-semibold normal-case tracking-normal text-slate-400">Optional</span>}
    </span>
  );
}

function ReadinessItem({ label, state, detail }: { label: string; state: boolean | null; detail: string }) {
  const Icon = state === true ? CheckCircle2 : state === false ? Circle : Info;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span className={cn(
        "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
        state === true ? "bg-emerald-100 text-emerald-700" : state === false ? "bg-slate-100 text-slate-400" : "bg-amber-100 text-amber-700",
      )}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div>
        <p className="text-[11px] font-bold text-slate-800">{label}</p>
        <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

export function CreateEvidenceForm({
  options,
  selectedProgrammeId,
  selectedCohortId,
  action,
  currentUserName,
  currentRole,
  maxFileSizeBytes,
  acceptedMimeTypes,
  acceptedExtensions,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [programmeId, setProgrammeId] = useState(selectedProgrammeId);
  const [cohortId, setCohortId] = useState(selectedCohortId);
  const [memberId, setMemberId] = useState("");
  const [interventionId, setInterventionId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [visitId, setVisitId] = useState("");
  const [category, setCategory] = useState("monitoring_photo");
  const [description, setDescription] = useState("");
  const [capturedAt, setCapturedAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const cohorts = useMemo(
    () => options.cohorts.filter((item) => item.programme_id === programmeId),
    [options.cohorts, programmeId],
  );
  const members = useMemo(
    () => options.members.filter((item) => item.cohort_id === cohortId),
    [cohortId, options.members],
  );
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

  const selectedProgramme = options.programmes.find((item) => item.id === programmeId);
  const selectedCohort = options.cohorts.find((item) => item.id === cohortId);
  const selectedMember = options.members.find((item) => item.id === memberId);
  const selectedIntervention = options.interventions.find((item) => item.id === interventionId);
  const selectedAssessment = options.assessments.find((item) => item.id === assessmentId);
  const selectedVisit = options.visits.find((item) => item.id === visitId);

  const extension = file?.name.split(".").pop()?.toLowerCase() ?? "";
  const validFormat = file ? acceptedExtensions.includes(extension) && acceptedMimeTypes.includes(file.type.toLowerCase()) : false;
  const validSize = file ? file.size > 0 && file.size <= maxFileSizeBytes : false;
  const contextComplete = Boolean(programmeId && cohortId && memberId);
  const metadataComplete = Boolean(category);
  const ready = Boolean(file && validFormat && validSize && contextComplete && metadataComplete);
  const accept = [
    ...acceptedExtensions.map((item) => `.${item}`),
    ...acceptedMimeTypes,
  ].join(",");

  function resetDependentContext(level: "programme" | "cohort" | "member") {
    if (level === "programme") setCohortId("");
    if (level === "programme" || level === "cohort") setMemberId("");
    if (level === "programme" || level === "cohort" || level === "member") {
      setInterventionId("");
      setAssessmentId("");
      setVisitId("");
    }
  }

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const nextFile = event.dataTransfer.files[0] ?? null;
    if (!nextFile) return;
    const transfer = new DataTransfer();
    transfer.items.add(nextFile);
    if (inputRef.current) inputRef.current.files = transfer.files;
    selectFile(nextFile);
  }

  const steps = [
    { label: "Select Evidence File", complete: Boolean(file && validFormat && validSize) },
    { label: "Link Programme Context", complete: contextComplete },
    { label: "Add Metadata", complete: metadataComplete },
    { label: "Validate Evidence", complete: ready },
    { label: "Submit for Review", complete: false },
  ];

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="programme_id" value={programmeId} />
      <input type="hidden" name="cohort_id" value={cohortId} />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <div className="grid gap-3 md:grid-cols-5">
            {steps.map((step, index) => (
              <div key={step.label} className="flex items-center gap-2 md:block">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                    step.complete ? "bg-emerald-600 text-white" : index === 0 || steps.slice(0, index).every((item) => item.complete) ? "bg-[#0c1f46] text-white" : "bg-slate-200 text-slate-500",
                  )}>
                    {step.complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  {index < steps.length - 1 && <span className={cn("hidden h-px flex-1 md:block", step.complete ? "bg-emerald-300" : "bg-slate-200")} />}
                </div>
                <p className="mt-0 text-[10px] font-bold text-slate-700 md:mt-2">{step.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">Step 01</p>
                <h2 className="mt-1 text-lg font-bold text-[#0c1733]">Select Evidence File</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Choose the source file that supports the institutional claim or field activity.</p>
              </div>
              <FileCheck2 className="h-6 w-6 text-blue-700" />
            </div>

            <div
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "mt-5 rounded-2xl border-2 border-dashed p-6 text-center transition sm:p-10",
                dragging ? "border-blue-500 bg-blue-50" : file && validFormat && validSize ? "border-emerald-300 bg-emerald-50/40" : file ? "border-rose-300 bg-rose-50/40" : "border-slate-300 bg-slate-50/70 hover:border-blue-400 hover:bg-blue-50/40",
              )}
            >
              <input
                ref={inputRef}
                required
                name="evidence_file"
                type="file"
                accept={accept}
                onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                className="sr-only"
                id="evidence-file"
              />
              <span className={cn(
                "mx-auto grid h-14 w-14 place-items-center rounded-2xl",
                file && validFormat && validSize ? "bg-emerald-100 text-emerald-700" : file ? "bg-rose-100 text-rose-700" : "bg-[#0c1f46] text-white",
              )}>
                {file ? <FileText className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
              </span>
              {file ? (
                <>
                  <p className="mt-4 break-all text-sm font-bold text-[#0c1733]">{file.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{file.type || UNAVAILABLE} · {formatBytes(file.size)}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <span className={cn("rounded-full px-3 py-1 text-[10px] font-bold", validFormat ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                      {validFormat ? "Accepted format" : "Unsupported format"}
                    </span>
                    <span className={cn("rounded-full px-3 py-1 text-[10px] font-bold", validSize ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                      {validSize ? "Size accepted" : `Maximum ${formatBytes(maxFileSizeBytes)}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (inputRef.current) inputRef.current.value = ""; selectFile(null); }}
                    className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700"
                  >
                    <X className="h-3.5 w-3.5" /> Remove file
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-4 text-sm font-bold text-[#0c1733]">Drag and drop evidence here</p>
                  <p className="mt-1 text-xs text-slate-500">or select a file from your device</p>
                  <label htmlFor="evidence-file" className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0c1f46] px-4 py-2.5 text-xs font-bold text-white">
                    Browse files <ArrowRight className="h-3.5 w-3.5" />
                  </label>
                </>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-3"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Accepted formats</p><p className="mt-1 text-[11px] font-bold text-slate-700">{acceptedExtensions.map((item) => item.toUpperCase()).join(", ")}</p></div>
              <div className="rounded-xl border border-slate-200 p-3"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Maximum size</p><p className="mt-1 text-[11px] font-bold text-slate-700">{formatBytes(maxFileSizeBytes)}</p></div>
              <div className="rounded-xl border border-slate-200 p-3"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Integrity control</p><p className="mt-1 text-[11px] font-bold text-slate-700">SHA-256 on upload</p></div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">Step 02</p>
                <h2 className="mt-1 text-lg font-bold text-[#0c1733]">Link Programme Context</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Options are restricted by your existing programme and field assignment scope.</p>
              </div>
              <Link2 className="h-6 w-6 text-blue-700" />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label>
                <FieldLabel>Programme</FieldLabel>
                <select required value={programmeId} onChange={(event) => { setProgrammeId(event.target.value); resetDependentContext("programme"); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                  <option value="">{options.programmes.length ? "Select programme" : UNAVAILABLE}</option>
                  {options.programmes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.programme_code ? ` · ${item.programme_code}` : ""}</option>)}
                </select>
              </label>
              <label>
                <FieldLabel>Cohort</FieldLabel>
                <select required value={cohortId} onChange={(event) => { setCohortId(event.target.value); resetDependentContext("cohort"); }} disabled={!programmeId} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm disabled:bg-slate-100 disabled:text-slate-400">
                  <option value="">{programmeId ? (cohorts.length ? "Select cohort" : UNAVAILABLE) : "Select programme first"}</option>
                  {cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="md:col-span-2">
                <FieldLabel>Beneficiary / cohort member</FieldLabel>
                <select required name="cohort_member_id" value={memberId} onChange={(event) => { setMemberId(event.target.value); resetDependentContext("member"); }} disabled={!cohortId} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm disabled:bg-slate-100 disabled:text-slate-400">
                  <option value="">{cohortId ? (members.length ? "Select beneficiary" : UNAVAILABLE) : "Select cohort first"}</option>
                  {members.map((item) => <option key={item.id} value={item.id}>{item.msmes?.business_name ?? UNAVAILABLE} · {item.msmes?.msme_id ?? item.member_status}</option>)}
                </select>
              </label>
              <label>
                <FieldLabel optional>Intervention</FieldLabel>
                <select name="intervention_id" value={interventionId} onChange={(event) => { setInterventionId(event.target.value); setAssessmentId(""); setVisitId(""); }} disabled={!memberId} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm disabled:bg-slate-100 disabled:text-slate-400">
                  <option value="">{memberId ? (interventions.length ? "No intervention selected" : UNAVAILABLE) : "Select beneficiary first"}</option>
                  {interventions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </label>
              <label>
                <FieldLabel optional>Assessment</FieldLabel>
                <select name="assessment_id" value={assessmentId} onChange={(event) => { setAssessmentId(event.target.value); setVisitId(""); }} disabled={!memberId} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm disabled:bg-slate-100 disabled:text-slate-400">
                  <option value="">{memberId ? (assessments.length ? "No assessment selected" : UNAVAILABLE) : "Select beneficiary first"}</option>
                  {assessments.map((item) => <option key={item.id} value={item.id}>{item.title ?? item.assessment_type ?? UNAVAILABLE}</option>)}
                </select>
              </label>
              <label className="md:col-span-2">
                <FieldLabel optional>Monitoring visit</FieldLabel>
                <select name="field_visit_id" value={visitId} onChange={(event) => setVisitId(event.target.value)} disabled={!memberId} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm disabled:bg-slate-100 disabled:text-slate-400">
                  <option value="">{memberId ? (visits.length ? "No monitoring visit selected" : UNAVAILABLE) : "Select beneficiary first"}</option>
                  {visits.map((item) => <option key={item.id} value={item.id}>{item.title ?? "Field visit"} · {humanize(item.status ?? "pending")}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">Step 03</p>
                <h2 className="mt-1 text-lg font-bold text-[#0c1733]">Add Evidence Metadata</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Describe the evidence using only metadata supported by the current upload workflow.</p>
              </div>
              <Fingerprint className="h-6 w-6 text-blue-700" />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Evidence title / filename</p>
                <p className="mt-1 truncate text-sm font-bold text-slate-700">{file?.name ?? "Derived from selected file"}</p>
              </div>
              <label>
                <FieldLabel>Evidence category</FieldLabel>
                <select name="evidence_category" value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                  {EVIDENCE_CATEGORIES.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
                </select>
              </label>
              <label>
                <FieldLabel optional>Source / collection date</FieldLabel>
                <input name="captured_at" type="datetime-local" value={capturedAt} onChange={(event) => setCapturedAt(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" />
              </label>
              <label className="md:col-span-2">
                <FieldLabel optional>Context note / description</FieldLabel>
                <textarea name="description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="What this file demonstrates, where it was collected, and why it supports the programme record." />
              </label>
            </div>
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Validation</p>
                <h2 className="mt-1 text-base font-bold text-[#0c1733]">Submission Readiness</h2>
              </div>
              <span className={cn("rounded-full px-3 py-1 text-[10px] font-bold", ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                {ready ? "Ready to upload" : "Action required"}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              <ReadinessItem label="File selected" state={Boolean(file)} detail={file ? file.name : "Select one evidence file."} />
              <ReadinessItem label="Valid format" state={file ? validFormat : false} detail={file ? (validFormat ? "Matches server-supported formats." : "File type is not accepted.") : "Awaiting file selection."} />
              <ReadinessItem label="Valid size" state={file ? validSize : false} detail={`Maximum permitted size is ${formatBytes(maxFileSizeBytes)}.`} />
              <ReadinessItem label="Programme linked" state={Boolean(programmeId)} detail={selectedProgramme?.name ?? "A programme is required."} />
              <ReadinessItem label="Beneficiary context" state={Boolean(memberId)} detail={selectedMember?.msmes?.business_name ?? "A cohort beneficiary is required."} />
              <ReadinessItem label="Visit / assessment link" state={assessmentId || visitId ? true : null} detail={assessmentId || visitId ? "Supporting operational link selected." : "Optional in the existing workflow."} />
              <ReadinessItem label="Metadata complete" state={metadataComplete} detail={metadataComplete ? "Required category is present." : "Select an evidence category."} />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-[#0c1f46] p-5 text-white">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-100">Chain of custody</p></div>
              <p className="mt-2 text-sm font-bold">Protected evidence intake</p>
              <p className="mt-1 text-[10px] leading-5 text-blue-100/75">Private storage references are never exposed in this workspace.</p>
            </div>
            <div className="space-y-3 p-5">
              {([
                ["Uploaded by", currentUserName, UserRound],
                ["Current role", humanize(currentRole), BadgeCheck],
                ["Upload timestamp", "Recorded by server on upload", Clock3],
                ["Programme", selectedProgramme?.name ?? UNAVAILABLE, Link2],
                ["Cohort", selectedCohort?.name ?? UNAVAILABLE, CalendarDays],
                ["Beneficiary", selectedMember?.msmes?.business_name ?? UNAVAILABLE, UserRound],
                ["Intervention", selectedIntervention?.title ?? UNAVAILABLE, ChevronRight],
                ["Assessment", selectedAssessment?.title ?? selectedAssessment?.assessment_type ?? UNAVAILABLE, FileCheck2],
                ["Monitoring visit", selectedVisit?.title ?? UNAVAILABLE, CalendarDays],
              ] satisfies Array<[string, string, LucideIcon]>).map(([label, value, Icon]) => (
                <div key={String(label)} className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icon className="h-3.5 w-3.5" /></span>
                  <div><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className="mt-0.5 text-[11px] font-bold text-slate-700">{value}</p></div>
                </div>
              ))}
              <div className="border-t border-slate-200 pt-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Expected lifecycle</p>
                <p className="mt-2 text-[10px] font-semibold leading-5 text-slate-600">Uploaded → Submitted → Under Review → Verified / Returned / Rejected</p>
              </div>
            </div>
          </section>

          <section className={cn("rounded-2xl border p-5 shadow-sm", ready ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white")}>
            <div className="flex items-center gap-2">
              <LockKeyhole className={cn("h-4 w-4", ready ? "text-emerald-700" : "text-slate-500")} />
              <h2 className="text-sm font-bold text-[#0c1733]">Secure Upload</h2>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-600">
              Upload creates an evidence record in <strong>Uploaded</strong> state. Submission for review remains a separate existing action on the evidence detail page.
            </p>
            <Button type="submit" disabled={!ready} className="mt-4 w-full gap-2">
              <Upload className="h-4 w-4" /> Upload Evidence
            </Button>
            <p className="mt-3 flex items-start gap-2 text-[10px] leading-4 text-slate-500">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              The server revalidates type, size, scope, context integrity, and duplicate checksum before saving.
            </p>
          </section>
        </aside>
      </div>
    </form>
  );
}
