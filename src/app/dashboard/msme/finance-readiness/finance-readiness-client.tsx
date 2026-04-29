"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Landmark, TrendingUp, Wallet } from "lucide-react";

type Pathway = "loan" | "grant" | "investment";
type Answer = "yes" | "no" | null;
type Question = { id: string; label: string; helper: string };
type Section = { id: string; title: string; questions: Question[] };

type FinanceReadinessClientProps = { businessName: string; msmeId: string };

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
const pathwayMeta = { loan: { title: "Loan", icon: Landmark, desc: "Assesses repayment capacity and debt fitness." }, grant: { title: "Grant", icon: Wallet, desc: "Assesses impact fit and reporting readiness." }, investment: { title: "Investment", icon: TrendingUp, desc: "Assesses growth potential and governance confidence." } };

export function FinanceReadinessClient({ businessName, msmeId }: FinanceReadinessClientProps) {
  const [pathway, setPathway] = useState<Pathway>("loan"); const [sectionIndex, setSectionIndex] = useState(0); const [answers, setAnswers] = useState<Record<string, Answer>>({}); const [showReport, setShowReport] = useState(false); const [assessmentId, setAssessmentId] = useState<string | null>(null); const [isPersisting, setIsPersisting] = useState(false);
  const allQ = useMemo(() => sections.flatMap((s) => s.questions), []);
  const answered = allQ.filter((q) => answers[q.id]).length; const score = Math.round((allQ.filter((q) => answers[q.id] === "yes").length / allQ.length) * 100); const completion = Math.round((answered / allQ.length) * 100); const active = sections[sectionIndex];
  const band = score >= 80 ? "High readiness" : score >= 60 ? "Moderate readiness" : "Early-stage readiness";
  const categoryScores = sections.map((s) => ({ title: s.title, score: Math.round((s.questions.filter((q) => answers[q.id] === "yes").length / s.questions.length) * 100) }));

  const downloadHref = assessmentId
    ? `/api/msme/finance-readiness/pdf?assessmentId=${encodeURIComponent(assessmentId)}`
    : `/api/msme/finance-readiness/pdf?pathway=${encodeURIComponent(pathway)}&score=${score}&completion=${completion}&band=${encodeURIComponent(band)}`;

  const openPdfReport = (href: string) => {
    const opened = window.open(href, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.assign(href);
    }
  };

  const persistAssessmentAndDownload = async () => {
    if (assessmentId || isPersisting) {
      openPdfReport(downloadHref);
      return;
    }

    setIsPersisting(true);
    try {
      const response = await fetch("/api/msme/finance-readiness/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathway, score, completion, band }),
      });

      if (!response.ok) {
        openPdfReport(downloadHref);
        return;
      }

      const payload = (await response.json()) as { assessmentId?: string };
      if (!payload.assessmentId) {
        openPdfReport(downloadHref);
        return;
      }

      setAssessmentId(payload.assessmentId);
      openPdfReport(`/api/msme/finance-readiness/pdf?assessmentId=${encodeURIComponent(payload.assessmentId)}`);
    } catch {
      openPdfReport(downloadHref);
    } finally {
      setIsPersisting(false);
    }
  };


  if (showReport) { return <section className="space-y-5 pb-6"><div className="rounded-3xl border bg-white p-4 sm:p-6"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Readiness Report Preview</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Access to Finance Readiness Index (AFRI)</h1></div><Link href={downloadHref} onClick={(event) => { event.preventDefault(); void persistAssessmentAndDownload(); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"><Download className="h-4 w-4"/>{isPersisting ? "Preparing download..." : "Download PDF Report"}</Link></div><div className="mt-4 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border bg-emerald-50 p-4"><p className="text-sm">AFRI score</p><p className="text-4xl font-bold">{score}/100</p></div><div className="rounded-2xl border bg-slate-50 p-4"><p className="text-sm">Readiness band</p><p className="mt-2 text-sm font-semibold">{band}</p></div><div className="rounded-2xl border bg-slate-50 p-4"><p className="text-sm">Current pathway</p><p className="mt-2 text-sm font-semibold capitalize">{pathway}</p></div></div></div><button onClick={() => setShowReport(false)} className="rounded-xl border px-4 py-2 text-sm">Back to diagnostic</button></section>; }

  return <section className="space-y-5 pb-24"><div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 sm:p-6"><h1 className="text-2xl font-bold">Access to Finance Readiness Diagnostic</h1><p className="mt-2 text-sm text-slate-600">Business: {businessName} • {msmeId} • Pathway: <span className="capitalize">{pathway}</span></p></div><div className="grid gap-3 md:grid-cols-3">{(Object.keys(pathwayMeta) as Pathway[]).map((k) => { const Icon = pathwayMeta[k].icon; return <button key={k} onClick={() => setPathway(k)} className={`rounded-2xl border p-4 text-left ${pathway === k ? "border-emerald-500 bg-emerald-50" : "bg-white"}`}><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-emerald-700" /><p className="font-semibold">{pathwayMeta[k].title}</p></div><p className="mt-2 text-sm text-slate-600">{pathwayMeta[k].desc}</p></button>; })}</div><div className="rounded-2xl border bg-white p-4"><p className="text-sm font-semibold">Section {sectionIndex + 1} of 6: {active.title}</p><p className="text-sm text-slate-600">{answered} of {allQ.length} answered</p><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${completion}%` }} /></div></div><div className="space-y-3">{active.questions.map((q) => (<div key={q.id} className="rounded-2xl border bg-white p-4"><p className="font-medium">{q.label}</p><p className="mt-1 text-sm text-slate-600">{q.helper}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:w-[280px]"><button onClick={() => setAnswers((p) => ({ ...p, [q.id]: "yes" }))} className={`rounded-lg border px-4 py-2 ${answers[q.id] === "yes" ? "border-emerald-600 bg-emerald-100" : ""}`}>Yes</button><button onClick={() => setAnswers((p) => ({ ...p, [q.id]: "no" }))} className={`rounded-lg border px-4 py-2 ${answers[q.id] === "no" ? "border-rose-500 bg-rose-50" : ""}`}>No</button></div></div>))}</div><div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-white/95 p-3"><div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:justify-between"><button onClick={() => setSectionIndex((n) => Math.max(0, n - 1))} disabled={sectionIndex === 0} className="inline-flex items-center justify-center gap-1 rounded-lg border px-4 py-2 text-sm disabled:opacity-50"><ArrowLeft className="h-4 w-4" />Back</button>{sectionIndex < sections.length - 1 ? (<button onClick={() => setSectionIndex((n) => Math.min(sections.length - 1, n + 1))} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Next Section <ArrowRight className="h-4 w-4" /></button>) : (<button onClick={() => setShowReport(true)} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" />View Report</button>)}</div></div></section>;
}
