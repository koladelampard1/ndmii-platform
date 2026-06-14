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
  Gauge,
  Info,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Ruler,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundCheck,
} from "lucide-react";
import { useFormStatus } from "react-dom";
import {
  INDICATOR_CALCULATION_METHODS,
  INDICATOR_DEFINITION_STATUSES,
  INDICATOR_DIRECTIONS,
  type IndicatorFormOptions,
} from "@/lib/data/impact-indicators";
import { cn } from "@/lib/utils";

const STEPS = [
  { number: 1, label: "Indicator Information", shortLabel: "Information", icon: Target },
  { number: 2, label: "Outcome Alignment", shortLabel: "Alignment", icon: Layers3 },
  { number: 3, label: "Measurement Configuration", shortLabel: "Measurement", icon: Ruler },
  { number: 4, label: "Evidence & Verification", shortLabel: "Evidence", icon: ShieldCheck },
  { number: 5, label: "Review & Create", shortLabel: "Review", icon: ClipboardCheck },
] as const;

const FIELD_CLASS = "h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
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
      {pending ? "Creating indicator..." : "Create Indicator"}
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

export function IndicatorDesignStudio({
  options,
  action,
  error,
  role,
  canOpenAnalytics,
  scopeNotice,
}: {
  options: IndicatorFormOptions;
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  role: string;
  canOpenAnalytics: boolean;
  scopeNotice: string | null;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [interventionId, setInterventionId] = useState("");
  const [indicatorType, setIndicatorType] = useState("outcome");
  const [unitOfMeasure, setUnitOfMeasure] = useState("");
  const [direction, setDirection] = useState("increase");
  const [calculationMethod, setCalculationMethod] = useState("manual");
  const [frequency, setFrequency] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [status, setStatus] = useState("active");
  const [baselineRequired, setBaselineRequired] = useState(true);
  const [targetRequired, setTargetRequired] = useState(true);

  const cohorts = useMemo(
    () => options.cohorts.filter((item) => !programmeId || item.programme_id === programmeId),
    [options.cohorts, programmeId],
  );
  const interventions = useMemo(
    () => options.interventions.filter((item) => (
      (!programmeId || item.programme_id === programmeId)
      && (!cohortId || item.cohort_id === cohortId)
    )),
    [cohortId, options.interventions, programmeId],
  );
  const selectedProgramme = options.programmes.find((item) => item.id === programmeId);
  const selectedCohort = options.cohorts.find((item) => item.id === cohortId);
  const selectedIntervention = options.interventions.find((item) => item.id === interventionId);
  const selectedOwner = options.users.find((item) => item.id === ownerUserId);

  const requiredFieldsComplete = Boolean(name.trim() && unitOfMeasure.trim());
  const outcomeLinked = Boolean(programmeId || cohortId || interventionId);
  const measurementConfigured = Boolean(unitOfMeasure.trim() && direction && calculationMethod);
  const completedRequiredFields = [Boolean(name.trim()), Boolean(unitOfMeasure.trim())].filter(Boolean).length;
  const readiness = Math.round((completedRequiredFields / 2) * 100);
  const ready = requiredFieldsComplete;

  function changeProgramme(value: string) {
    setProgrammeId(value);
    setCohortId("");
    setInterventionId("");
  }

  function changeCohort(value: string) {
    setCohortId(value);
    setInterventionId("");
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
            <Link href="/dashboard/impact-intelligence/indicators" className="inline-flex items-center gap-2 text-xs font-semibold text-blue-100/80 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Indicators
            </Link>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold">
                <BadgeCheck className="h-3.5 w-3.5 text-blue-300" /> {humanize(role)}
              </span>
              <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-bold", ready ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-400/10 text-amber-200")}>
                <ShieldCheck className="h-3.5 w-3.5" /> {ready ? "Ready to create" : "Configuration in progress"}
              </span>
              {canOpenAnalytics && (
                <Link href="/dashboard/impact-intelligence/analytics" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-bold hover:bg-white/10">
                  <BarChart3 className="h-3.5 w-3.5" /> Open Analytics
                </Link>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Outcome Measurement Studio</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Create Indicator</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/75">
                Define how BOI will measure an outcome, configure its measurement method, and prepare the indicator for governed use.
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
              <p className="mt-3 text-[10px] text-blue-100/60">Creation remains subject to existing role and server-side validation.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-7">
        <nav aria-label="Indicator creation steps" className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto">
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

      <form id="indicator-design-form" action={action} className="mx-auto grid max-w-[1500px] gap-6 p-4 sm:p-7 xl:grid-cols-[minmax(0,1fr)_360px] xl:p-9">
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="programme_id" value={programmeId} />
        <input type="hidden" name="cohort_id" value={cohortId} />
        <input type="hidden" name="intervention_id" value={interventionId} />
        <input type="hidden" name="indicator_type" value={indicatorType} />
        <input type="hidden" name="unit_of_measure" value={unitOfMeasure} />
        <input type="hidden" name="direction_of_improvement" value={direction} />
        <input type="hidden" name="calculation_method" value={calculationMethod} />
        <input type="hidden" name="measurement_frequency" value={frequency} />
        <input type="hidden" name="owner_user_id" value={ownerUserId} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="baseline_required" value={baselineRequired ? "true" : ""} />
        <input type="hidden" name="target_required" value={targetRequired ? "true" : ""} />
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 xl:col-span-2">
            {error}
          </div>
        )}
        {scopeNotice && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 xl:col-span-2">
            {scopeNotice}
          </div>
        )}

        <div className="min-w-0 space-y-6">
          {step === 1 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <PanelHeading eyebrow="Step 01" title="Indicator Information Workspace" description="Establish the indicator identity and the outcome statement it is intended to evidence." icon={Target} />
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <label className="space-y-2 text-xs font-bold text-slate-700 md:col-span-2">
                  Indicator name <span className="text-rose-500">*</span>
                  <input required value={name} onChange={(event) => setName(event.target.value)} className={FIELD_CLASS} placeholder="e.g. Jobs sustained after BOI support" />
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Indicator type
                  <select value={indicatorType} onChange={(event) => setIndicatorType(event.target.value)} className={FIELD_CLASS}>
                    <option value="output">Output</option>
                    <option value="outcome">Outcome</option>
                    <option value="impact">Impact</option>
                    <option value="efficiency">Efficiency</option>
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Status
                  <select value={status} onChange={(event) => setStatus(event.target.value)} className={FIELD_CLASS}>
                    {INDICATOR_DEFINITION_STATUSES.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700 md:col-span-2">
                  Description
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" placeholder="Describe exactly what is measured and how the unit should be interpreted." />
                </label>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <PanelHeading eyebrow="Step 02" title="Outcome Alignment Centre" description="Link the definition to supported programme context. All links remain optional under the existing create workflow." icon={Layers3} />
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <label className="space-y-2 text-xs font-bold text-slate-700 md:col-span-2">
                  Linked programme
                  <select value={programmeId} onChange={(event) => changeProgramme(event.target.value)} className={FIELD_CLASS}>
                    <option value="">Portfolio-level</option>
                    {options.programmes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.programme_code ? ` · ${item.programme_code}` : ""}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Linked cohort
                  <select value={cohortId} onChange={(event) => changeCohort(event.target.value)} disabled={!programmeId} className={FIELD_CLASS}>
                    <option value="">{programmeId ? "All programme cohorts" : "Select programme first"}</option>
                    {cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Linked intervention
                  <select value={interventionId} onChange={(event) => setInterventionId(event.target.value)} disabled={!programmeId} className={FIELD_CLASS}>
                    <option value="">{programmeId ? "All matching interventions" : "Select programme first"}</option>
                    {interventions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <AvailabilityCard title="Linked outcome area" detail="The existing indicator definition workflow has no outcome-area field." available={false} icon={Target} />
                <AvailabilityCard title="Programme context" detail={outcomeLinked ? "A supported programme, cohort, or intervention link is configured." : "This definition remains portfolio-level."} available={outcomeLinked} icon={Layers3} />
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <PanelHeading eyebrow="Step 03" title="Measurement Configuration" description="Define the supported unit, direction, calculation approach, and collection frequency." icon={Ruler} />
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Unit of measure <span className="text-rose-500">*</span>
                  <input required value={unitOfMeasure} onChange={(event) => setUnitOfMeasure(event.target.value)} className={FIELD_CLASS} placeholder="jobs, %, NGN" />
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Direction of improvement
                  <select value={direction} onChange={(event) => setDirection(event.target.value)} className={FIELD_CLASS}>
                    {INDICATOR_DIRECTIONS.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Calculation method
                  <select value={calculationMethod} onChange={(event) => setCalculationMethod(event.target.value)} className={FIELD_CLASS}>
                    {INDICATOR_CALCULATION_METHODS.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Measurement frequency
                  <input value={frequency} onChange={(event) => setFrequency(event.target.value)} className={FIELD_CLASS} placeholder="Monthly, quarterly" />
                </label>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <AvailabilityCard title="Baseline value" detail="The definition stores whether a baseline is required, not a baseline value." available={false} icon={Gauge} />
                <AvailabilityCard title="Target value" detail="The definition stores whether a target is required, not a target value." available={false} icon={Target} />
                <AvailabilityCard title="Aggregation type" detail="No aggregation field exists in the current definition workflow." available={false} icon={BarChart3} />
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <PanelHeading eyebrow="Step 04" title="Evidence & Verification Centre" description="Configure the supported ownership and measurement requirements without extending the current schema." icon={ShieldCheck} />
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <label className="space-y-2 text-xs font-bold text-slate-700 md:col-span-2">
                  Indicator owner
                  <select value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)} className={FIELD_CLASS}>
                    <option value="">Unassigned</option>
                    {options.users.map((item) => <option key={item.id} value={item.id}>{item.full_name ?? item.email ?? item.id}</option>)}
                  </select>
                </label>
                <label className={cn("flex items-start gap-3 rounded-2xl border p-4", baselineRequired ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50")}>
                  <input type="checkbox" checked={baselineRequired} onChange={(event) => setBaselineRequired(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600" />
                  <span><span className="block text-xs font-bold text-slate-800">Baseline required</span><span className="mt-1 block text-[11px] leading-5 text-slate-500">Future measurements must include a baseline value.</span></span>
                </label>
                <label className={cn("flex items-start gap-3 rounded-2xl border p-4", targetRequired ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50")}>
                  <input type="checkbox" checked={targetRequired} onChange={(event) => setTargetRequired(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600" />
                  <span><span className="block text-xs font-bold text-slate-800">Target required</span><span className="mt-1 block text-[11px] leading-5 text-slate-500">Future measurements must include a target value.</span></span>
                </label>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <AvailabilityCard title="Evidence expectations" detail="Evidence requirements are not configured on indicator definitions." available={false} icon={FileCheck2} />
                <AvailabilityCard title="Verification requirements" detail="Definition creation has no verifier or verification-rule field." available={false} icon={UserRoundCheck} />
                <AvailabilityCard title="Linked assessment support" detail={calculationMethod === "assessment_score" ? "Assessment score is the selected calculation method." : "No assessment link is stored on a definition."} available={calculationMethod === "assessment_score"} icon={ClipboardCheck} />
                <AvailabilityCard title="Linked monitoring support" detail={calculationMethod === "field_observation" ? "Field observation is the selected calculation method." : "No monitoring link is stored on a definition."} available={calculationMethod === "field_observation"} icon={BadgeCheck} />
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-[#0c1f46] p-6 text-white sm:p-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 text-[#07162f]"><Sparkles className="h-5 w-5" /></span>
                <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Final Create Section</p>
                <h2 className="mt-2 text-2xl font-bold">Create Indicator</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/70">Create this definition through the existing server action, validation, scope diagnostics, and redirect workflow.</p>
              </div>
              <div className="p-6 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Indicator name", ready: Boolean(name.trim()) },
                    { label: "Unit of measure", ready: Boolean(unitOfMeasure.trim()) },
                    { label: "Measurement method", ready: measurementConfigured },
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
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Indicator Readiness</p>
                <p className="mt-1 text-lg font-bold text-[#0c1733]">{ready ? "Ready for use" : "In progress"}</p>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#0c1f46] text-sm font-bold text-white">{readiness}%</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${readiness}%` }} />
            </div>
            <div className="mt-5 space-y-3">
              {[
                { label: "Required fields complete", state: requiredFieldsComplete },
                { label: "Outcome context linked", state: outcomeLinked },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600">{item.label}</span>
                  {item.state ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-[10px] font-bold text-slate-400">Not set</span>}
                </div>
              ))}
              {["Target defined", "Evidence strategy defined", "Verification ready"].map((label) => (
                <div key={label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600">{label}</span>
                  <span className="text-[10px] font-bold text-slate-400">Unavailable</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Target className="h-4 w-4" /></span>
              <div>
                <p className="text-xs font-bold text-[#0c1733]">Live Indicator Preview</p>
                <p className="text-[10px] text-slate-400">Updates from supported fields</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-indigo-700">{humanize(indicatorType)}</span>
              <h3 className="mt-4 text-sm font-bold leading-5 text-[#0c1733]">{name.trim() || "Untitled indicator"}</h3>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">{description.trim() || "Indicator definition will appear here."}</p>
              <dl className="mt-4 space-y-3 border-t border-slate-200 pt-4 text-[11px]">
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Measurement type</dt><dd className="text-right font-bold text-slate-700">{humanize(calculationMethod)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Target</dt><dd className="text-right font-bold text-slate-400">Defined during measurement</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Programme</dt><dd className="text-right font-bold text-slate-700">{selectedProgramme?.name ?? "Portfolio-level"}</dd></div>
                {(selectedCohort || selectedIntervention) && <div className="flex justify-between gap-3"><dt className="text-slate-400">Context</dt><dd className="text-right font-bold text-slate-700">{[selectedCohort?.name, selectedIntervention?.title].filter(Boolean).join(" · ")}</dd></div>}
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
                { label: "Evidence readiness", value: "Unavailable", ready: null },
                { label: "Reporting readiness", value: "Unavailable", ready: null },
                { label: "Analytics readiness", value: "Unavailable", ready: null },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                  <span className="text-[11px] font-semibold text-slate-600">{item.label}</span>
                  <span className={cn("text-[10px] font-bold", item.ready === true ? "text-emerald-700" : item.ready === false ? "text-rose-700" : "text-slate-400")}>{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex gap-3">
              {selectedOwner ? <UserRoundCheck className="h-5 w-5 shrink-0 text-blue-700" /> : <Info className="h-5 w-5 shrink-0 text-blue-700" />}
              <div>
                <p className="text-xs font-bold text-blue-950">{selectedOwner ? "Ownership assigned" : "Governed workflow"}</p>
                <p className="mt-1 text-[10px] leading-5 text-blue-800">{selectedOwner ? `${selectedOwner.full_name ?? selectedOwner.email ?? selectedOwner.id} is selected as indicator owner.` : "Ownership is optional. Measurement verification remains governed by the existing measurement workflow."}</p>
              </div>
            </div>
          </section>
        </aside>
      </form>
    </section>
  );
}
