"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Gauge,
  Info,
  Layers3,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Ruler,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import type { ImpactEvidenceRecord } from "@/lib/data/impact-evidence";
import {
  INDICATOR_SOURCE_TYPES,
  type ImpactIndicatorDefinition,
  type IndicatorFormOptions,
} from "@/lib/data/impact-indicators";
import { cn } from "@/lib/utils";

const UNAVAILABLE = "Unavailable";
const FIELD_CLASS = "h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";
const STEPS = [
  { label: "Review Indicator", icon: Target },
  { label: "Enter Measurement", icon: Ruler },
  { label: "Link Evidence", icon: Link2 },
  { label: "Validate", icon: ShieldCheck },
  { label: "Submit Measurement", icon: ClipboardCheck },
] as const;

function humanize(value: string | null | undefined) {
  return value
    ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
    : UNAVAILABLE;
}

function display(value: string | null | undefined) {
  return value?.trim() || UNAVAILABLE;
}

function formatDate(value: string | null | undefined) {
  if (!value) return UNAVAILABLE;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? UNAVAILABLE
    : date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function PanelHeading({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0c1f46] text-white shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-[#0c1733]">{title}</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function ContextValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-2 text-xs font-bold text-slate-800">{value}</p>
    </div>
  );
}

function ReadinessItem({ label, complete, detail }: { label: string; complete: boolean | null; detail: string }) {
  const Icon = complete === true ? CheckCircle2 : complete === false ? Circle : Info;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span className={cn(
        "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
        complete === true ? "bg-emerald-100 text-emerald-700" : complete === false ? "bg-slate-100 text-slate-400" : "bg-amber-100 text-amber-700",
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

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 text-sm font-bold text-[#07162f] shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {pending ? "Saving measurement..." : "Save Draft Measurement"}
    </button>
  );
}

export function MeasurementCaptureStudio({
  indicator,
  options,
  evidence,
  evidenceAvailable,
  action,
  error,
  role,
  canOpenEvidence,
  canOpenReports,
}: {
  indicator: ImpactIndicatorDefinition;
  options: IndicatorFormOptions;
  evidence: ImpactEvidenceRecord[];
  evidenceAvailable: boolean;
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  role: string;
  canOpenEvidence: boolean;
  canOpenReports: boolean;
}) {
  const [programmeId, setProgrammeId] = useState(indicator.programme_id ?? "");
  const [cohortId, setCohortId] = useState(indicator.cohort_id ?? "");
  const [memberId, setMemberId] = useState("");
  const [interventionId, setInterventionId] = useState(indicator.intervention_id ?? "");
  const [assessmentId, setAssessmentId] = useState("");
  const [scoreRunId, setScoreRunId] = useState("");
  const [fieldVisitId, setFieldVisitId] = useState("");
  const [sourceType, setSourceType] = useState("manual");
  const [measurementDate, setMeasurementDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [baseline, setBaseline] = useState("");
  const [target, setTarget] = useState("");
  const [measuredValue, setMeasuredValue] = useState("");

  const cohorts = useMemo(
    () => options.cohorts.filter((item) => item.programme_id === programmeId),
    [options.cohorts, programmeId],
  );
  const members = useMemo(
    () => options.members.filter((item) => item.programme_id === programmeId && (!cohortId || item.cohort_id === cohortId)),
    [cohortId, options.members, programmeId],
  );
  const interventions = useMemo(
    () => options.interventions.filter((item) => (
      item.programme_id === programmeId
      && (!cohortId || !item.cohort_id || item.cohort_id === cohortId)
      && (!memberId || item.cohort_member_id === memberId)
    )),
    [cohortId, memberId, options.interventions, programmeId],
  );
  const assessments = useMemo(
    () => options.assessments.filter((item) => (
      item.programme_id === programmeId
      && (!cohortId || !item.cohort_id || item.cohort_id === cohortId)
      && (!memberId || item.cohort_member_id === memberId)
      && (!interventionId || !item.intervention_id || item.intervention_id === interventionId)
    )),
    [cohortId, interventionId, memberId, options.assessments, programmeId],
  );
  const scoreRuns = useMemo(
    () => options.scoreRuns.filter((item) => item.assessment_id === assessmentId),
    [assessmentId, options.scoreRuns],
  );
  const visits = useMemo(
    () => options.visits.filter((item) => (
      item.programme_id === programmeId
      && (!cohortId || !item.cohort_id || item.cohort_id === cohortId)
      && (!memberId || item.cohort_member_id === memberId)
      && (!interventionId || !item.intervention_id || item.intervention_id === interventionId)
      && (!assessmentId || !item.assessment_id || item.assessment_id === assessmentId)
    )),
    [assessmentId, cohortId, interventionId, memberId, options.visits, programmeId],
  );
  const visibleEvidence = useMemo(
    () => evidence.filter((item) => (
      item.programme_id === programmeId
      && (!cohortId || !item.cohort_id || item.cohort_id === cohortId)
      && (!memberId || !item.cohort_member_id || item.cohort_member_id === memberId)
    )),
    [cohortId, evidence, memberId, programmeId],
  );

  const selectedProgramme = options.programmes.find((item) => item.id === programmeId);
  const selectedCohort = options.cohorts.find((item) => item.id === cohortId);
  const selectedMember = options.members.find((item) => item.id === memberId);
  const selectedIntervention = options.interventions.find((item) => item.id === interventionId);
  const selectedAssessment = options.assessments.find((item) => item.id === assessmentId);
  const selectedVisit = options.visits.find((item) => item.id === fieldVisitId);
  const valueEntered = measuredValue.trim() !== "" && Number.isFinite(Number(measuredValue));
  const dateEntered = Boolean(measurementDate);
  const baselineReady = !indicator.baseline_required || (baseline.trim() !== "" && Number.isFinite(Number(baseline)));
  const targetReady = !indicator.target_required || (target.trim() !== "" && Number.isFinite(Number(target)));
  const sourceReady = sourceType === "assessment_score"
    ? Boolean(assessmentId && scoreRunId)
    : sourceType === "field_visit"
      ? Boolean(fieldVisitId)
      : sourceType === "manual";
  const contextReady = Boolean(programmeId);
  const ready = valueEntered && dateEntered && baselineReady && targetReady && sourceReady && contextReady;
  const completed = [valueEntered, dateEntered, baselineReady, targetReady, sourceReady, contextReady].filter(Boolean).length;
  const readiness = Math.round((completed / 6) * 100);
  const verifiedEvidenceCount = visibleEvidence.filter((item) => item.status === "verified" && item.verification_status === "verified").length;
  const periodLabel = periodStart || periodEnd
    ? `${formatDate(periodStart)} to ${formatDate(periodEnd)}`
    : formatDate(measurementDate);

  function changeProgramme(value: string) {
    setProgrammeId(value);
    setCohortId("");
    setMemberId("");
    setInterventionId("");
    setAssessmentId("");
    setScoreRunId("");
    setFieldVisitId("");
  }

  function changeCohort(value: string) {
    setCohortId(value);
    setMemberId("");
    setInterventionId("");
    setAssessmentId("");
    setScoreRunId("");
    setFieldVisitId("");
  }

  function changeMember(value: string) {
    setMemberId(value);
    setInterventionId("");
    setAssessmentId("");
    setScoreRunId("");
    setFieldVisitId("");
  }

  return (
    <section className="-m-4 min-h-screen bg-[#f4f7fb] sm:-m-5 lg:-m-7">
      <header className="relative overflow-hidden bg-[radial-gradient(circle_at_82%_18%,rgba(16,185,129,0.2),transparent_25%),linear-gradient(120deg,#07152f_0%,#0b2450_58%,#071a3c_100%)] px-5 py-7 text-white sm:px-7 lg:px-9 lg:py-9">
        <div className="absolute inset-0 opacity-20" aria-hidden="true">
          <div className="absolute right-10 top-0 h-64 w-64 rounded-full border border-white/20" />
          <div className="absolute right-24 top-12 h-40 w-40 rounded-full border border-emerald-300/30" />
        </div>
        <div className="relative mx-auto max-w-[1500px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={`/dashboard/impact-intelligence/indicators/${indicator.id}`} className="inline-flex items-center gap-2 text-xs font-semibold text-blue-100/80 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Indicator
            </Link>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold">
                <BadgeCheck className="h-3.5 w-3.5 text-blue-300" /> {humanize(role)}
              </span>
              <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-bold", ready ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-400/10 text-amber-200")}>
                <ShieldCheck className="h-3.5 w-3.5" /> {ready ? "Ready to save draft" : "Measurement in progress"}
              </span>
              {canOpenEvidence && <Link href="/dashboard/impact-intelligence/evidence" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-bold hover:bg-white/10"><FileCheck2 className="h-3.5 w-3.5" /> Open Evidence</Link>}
              {canOpenReports && <Link href="/dashboard/impact-intelligence/reports" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-bold hover:bg-white/10"><FileText className="h-3.5 w-3.5" /> Open Reports</Link>}
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Indicator Measurement Capture Studio</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{indicator.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100/75">
                Record a governed outcome value, confirm its programme context, and prepare a draft measurement for the existing verification workflow.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {[humanize(indicator.indicator_type), display(indicator.unit_of_measure), humanize(indicator.direction_of_improvement), humanize(indicator.status)].map((item) => (
                  <span key={item} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold text-blue-100">{item}</span>
                ))}
              </div>
            </div>
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-100">Capture readiness</span>
                <span className="font-bold text-emerald-300">{readiness}%</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${readiness}%` }} />
              </div>
              <p className="mt-3 text-[10px] text-blue-100/60">Saving creates a draft. Submission and verification continue from the indicator workspace.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-7">
        <nav aria-label="Measurement capture steps" className="mx-auto grid max-w-[1500px] gap-2 sm:grid-cols-5">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const stepComplete = index === 0
              || (index === 1 && valueEntered && dateEntered)
              || (index === 2 && sourceReady)
              || (index === 3 && ready);
            return (
              <div key={step.label} className={cn("flex items-center gap-3 rounded-xl border px-3 py-3", stepComplete ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-500")}>
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", stepComplete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100")}>
                  {stepComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span><span className="block text-[9px] font-bold uppercase tracking-[0.12em] opacity-60">Step {index + 1}</span><span className="mt-0.5 block text-xs font-bold">{step.label}</span></span>
              </div>
            );
          })}
        </nav>
      </div>

      <form action={action} className="mx-auto grid max-w-[1500px] gap-6 p-4 sm:p-7 xl:grid-cols-[minmax(0,1fr)_360px] xl:p-9">
        <input type="hidden" name="programme_id" value={programmeId} />
        <input type="hidden" name="cohort_id" value={cohortId} />
        <input type="hidden" name="cohort_member_id" value={memberId} />
        <input type="hidden" name="msme_id" value={selectedMember?.msme_id ?? ""} />
        <input type="hidden" name="intervention_id" value={interventionId} />
        <input type="hidden" name="assessment_id" value={assessmentId} />
        <input type="hidden" name="assessment_score_run_id" value={scoreRunId} />
        <input type="hidden" name="field_visit_id" value={fieldVisitId} />
        <input type="hidden" name="source_type" value={sourceType} />

        <div className="min-w-0 space-y-6">
          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</div>}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <PanelHeading eyebrow="Step 01" title="Indicator Context Panel" description="Review the governed indicator definition before recording a new outcome value." icon={Target} />
            <p className="mt-6 text-sm leading-6 text-slate-600">{display(indicator.description)}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ContextValue label="Programme" value={indicator.impact_programmes?.name ?? UNAVAILABLE} />
              <ContextValue label="Cohort" value={indicator.impact_beneficiary_cohorts?.name ?? UNAVAILABLE} />
              <ContextValue label="Intervention" value={indicator.impact_interventions?.title ?? UNAVAILABLE} />
              <ContextValue label="Unit of measure" value={display(indicator.unit_of_measure)} />
              <ContextValue label="Calculation method" value={humanize(indicator.calculation_method)} />
              <ContextValue label="Frequency" value={humanize(indicator.measurement_frequency)} />
              <ContextValue label="Baseline context" value={indicator.baseline_required ? "Required for each measurement" : UNAVAILABLE} />
              <ContextValue label="Target context" value={indicator.target_required ? "Required for each measurement" : UNAVAILABLE} />
              <ContextValue label="Direction of improvement" value={humanize(indicator.direction_of_improvement)} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <PanelHeading eyebrow="Step 02" title="Measurement Entry Workspace" description="Use only the existing scoped measurement fields and source relationships." icon={Ruler} />
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              <label className="space-y-2 text-xs font-bold text-slate-700">
                Programme <span className="text-rose-500">*</span>
                <select required value={programmeId} onChange={(event) => changeProgramme(event.target.value)} className={FIELD_CLASS}>
                  <option value="">Select programme</option>
                  {options.programmes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-xs font-bold text-slate-700">
                Cohort
                <select value={cohortId} onChange={(event) => changeCohort(event.target.value)} className={FIELD_CLASS}>
                  <option value="">Programme-level</option>
                  {cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-xs font-bold text-slate-700">
                Beneficiary
                <select value={memberId} onChange={(event) => changeMember(event.target.value)} className={FIELD_CLASS}>
                  <option value="">Aggregate measurement</option>
                  {members.map((item) => <option key={item.id} value={item.id}>{item.msmes?.business_name ?? item.msme_id}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-xs font-bold text-slate-700">
                Intervention
                <select value={interventionId} onChange={(event) => { setInterventionId(event.target.value); setAssessmentId(""); setScoreRunId(""); setFieldVisitId(""); }} className={FIELD_CLASS}>
                  <option value="">Not linked</option>
                  {interventions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-xs font-bold text-slate-700">
                Assessment
                <select value={assessmentId} onChange={(event) => { setAssessmentId(event.target.value); setScoreRunId(""); setFieldVisitId(""); }} className={FIELD_CLASS}>
                  <option value="">Not linked</option>
                  {assessments.map((item) => <option key={item.id} value={item.id}>{item.title ?? humanize(item.assessment_type)}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-xs font-bold text-slate-700">
                Score run
                <select value={scoreRunId} onChange={(event) => setScoreRunId(event.target.value)} disabled={!assessmentId} className={FIELD_CLASS}>
                  <option value="">Not linked</option>
                  {scoreRuns.map((item) => <option key={item.id} value={item.id}>{item.weighted_score.toFixed(1)}% · {formatDate(item.calculated_at.slice(0, 10))}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-xs font-bold text-slate-700">
                Field visit
                <select value={fieldVisitId} onChange={(event) => setFieldVisitId(event.target.value)} className={FIELD_CLASS}>
                  <option value="">Not linked</option>
                  {visits.map((item) => <option key={item.id} value={item.id}>{item.title ?? "Field visit"} · {humanize(item.status)}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-xs font-bold text-slate-700">
                Measurement source
                <select value={sourceType} onChange={(event) => setSourceType(event.target.value)} className={FIELD_CLASS}>
                  {INDICATOR_SOURCE_TYPES.filter((item) => ["manual", "assessment_score", "field_visit"].includes(item)).map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-xs font-bold text-slate-700">
                Measurement date <span className="text-rose-500">*</span>
                <input required name="measurement_date" type="date" value={measurementDate} onChange={(event) => setMeasurementDate(event.target.value)} className={FIELD_CLASS} />
              </label>
              <label className="space-y-2 text-xs font-bold text-slate-700">
                Measurement value <span className="text-rose-500">*</span>
                <div className="relative">
                  <input required name="measured_value" type="number" step="0.0001" value={measuredValue} onChange={(event) => setMeasuredValue(event.target.value)} className={`${FIELD_CLASS} pr-24`} placeholder="Enter value" />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[10px] font-bold text-slate-400">{display(indicator.unit_of_measure)}</span>
                </div>
              </label>
              <label className="space-y-2 text-xs font-bold text-slate-700">
                Baseline {indicator.baseline_required && <span className="text-rose-500">*</span>}
                <input required={indicator.baseline_required} name="baseline_value" type="number" step="0.0001" value={baseline} onChange={(event) => setBaseline(event.target.value)} className={FIELD_CLASS} placeholder={indicator.baseline_required ? "Required" : "Optional"} />
              </label>
              <label className="space-y-2 text-xs font-bold text-slate-700">
                Target {indicator.target_required && <span className="text-rose-500">*</span>}
                <input required={indicator.target_required} name="target_value" type="number" step="0.0001" value={target} onChange={(event) => setTarget(event.target.value)} className={FIELD_CLASS} placeholder={indicator.target_required ? "Required" : "Optional"} />
              </label>
              <div className="md:col-span-2">
                <p className="mb-2 text-xs font-bold text-slate-700">Reporting period</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="relative"><CalendarDays className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-slate-400" /><input name="reporting_period_start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className={`${FIELD_CLASS} pl-11`} aria-label="Reporting period start" /></label>
                  <label className="relative"><CalendarDays className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-slate-400" /><input name="reporting_period_end" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className={`${FIELD_CLASS} pl-11`} aria-label="Reporting period end" /></label>
                </div>
              </div>
              <ContextValue label="Notes" value={UNAVAILABLE} />
              <ContextValue label="Editable status" value={UNAVAILABLE} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <PanelHeading eyebrow="Step 03" title="Evidence Linkage Centre" description="Review scoped evidence support without creating an unsupported measurement relationship." icon={Link2} />
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <ContextValue label="Selected evidence" value={UNAVAILABLE} />
              <ContextValue label="Visible evidence records" value={evidenceAvailable ? String(visibleEvidence.length) : UNAVAILABLE} />
              <ContextValue label="Verified support records" value={evidenceAvailable ? String(verifiedEvidenceCount) : UNAVAILABLE} />
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div><p className="text-xs font-bold text-amber-900">Direct evidence linkage is unavailable</p><p className="mt-1 text-[11px] leading-5 text-amber-800">The existing measurement action does not support selecting an evidence record. No relationship will be inferred or fabricated.</p></div>
              </div>
            </div>
            {evidenceAvailable && visibleEvidence.length > 0 && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {visibleEvidence.slice(0, 6).map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{item.original_filename ?? item.file_name}</p><p className="mt-1 text-[10px] text-slate-500">{humanize(item.evidence_category ?? item.evidence_type)}</p></div>
                      <span className={cn("rounded-full px-2 py-1 text-[9px] font-bold", item.status === "verified" && item.verification_status === "verified" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>{humanize(item.verification_status)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <PanelHeading eyebrow="Step 05" title="Final Submission Section" description="Create the draft measurement using the existing server action and redirect." icon={Sparkles} />
            <div className="mt-6 rounded-2xl bg-[#07152f] p-5 text-white">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold">Save this outcome measurement as a draft</p>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-blue-100/70">After saving, you will return to the indicator workspace. The draft can then be submitted for review and verified by an authorised role under the existing lifecycle.</p>
                </div>
                <SubmitButton disabled={!ready} />
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <PanelHeading eyebrow="Step 04" title="Measurement Readiness" description="Actual client-side completion mirrors the server-required fields." icon={ShieldCheck} />
            <div className="mt-5 space-y-2">
              <ReadinessItem label="Value entered" complete={valueEntered} detail={valueEntered ? `${measuredValue} ${display(indicator.unit_of_measure)}` : "A numeric measurement value is required."} />
              <ReadinessItem label="Date or period entered" complete={dateEntered} detail={dateEntered ? periodLabel : "A measurement date is required."} />
              <ReadinessItem label="Evidence linked" complete={null} detail="Unavailable in the existing creation workflow." />
              <ReadinessItem label="Indicator context complete" complete={contextReady && baselineReady && targetReady} detail="Programme and required baseline or target context must be present." />
              <ReadinessItem label="Source validation complete" complete={sourceReady} detail={sourceType === "manual" ? "Manual source selected." : sourceType === "assessment_score" ? "Assessment and score run are required." : "A field visit is required."} />
              <ReadinessItem label="Ready to save draft" complete={ready} detail={ready ? "Existing creation validation requirements are complete." : "Complete the remaining required measurement fields."} />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-[#0c1f46] p-5 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-300">Live Measurement Preview</p>
              <p className="mt-3 text-lg font-bold">{indicator.name}</p>
              <p className="mt-2 text-xs text-blue-100/70">{selectedProgramme?.name ?? UNAVAILABLE}</p>
            </div>
            <div className="p-5">
              <div className="rounded-2xl bg-emerald-50 p-4 text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-700">Recorded value</p>
                <p className="mt-2 text-3xl font-bold text-[#0c1733]">{valueEntered ? Number(measuredValue).toLocaleString("en-NG") : UNAVAILABLE}</p>
                <p className="mt-1 text-xs font-bold text-emerald-700">{display(indicator.unit_of_measure)}</p>
              </div>
              <dl className="mt-4 space-y-3 text-[11px]">
                {[
                  ["Period / date", periodLabel],
                  ["Cohort", selectedCohort?.name ?? UNAVAILABLE],
                  ["Beneficiary", selectedMember?.msmes?.business_name ?? selectedMember?.msme_id ?? UNAVAILABLE],
                  ["Intervention", selectedIntervention?.title ?? UNAVAILABLE],
                  ["Assessment", selectedAssessment?.title ?? humanize(selectedAssessment?.assessment_type)],
                  ["Field visit", selectedVisit?.title ?? UNAVAILABLE],
                  ["Evidence support", UNAVAILABLE],
                  ["Expected lifecycle state", "Draft"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0"><dt className="text-slate-400">{label}</dt><dd className="max-w-[190px] text-right font-bold text-slate-700">{value}</dd></div>
                ))}
              </dl>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><Gauge className="h-4 w-4" /></span><div><p className="text-xs font-bold text-[#0c1733]">Verification Pathway</p><p className="mt-0.5 text-[10px] text-slate-500">Existing lifecycle states only</p></div></div>
            <div className="mt-5 space-y-2">
              {["Draft / Entered", "Submitted", "Under Review", "Verified", "Report Ready"].map((item, index) => (
                <div key={item} className="relative flex items-center gap-3">
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold", index === 0 ? "bg-[#0c1f46] text-white" : "bg-slate-100 text-slate-400")}>{index + 1}</span>
                  <p className={cn("text-[11px] font-bold", index === 0 ? "text-[#0c1733]" : "text-slate-400")}>{item}</p>
                  {index < 4 && <ArrowRight className="ml-auto h-3.5 w-3.5 rotate-90 text-slate-300" />}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3"><Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><div><p className="text-xs font-bold text-blue-900">What happens next</p><p className="mt-1 text-[10px] leading-5 text-blue-800">The server calculates progress and outcome status, saves a draft, records the creation event, and redirects to the indicator workspace. Submission remains a separate existing action.</p></div></div>
          </section>
        </aside>
      </form>
    </section>
  );
}
