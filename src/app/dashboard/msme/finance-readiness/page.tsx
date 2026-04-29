"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Landmark,
  QrCode,
  RefreshCcw,
  ShieldAlert,
  Star,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

type Pathway = "loan" | "grant" | "investment";
type Answer = "yes" | "no" | null;
type Question = { id: string; label: string; helper: string; category: CategoryKey };
type Section = { id: string; title: string; questions: Question[] };
type CategoryKey = "identity" | "financial" | "tax" | "operations" | "growth" | "risk";

const sections: Section[] = [
  { id: "identity", title: "Identity & Compliance", questions: [
    { id: "nin_bvn", label: "Do you have verified NIN/BVN records linked to the business?", helper: "Identity validation is required before financing.", category: "identity" },
    { id: "cac", label: "Is your CAC registration active and up to date?", helper: "Updated registration improves trust and approval speed.", category: "identity" },
    { id: "tin", label: "Do you have an active TIN and basic filing history?", helper: "Tax traceability is a core compliance signal.", category: "tax" },
  ]},
  { id: "financial", title: "Financial Records", questions: [
    { id: "bank_stmt", label: "Can you provide 12 months of bank statements?", helper: "Cashflow evidence supports affordability checks.", category: "financial" },
    { id: "bookkeeping", label: "Do you keep monthly profit/loss and expense records?", helper: "Consistent records improve underwriting confidence.", category: "financial" },
    { id: "separation", label: "Do you separate business and personal finances?", helper: "Separate accounts enable clearer analysis.", category: "financial" },
  ]},
  { id: "operations", title: "Business Operations", questions: [
    { id: "capacity", label: "Can operations support higher order volume?", helper: "Funders test your ability to absorb capital.", category: "operations" },
    { id: "supply", label: "Do you have stable suppliers and procurement cycles?", helper: "Supply continuity lowers execution risk.", category: "operations" },
    { id: "staff", label: "Do you have key staff with clear responsibilities?", helper: "Role clarity supports continuity.", category: "operations" },
  ]},
  { id: "market", title: "Market & Traction", questions: [
    { id: "customers", label: "Do you have recurring customers or contracts?", helper: "Recurring demand supports predictability.", category: "growth" },
    { id: "growth", label: "Has revenue remained stable or grown recently?", helper: "Stable trends improve readiness.", category: "growth" },
    { id: "competition", label: "Can you explain your market differentiation?", helper: "Clear value proposition builds confidence.", category: "growth" },
  ]},
  { id: "governance", title: "Governance & Team", questions: [
    { id: "structure", label: "Is there a documented decision-making structure?", helper: "Governance improves accountability.", category: "risk" },
    { id: "reporting", label: "Can you produce periodic funder updates?", helper: "Reporting readiness is often mandatory.", category: "risk" },
    { id: "risk", label: "Do you track risks and mitigation plans?", helper: "Risk controls improve approval odds.", category: "risk" },
  ]},
  { id: "funding", title: "Funding Strategy", questions: [
    { id: "purpose", label: "Is the funding use-case specific and costed?", helper: "Clear use-of-funds is required across pathways.", category: "growth" },
    { id: "amount", label: "Is requested amount estimated with assumptions?", helper: "Accurate sizing reduces financing mismatch.", category: "growth" },
    { id: "repayment", label: "For debt, do you have a repayment plan?", helper: "Repayment logic is essential for loans.", category: "risk" },
  ]},
];

const pathwayMeta = {
  loan: { title: "Loan", icon: Landmark, desc: "Assesses repayment capacity and debt fitness." },
  grant: { title: "Grant", icon: Wallet, desc: "Assesses impact fit and reporting readiness." },
  investment: { title: "Investment", icon: TrendingUp, desc: "Assesses growth potential and governance confidence." },
};

const formatCurrency = (amount: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
const scoreBand = (score: number) => (score >= 75 ? "ADVANCED" : score >= 50 ? "EMERGING" : "EARLY-STAGE");

export default function Page() {
  const [pathway, setPathway] = useState<Pathway>("loan");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [showReport, setShowReport] = useState(false);
  const [fundingAmount, setFundingAmount] = useState(1000000);

  const profile = useMemo(() => {
    if (typeof window === "undefined") return { businessName: "MSME Business", msmeId: "DBIN-MSME-ID" };
    const businessName = localStorage.getItem("business_name") || localStorage.getItem("provider_display_name") || "MSME Business";
    const msmeId = localStorage.getItem("msme_id") || "DBIN-MSME-ID";
    return { businessName, msmeId };
  }, []);

  const allQ = useMemo(() => sections.flatMap((s) => s.questions), []);
  const answered = allQ.filter((q) => answers[q.id]).length;
  const score = Math.round((allQ.filter((q) => answers[q.id] === "yes").length / allQ.length) * 100);
  const completion = Math.round((answered / allQ.length) * 100);
  const active = sections[sectionIndex];
  const today = new Date();
  const completedDate = new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "long", year: "numeric" }).format(today);
  const nextReviewDate = new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000));

  const categories = (Object.keys({ identity: 1, financial: 1, tax: 1, operations: 1, growth: 1, risk: 1 }) as CategoryKey[]).map((key) => {
    const items = allQ.filter((q) => q.category === key);
    const yes = items.filter((q) => answers[q.id] === "yes").length;
    return Math.round((yes / Math.max(1, items.length)) * 100);
  });

  if (showReport) {
    const band = scoreBand(score);
    const categoryRows = [
      ["Business Identity Readiness", categories[0]],
      ["Financial Records & Discipline", categories[1]],
      ["Tax, Compliance & Regulatory", categories[2]],
      ["Operations & Business Stability", categories[3]],
      ["Growth Intent & Funding Need", categories[4]],
      ["Risk Signals & Readiness Gaps", categories[5]],
    ] as const;

    return <section className="space-y-4 pb-6">
      <div className="rounded-3xl border bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">DBIN ACCESS TO FINANCE READINESS REPORT</p>
            <h1 className="text-2xl font-bold text-slate-900">MSME Readiness Diagnostic Summary</h1>
          </div>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"><Download className="h-4 w-4" />Download PDF Report</button>
        </div>

        <div className="mt-4 grid gap-2 rounded-2xl border bg-slate-50 p-4 text-sm md:grid-cols-3 lg:grid-cols-6">
          <div><p className="text-xs text-slate-500">Business Name</p><p className="font-semibold">{profile.businessName}</p></div>
          <div><p className="text-xs text-slate-500">DBIN / MSME ID</p><p className="font-semibold">{profile.msmeId}</p></div>
          <div><p className="text-xs text-slate-500">Assessment Pathway</p><p className="font-semibold">{pathwayMeta[pathway].title}</p></div>
          <div><p className="text-xs text-slate-500">Funding Amount Needed</p><p className="font-semibold text-emerald-700">{formatCurrency(fundingAmount)}</p></div>
          <div><p className="text-xs text-slate-500">Report Generated</p><p className="font-semibold">{completedDate}</p></div>
          <div><p className="text-xs text-slate-500">Next Review Recommended</p><p className="font-semibold">{nextReviewDate}</p></div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr),minmax(0,1fr)]">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-700 p-5 text-white">
            <p className="text-sm font-semibold">AFRI SCORE</p><p className="mt-1 text-6xl font-bold">{score}%</p>
            <div className="mt-3 h-3 rounded-full bg-white/25"><div className="h-3 rounded-full bg-emerald-200" style={{ width: `${score}%` }} /></div>
            <p className="mt-3 inline-flex rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-950">{band}</p>
            <p className="mt-2 text-sm text-emerald-100">Your business readiness score reflects identity strength, records discipline, compliance posture, operational stability, and risk controls.</p>
          </div>
          <div className="space-y-3 rounded-2xl border bg-white p-4 text-sm">
            <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-700" />Assessment completed: <span className="font-semibold">{completedDate}</span></p>
            <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-700" />Report generated: <span className="font-semibold">{completedDate}</span></p>
            <p className="flex items-center gap-2"><RefreshCcw className="h-4 w-4 text-emerald-700" />Next review recommended: <span className="font-semibold">In 90 days</span></p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border p-4">
          <p className="mb-3 text-sm font-bold text-emerald-800">CATEGORY BREAKDOWN</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {categoryRows.map(([label, value]) => <div key={label} className="rounded-xl border p-3"><p className="text-sm font-medium">{label}</p><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${value}%` }} /></div><p className="mt-2 text-sm font-semibold">{value}%</p></div>)}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border bg-emerald-50 p-4"><p className="mb-2 font-semibold text-emerald-900">Strengths</p>{["Verified business identity", "Consistent transaction tracking", "Growth intent documented"].map((item) => <p key={item} className="mb-1 flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-700" />{item}</p>)}</div>
          <div className="rounded-2xl border bg-amber-50 p-4"><p className="mb-2 font-semibold text-amber-900">Readiness Gaps</p>{["Tax filings not up to date", "Limited operational documentation", "Insufficient financial history depth"].map((item) => <p key={item} className="mb-1 flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-700" />{item}</p>)}</div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="mb-2 flex items-center gap-2 font-semibold text-rose-800"><ShieldAlert className="h-4 w-4" />Risk Flags</p><p className="rounded-xl border border-rose-200 bg-white p-3 text-sm text-rose-700">High debt pressure may affect repayment readiness.</p></div>
        </div>

        <div className="mt-4 rounded-2xl border p-4">
          <p className="mb-3 font-semibold text-emerald-900">Recommended Next Actions</p>
          <div className="grid gap-4 lg:grid-cols-3 text-sm">
            {["Priority Actions (Next 30 days)", "Medium-Term Actions (Next 90 days)", "Investor-Grade Improvements (Next 6 months)"].map((title, idx) => <div key={title}><p className="mb-2 font-semibold">{title}</p>{["Strengthen record keeping", "Resolve compliance issues", "Prepare lender documentation"].map((it) => <p key={`${idx}-${it}`} className="mb-1 flex items-center gap-2"><Check className="h-4 w-4 text-emerald-700" />{it}</p>)}</div>)}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border bg-emerald-50 p-4"><p className="font-semibold text-emerald-900">Funding Signal Summary</p><p className="mt-1 text-sm">Recommended funding type: <span className="font-semibold">{pathwayMeta[pathway].title}</span></p><p className="mt-2 text-sm">Confidence level</p><div className="mt-1 flex gap-1">{[1,2,3,4,5].map((i)=><Star key={i} className={`h-4 w-4 ${i<=3?"fill-emerald-600 text-emerald-600":"text-slate-300"}`} />)}</div></div>
          <div className="rounded-2xl border p-4"><p className="font-semibold text-emerald-900">About this Report</p><p className="mt-2 text-sm text-slate-600">The DBIN AFRI score summarizes readiness across six categories using diagnostic responses. Higher scores indicate stronger lender confidence and funding preparedness.</p></div>
          <div className="rounded-2xl border p-4"><p className="font-semibold text-emerald-900">Verify This Report</p><div className="mt-2 flex items-center gap-3"><div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-slate-100"><QrCode className="h-10 w-10 text-slate-500" /></div><p className="text-xs">Verification ID<br /><span className="font-semibold">DBIN-RPT-{profile.msmeId}-{score}</span></p></div></div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-950 px-4 py-3 text-sm text-emerald-100"><p>Powered by DBIN</p><p>ndmii.gov.ng</p></div>
      </div>
      <button onClick={() => setShowReport(false)} className="rounded-xl border px-4 py-2 text-sm">Back to diagnostic</button>
    </section>;
  }

  return (
    <section className="space-y-5 pb-24">
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 sm:p-6">
        <h1 className="text-2xl font-bold">Access to Finance Readiness Diagnostic</h1>
        <p className="mt-2 text-sm text-slate-600">Funding amount needed</p>
        <input value={fundingAmount} onChange={(e)=>setFundingAmount(Number(e.target.value)||0)} className="mt-1 w-full max-w-xs rounded-xl border px-3 py-2" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">{(Object.keys(pathwayMeta) as Pathway[]).map((k) => {
        const Icon = pathwayMeta[k].icon;
        return <button key={k} onClick={() => setPathway(k)} className={`rounded-2xl border p-4 text-left ${pathway === k ? "border-emerald-500 bg-emerald-50" : "bg-white"}`}><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-emerald-700" /><p className="font-semibold">{pathwayMeta[k].title}</p></div><p className="mt-2 text-sm text-slate-600">{pathwayMeta[k].desc}</p></button>;
      })}</div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-sm font-semibold">Section {sectionIndex + 1} of 6: {active.title}</p><p className="text-sm text-slate-600">{answered} of {allQ.length} answered</p><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${completion}%` }} /></div></div>
      <div className="space-y-3">{active.questions.map((q) => <div key={q.id} className="rounded-2xl border bg-white p-4"><p className="font-medium">{q.label}</p><p className="mt-1 text-sm text-slate-600">{q.helper}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:w-[280px]"><button onClick={() => setAnswers((p) => ({ ...p, [q.id]: "yes" }))} className={`rounded-lg border px-4 py-2 ${answers[q.id] === "yes" ? "border-emerald-600 bg-emerald-100" : ""}`}>Yes</button><button onClick={() => setAnswers((p) => ({ ...p, [q.id]: "no" }))} className={`rounded-lg border px-4 py-2 ${answers[q.id] === "no" ? "border-rose-500 bg-rose-50" : ""}`}>No</button></div></div>)}</div>
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-white/95 p-3"><div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:justify-between"><button onClick={() => setSectionIndex((n) => Math.max(0, n - 1))} disabled={sectionIndex === 0} className="inline-flex items-center justify-center gap-1 rounded-lg border px-4 py-2 text-sm disabled:opacity-50"><ArrowLeft className="h-4 w-4" />Back</button>{sectionIndex < sections.length - 1 ? (<button onClick={() => setSectionIndex((n) => Math.min(sections.length - 1, n + 1))} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Next Section <ArrowRight className="h-4 w-4" /></button>) : (<button onClick={() => setShowReport(true)} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" />View Report</button>)}</div></div>
    </section>
  );
}
