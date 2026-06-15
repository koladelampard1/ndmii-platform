"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Gauge,
  Layers3,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  Network,
  PanelTop,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

const STEPS = [
  { number: 1, label: "Template Information", shortLabel: "Information", icon: FileText },
  { number: 2, label: "Programme Alignment", shortLabel: "Alignment", icon: Layers3 },
  { number: 3, label: "Question Framework", shortLabel: "Questions", icon: ListChecks },
  { number: 4, label: "Scoring & Deployment", shortLabel: "Scoring", icon: Gauge },
  { number: 5, label: "Review & Create", shortLabel: "Review", icon: ClipboardCheck },
] as const;

const FIELD_CLASS = "h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10";

type BlueprintQuestion = {
  section: string;
  question: string;
  type: string;
  category: string;
  weight: number;
  required: boolean;
  options: string[];
  scoringConfigured: boolean;
};

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function parseBlueprint(value: string) {
  const questions: BlueprintQuestion[] = [];
  let valid = true;

  for (const line of value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    const [section, question, type, category, weight, required, options, , scoringConfig] = line.split("|").map((item) => item?.trim() ?? "");
    if (!section || !question) valid = false;
    let scoringConfigured = false;
    if (scoringConfig) {
      try {
        const parsed: unknown = JSON.parse(scoringConfig);
        scoringConfigured = Boolean(parsed) && typeof parsed === "object" && !Array.isArray(parsed);
        if (!scoringConfigured) valid = false;
      } catch {
        valid = false;
      }
    }
    const parsedWeight = Number(weight);
    questions.push({
      section,
      question,
      type: type || "text",
      category,
      weight: Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1,
      required: ["yes", "true", "required", "1"].includes(required.toLowerCase()),
      options: options.split(",").map((item) => item.trim()).filter(Boolean),
      scoringConfigured,
    });
  }

  return { questions, valid: valid && questions.length > 0 };
}

function scoringBandsValid(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed);
  } catch {
    return false;
  }
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
      {pending ? "Creating template..." : "Create Assessment Template"}
    </button>
  );
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

function AvailabilityCard({
  title,
  detail,
  available,
  icon: Icon,
}: {
  title: string;
  detail: string;
  available: boolean;
  icon: LucideIcon;
}) {
  return (
    <article className={cn("rounded-2xl border p-4", available ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50/70")}>
      <div className="flex items-center justify-between gap-3">
        <span className={cn("grid h-9 w-9 place-items-center rounded-xl", available ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500")}>
          <Icon className="h-4 w-4" />
        </span>
        <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide", available ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")}>
          {available ? "Configured" : "Unavailable"}
        </span>
      </div>
      <h3 className="mt-4 text-xs font-bold text-[#0c1733]">{title}</h3>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

export function AssessmentDesignStudio({
  action,
  assessmentTypes,
  defaultBlueprint,
  defaultScoringBands,
  error,
  questionTypes,
  role,
  statuses,
  canOpenAssessments,
}: {
  action: (formData: FormData) => void | Promise<void>;
  assessmentTypes: readonly string[];
  defaultBlueprint: string;
  defaultScoringBands: string;
  error?: string;
  questionTypes: readonly string[];
  role: string;
  statuses: readonly string[];
  canOpenAssessments: boolean;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assessmentType, setAssessmentType] = useState("credit_readiness");
  const [version, setVersion] = useState("1");
  const [status, setStatus] = useState("draft");
  const [scoringBands, setScoringBands] = useState(defaultScoringBands);
  const [blueprint, setBlueprint] = useState(defaultBlueprint);

  const blueprintState = useMemo(() => parseBlueprint(blueprint), [blueprint]);
  const sectionNames = useMemo(
    () => Array.from(new Set(blueprintState.questions.map((item) => item.section).filter(Boolean))),
    [blueprintState.questions],
  );
  const responseTypes = useMemo(
    () => Array.from(new Set(blueprintState.questions.map((item) => item.type).filter(Boolean))),
    [blueprintState.questions],
  );
  const scoringValid = scoringBandsValid(scoringBands);
  const requiredFieldsComplete = Boolean(name.trim()) && Number(version) > 0 && blueprintState.valid && scoringValid;
  const scoringConfigured = scoringValid && blueprintState.questions.some((item) => item.weight > 0);
  const deploymentReady = requiredFieldsComplete && status === "active";
  const ready = requiredFieldsComplete;
  const completedRequirements = [
    Boolean(name.trim()),
    Number(version) > 0,
    blueprintState.valid,
    scoringValid,
  ].filter(Boolean).length;
  const readiness = Math.round((completedRequirements / 4) * 100);

  return (
    <section className="-m-4 min-h-screen bg-[#f4f7fb] sm:-m-5 lg:-m-7">
      <header className="relative overflow-hidden bg-[radial-gradient(circle_at_82%_18%,rgba(16,185,129,0.2),transparent_25%),linear-gradient(120deg,#07152f_0%,#0b2450_58%,#071a3c_100%)] px-5 py-7 text-white sm:px-7 lg:px-9 lg:py-9">
        <div className="absolute inset-0 opacity-20" aria-hidden="true">
          <div className="absolute right-10 top-0 h-64 w-64 rounded-full border border-white/20" />
          <div className="absolute right-24 top-12 h-40 w-40 rounded-full border border-emerald-300/30" />
        </div>
        <div className="relative mx-auto max-w-[1500px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/dashboard/impact-intelligence/assessments/templates" className="inline-flex items-center gap-2 text-xs font-semibold text-blue-100/80 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Templates
            </Link>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold">
                <BadgeCheck className="h-3.5 w-3.5 text-blue-300" /> {humanize(role)}
              </span>
              <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-bold", ready ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-400/10 text-amber-200")}>
                <ShieldCheck className="h-3.5 w-3.5" /> {ready ? "Ready to create" : "Design in progress"}
              </span>
              {canOpenAssessments && (
                <Link href="/dashboard/impact-intelligence/assessments" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-bold hover:bg-white/10">
                  <ClipboardCheck className="h-3.5 w-3.5" /> Open Assessments
                </Link>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">BOI Assessment Design Studio</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Create Assessment Template</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/75">
                Design a governed instrument for collecting programme, beneficiary, readiness, compliance, and outcome data.
              </p>
            </div>
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-100">Studio progress</span>
                <span className="font-bold text-emerald-300">Step {step} of 5</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${step * 20}%` }} />
              </div>
              <p className="mt-3 text-[10px] text-blue-100/60">Creation remains subject to existing role and server-side assessment validation.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-7">
        <nav aria-label="Assessment template creation steps" className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto">
          {STEPS.map((item) => {
            const Icon = item.icon;
            const active = step === item.number;
            const complete = step > item.number;
            return (
              <button
                key={item.number}
                type="button"
                onClick={() => setStep(item.number)}
                className={cn(
                  "flex min-w-max flex-1 items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                  active ? "border-[#0c1f46] bg-[#0c1f46] text-white shadow-md" : complete ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                )}
              >
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", active ? "bg-white/10" : complete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100")}>
                  {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span>
                  <span className="block text-[9px] font-bold uppercase tracking-[0.12em] opacity-60">Step {item.number}</span>
                  <span className="mt-0.5 hidden text-xs font-bold sm:block">{item.label}</span>
                  <span className="mt-0.5 block text-xs font-bold sm:hidden">{item.shortLabel}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <form action={action} className="mx-auto grid max-w-[1500px] gap-6 p-4 sm:p-7 xl:grid-cols-[minmax(0,1fr)_360px] xl:p-9">
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="assessment_type" value={assessmentType} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="scoring_bands" value={scoringBands} />
        <input type="hidden" name="question_blueprint" value={blueprint} />

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 xl:col-span-2">
            {error}
          </div>
        )}

        <div className="min-w-0 space-y-6">
          {step === 1 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <PanelHeading eyebrow="Step 01" title="Template Information Workspace" description="Define the identity, purpose, assessment class, version, and lifecycle state of this instrument." icon={FileText} />
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <label className="space-y-2 text-xs font-bold text-slate-700 md:col-span-2">
                  Template name <span className="text-rose-500">*</span>
                  <input required value={name} onChange={(event) => setName(event.target.value)} className={FIELD_CLASS} placeholder="e.g. BOI MSME Readiness Assessment" />
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Assessment type
                  <select value={assessmentType} onChange={(event) => setAssessmentType(event.target.value)} className={FIELD_CLASS}>
                    {assessmentTypes.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Status
                  <select value={status} onChange={(event) => setStatus(event.target.value)} className={FIELD_CLASS}>
                    {statuses.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Version <span className="text-rose-500">*</span>
                  <input required type="number" min="1" value={version} onChange={(event) => setVersion(event.target.value)} className={FIELD_CLASS} />
                </label>
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Instrument class</p>
                  <p className="mt-2 text-sm font-bold text-blue-950">{humanize(assessmentType)}</p>
                  <p className="mt-1 text-[11px] leading-5 text-blue-800">Uses the existing canonical assessment type configuration.</p>
                </div>
                <label className="space-y-2 text-xs font-bold text-slate-700 md:col-span-2">
                  Description
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" placeholder="Purpose, target MSME segment, and usage notes." />
                </label>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <PanelHeading eyebrow="Step 02" title="Programme Alignment Centre" description="Review the programme context supported by the existing assessment-template workflow." icon={Layers3} />
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                <AvailabilityCard title="Linked programme" detail="Programme linkage is configured when an assessment is created, not on its template." available={false} icon={Layers3} />
                <AvailabilityCard title="Linked cohort" detail="Cohort linkage is not stored by the current template creation workflow." available={false} icon={Target} />
                <AvailabilityCard title="Linked intervention" detail="Intervention linkage is selected during assessment deployment." available={false} icon={Network} />
              </div>
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-xs font-bold text-amber-950">Deployment context remains downstream</p>
                <p className="mt-1 text-[11px] leading-5 text-amber-800">
                  This template defines a reusable instrument. Programme, cohort, beneficiary, and intervention scope are applied through the existing assessment creation workflow.
                </p>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <PanelHeading eyebrow="Step 03" title="Question Framework Centre" description="Author the supported section and question blueprint consumed by the current template engine." icon={ListChecks} />
              <div className="mt-7 grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Sections", value: sectionNames.length },
                  { label: "Questions", value: blueprintState.questions.length },
                  { label: "Required", value: blueprintState.questions.filter((item) => item.required).length },
                  { label: "Response types", value: responseTypes.length },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
                    <p className="mt-2 text-2xl font-bold text-[#0c1733]">{item.value}</p>
                  </div>
                ))}
              </div>
              <label className="mt-6 block space-y-2 text-xs font-bold text-slate-700">
                Question blueprint <span className="text-rose-500">*</span>
                <textarea required value={blueprint} onChange={(event) => setBlueprint(event.target.value)} rows={14} className="w-full rounded-xl border border-slate-200 bg-slate-950 px-4 py-4 font-mono text-xs font-normal leading-6 text-slate-100 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                <span className="block text-[11px] font-normal leading-5 text-slate-500">
                  One question per line: Section | Question | Type | Category | Weight | Required yes/no | Options comma list | Help text | Optional scoring config JSON.
                </span>
              </label>
              <div className="mt-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Supported response types</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {questionTypes.map((item) => (
                    <span key={item} className={cn("rounded-full border px-3 py-1.5 text-[10px] font-bold", responseTypes.includes(item) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500")}>
                      {humanize(item)}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <PanelHeading eyebrow="Step 04" title="Scoring & Deployment Centre" description="Configure the supported readiness bands and review deployment signals derived from the template status." icon={Gauge} />
              <label className="mt-7 block space-y-2 text-xs font-bold text-slate-700">
                Scoring bands
                <textarea value={scoringBands} onChange={(event) => setScoringBands(event.target.value)} rows={9} className="w-full rounded-xl border border-slate-200 bg-slate-950 px-4 py-4 font-mono text-xs font-normal leading-6 text-slate-100 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                <span className="block text-[11px] font-normal leading-5 text-slate-500">JSON array with label, min, and max percent values. Current dashboards support low, moderate, and strong labels.</span>
              </label>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <AvailabilityCard title="Question scoring support" detail={`${blueprintState.questions.filter((item) => item.scoringConfigured).length} question(s) include explicit scoring configuration; weights remain supported for all questions.`} available={scoringConfigured} icon={Gauge} />
                <AvailabilityCard title="Deployment readiness" detail={deploymentReady ? "The template is configured as active and passes current client readiness checks." : "Set status to Active after required configuration is complete to signal deployment readiness."} available={deploymentReady} icon={FileCheck2} />
                <AvailabilityCard title="Approval requirements" detail="No approval field or approval action exists in the current template creation workflow." available={false} icon={BadgeCheck} />
                <AvailabilityCard title="Impact measurement link" detail="Assessment results can be consumed downstream; no direct indicator or analytics link is stored on template creation." available={false} icon={BarChart3} />
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-[#0c1f46] p-6 text-white sm:p-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 text-[#07162f]"><Sparkles className="h-5 w-5" /></span>
                <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Final Create Section</p>
                <h2 className="mt-2 text-2xl font-bold">Create Assessment Template</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/70">Create this instrument through the existing server action, validation, diagnostics, and detail-page redirect.</p>
              </div>
              <div className="p-6 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Template name", ready: Boolean(name.trim()) },
                    { label: "Valid version", ready: Number(version) > 0 },
                    { label: "Question blueprint", ready: blueprintState.valid },
                    { label: "Scoring bands", ready: scoringValid },
                  ].map((item) => (
                    <div key={item.label} className={cn("flex items-center gap-3 rounded-xl border p-3", item.ready ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50")}>
                      {item.ready ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-rose-600" />}
                      <span className="text-xs font-bold text-slate-700">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-7 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <LockKeyhole className="h-4 w-4 text-slate-400" />
                    Existing RBAC and server-side validation remain authoritative.
                  </div>
                  <SubmitButton disabled={!ready} />
                </div>
              </div>
            </section>
          )}

          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:invisible">
              <ArrowLeft className="h-4 w-4" /> Previous
            </button>
            {step < 5 && (
              <button type="button" onClick={() => setStep((current) => Math.min(5, current + 1))} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0c1f46] px-5 text-xs font-bold text-white shadow-sm hover:bg-[#132d60]">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Assessment Readiness</p>
                <p className="mt-1 text-lg font-bold text-[#0c1733]">{ready ? "Ready to create" : "In progress"}</p>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#0c1f46] text-sm font-bold text-white">{readiness}%</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${readiness}%` }} />
            </div>
            <div className="mt-5 space-y-3">
              {[
                { label: "Required fields complete", state: requiredFieldsComplete, unavailable: false },
                { label: "Programme linked", state: false, unavailable: true },
                { label: "Scoring configured", state: scoringConfigured, unavailable: false },
                { label: "Deployment ready", state: deploymentReady, unavailable: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600">{item.label}</span>
                  {item.unavailable ? <span className="text-[10px] font-bold text-slate-400">Unavailable</span> : item.state ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-[10px] font-bold text-slate-400">Not ready</span>}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><PanelTop className="h-4 w-4" /></span>
              <div>
                <p className="text-xs font-bold text-[#0c1733]">Live Assessment Preview</p>
                <p className="text-[10px] text-slate-400">Updates from supported fields</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-indigo-700">{humanize(assessmentType)}</span>
                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">Version {version || "Unavailable"}</span>
              </div>
              <h3 className="mt-4 text-sm font-bold leading-5 text-[#0c1733]">{name.trim() || "Untitled assessment template"}</h3>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">{description.trim() || "Assessment purpose and usage notes will appear here."}</p>
              <dl className="mt-4 space-y-3 border-t border-slate-200 pt-4 text-[11px]">
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Programme context</dt><dd className="text-right font-bold text-slate-400">Applied at deployment</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Expected structure</dt><dd className="text-right font-bold text-slate-700">{sectionNames.length} sections · {blueprintState.questions.length} questions</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Readiness state</dt><dd className={cn("text-right font-bold", ready ? "text-emerald-700" : "text-amber-700")}>{ready ? "Ready to create" : "In progress"}</dd></div>
              </dl>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-4 w-4" /></span>
              <div><p className="text-xs font-bold text-[#0c1733]">Executive Validation Centre</p><p className="text-[10px] text-slate-400">Configuration-derived status only</p></div>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { label: "Completeness", value: requiredFieldsComplete ? "Complete" : "Action required", ready: requiredFieldsComplete },
                { label: "Governance readiness", value: "Unavailable", ready: null },
                { label: "Reporting readiness", value: blueprintState.valid ? "Structure available" : "Action required", ready: blueprintState.valid },
                { label: "Analytics readiness", value: scoringConfigured ? "Scoring available" : "Action required", ready: scoringConfigured },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                  <span className="text-[11px] font-semibold text-slate-600">{item.label}</span>
                  <span className={cn("text-[10px] font-bold", item.ready === true ? "text-emerald-700" : item.ready === false ? "text-rose-700" : "text-slate-400")}>{item.value}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </form>
    </section>
  );
}
