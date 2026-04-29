"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Landmark, TrendingUp, Wallet } from "lucide-react";

type Pathway = "loan" | "grant" | "investment";
type Answer = "yes" | "no" | null;
type Question = { id: string; label: string; helper: string };
type Section = { id: string; title: string; questions: Question[] };

const sections: Section[] = [
  { id: "identity", title: "Identity & Compliance", questions: [
    { id: "nin_bvn", label: "Do you have verified NIN/BVN records linked to the business?", helper: "Identity validation is required before financing." },
    { id: "cac", label: "Is your CAC registration active and up to date?", helper: "Updated registration improves trust and approval speed." },
    { id: "tin", label: "Do you have an active TIN and basic filing history?", helper: "Tax traceability is a core compliance signal." },
  ]},
  { id: "financial", title: "Financial Records", questions: [
    { id: "bank_stmt", label: "Can you provide 12 months of bank statements?", helper: "Cashflow evidence supports affordability checks." },
    { id: "bookkeeping", label: "Do you keep monthly profit/loss and expense records?", helper: "Consistent records improve underwriting confidence." },
    { id: "separation", label: "Do you separate business and personal finances?", helper: "Separate accounts enable clearer analysis." },
  ]},
  { id: "operations", title: "Business Operations", questions: [
    { id: "capacity", label: "Can operations support higher order volume?", helper: "Funders test your ability to absorb capital." },
    { id: "supply", label: "Do you have stable suppliers and procurement cycles?", helper: "Supply continuity lowers execution risk." },
    { id: "staff", label: "Do you have key staff with clear responsibilities?", helper: "Role clarity supports continuity." },
  ]},
  { id: "market", title: "Market & Traction", questions: [
    { id: "customers", label: "Do you have recurring customers or contracts?", helper: "Recurring demand supports predictability." },
    { id: "growth", label: "Has revenue remained stable or grown recently?", helper: "Stable trends improve readiness." },
    { id: "competition", label: "Can you explain your market differentiation?", helper: "Clear value proposition builds confidence." },
  ]},
  { id: "governance", title: "Governance & Team", questions: [
    { id: "structure", label: "Is there a documented decision-making structure?", helper: "Governance improves accountability." },
    { id: "reporting", label: "Can you produce periodic funder updates?", helper: "Reporting readiness is often mandatory." },
    { id: "risk", label: "Do you track risks and mitigation plans?", helper: "Risk controls improve approval odds." },
  ]},
  { id: "funding", title: "Funding Strategy", questions: [
    { id: "purpose", label: "Is the funding use-case specific and costed?", helper: "Clear use-of-funds is required across pathways." },
    { id: "amount", label: "Is requested amount estimated with assumptions?", helper: "Accurate sizing reduces financing mismatch." },
    { id: "repayment", label: "For debt, do you have a repayment plan?", helper: "Repayment logic is essential for loans." },
  ]},
];

const pathwayMeta = {
  loan: { title: "Loan", icon: Landmark, desc: "Assesses repayment capacity and debt fitness." },
  grant: { title: "Grant", icon: Wallet, desc: "Assesses impact fit and reporting readiness." },
  investment: { title: "Investment", icon: TrendingUp, desc: "Assesses growth potential and governance confidence." },
};

export default function Page() {
  const [pathway, setPathway] = useState<Pathway>("loan");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [showReport, setShowReport] = useState(false);

  const allQ = useMemo(() => sections.flatMap((s) => s.questions), []);
  const answered = allQ.filter((q) => answers[q.id]).length;
  const yesCount = allQ.filter((q) => answers[q.id] === "yes").length;
  const score = Math.round((yesCount / allQ.length) * 100);
  const completion = Math.round((answered / allQ.length) * 100);
  const active = sections[sectionIndex];
  const readinessBand = score >= 80 ? "High readiness" : score >= 60 ? "Moderate readiness" : "Early-stage readiness";
  const reportDate = new Date().toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });

  const categoryBreakdown = sections.map((section) => {
    const yes = section.questions.filter((q) => answers[q.id] === "yes").length;
    const value = Math.round((yes / section.questions.length) * 100);
    return { title: section.title, value };
  });

  const strengths = categoryBreakdown.filter((item) => item.value >= 67).map((item) => item.title);
  const gaps = categoryBreakdown.filter((item) => item.value < 67).map((item) => item.title);
  const riskFlags = [
    answers.nin_bvn === "no" ? "Identity records are not fully verified." : null,
    answers.tin === "no" ? "Tax traceability is weak due to inactive TIN/filings." : null,
    answers.bank_stmt === "no" ? "Lack of 12-month bank statements increases underwriting risk." : null,
    answers.repayment === "no" && pathway === "loan" ? "Repayment strategy is not documented for debt funding." : null,
  ].filter(Boolean) as string[];

  if (showReport) {
    return (
      <section className="report-sheet space-y-5 pb-6 print:space-y-4">
        <style jsx global>{`
          @media print {
            @page { size: A4 portrait; margin: 14mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
            .print-hide { display: none !important; }
            .report-sheet { padding: 0 !important; }
            .report-card { break-inside: avoid; page-break-inside: avoid; }
            .report-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            .report-3col { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            .report-meta { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            .report-footer { position: static !important; margin-top: 10mm !important; }
            .report-text-2xl { font-size: 1.35rem !important; line-height: 1.3 !important; }
            .report-text-lg { font-size: 1rem !important; line-height: 1.4 !important; }
          }
        `}</style>

        <div className="report-card rounded-3xl border bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">DBIN — Access to Finance Readiness Report</p>
              <h1 className="report-text-2xl mt-2 text-2xl font-bold text-slate-900">Access to Finance Readiness Index (AFRI)</h1>
              <p className="mt-2 text-sm text-slate-600">Generated on {reportDate}</p>
            </div>
            <button onClick={() => window.print()} className="print-hide inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
              <Download className="h-4 w-4" />Download PDF Report
            </button>
          </div>

          <div className="report-meta mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Business Name</p><p className="mt-1 text-sm font-semibold">Adebayo Agro Ventures</p></div>
            <div className="rounded-xl border bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">DBIN / MSME ID</p><p className="mt-1 text-sm font-semibold">DBIN-MSME-448201</p></div>
            <div className="rounded-xl border bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Assessment Pathway</p><p className="mt-1 text-sm font-semibold capitalize">{pathway}</p></div>
            <div className="rounded-xl border bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Funding Amount</p><p className="mt-1 text-sm font-semibold">₦12,500,000</p></div>
          </div>
        </div>

        <div className="report-grid grid gap-4 lg:grid-cols-3">
          <div className="report-card rounded-2xl border bg-emerald-50 p-4 lg:col-span-1">
            <p className="text-sm text-emerald-900">AFRI score</p>
            <p className="mt-2 text-4xl font-bold text-emerald-900">{score}/100</p>
          </div>
          <div className="report-card rounded-2xl border bg-white p-4 lg:col-span-2">
            <p className="text-sm text-slate-600">Readiness band interpretation</p>
            <p className="report-text-lg mt-2 text-lg font-semibold text-slate-900">{readinessBand}</p>
            <p className="mt-2 text-sm text-slate-600">{readinessBand === "High readiness" ? "Business has strong signals for near-term financing with only minor documentary improvements needed." : readinessBand === "Moderate readiness" ? "Business has credible readiness indicators but should close priority documentation and risk controls before submission." : "Business should strengthen core compliance, records, and strategy before approaching formal financing."}</p>
          </div>
        </div>

        <div className="report-card rounded-2xl border bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Category breakdown</h2>
          <div className="mt-3 space-y-3">
            {categoryBreakdown.map((item) => (
              <div key={item.title}>
                <div className="mb-1 flex items-center justify-between text-sm"><span>{item.title}</span><span className="font-semibold">{item.value}%</span></div>
                <div className="h-2.5 w-full rounded-full bg-slate-100"><div className="h-2.5 rounded-full bg-emerald-600" style={{ width: `${item.value}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="report-3col grid gap-4 lg:grid-cols-3">
          <div className="report-card rounded-2xl border bg-white p-4"><h3 className="text-sm font-semibold">Strengths</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{(strengths.length ? strengths : ["No strong categories yet."]).map((s) => <li key={s}>{s}</li>)}</ul></div>
          <div className="report-card rounded-2xl border bg-white p-4"><h3 className="text-sm font-semibold">Readiness gaps</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{(gaps.length ? gaps : ["No major gaps detected."]).map((s) => <li key={s}>{s}</li>)}</ul></div>
          <div className="report-card rounded-2xl border bg-white p-4"><h3 className="text-sm font-semibold">Risk flags</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{(riskFlags.length ? riskFlags : ["No high-risk flags captured in this assessment."]).map((s) => <li key={s}>{s}</li>)}</ul></div>
        </div>

        <div className="report-card rounded-2xl border bg-white p-4">
          <h3 className="text-sm font-semibold">Recommended next actions</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <div><p className="text-xs font-semibold uppercase text-slate-500">Immediate (0-30 days)</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700"><li>Complete missing KYC records (NIN/BVN, CAC, TIN).</li><li>Prepare 12-month bank statements and monthly P/L summary.</li></ul></div>
            <div><p className="text-xs font-semibold uppercase text-slate-500">Near term (30-90 days)</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700"><li>Formalize governance and reporting cadence for funders.</li><li>Document use-of-funds and scenario-based assumptions.</li></ul></div>
            <div><p className="text-xs font-semibold uppercase text-slate-500">Submission readiness</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700"><li>Bundle evidence pack by pathway requirements.</li><li>Pre-check funding amount against cashflow capacity.</li></ul></div>
          </div>
        </div>

        <div className="report-grid grid gap-4 lg:grid-cols-2">
          <div className="report-card rounded-2xl border bg-white p-4"><h3 className="text-sm font-semibold">Funding signal summary</h3><p className="mt-2 text-sm text-slate-700">{score >= 80 ? "Strong signal: business can proceed to lender/grantor engagement with minimal remediation." : score >= 60 ? "Moderate signal: proceed after closing identified gaps and strengthening evidence pack." : "Weak signal: focus on readiness improvements before formal funding applications."}</p></div>
          <div className="report-card rounded-2xl border bg-white p-4"><h3 className="text-sm font-semibold">About this report</h3><p className="mt-2 text-sm text-slate-700">This simulated AFRI report is generated from self-declared diagnostic responses and is intended for readiness guidance within the DBIN MSME platform.</p></div>
        </div>

        <div className="report-grid grid gap-4 lg:grid-cols-2">
          <div className="report-card rounded-2xl border bg-white p-4"><h3 className="text-sm font-semibold">Verify this report</h3><div className="mt-3 flex items-center gap-3"><div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed text-xs text-slate-500">QR</div><p className="text-xs text-slate-600">Scan to verify AFRI report authenticity in the DBIN verification portal.</p></div></div>
          <div className="report-card report-footer flex items-end rounded-2xl border bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Powered by Roseate Forte</p></div>
        </div>

        <div className="print-hide flex flex-wrap gap-3">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"><Download className="h-4 w-4" />Download PDF Report</button>
          <button onClick={() => setShowReport(false)} className="rounded-xl border px-4 py-2 text-sm">Back to Diagnostic</button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5 pb-24">
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 sm:p-6">
        <h1 className="text-2xl font-bold">Access to Finance Readiness Diagnostic</h1>
        <p className="mt-2 text-sm text-slate-600">Business: Adebayo Agro Ventures • DBIN-MSME-448201 • Pathway: <span className="capitalize">{pathway}</span></p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(pathwayMeta) as Pathway[]).map((k) => {
          const Icon = pathwayMeta[k].icon;
          return (
            <button key={k} onClick={() => setPathway(k)} className={`rounded-2xl border p-4 text-left ${pathway === k ? "border-emerald-500 bg-emerald-50" : "bg-white"}`}>
              <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-emerald-700" /><p className="font-semibold">{pathwayMeta[k].title}</p></div>
              <p className="mt-2 text-sm text-slate-600">{pathwayMeta[k].desc}</p>
            </button>
          );
        })}
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <p className="text-sm font-semibold">Section {sectionIndex + 1} of 6: {active.title}</p>
        <p className="text-sm text-slate-600">{answered} of {allQ.length} answered</p>
        <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${completion}%` }} /></div>
      </div>
      <div className="space-y-3">
        {active.questions.map((q) => (
          <div key={q.id} className="rounded-2xl border bg-white p-4">
            <p className="font-medium">{q.label}</p>
            <p className="mt-1 text-sm text-slate-600">{q.helper}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:w-[280px]">
              <button onClick={() => setAnswers((p) => ({ ...p, [q.id]: "yes" }))} className={`rounded-lg border px-4 py-2 ${answers[q.id] === "yes" ? "border-emerald-600 bg-emerald-100" : ""}`}>Yes</button>
              <button onClick={() => setAnswers((p) => ({ ...p, [q.id]: "no" }))} className={`rounded-lg border px-4 py-2 ${answers[q.id] === "no" ? "border-rose-500 bg-rose-50" : ""}`}>No</button>
            </div>
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-white/95 p-3">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:justify-between">
          <button onClick={() => setSectionIndex((n) => Math.max(0, n - 1))} disabled={sectionIndex === 0} className="inline-flex items-center justify-center gap-1 rounded-lg border px-4 py-2 text-sm disabled:opacity-50"><ArrowLeft className="h-4 w-4" />Back</button>
          {sectionIndex < sections.length - 1 ? (
            <button onClick={() => setSectionIndex((n) => Math.min(sections.length - 1, n + 1))} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Next Section <ArrowRight className="h-4 w-4" /></button>
          ) : (
            <button onClick={() => setShowReport(true)} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" />View Report</button>
          )}
        </div>
      </div>
    </section>
  );
}
