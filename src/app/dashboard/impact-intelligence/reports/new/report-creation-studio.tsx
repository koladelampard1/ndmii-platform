"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileArchive,
  FileCheck2,
  FileText,
  Gauge,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useFormStatus } from "react-dom";
import { REPORT_PHASE1A_TYPES, type ReportFormOptions } from "@/lib/data/impact-reports";
import { cn } from "@/lib/utils";

type SourceKey = "assessments" | "monitoring" | "evidence" | "indicators" | "intelligence";

const STEPS = [
  { number: 1, label: "Report Information", shortLabel: "Information", icon: FileText },
  { number: 2, label: "Programme Selection", shortLabel: "Programme", icon: Layers3 },
  { number: 3, label: "Data Sources", shortLabel: "Sources", icon: Database },
  { number: 4, label: "Validation", shortLabel: "Validation", icon: ShieldCheck },
  { number: 5, label: "Generate Draft", shortLabel: "Generate", icon: Sparkles },
] as const;

const SOURCES: Array<{
  key: SourceKey;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}> = [
  { key: "assessments", title: "Assessments", description: "Approved assessment records and review score runs.", icon: ClipboardCheck, tone: "bg-blue-50 text-blue-700" },
  { key: "monitoring", title: "Monitoring", description: "Reviewed field visits and programme monitoring findings.", icon: BarChart3, tone: "bg-cyan-50 text-cyan-700" },
  { key: "evidence", title: "Evidence", description: "Verified files with complete integrity and storage records.", icon: FileArchive, tone: "bg-amber-50 text-amber-700" },
  { key: "indicators", title: "Indicators", description: "Verified measurements used for official impact claims.", icon: Target, tone: "bg-violet-50 text-violet-700" },
  { key: "intelligence", title: "Intelligence", description: "Derived institutional analysis from eligible scope data.", icon: Radar, tone: "bg-emerald-50 text-emerald-700" },
];

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 text-sm font-bold text-[#07162f] shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {pending ? "Creating draft..." : "Generate Report Draft"}
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

export function ReportCreationStudio({
  options,
  action,
  error,
}: {
  options: ReportFormOptions;
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
}) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [reportType, setReportType] = useState<(typeof REPORT_PHASE1A_TYPES)[number]>("programme_performance");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [interventionId, setInterventionId] = useState("");
  const [sources, setSources] = useState<Record<SourceKey, boolean>>({
    assessments: true,
    monitoring: true,
    evidence: true,
    indicators: true,
    intelligence: true,
  });

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
  const selectedProgramme = options.programmes.find((item) => item.id === programmeId) ?? null;
  const selectedCohort = cohorts.find((item) => item.id === cohortId) ?? null;
  const selectedIntervention = interventions.find((item) => item.id === interventionId) ?? null;
  const selectedSources = SOURCES.filter((item) => sources[item.key]);
  const metadataReady = title.trim().length > 0;
  const scopeReady = Boolean(programmeId);
  const sourcesReady = selectedSources.length > 0;
  const ready = metadataReady && scopeReady && sourcesReady;
  const completedRequirements = [metadataReady, scopeReady, sourcesReady].filter(Boolean).length;
  const readiness = Math.round((completedRequirements / 3) * 100);
  const summary = [
    periodStart || periodEnd ? `Reporting period: ${periodStart || "Not specified"} to ${periodEnd || "Not specified"}.` : "",
    notes.trim(),
  ].filter(Boolean).join("\n\n");

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

  function goNext() {
    setStep((current) => Math.min(current + 1, 5));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 1));
  }

  return (
    <section className="-m-4 min-h-screen bg-[#f4f7fb] sm:-m-5 lg:-m-7">
      <header className="relative overflow-hidden bg-[radial-gradient(circle_at_82%_18%,rgba(16,185,129,0.2),transparent_25%),linear-gradient(120deg,#07152f_0%,#0b2450_58%,#071a3c_100%)] px-5 py-7 text-white sm:px-7 lg:px-9 lg:py-9">
        <div className="absolute inset-0 opacity-20" aria-hidden="true">
          <div className="absolute right-10 top-0 h-64 w-64 rounded-full border border-white/20" />
          <div className="absolute right-24 top-12 h-40 w-40 rounded-full border border-emerald-300/30" />
        </div>
        <div className="relative mx-auto max-w-[1500px]">
          <Link href="/dashboard/impact-intelligence/reports" className="inline-flex items-center gap-2 text-xs font-semibold text-blue-100/80 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Institutional Reports
          </Link>
          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Report Creation Studio</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Create Institutional Report</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/75">
                Build a governed programme report through a guided scope, source, validation, and draft-generation workflow.
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
              <p className="mt-3 text-[10px] text-blue-100/60">Draft creation remains subject to programme scope and role permissions.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-7">
        <nav aria-label="Report creation steps" className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto">
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
        <input type="hidden" name="msme_id" value={selectedMember?.msme_id ?? ""} />
        <input type="hidden" name="summary" value={summary} />
        {SOURCES.map((source) => (
          <input key={source.key} type="hidden" name="source_preferences" value={sources[source.key] ? source.key : ""} />
        ))}

        <div className="min-w-0 space-y-6">
          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</div>}

          {step === 1 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <PanelHeading eyebrow="Step 01" title="Report Metadata Workspace" description="Establish the executive identity, period, and institutional context for this report." icon={FileText} />
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <label className="space-y-2 text-xs font-bold text-slate-700 md:col-span-2">
                  Report title <span className="text-rose-500">*</span>
                  <input required name="title" value={title} onChange={(event) => setTitle(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" placeholder="e.g. BOI MSME Growth Programme Performance Report" />
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Report type
                  <select name="report_type" value={reportType} onChange={(event) => setReportType(event.target.value as typeof reportType)} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10">
                    {REPORT_PHASE1A_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
                  </select>
                </label>
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-slate-700">Reporting period</span>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="relative">
                      <span className="sr-only">Reporting period start</span>
                      <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                      <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-2 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500 focus:bg-white" />
                    </label>
                    <label>
                      <span className="sr-only">Reporting period end</span>
                      <input type="date" min={periodStart || undefined} value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500 focus:bg-white" />
                    </label>
                  </div>
                </div>
                <label className="space-y-2 text-xs font-bold text-slate-700 md:col-span-2">
                  Executive notes
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-normal leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" placeholder="Purpose, audience, reporting context, or decisions this report should support." />
                </label>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <PanelHeading eyebrow="Step 02" title="Programme Selection" description="Define the governed reporting scope. Each selection narrows the eligible records available to the report engine." icon={Layers3} />
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <label className="space-y-2 text-xs font-bold text-slate-700 md:col-span-2">
                  Programme <span className="text-rose-500">*</span>
                  <select required name="programme_id" value={programmeId} onChange={(event) => changeProgramme(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10">
                    <option value="">Select an authorised programme</option>
                    {options.programmes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.programme_code ? ` · ${item.programme_code}` : ""}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Beneficiary cohort
                  <select name="cohort_id" value={cohortId} onChange={(event) => changeCohort(event.target.value)} disabled={!programmeId} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                    <option value="">{programmeId ? "All programme cohorts" : "Select programme first"}</option>
                    {cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700">
                  Beneficiary / MSME
                  <select name="cohort_member_id" value={memberId} onChange={(event) => changeMember(event.target.value)} disabled={!cohortId} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                    <option value="">{cohortId ? "All cohort beneficiaries" : "Select cohort first"}</option>
                    {members.map((item) => <option key={item.id} value={item.id}>{item.msmes?.business_name ?? "Unknown MSME"} ({item.msmes?.msme_id ?? item.member_status})</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-700 md:col-span-2">
                  Intervention
                  <select name="intervention_id" value={interventionId} onChange={(event) => setInterventionId(event.target.value)} disabled={!programmeId} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                    <option value="">{programmeId ? "All matching interventions" : "Select programme first"}</option>
                    {interventions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-6 flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-900">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                Only programmes and related records available within your existing role scope can be selected.
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <PanelHeading eyebrow="Step 03" title="Data Source Selection Centre" description="Choose the eligible source families to emphasise in this draft. The report engine will include only existing, validated records within the selected scope." icon={Database} />
              <div className="mt-7 grid gap-3 md:grid-cols-2">
                {SOURCES.map((source) => {
                  const Icon = source.icon;
                  const checked = sources[source.key];
                  return (
                    <button
                      key={source.key}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => setSources((current) => ({ ...current, [source.key]: !current[source.key] }))}
                      className={cn("flex items-start gap-4 rounded-2xl border p-4 text-left transition", checked ? "border-emerald-300 bg-emerald-50/50 shadow-sm" : "border-slate-200 bg-slate-50/50 hover:border-slate-300")}
                    >
                      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", source.tone)}><Icon className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-bold text-[#0c1733]">{source.title}</span>
                          <span className={cn("grid h-5 w-5 place-items-center rounded-full border", checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white")}>{checked && <Check className="h-3 w-3" />}</span>
                        </span>
                        <span className="mt-1.5 block text-xs leading-5 text-slate-500">{source.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-500">
                Source preferences guide this studio preview. Existing report generation rules remain authoritative and automatically exclude unapproved, unreviewed, or unverified records.
              </p>
            </section>
          )}

          {step === 4 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <PanelHeading eyebrow="Step 04" title="Executive Validation Centre" description="Review scope completeness and draft eligibility before creating the institutional report record." icon={ShieldCheck} />
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Source completeness", value: sourcesReady ? `${selectedSources.length} source families selected` : "No sources selected", ready: sourcesReady, icon: Database },
                  { label: "Evidence completeness", value: sources.evidence ? "Eligible evidence will be resolved" : "Evidence not selected", ready: sources.evidence, icon: FileArchive },
                  { label: "Indicator completeness", value: sources.indicators ? "Eligible indicators will be resolved" : "Indicators not selected", ready: sources.indicators, icon: Target },
                  { label: "Export eligibility", value: "Requires approved generated version", ready: false, icon: FileCheck2 },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <article key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}><Icon className="h-4 w-4" /></span>
                        <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide", item.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{item.ready ? "Complete" : "Pending"}</span>
                      </div>
                      <h3 className="mt-4 text-xs font-bold text-[#0c1733]">{item.label}</h3>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.value}</p>
                    </article>
                  );
                })}
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-[#0c1733]">Validation status</p>
                    <p className="mt-1 text-[11px] text-slate-500">{ready ? "Core draft requirements are satisfied." : "Complete the missing core requirements before generating."}</p>
                  </div>
                  <span className={cn("rounded-full px-3 py-1.5 text-[10px] font-bold", ready ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>{ready ? "Draft ready" : "Action required"}</span>
                </div>
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-[#0c1f46] p-6 text-white sm:p-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 text-[#07162f]"><Sparkles className="h-5 w-5" /></span>
                <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Final Generate Section</p>
                <h2 className="mt-2 text-2xl font-bold">Generate Report Draft</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/70">Create the governed draft record using the existing report creation workflow. Source resolution and immutable version generation continue inside the report workspace.</p>
              </div>
              <div className="p-6 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Metadata", ready: metadataReady },
                    { label: "Programme scope", ready: scopeReady },
                    { label: "Source selection", ready: sourcesReady },
                  ].map((item) => (
                    <div key={item.label} className={cn("flex items-center gap-3 rounded-xl border p-3", item.ready ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50")}>
                      {item.ready ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Gauge className="h-4 w-4 text-rose-600" />}
                      <span className="text-xs font-bold text-slate-700">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-7 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <LockKeyhole className="h-4 w-4 text-slate-400" />
                    RBAC and server-side scope validation remain enforced.
                  </div>
                  <SubmitButton disabled={!ready} />
                </div>
              </div>
            </section>
          )}

          <div className="flex items-center justify-between">
            <button type="button" onClick={goBack} disabled={step === 1} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:invisible">
              <ArrowLeft className="h-4 w-4" /> Previous
            </button>
            {step < 5 && (
              <button type="button" onClick={goNext} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0c1f46] px-5 text-xs font-bold text-white shadow-sm hover:bg-[#132d60]">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Report Readiness</p>
                <p className="mt-1 text-lg font-bold text-[#0c1733]">{ready ? "Ready for draft" : "In progress"}</p>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#0c1f46] text-sm font-bold text-white">{readiness}%</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${readiness}%` }} />
            </div>
            <div className="mt-5 space-y-3">
              {[
                { label: "Report information", ready: metadataReady },
                { label: "Programme selected", ready: scopeReady },
                { label: "Source families selected", ready: sourcesReady },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600">{item.label}</span>
                  {item.ready ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-[10px] font-bold text-amber-700">Missing</span>}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><FileCheck2 className="h-4 w-4" /></span>
              <div>
                <p className="text-xs font-bold text-[#0c1733]">Live Report Preview</p>
                <p className="text-[10px] text-slate-400">Updates as you configure the studio</p>
              </div>
            </div>
            <div className="mt-5 space-y-4 text-xs">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Report scope</p>
                <p className="mt-1.5 font-semibold leading-5 text-slate-700">{selectedProgramme?.name ?? "No programme selected"}</p>
                {(selectedCohort || selectedMember || selectedIntervention) && <p className="mt-1 text-[10px] leading-4 text-slate-500">{[selectedCohort?.name, selectedMember?.msmes?.business_name, selectedIntervention?.title].filter(Boolean).join(" · ")}</p>}
              </div>
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Expected content</p>
                <p className="mt-1.5 font-semibold leading-5 text-slate-700">{title.trim() || titleCase(reportType)}</p>
                <p className="mt-1 text-[10px] text-slate-500">{periodStart || periodEnd ? `${periodStart || "Open"} to ${periodEnd || "Open"}` : "Reporting period not specified"}</p>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Selected sources</p>
                  <span className="rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-bold text-indigo-700">{selectedSources.length} of {SOURCES.length}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedSources.map((source) => <span key={source.key} className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-600">{source.title}</span>)}
                  {selectedSources.length === 0 && <span className="text-[10px] text-rose-600">Select at least one source family.</span>}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex gap-3">
              <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <p className="text-xs font-bold text-emerald-950">Governed workflow</p>
                <p className="mt-1 text-[10px] leading-5 text-emerald-800">Drafts remain non-official until version generation, review, approval, and export eligibility checks are complete.</p>
              </div>
            </div>
          </section>
        </aside>
      </form>
    </section>
  );
}
