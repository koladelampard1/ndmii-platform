"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, BarChart3, CheckCircle2, CircleAlert, Download, Landmark, TrendingUp } from "lucide-react";
import type { AssessmentResponses, FinancePathway, MsmeReadinessSnapshot, ReadinessResult } from "modules/finance-readiness/types";

const pathwayCards: Array<{ key: FinancePathway; title: string; subtitle: string; icon: typeof Landmark }> = [
  { key: "loan", title: "Loan Readiness", subtitle: "Assess debt capacity and repayment readiness.", icon: Landmark },
  { key: "grant", title: "Grant Readiness", subtitle: "Check impact reporting and compliance readiness.", icon: BadgeCheck },
  { key: "investment", title: "Investment Readiness", subtitle: "Evaluate investor confidence indicators.", icon: TrendingUp },
];

type SubmitResponse = ReadinessResult & {
  assessmentId: string;
  pathway: FinancePathway;
  snapshot: MsmeReadinessSnapshot;
};

const defaultResponses: AssessmentResponses = {
  hasBusinessRegistration: true,
  hasFormalBankAccount: true,
  hasMonthlyRecords: false,
  bookkeepingMethod: "manual",
  hasCashflowProjection: false,
  hasRecentTaxFiling: false,
  hasVatRegistration: false,
  complianceStatus: "pending",
  hasOperatingPlan: false,
  hasDocumentedProcesses: false,
  teamSizeBand: "2_5",
  fundingAmountRange: "500k_2m",
  fundingPurpose: "",
  growthPriority: "working_capital",
};

function pathwayLabel(pathway: FinancePathway) {
  return pathwayCards.find((item) => item.key === pathway)?.title ?? "Finance Readiness";
}

export function FinanceReadinessFlow({ initialSnapshot }: { initialSnapshot: MsmeReadinessSnapshot | null }) {
  const [pathway, setPathway] = useState<FinancePathway>("loan");
  const [responses, setResponses] = useState<AssessmentResponses>(defaultResponses);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completion = useMemo(() => {
    const answers = [
      responses.hasBusinessRegistration,
      responses.hasFormalBankAccount,
      responses.hasMonthlyRecords,
      responses.bookkeepingMethod,
      responses.hasCashflowProjection,
      responses.hasRecentTaxFiling,
      responses.hasVatRegistration,
      responses.complianceStatus,
      responses.hasOperatingPlan,
      responses.hasDocumentedProcesses,
      responses.teamSizeBand,
      responses.fundingAmountRange,
      responses.fundingPurpose.trim().length > 0,
      responses.growthPriority,
    ];
    const done = answers.filter((item) => Boolean(item)).length;
    return Math.round((done / answers.length) * 100);
  }, [responses]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/finance-readiness/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathway, responses }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to submit assessment.");
      }
      setResult(payload as SubmitResponse);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function downloadReportPdf() {
    if (!result) return;
    const reportWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
    if (!reportWindow) return;

    const pathwayTitle = pathwayLabel(result.pathway);
    const generatedDate = new Date().toLocaleString();
    const strengths = result.strengths.map((item) => `<li>${item}</li>`).join("");
    const gaps = result.gaps.map((item) => `<li>${item}</li>`).join("");
    const recommendations = result.recommendations.map((item) => `<li>${item}</li>`).join("");
    const flags = result.riskFlags.length
      ? result.riskFlags.map((item) => `<li>${item}</li>`).join("")
      : "<li>No significant risk flags detected.</li>";
    const breakdownRows = result.breakdown
      .map((item) => `<tr><td>${item.label}</td><td>${item.score}/${item.maxScore}</td></tr>`)
      .join("");

    reportWindow.document.write(`<!doctype html>
      <html>
        <head><title>AFRI Report ${result.snapshot.msmeIdLabel}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}
          h1,h2{margin:0 0 8px}
          .brand{color:#166534;font-weight:700}
          .card{border:1px solid #d1fae5;border-radius:12px;padding:12px;margin-top:12px}
          table{width:100%;border-collapse:collapse;margin-top:8px}
          td,th{border:1px solid #e2e8f0;padding:8px;text-align:left}
        </style></head>
        <body>
          <p class="brand">DBIN · Access to Finance Readiness Report</p>
          <h1>${result.snapshot.businessName}</h1>
          <p>DBIN/MSME ID: ${result.snapshot.msmeIdLabel}</p>
          <p>Pathway: ${pathwayTitle}</p>
          <p>Date generated: ${generatedDate}</p>
          <div class="card"><h2>AFRI Score: ${result.score}/100 (${result.band})</h2></div>
          <div class="card"><h2>Score breakdown</h2><table><thead><tr><th>Dimension</th><th>Score</th></tr></thead><tbody>${breakdownRows}</tbody></table></div>
          <div class="card"><h2>Strengths</h2><ul>${strengths}</ul></div>
          <div class="card"><h2>Gaps</h2><ul>${gaps}</ul></div>
          <div class="card"><h2>Recommendations</h2><ul>${recommendations}</ul></div>
          <div class="card"><h2>Risk flags</h2><ul>${flags}</ul></div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>`);
    reportWindow.document.close();
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">DBIN Access to Finance</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Finance Readiness Diagnostic</h1>
        <p className="mt-1 text-sm text-slate-600">Choose a pathway, complete a short assessment, and generate your AFRI readiness report.</p>
      </header>

      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Assessment progress</p>
          <p className="text-sm font-semibold text-emerald-700">{completion}%</p>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${completion}%` }} />
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        {pathwayCards.map((card) => {
          const Icon = card.icon;
          const active = pathway === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setPathway(card.key)}
              className={`rounded-2xl border p-4 text-left transition ${active ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-emerald-700" : "text-slate-500"}`} />
              <p className="mt-2 font-semibold text-slate-900">{card.title}</p>
              <p className="mt-1 text-sm text-slate-600">{card.subtitle}</p>
            </button>
          );
        })}
      </section>

      {initialSnapshot && (
        <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <article><p className="text-xs uppercase text-slate-500">Business</p><p className="font-semibold text-slate-900">{initialSnapshot.businessName}</p></article>
          <article><p className="text-xs uppercase text-slate-500">DBIN/MSME ID</p><p className="font-semibold text-slate-900">{initialSnapshot.msmeIdLabel}</p></article>
          <article><p className="text-xs uppercase text-slate-500">Verification</p><p className="font-semibold capitalize text-slate-900">{initialSnapshot.verificationStatus}</p></article>
          <article><p className="text-xs uppercase text-slate-500">Complaints</p><p className="font-semibold text-slate-900">{initialSnapshot.openComplaints} open / {initialSnapshot.resolvedComplaints} resolved</p></article>
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-800">Section A · Business Identity</legend>
            <label className="flex items-center justify-between text-sm">Business registration available?<YesNo value={responses.hasBusinessRegistration} onChange={(value) => setResponses((prev) => ({ ...prev, hasBusinessRegistration: value }))} /></label>
            <label className="flex items-center justify-between text-sm">Formal bank account in business name?<YesNo value={responses.hasFormalBankAccount} onChange={(value) => setResponses((prev) => ({ ...prev, hasFormalBankAccount: value }))} /></label>
          </fieldset>

          <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-800">Section B · Financial Records</legend>
            <label className="flex items-center justify-between text-sm">Monthly records maintained?<YesNo value={responses.hasMonthlyRecords} onChange={(value) => setResponses((prev) => ({ ...prev, hasMonthlyRecords: value }))} /></label>
            <label className="block text-sm">Bookkeeping method
              <select className="mt-1 w-full rounded-md border p-2 text-sm" value={responses.bookkeepingMethod} onChange={(event) => setResponses((prev) => ({ ...prev, bookkeepingMethod: event.target.value as AssessmentResponses["bookkeepingMethod"] }))}>
                <option value="none">None</option><option value="manual">Manual ledger</option><option value="spreadsheet">Spreadsheet</option><option value="software">Accounting software</option>
              </select>
            </label>
            <label className="flex items-center justify-between text-sm">Cashflow projection for next 6 months?<YesNo value={responses.hasCashflowProjection} onChange={(value) => setResponses((prev) => ({ ...prev, hasCashflowProjection: value }))} /></label>
          </fieldset>

          <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-800">Section C · Tax & Compliance</legend>
            <label className="flex items-center justify-between text-sm">Recent tax filing available?<YesNo value={responses.hasRecentTaxFiling} onChange={(value) => setResponses((prev) => ({ ...prev, hasRecentTaxFiling: value }))} /></label>
            <label className="flex items-center justify-between text-sm">VAT registration active?<YesNo value={responses.hasVatRegistration} onChange={(value) => setResponses((prev) => ({ ...prev, hasVatRegistration: value }))} /></label>
            <label className="block text-sm">Compliance profile status
              <select className="mt-1 w-full rounded-md border p-2 text-sm" value={responses.complianceStatus} onChange={(event) => setResponses((prev) => ({ ...prev, complianceStatus: event.target.value as AssessmentResponses["complianceStatus"] }))}>
                <option value="pending">Pending</option><option value="partial">Partially compliant</option><option value="verified">Verified/Compliant</option>
              </select>
            </label>
          </fieldset>

          <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-800">Section D · Operations</legend>
            <label className="flex items-center justify-between text-sm">Operating plan documented?<YesNo value={responses.hasOperatingPlan} onChange={(value) => setResponses((prev) => ({ ...prev, hasOperatingPlan: value }))} /></label>
            <label className="flex items-center justify-between text-sm">Standard operating processes documented?<YesNo value={responses.hasDocumentedProcesses} onChange={(value) => setResponses((prev) => ({ ...prev, hasDocumentedProcesses: value }))} /></label>
            <label className="block text-sm">Team size
              <select className="mt-1 w-full rounded-md border p-2 text-sm" value={responses.teamSizeBand} onChange={(event) => setResponses((prev) => ({ ...prev, teamSizeBand: event.target.value as AssessmentResponses["teamSizeBand"] }))}>
                <option value="solo">Solo</option><option value="2_5">2-5</option><option value="6_20">6-20</option><option value="21_plus">21+</option>
              </select>
            </label>
          </fieldset>
        </div>

        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold text-slate-800">Section E · Growth / Funding Need</legend>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">Funding amount range
              <select className="mt-1 w-full rounded-md border p-2 text-sm" value={responses.fundingAmountRange} onChange={(event) => setResponses((prev) => ({ ...prev, fundingAmountRange: event.target.value as AssessmentResponses["fundingAmountRange"] }))}>
                <option value="under_500k">Under ₦500k</option><option value="500k_2m">₦500k - ₦2m</option><option value="2m_10m">₦2m - ₦10m</option><option value="10m_50m">₦10m - ₦50m</option><option value="above_50m">Above ₦50m</option>
              </select>
            </label>
            <label className="block text-sm">Funding purpose
              <input className="mt-1 w-full rounded-md border p-2 text-sm" value={responses.fundingPurpose} onChange={(event) => setResponses((prev) => ({ ...prev, fundingPurpose: event.target.value }))} placeholder="e.g. Working capital for 3 contract cycles" />
            </label>
            <label className="block text-sm md:col-span-2">Growth priority
              <select className="mt-1 w-full rounded-md border p-2 text-sm" value={responses.growthPriority} onChange={(event) => setResponses((prev) => ({ ...prev, growthPriority: event.target.value as AssessmentResponses["growthPriority"] }))}>
                <option value="working_capital">Working capital</option><option value="equipment">Equipment acquisition</option><option value="market_expansion">Market expansion</option><option value="digital_upgrade">Digital upgrade</option><option value="hiring">Hiring and staffing</option>
              </select>
            </label>
          </div>
        </fieldset>

        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-70">
          {submitting ? "Submitting..." : "Generate AFRI Result"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {result && (
        <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-emerald-700">Assessment complete · {pathwayLabel(result.pathway)}</p>
              <h2 className="text-2xl font-bold text-slate-900">AFRI Score {result.score}/100</h2>
              <p className="text-sm text-slate-700">Readiness band: <span className="font-semibold">{result.band}</span></p>
            </div>
            <button onClick={downloadReportPdf} type="button" className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
              <Download className="h-4 w-4" /> Download Readiness Report PDF
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {result.breakdown.map((item) => (
              <article key={item.key} className="rounded-xl border bg-white p-3">
                <p className="text-xs uppercase text-slate-500">{item.label}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{item.score}<span className="text-sm font-medium text-slate-500">/{item.maxScore}</span></p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${Math.round((item.score / item.maxScore) * 100)}%` }} /></div>
              </article>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <ListCard title="Strengths" icon={<CheckCircle2 className="h-4 w-4 text-emerald-700" />} items={result.strengths} />
            <ListCard title="Gaps" icon={<CircleAlert className="h-4 w-4 text-amber-700" />} items={result.gaps} />
            <ListCard title="Recommended next actions" icon={<BarChart3 className="h-4 w-4 text-indigo-700" />} items={result.recommendations} />
          </div>
        </section>
      )}
    </section>
  );
}

function YesNo({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <select className="ml-2 rounded-md border p-1.5 text-sm" value={value ? "yes" : "no"} onChange={(event) => onChange(event.target.value === "yes")}>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  );
}

function ListCard({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <article className="rounded-xl border bg-white p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">{icon}{title}</p>
      <ul className="mt-2 space-y-2 text-sm text-slate-700">
        {items.map((item) => (<li key={item} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />{item}</li>))}
      </ul>
    </article>
  );
}
