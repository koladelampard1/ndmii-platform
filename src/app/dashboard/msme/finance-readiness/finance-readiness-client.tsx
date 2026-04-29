"use client";

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

function d(blob: Blob, fileName: string) { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = fileName; a.click(); URL.revokeObjectURL(u); }
function b(v: string) { return new TextEncoder().encode(v); }
function esc(v: string) { return v.replace(/[()\\]/g, ""); }
function buildPdf(pages: string[]) {
  const objects: string[] = [];
  const pageIds: number[] = [];
  let nextId = 3;
  for (const stream of pages) {
    const contentId = nextId;
    const pageId = nextId + 1;
    objects.push(`${contentId} 0 obj\n<< /Length ${b(stream).length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    objects.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 1 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
    pageIds.push(pageId);
    nextId += 2;
  }
  const header = "%PDF-1.4\n";
  const root = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>\nendobj\n`;
  const fontObj = `${nextId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const all = [header, root, pagesObj, ...objects, fontObj];
  let pdf = "";
  const xref = [0];
  for (const part of all) { xref.push(b(pdf).length); pdf += part; }
  const start = b(pdf).length;
  pdf += `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < xref.length; i += 1) pdf += `${String(xref[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new Blob([b(pdf)], { type: "application/pdf" });
}

export function FinanceReadinessClient({ businessName, msmeId }: FinanceReadinessClientProps) {
  const [pathway, setPathway] = useState<Pathway>("loan"); const [sectionIndex, setSectionIndex] = useState(0); const [answers, setAnswers] = useState<Record<string, Answer>>({}); const [showReport, setShowReport] = useState(false);
  const allQ = useMemo(() => sections.flatMap((s) => s.questions), []);
  const answered = allQ.filter((q) => answers[q.id]).length; const score = Math.round((allQ.filter((q) => answers[q.id] === "yes").length / allQ.length) * 100); const completion = Math.round((answered / allQ.length) * 100); const active = sections[sectionIndex];
  const band = score >= 80 ? "High readiness" : score >= 60 ? "Moderate readiness" : "Early-stage readiness";
  const categoryScores = sections.map((s) => ({ title: s.title, score: Math.round((s.questions.filter((q) => answers[q.id] === "yes").length / s.questions.length) * 100) }));

  const downloadPdf = async () => {
    const now = new Date();
    const top = [
      "BT /F1 12 Tf 40 800 Td (DBIN · Digital Business Identity Network) Tj ET",
      "BT /F1 18 Tf 40 776 Td (ACCESS TO FINANCE READINESS REPORT) Tj ET",
      "BT /F1 12 Tf 40 756 Td (MSME Readiness Diagnostic Summary) Tj ET",
      `BT /F1 10 Tf 40 740 Td (Report date/time: ${esc(now.toLocaleString("en-NG"))}) Tj ET`,
      `BT /F1 10 Tf 40 714 Td (Business name: ${esc(businessName)}) Tj ET`,
      `BT /F1 10 Tf 40 700 Td (DBIN/MSME ID: ${esc(msmeId)}) Tj ET`,
      `BT /F1 10 Tf 40 686 Td (Assessment pathway: ${pathwayMeta[pathway].title}) Tj ET`,
      "BT /F1 10 Tf 40 672 Td (Funding amount needed: NGN 5,000,000 simulated) Tj ET",
      `BT /F1 24 Tf 40 632 Td (AFRI Score: ${score}/100) Tj ET`,
      `BT /F1 11 Tf 40 610 Td (Readiness band: ${band}) Tj ET`,
      `BT /F1 11 Tf 40 594 Td (Score progress: ${score} percent) Tj ET`,
      `BT /F1 10 Tf 40 572 Td (Assessment completed: ${completion} percent | Report generated: ${esc(now.toLocaleDateString("en-NG"))}) Tj ET`,
      `BT /F1 10 Tf 40 556 Td (Next review: ${esc(new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90).toLocaleDateString("en-NG"))}) Tj ET`,
      "BT /F1 12 Tf 40 530 Td (Category breakdown) Tj ET",
      ...categoryScores.map((c, i) => `BT /F1 10 Tf 52 ${512 - i * 14} Td (${esc(c.title)}: ${c.score} percent) Tj ET`),
    ].join("\n");
    const page2 = [
      "BT /F1 12 Tf 40 800 Td (Strengths) Tj ET",
      "BT /F1 10 Tf 52 784 Td (- Solid identity and registration readiness) Tj ET",
      "BT /F1 10 Tf 52 770 Td (- Structured assessment completion) Tj ET",
      "BT /F1 12 Tf 40 742 Td (Readiness gaps) Tj ET",
      "BT /F1 10 Tf 52 726 Td (- Improve periodic reporting discipline) Tj ET",
      "BT /F1 10 Tf 52 712 Td (- Strengthen risk register documentation) Tj ET",
      "BT /F1 12 Tf 40 684 Td (Risk flags) Tj ET",
      "BT /F1 10 Tf 52 668 Td (- Potential financing mismatch risk) Tj ET",
      "BT /F1 10 Tf 52 654 Td (- Underwriting evidence gaps) Tj ET",
      "BT /F1 12 Tf 40 626 Td (Recommended next actions) Tj ET",
      "BT /F1 10 Tf 52 610 Td (1. Consolidate 12-month financials.) Tj ET",
      "BT /F1 10 Tf 52 596 Td (2. Formalize governance and risk logs.) Tj ET",
      "BT /F1 10 Tf 52 582 Td (3. Prepare use-of-funds schedule.) Tj ET",
      `BT /F1 12 Tf 40 554 Td (Funding signal summary: ${esc(band)} with AFRI ${score}/100.) Tj ET`,
      "BT /F1 11 Tf 40 526 Td (About this report) Tj ET",
      "BT /F1 10 Tf 52 510 Td (This DBIN simulation report supports MSME finance readiness planning.) Tj ET",
      "BT /F1 10 Tf 52 496 Td (It is not a final lender decision document.) Tj ET",
      "BT /F1 11 Tf 40 468 Td (Verify this report / QR placeholder: [ DBIN VERIFY ]) Tj ET",
      "BT /F1 10 Tf 200 60 Td (Powered by Roseate Forte) Tj ET",
    ].join("\n");
    const blob = buildPdf([top, page2]);
    d(blob, `finance-readiness-report-${msmeId}.pdf`);
  };

  if (showReport) { return <section className="space-y-5 pb-6"><div className="rounded-3xl border bg-white p-4 sm:p-6"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Readiness Report Preview</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Access to Finance Readiness Index (AFRI)</h1></div><button onClick={downloadPdf} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"><Download className="h-4 w-4"/>Download PDF Report</button></div><div className="mt-4 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border bg-emerald-50 p-4"><p className="text-sm">AFRI score</p><p className="text-4xl font-bold">{score}/100</p></div><div className="rounded-2xl border bg-slate-50 p-4"><p className="text-sm">Readiness band</p><p className="mt-2 text-sm font-semibold">{band}</p></div><div className="rounded-2xl border bg-slate-50 p-4"><p className="text-sm">Current pathway</p><p className="mt-2 text-sm font-semibold capitalize">{pathway}</p></div></div></div><button onClick={() => setShowReport(false)} className="rounded-xl border px-4 py-2 text-sm">Back to diagnostic</button></section>; }

  return <section className="space-y-5 pb-24"><div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 sm:p-6"><h1 className="text-2xl font-bold">Access to Finance Readiness Diagnostic</h1><p className="mt-2 text-sm text-slate-600">Business: {businessName} • {msmeId} • Pathway: <span className="capitalize">{pathway}</span></p></div><div className="grid gap-3 md:grid-cols-3">{(Object.keys(pathwayMeta) as Pathway[]).map((k) => { const Icon = pathwayMeta[k].icon; return <button key={k} onClick={() => setPathway(k)} className={`rounded-2xl border p-4 text-left ${pathway === k ? "border-emerald-500 bg-emerald-50" : "bg-white"}`}><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-emerald-700" /><p className="font-semibold">{pathwayMeta[k].title}</p></div><p className="mt-2 text-sm text-slate-600">{pathwayMeta[k].desc}</p></button>; })}</div><div className="rounded-2xl border bg-white p-4"><p className="text-sm font-semibold">Section {sectionIndex + 1} of 6: {active.title}</p><p className="text-sm text-slate-600">{answered} of {allQ.length} answered</p><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${completion}%` }} /></div></div><div className="space-y-3">{active.questions.map((q) => (<div key={q.id} className="rounded-2xl border bg-white p-4"><p className="font-medium">{q.label}</p><p className="mt-1 text-sm text-slate-600">{q.helper}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:w-[280px]"><button onClick={() => setAnswers((p) => ({ ...p, [q.id]: "yes" }))} className={`rounded-lg border px-4 py-2 ${answers[q.id] === "yes" ? "border-emerald-600 bg-emerald-100" : ""}`}>Yes</button><button onClick={() => setAnswers((p) => ({ ...p, [q.id]: "no" }))} className={`rounded-lg border px-4 py-2 ${answers[q.id] === "no" ? "border-rose-500 bg-rose-50" : ""}`}>No</button></div></div>))}</div><div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-white/95 p-3"><div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:justify-between"><button onClick={() => setSectionIndex((n) => Math.max(0, n - 1))} disabled={sectionIndex === 0} className="inline-flex items-center justify-center gap-1 rounded-lg border px-4 py-2 text-sm disabled:opacity-50"><ArrowLeft className="h-4 w-4" />Back</button>{sectionIndex < sections.length - 1 ? (<button onClick={() => setSectionIndex((n) => Math.min(sections.length - 1, n + 1))} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Next Section <ArrowRight className="h-4 w-4" /></button>) : (<button onClick={() => setShowReport(true)} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" />View Report</button>)}</div></div></section>;
}
