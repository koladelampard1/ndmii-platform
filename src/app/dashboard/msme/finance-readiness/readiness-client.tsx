"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BadgeCheck, BarChart3, CheckCircle2, CircleDollarSign, Download, Landmark, PiggyBank } from "lucide-react";
import {
  FINANCE_READINESS_QUESTIONS,
  prettyCategory,
  type AssessmentCategory,
  type AssessmentQuestion,
  type AutoSignals,
  type FinanceReadinessResult,
} from "@/lib/finance-readiness";

type SubmitResponse = {
  ok: boolean;
  assessmentId?: string;
  createdAt?: string;
  businessName?: string;
  dbinId?: string;
  autoSignals?: AutoSignals;
  result?: FinanceReadinessResult;
  message?: string;
};

type Props = {
  businessName: string;
  dbinId: string;
  autoSignals: AutoSignals;
};

const pathways = [
  { label: "Loan Readiness", icon: Landmark, tone: "from-emerald-600 to-emerald-500" },
  { label: "Grant Readiness", icon: PiggyBank, tone: "from-teal-600 to-teal-500" },
  { label: "Investment Readiness", icon: CircleDollarSign, tone: "from-lime-600 to-emerald-500" },
];

function categoryLabel(question: AssessmentQuestion) {
  return prettyCategory(question.category);
}

function questionsByCategory() {
  const grouped = new Map<AssessmentCategory, AssessmentQuestion[]>();
  for (const question of FINANCE_READINESS_QUESTIONS) {
    const existing = grouped.get(question.category) ?? [];
    existing.push(question);
    grouped.set(question.category, existing);
  }
  return grouped;
}

function downloadSimplePdf(fileName: string, lines: string[]) {
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const content = ["BT", "/F1 11 Tf", "40 800 Td"];
  lines.forEach((line, index) => {
    if (index > 0) content.push("0 -16 Td");
    content.push(`(${escape(line)}) Tj`);
  });
  content.push("ET");

  const stream = content.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];

  let cursor = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const object of objects) {
    offsets.push(cursor.length);
    cursor += `${object}\n`;
  }

  const xrefOffset = cursor.length;
  cursor += `xref\n0 ${objects.length + 1}\n`;
  cursor += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    cursor += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  cursor += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([new TextEncoder().encode(cursor)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function FinanceReadinessClient({ businessName, dbinId, autoSignals }: Props) {
  const groupedQuestions = useMemo(() => questionsByCategory(), []);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<{ createdAt: string; assessmentId: string } | null>(null);
  const [result, setResult] = useState<FinanceReadinessResult | null>(null);

  const completion = Math.round((Object.values(responses).filter((value) => value.trim()).length / FINANCE_READINESS_QUESTIONS.length) * 100);

  const handleChange = (questionId: string, value: string) => {
    setResponses((current) => ({ ...current, [questionId]: value }));
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/finance-readiness/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ responses }),
      });
      const data = (await response.json()) as SubmitResponse;

      if (!response.ok || !data.ok || !data.result || !data.assessmentId || !data.createdAt) {
        throw new Error(data.message || "Unable to complete finance readiness assessment.");
      }

      setResult(data.result);
      setReportMeta({ assessmentId: data.assessmentId, createdAt: data.createdAt });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  const signalCards = [
    { label: "Verification", value: autoSignals.verificationStatus?.replaceAll("_", " ") ?? "pending" },
    { label: "Profile completion", value: `${autoSignals.profileCompletion}%` },
    { label: "Open complaints", value: `${autoSignals.openComplaints}` },
    { label: "Tax profile", value: autoSignals.taxProfileStatus ?? "pending" },
    { label: "Compliance score", value: autoSignals.complianceScore !== null ? `${autoSignals.complianceScore}/100` : "No data" },
    { label: "Invoices / Payments", value: `${autoSignals.invoicesIssued} / ${autoSignals.paymentsRecorded}` },
  ];

  return (
    <section className="space-y-6 pb-8">
      <header className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm sm:p-7">
        <h1 className="text-2xl font-semibold tracking-tight text-emerald-950 sm:text-3xl">Access to Finance Readiness</h1>
        <p className="mt-2 max-w-3xl text-sm text-emerald-900/80 sm:text-base">
          Check your business readiness for loans, grants, investment, and procurement opportunities.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {pathways.map((pathway) => {
            const Icon = pathway.icon;
            return (
              <article key={pathway.label} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                <div className={`inline-flex rounded-xl bg-gradient-to-r ${pathway.tone} p-2 text-white`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">{pathway.label}</p>
                <p className="mt-1 text-xs text-slate-600">Powered by one shared AFRI scoring engine.</p>
              </article>
            );
          })}
        </div>
      </header>

      {!result ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Assessment progress</span>
              <span className="font-semibold text-emerald-700">{completion}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-emerald-600 transition-all" style={{ width: `${completion}%` }} />
            </div>
          </div>

          {(Array.from(groupedQuestions.entries()) as Array<[AssessmentCategory, AssessmentQuestion[]]>).map(([category, questions]) => (
            <article key={category} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{prettyCategory(category)}</h2>
              <p className="mb-4 mt-1 text-xs uppercase tracking-wide text-emerald-700">{questions.length} checks</p>
              <div className="grid gap-4 md:grid-cols-2">
                {questions.map((question) => (
                  <label key={question.id} className="space-y-1.5 text-sm">
                    <span className="font-medium text-slate-800">{question.label}</span>
                    {question.type === "yes_no" ? (
                      <select
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                        value={responses[question.id] ?? ""}
                        onChange={(event) => handleChange(question.id, event.target.value)}
                        required
                      >
                        <option value="">Select</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    ) : question.type === "short_text" ? (
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                        value={responses[question.id] ?? ""}
                        onChange={(event) => handleChange(question.id, event.target.value)}
                        placeholder="Brief response"
                      />
                    ) : (
                      <select
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                        value={responses[question.id] ?? ""}
                        onChange={(event) => handleChange(question.id, event.target.value)}
                        required
                      >
                        <option value="">Select</option>
                        {question.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    )}
                    <span className="text-xs text-slate-500">Pathway relevance: {categoryLabel(question)}</span>
                  </label>
                ))}
              </div>
            </article>
          ))}

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Auto-computed DBIN signals</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {signalCards.map((signal) => (
                <div key={signal.label} className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-700">{signal.label}</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-950 capitalize">{signal.value}</p>
                </div>
              ))}
            </div>
          </article>

          {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Submitting..." : "Submit Assessment"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <section className="space-y-5">
          <article className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-700">AFRI Total Score</p>
                <p className="text-4xl font-bold tracking-tight text-emerald-950">{result.totalScore}/100</p>
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <BadgeCheck className="h-3.5 w-3.5" /> {result.band} Readiness Band
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const generatedDate = reportMeta?.createdAt ? new Date(reportMeta.createdAt).toLocaleDateString("en-NG") : new Date().toLocaleDateString("en-NG");
                  const lines = [
                    "DBIN Access to Finance Readiness Report",
                    `Business: ${businessName}`,
                    `DBIN ID: ${dbinId}`,
                    `Date generated: ${generatedDate}`,
                    `AFRI score: ${result.totalScore}/100 (${result.band})`,
                    `Identity: ${result.breakdown.identity}/20`,
                    `Financial Discipline: ${result.breakdown.financial_discipline}/20`,
                    `Compliance: ${result.breakdown.compliance}/20`,
                    `Operational Stability: ${result.breakdown.operational_stability}/20`,
                    `Growth Preparedness: ${result.breakdown.growth_preparedness}/20`,
                    `Recommendations: ${result.recommendations.join(" | ")}`,
                    `Risk flags: ${result.riskFlags.length ? result.riskFlags.join(" | ") : "None"}`,
                    "QR/verification: Placeholder (use existing DBIN verification QR utility if enabled).",
                  ];
                  downloadSimplePdf(`finance-readiness-${dbinId}.pdf`, lines);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                <Download className="h-4 w-4" /> Download PDF Report
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(Object.entries(result.breakdown) as Array<[AssessmentCategory, number]>).map(([category, value]) => (
                <div key={category} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{prettyCategory(category)}</p>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${(value / 20) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{value}/20</p>
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Top strengths
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {result.strengths.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </article>
            <article className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <BarChart3 className="h-4 w-4" /> Top gaps
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {result.gaps.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </article>
            <article className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-rose-800">
                <AlertTriangle className="h-4 w-4" /> Risk flags
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {result.riskFlags.length ? result.riskFlags.map((item) => <li key={item}>• {item}</li>) : <li>• No immediate risk flag detected.</li>}
              </ul>
            </article>
          </div>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Recommended next actions</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {result.recommendations.map((recommendation) => (
                <li key={recommendation}>• {recommendation}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Assessment reference: {reportMeta?.assessmentId}</p>
          </article>
        </section>
      )}
    </section>
  );
}
