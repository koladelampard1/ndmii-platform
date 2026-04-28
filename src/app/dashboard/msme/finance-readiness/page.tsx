"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Download, Landmark, ShieldAlert, TrendingUp, Wallet } from "lucide-react";

type Pathway = "loan" | "grant" | "investment";
type Answer = "yes" | "no" | null;
type Question = { id: string; label: string; helper: string };
type Section = { id: string; title: string; questions: Question[] };

type Category = { key: string; title: string; sectionId: string };

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

const categories: Category[] = [
  { key: "identity", title: "Business Identity Readiness", sectionId: "identity" },
  { key: "financial", title: "Financial Records & Discipline", sectionId: "financial" },
  { key: "tax", title: "Tax, Compliance & Regulatory Readiness", sectionId: "governance" },
  { key: "operations", title: "Operations & Business Stability", sectionId: "operations" },
  { key: "growth", title: "Growth Intent & Funding Need", sectionId: "funding" },
  { key: "risk", title: "Risk Signals & Readiness Gaps", sectionId: "market" },
];

const pathwayMeta = {
  loan: { title: "Loan", icon: Landmark, desc: "Assesses repayment capacity and debt fitness." },
  grant: { title: "Grant", icon: Wallet, desc: "Assesses impact fit and reporting readiness." },
  investment: { title: "Investment", icon: TrendingUp, desc: "Assesses growth potential and governance confidence." },
};

const bandMeta = (score: number) => score >= 80
  ? { label: "High readiness", color: "bg-emerald-100 text-emerald-800", interpretation: "Your business shows strong signals for near-term funding engagement with minimal remediation." }
  : score >= 60
    ? { label: "Moderate readiness", color: "bg-amber-100 text-amber-800", interpretation: "Your business is fundable with targeted improvements in documentation, controls, and reporting confidence." }
    : { label: "Early-stage readiness", color: "bg-rose-100 text-rose-800", interpretation: "Core records and compliance evidence should be strengthened before formal lender or investor engagement." };

export default function Page() {
  const [pathway, setPathway] = useState<Pathway>("loan");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [showReport, setShowReport] = useState(false);

  const allQ = useMemo(() => sections.flatMap((s) => s.questions), []);
  const answered = allQ.filter((q) => answers[q.id]).length;
  const score = Math.round((allQ.filter((q) => answers[q.id] === "yes").length / allQ.length) * 100);
  const completion = Math.round((answered / allQ.length) * 100);
  const active = sections[sectionIndex];
  const reportDate = new Date().toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
  const band = bandMeta(score);
  const fundingAmount = "₦12,500,000";

  const categoryScores = categories.map((category) => {
    const section = sections.find((s) => s.id === category.sectionId);
    const q = section?.questions ?? [];
    const yesCount = q.filter((item) => answers[item.id] === "yes").length;
    return { ...category, score: q.length ? Math.round((yesCount / q.length) * 100) : 0 };
  });

  const strengths = allQ.filter((q) => answers[q.id] === "yes").slice(0, 4).map((q) => q.label);
  const gaps = allQ.filter((q) => answers[q.id] === "no").slice(0, 4).map((q) => q.label);
  const riskFlags = gaps.slice(0, 3).map((g) => `Risk signal: ${g}`);

  if (showReport) {
    return (
      <section className="space-y-5 pb-8 print:pb-0">
        <style>{`@media print { .no-print { display:none!important; } .print-card { break-inside: avoid; } body { background: white; } }`}</style>
        <div className="rounded-3xl border border-emerald-200 bg-white p-4 sm:p-6 print:border-0 print:p-0">
          <div className="flex flex-wrap justify-between gap-3 border-b border-emerald-100 pb-4 print-card">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">DBIN • Digital Business Identity Network</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">ACCESS TO FINANCE READINESS REPORT</h1>
              <p className="text-sm text-slate-600">MSME Readiness Diagnostic Summary • Generated {reportDate}</p>
            </div>
            <div className="no-print flex gap-2">
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"><Download className="h-4 w-4" />Download PDF Report</button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3 print-card">
            <div className="rounded-2xl border p-4"><p className="text-xs uppercase text-slate-500">Business Name</p><p className="font-semibold">Adebayo Agro Ventures</p><p className="mt-2 text-xs uppercase text-slate-500">DBIN/MSME ID</p><p className="font-semibold">DBIN-MSME-448201</p></div>
            <div className="rounded-2xl border p-4"><p className="text-xs uppercase text-slate-500">Assessment Pathway</p><p className="font-semibold capitalize">{pathway}</p><p className="mt-2 text-xs uppercase text-slate-500">Funding Amount Needed</p><p className="font-semibold">{fundingAmount}</p></div>
            <div className="rounded-2xl border p-4"><p className="text-xs uppercase text-slate-500">Assessment Completed</p><p className="font-semibold">{reportDate}</p><p className="mt-2 text-xs uppercase text-slate-500">Next Review Recommended</p><p className="font-semibold">90 days</p></div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3 print-card">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 md:col-span-2">
              <p className="text-sm font-semibold text-emerald-800">Access to Finance Readiness Index (AFRI)</p>
              <p className="text-5xl font-bold text-emerald-800">{score}%</p>
              <div className="mt-3 h-3 rounded-full bg-emerald-100"><div className="h-3 rounded-full bg-emerald-600" style={{ width: `${score}%` }} /></div>
              <p className="mt-3 text-sm text-slate-700">{band.interpretation}</p>
            </div>
            <div className="rounded-2xl border p-5"><p className="text-sm text-slate-500">Readiness Band</p><span className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${band.color}`}>{band.label}</span><p className="mt-3 text-sm text-slate-600">Funding signal confidence: {score >= 75 ? "High" : score >= 55 ? "Medium" : "Low"}</p></div>
          </div>

          <div className="mt-4 rounded-2xl border p-4 print-card">
            <h2 className="font-semibold">Category Breakdown</h2>
            <div className="mt-3 space-y-3">
              {categoryScores.map((item) => (
                <div key={item.key}><div className="mb-1 flex justify-between text-sm"><span>{item.title}</span><span className="font-semibold">{item.score}%</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${item.score}%` }} /></div></div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3 print-card">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="flex items-center gap-2 font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Strengths</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{(strengths.length ? strengths : ["No strengths captured yet"]).map((s) => <li key={s}>{s}</li>)}</ul></div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 font-semibold text-amber-800"><AlertTriangle className="h-4 w-4" />Readiness gaps</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{(gaps.length ? gaps : ["No major gaps identified"]).map((s) => <li key={s}>{s}</li>)}</ul></div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="flex items-center gap-2 font-semibold text-rose-800"><ShieldAlert className="h-4 w-4" />Risk flags</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{(riskFlags.length ? riskFlags : ["No active risk flags"]).map((s) => <li key={s}>{s}</li>)}</ul></div>
          </div>

          <div className="mt-4 rounded-2xl border p-4 print-card">
            <h2 className="font-semibold">Recommended Next Actions</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
              <div><p className="font-semibold text-emerald-800">Priority Actions (Next 30 Days)</p><ul className="mt-1 list-disc pl-5"><li>Close top readiness gaps and submit missing records.</li><li>Standardize monthly reporting templates.</li></ul></div>
              <div><p className="font-semibold text-emerald-800">Medium-Term Actions (Next 90 Days)</p><ul className="mt-1 list-disc pl-5"><li>Improve cashflow discipline and governance checkpoints.</li><li>Track risk mitigation in recurring reviews.</li></ul></div>
              <div><p className="font-semibold text-emerald-800">Investor-Grade Improvements (Next 6 Months)</p><ul className="mt-1 list-disc pl-5"><li>Publish full-year management accounts.</li><li>Prepare investment-ready growth narrative and KPIs.</li></ul></div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3 print-card">
            <div className="rounded-2xl border p-4 md:col-span-2"><p className="font-semibold">Funding Signal Summary</p><p className="mt-1 text-sm text-slate-600">Recommended funding type: <span className="font-semibold capitalize">{pathway}</span>. Readiness confidence is <span className="font-semibold">{score >= 75 ? "High" : score >= 55 ? "Medium" : "Low"}</span> based on current diagnostic responses.</p><p className="mt-3 text-xs text-slate-500">About this report: This AFRI summary is a decision-support simulation and should be combined with formal due diligence.</p></div>
            <div className="rounded-2xl border p-4"><p className="font-semibold">Verify This Report</p><div className="mt-2 grid h-24 place-items-center rounded border border-dashed text-xs text-slate-500">QR Placeholder</div></div>
          </div>

          <div className="mt-5 border-t pt-3 text-xs text-slate-500 print-card">DBIN / Digital Business Identity Network • Powered by Roseate Forte • Verification note: values are generated from self-declared diagnostic responses.</div>
        </div>

        <div className="no-print flex flex-wrap gap-2">
          <button onClick={() => setShowReport(false)} className="rounded-xl border px-4 py-2 text-sm">Back to Diagnostic</button>
          <a href="/dashboard/msme" className="rounded-xl border px-4 py-2 text-sm">Back to MSME Dashboard</a>
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
