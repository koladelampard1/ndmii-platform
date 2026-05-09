"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, Download, FileClock, FilePlus2, Loader2, Save, Sparkles } from "lucide-react";
import type { BusinessPlanSession, BusinessPlanVersion } from "@/lib/data/business-plan";
import type { BusinessPlanAnswers, BusinessPlanPurpose, GeneratedBusinessPlan } from "@/lib/msme/business-plan-generator";

type Question = {
  key: string;
  label: string;
  hint?: string;
  textarea?: boolean;
};

type WizardSection = {
  title: string;
  description: string;
  questions: Question[];
};

const purposeOptions: { value: BusinessPlanPurpose; label: string }[] = [
  { value: "loan_application", label: "Loan application" },
  { value: "grant_application", label: "Grant application" },
  { value: "investor_pitch", label: "Investor pitch" },
  { value: "internal_planning", label: "Internal planning" },
];

const sections: WizardSection[] = [
  {
    title: "Business Basics",
    description: "Core identity and formalization details.",
    questions: [
      { key: "registeredBusinessName", label: "Registered or trading business name" },
      { key: "ownerName", label: "Business owner or principal contact" },
      { key: "sector", label: "Business sector or industry" },
      { key: "location", label: "Primary business location and states served" },
      { key: "registrationStatus", label: "Informal/formal registration status, CAC status, and TIN status", textarea: true },
    ],
  },
  {
    title: "Products and Services",
    description: "What the business sells and how it delivers quality.",
    questions: [
      { key: "products", label: "Main products or services", textarea: true },
      { key: "pricing", label: "Pricing approach and typical order value" },
      { key: "qualityControls", label: "Quality, packaging, compliance, or warranty practices", textarea: true },
    ],
  },
  {
    title: "Customers and Market",
    description: "Who buys from the business and why demand exists.",
    questions: [
      { key: "targetCustomers", label: "Target customers", textarea: true },
      { key: "customerProblem", label: "Customer problem or need being solved", textarea: true },
      { key: "solution", label: "How the business solves the problem", textarea: true },
      { key: "marketOpportunity", label: "Market opportunity in your locality, state, or sector", textarea: true },
      { key: "customerAcquisition", label: "How customers currently find or buy from you" },
    ],
  },
  {
    title: "Competitor Landscape",
    description: "Comparable businesses and your advantage.",
    questions: [
      { key: "competitors", label: "Known competitors or substitutes", textarea: true },
      { key: "competitiveAdvantage", label: "Why customers should choose your business", textarea: true },
      { key: "customerDecisionFactors", label: "What customers compare before buying" },
    ],
  },
  {
    title: "Operations",
    description: "Suppliers, logistics, distribution, and bottlenecks.",
    questions: [
      { key: "operationsModel", label: "How daily operations work", textarea: true },
      { key: "suppliers", label: "Supplier structure and key input sources", textarea: true },
      { key: "logistics", label: "Logistics, delivery, market access, or distribution approach", textarea: true },
      { key: "operationalChallenges", label: "Current operational challenges", textarea: true },
    ],
  },
  {
    title: "Sales and Marketing",
    description: "Sales channels and customer growth plan.",
    questions: [
      { key: "salesChannels", label: "Sales channels: shop, market, WhatsApp, agents, online, distributors", textarea: true },
      { key: "marketingApproach", label: "Marketing approach and promotions", textarea: true },
      { key: "monthlySales", label: "Reported monthly sales or sales range" },
      { key: "dailySales", label: "Reported daily sales or average daily transactions" },
    ],
  },
  {
    title: "Team and Management",
    description: "People, skills, and management responsibilities.",
    questions: [
      { key: "teamStructure", label: "Management and team structure", textarea: true },
      { key: "staffCount", label: "Current staff count, including casual or seasonal workers" },
      { key: "skillsNeeded", label: "Skills, advisory support, or hiring gaps", textarea: true },
    ],
  },
  {
    title: "Financial Assumptions",
    description: "Owner-reported figures only. DBIN will not estimate missing numbers.",
    questions: [
      { key: "monthlyCosts", label: "Reported monthly operating costs" },
      { key: "recordKeeping", label: "Record keeping approach: notebook, POS, spreadsheet, accounting app, bank statements", textarea: true },
      { key: "expansionPlans", label: "Expansion plans and expected revenue impact", textarea: true },
    ],
  },
  {
    title: "Funding Requirements",
    description: "Capital gap and intended use of funds.",
    questions: [
      { key: "fundingAmount", label: "Funding amount requested or financing gap" },
      { key: "fundingUse", label: "How the funds will be used", textarea: true },
      { key: "repaymentPlan", label: "Repayment plan, revenue support, or sustainability plan", textarea: true },
    ],
  },
  {
    title: "Risks and Mitigation",
    description: "Practical risks and how the business will reduce them.",
    questions: [
      { key: "risks", label: "Key risks: prices, FX, power, transport, regulation, demand, security", textarea: true },
      { key: "mitigation", label: "Mitigation plan for those risks", textarea: true },
    ],
  },
  {
    title: "90-Day Execution Plan",
    description: "Concrete actions for the next quarter.",
    questions: [
      { key: "ninetyDayPlan", label: "90-day action plan with milestones", textarea: true },
      { key: "prioritySupport", label: "Priority support required from lenders, cooperatives, associations, or DBIN", textarea: true },
    ],
  },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function countAnswered(answers: BusinessPlanAnswers) {
  const total = sections.reduce((sum, section) => sum + section.questions.length, 0);
  const answered = sections.flatMap((section) => section.questions).filter((question) => answers[question.key]?.trim()).length;
  return { answered, total, percent: Math.round((answered / total) * 100) };
}

export function BusinessPlanBuilderClient({
  initialSession,
  initialSessions,
  initialVersions,
}: {
  initialSession: BusinessPlanSession;
  initialSessions: BusinessPlanSession[];
  initialVersions: BusinessPlanVersion[];
}) {
  const [session, setSession] = useState(initialSession);
  const [sessions, setSessions] = useState(initialSessions);
  const [versions, setVersions] = useState(initialVersions);
  const [answers, setAnswers] = useState<BusinessPlanAnswers>(initialSession.answers_json ?? {});
  const [purpose, setPurpose] = useState<BusinessPlanPurpose>(initialSession.purpose);
  const [activeStep, setActiveStep] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [isPending, startTransition] = useTransition();
  const lastSaved = useRef(JSON.stringify({ answers: initialSession.answers_json, purpose: initialSession.purpose }));

  const completion = useMemo(() => countAnswered(answers), [answers]);
  const activeSection = sections[activeStep];
  const generatedPlan = session.generated_plan_json as GeneratedBusinessPlan | null;

  useEffect(() => {
    const payload = JSON.stringify({ answers, purpose });
    if (payload === lastSaved.current) return;

    setSaveState("saving");
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/msme/business-plan/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        if (!response.ok) throw new Error("Save failed");
        const data = await response.json();
        setSession(data.session);
        lastSaved.current = payload;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [answers, purpose, session.id]);

  function updateAnswer(key: string, value: string) {
    setAnswers((current) => ({ ...current, [key]: value.slice(0, 1600) }));
  }

  async function createNewDraft() {
    const response = await fetch("/api/msme/business-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose }),
    });
    if (!response.ok) return;
    const data = await response.json();
    setSession(data.session);
    setSessions((current) => [data.session, ...current]);
    setVersions([]);
    setAnswers({});
    setPurpose(data.session.purpose);
    setActiveStep(0);
    lastSaved.current = JSON.stringify({ answers: {}, purpose: data.session.purpose });
  }

  async function loadSession(sessionId: string) {
    const response = await fetch(`/api/msme/business-plan/${sessionId}`);
    if (!response.ok) return;
    const data = await response.json();
    setSession(data.session);
    setVersions(data.versions ?? []);
    setAnswers(data.session.answers_json ?? {});
    setPurpose(data.session.purpose);
    setActiveStep(0);
    lastSaved.current = JSON.stringify({ answers: data.session.answers_json ?? {}, purpose: data.session.purpose });
    setSaveState("saved");
  }

  function generatePlan() {
    startTransition(async () => {
      const response = await fetch(`/api/msme/business-plan/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "generate", answers, purpose }),
      });
      if (!response.ok) {
        setSaveState("error");
        return;
      }
      const data = await response.json();
      setSession(data.session);
      setVersions(data.versions ?? []);
      setSessions((current) => [data.session, ...current.filter((item) => item.id !== data.session.id)]);
      lastSaved.current = JSON.stringify({ answers: data.session.answers_json ?? {}, purpose: data.session.purpose });
      setSaveState("saved");
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Plan Sessions</h2>
              <p className="mt-1 text-xs text-slate-500">Drafts and generated plans are versioned.</p>
            </div>
            <button type="button" onClick={createNewDraft} className="rounded-lg border border-emerald-200 p-2 text-emerald-700 transition hover:bg-emerald-50" aria-label="Create new business plan draft">
              <FilePlus2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {sessions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => loadSession(item.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  item.id === session.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{item.business_name || "Business plan"}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.status === "generated" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {item.status}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-slate-500">Updated {formatDate(item.updated_at)}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Progress</h3>
          <div className="mt-3 h-2.5 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${completion.percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{completion.answered} of {completion.total} questions answered</p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
            {saveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saveState === "saved" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Save className="h-3.5 w-3.5 text-red-500" />}
            {saveState === "saving" ? "Saving draft" : saveState === "saved" ? "Draft saved" : "Save failed"}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileClock className="h-4 w-4 text-emerald-700" />
            Version History
          </h3>
          <div className="mt-3 space-y-2 text-sm">
            {versions.length ? versions.map((version) => (
              <div key={version.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-800">Version {version.version_number}</p>
                <p className="text-xs text-slate-500">{formatDate(version.created_at)}</p>
              </div>
            )) : <p className="text-sm text-slate-500">Generate a plan to create the first version.</p>}
          </div>
        </article>
      </aside>

      <div className="space-y-5">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Guided Plan Wizard</h2>
                <p className="mt-1 text-sm text-slate-500">Step {activeStep + 1} of {sections.length}: {activeSection.title}</p>
              </div>
              <select
                value={purpose}
                onChange={(event) => setPurpose(event.target.value as BusinessPlanPurpose)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                {purposeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {sections.map((section, index) => (
                <button
                  key={section.title}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    activeStep === index ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {index + 1}. {section.title}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <h3 className="font-semibold text-emerald-950">{activeSection.title}</h3>
              <p className="mt-1 text-sm text-emerald-900/80">{activeSection.description}</p>
            </div>

            <div className="mt-5 grid gap-4">
              {activeSection.questions.map((question) => (
                <label key={question.key} className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-800">{question.label}</span>
                  {question.textarea ? (
                    <textarea
                      value={answers[question.key] ?? ""}
                      onChange={(event) => updateAnswer(question.key, event.target.value)}
                      rows={4}
                      className="resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  ) : (
                    <input
                      value={answers[question.key] ?? ""}
                      onChange={(event) => updateAnswer(question.key, event.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  )}
                  {question.hint ? <span className="text-xs text-slate-500">{question.hint}</span> : null}
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
                disabled={activeStep === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generatePlan}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-70"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate Plan
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep((step) => Math.min(sections.length - 1, step + 1))}
                  disabled={activeStep === sections.length - 1}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Business Plan Preview</h2>
              <p className="mt-1 text-sm text-slate-500">
                {generatedPlan ? `Generated ${formatDate(generatedPlan.generatedAt)}` : "Generate a plan to preview the structured document."}
              </p>
            </div>
            <a
              href={generatedPlan ? `/api/msme/business-plan/${session.id}/pdf` : undefined}
              aria-disabled={!generatedPlan}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                generatedPlan ? "bg-slate-900 text-white transition hover:bg-slate-800" : "pointer-events-none bg-slate-100 text-slate-400"
              }`}
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </div>

          {generatedPlan ? (
            <div className="mx-auto mt-5 max-w-4xl rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm print:border-0 print:shadow-none sm:p-8">
              <div className="border-b border-emerald-200 pb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">DBIN Business Plan</p>
                <h3 className="mt-2 text-3xl font-bold tracking-tight">{generatedPlan.businessName}</h3>
                <p className="mt-2 text-sm text-slate-500">DBIN/MSME ID: {generatedPlan.msmeId} | Generated: {formatDate(generatedPlan.generatedAt)}</p>
              </div>
              <div className="mt-6 space-y-7">
                {generatedPlan.sections.map((section) => (
                  <section key={section.title}>
                    <h4 className="text-lg font-bold text-emerald-800">{section.title}</h4>
                    <div className="mt-2 space-y-2 text-sm leading-7 text-slate-700">
                      {section.body.map((paragraph, index) => <p key={`${section.title}-${index}`}>{paragraph}</p>)}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Your generated business plan preview will appear here.
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
