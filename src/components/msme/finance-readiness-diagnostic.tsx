"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, Save } from "lucide-react";

type Pathway = "loan" | "grant" | "investment";
type CategoryKey = "identity" | "financial" | "compliance" | "operations" | "growth" | "risk";

type Option = {
  label: string;
  score: number;
};

type Question = {
  id: string;
  label: string;
  options: Option[];
  help?: string;
  riskFlagThreshold?: number;
  riskFlagMessage?: string;
};

type Section = {
  key: CategoryKey;
  title: string;
  description: string;
  questions: Question[];
};

type Answers = Record<string, number>;

const STORAGE_KEY = "msme-finance-readiness-v1";

const pathwayWeights: Record<Pathway, Record<CategoryKey, number>> = {
  loan: {
    identity: 1,
    financial: 1.35,
    compliance: 1,
    operations: 1,
    growth: 1,
    risk: 1.1,
  },
  grant: {
    identity: 1,
    financial: 1,
    compliance: 1.35,
    operations: 1,
    growth: 1.05,
    risk: 1.1,
  },
  investment: {
    identity: 1,
    financial: 1.1,
    compliance: 1,
    operations: 1,
    growth: 1.4,
    risk: 1.15,
  },
};

const yesNoMostlyOptions: Option[] = [
  { label: "Yes, fully in place", score: 5 },
  { label: "Partly in place", score: 3 },
  { label: "No / not yet", score: 1 },
];

const sections: Section[] = [
  {
    key: "identity",
    title: "Business Identity Readiness",
    description: "Formal records and identity consistency improve lender and funder confidence.",
    questions: [
      { id: "registered", label: "Is your business formally registered?", options: yesNoMostlyOptions, riskFlagThreshold: 1, riskFlagMessage: "Business not formally registered." },
      {
        id: "name_consistency",
        label: "Is your business name consistent across CAC, bank, tax, and DBIN records?",
        options: yesNoMostlyOptions,
        riskFlagThreshold: 2,
        riskFlagMessage: "Identity records are inconsistent across official systems.",
      },
      { id: "business_account", label: "Do you have a dedicated business account?", options: yesNoMostlyOptions, riskFlagThreshold: 1, riskFlagMessage: "No dedicated business bank account." },
      { id: "address_verifiable", label: "Is your business address verifiable?", options: yesNoMostlyOptions },
    ],
  },
  {
    key: "financial",
    title: "Financial Records & Discipline",
    description: "Clean records, cashflow awareness, and transaction evidence are core to finance readiness.",
    questions: [
      { id: "monthly_sales", label: "Do you maintain monthly sales records?", options: yesNoMostlyOptions },
      {
        id: "expense_separation",
        label: "Do you track expenses separately from personal spending?",
        options: yesNoMostlyOptions,
        riskFlagThreshold: 1,
        riskFlagMessage: "Personal and business expenses are mixed.",
      },
      { id: "bank_statements", label: "Can you provide 3–6 months of bank statements?", options: yesNoMostlyOptions },
      { id: "receipts", label: "Do you issue receipts/invoices?", options: yesNoMostlyOptions },
      { id: "avg_revenue", label: "Do you know your average monthly revenue?", options: yesNoMostlyOptions },
    ],
  },
  {
    key: "compliance",
    title: "Tax, Compliance & Regulatory Readiness",
    description: "Compliance posture heavily impacts grants, procurement opportunities, and formal lending.",
    questions: [
      { id: "has_tin", label: "Do you have a TIN?", options: yesNoMostlyOptions, riskFlagThreshold: 1, riskFlagMessage: "TIN is missing." },
      { id: "tax_filing", label: "Do you file/pay tax?", options: yesNoMostlyOptions },
      { id: "permits", label: "Do you have sector-specific permits where required?", options: yesNoMostlyOptions },
      {
        id: "unresolved_complaints",
        label: "Do you have unresolved regulatory or customer complaints?",
        options: [
          { label: "No unresolved issues", score: 5 },
          { label: "Minor issues being resolved", score: 3 },
          { label: "Yes, unresolved issues exist", score: 1 },
        ],
        riskFlagThreshold: 1,
        riskFlagMessage: "Unresolved regulatory/customer complaints present.",
      },
    ],
  },
  {
    key: "operations",
    title: "Operations & Business Stability",
    description: "Business continuity, customer repeatability, and operational structure de-risk funding.",
    questions: [
      {
        id: "business_age",
        label: "How long has the business operated?",
        options: [
          { label: "More than 24 months", score: 5 },
          { label: "12–24 months", score: 3 },
          { label: "Less than 12 months", score: 1 },
        ],
      },
      { id: "repeat_customers", label: "Do you have repeat customers?", options: yesNoMostlyOptions },
      { id: "structured_ops", label: "Do you have staff or structured operations?", options: yesNoMostlyOptions },
      { id: "inventory_records", label: "Do you keep inventory/service delivery records?", options: yesNoMostlyOptions },
    ],
  },
  {
    key: "growth",
    title: "Growth Intent & Funding Need",
    description: "Clear use of funds and growth outcomes improve decision confidence for funders.",
    questions: [
      {
        id: "funding_type_clarity",
        label: "Have you selected a funding type aligned to your business goal?",
        options: [
          { label: "Yes, clearly aligned", score: 5 },
          { label: "Partly clear", score: 3 },
          { label: "Not clear yet", score: 1 },
        ],
      },
      {
        id: "funding_amount",
        label: "Is the funding amount well-defined and realistic for current operations?",
        options: yesNoMostlyOptions,
      },
      { id: "fund_use", label: "Can you clearly explain what funds will be used for?", options: yesNoMostlyOptions },
      {
        id: "repayment_impact",
        label: "Can you explain repayment plan (loan) or measurable impact (grant/investment)?",
        options: yesNoMostlyOptions,
      },
      { id: "supporting_docs", label: "Do you have supporting documents (records, contracts, projections)?", options: yesNoMostlyOptions },
    ],
  },
  {
    key: "risk",
    title: "Risk Signals & Readiness Gaps",
    description: "Final check for signals that could delay approval, disbursement, or investor confidence.",
    questions: [
      {
        id: "cashflow_volatility",
        label: "How stable is monthly cashflow?",
        options: [
          { label: "Stable and predictable", score: 5 },
          { label: "Moderate volatility", score: 3 },
          { label: "Highly volatile", score: 1 },
        ],
        riskFlagThreshold: 1,
        riskFlagMessage: "High cashflow volatility detected.",
      },
      {
        id: "debt_pressure",
        label: "Current debt pressure level",
        options: [
          { label: "Low / manageable", score: 5 },
          { label: "Moderate", score: 3 },
          { label: "High pressure", score: 1 },
        ],
        riskFlagThreshold: 1,
        riskFlagMessage: "High debt pressure may affect readiness.",
      },
      {
        id: "owner_dependency",
        label: "Is the business highly dependent on one person?",
        options: [
          { label: "No, operations are distributed", score: 5 },
          { label: "Partly dependent", score: 3 },
          { label: "Yes, single-point dependency", score: 1 },
        ],
      },
      {
        id: "market_concentration",
        label: "Do sales depend on one major customer/market channel?",
        options: [
          { label: "No, diversified", score: 5 },
          { label: "Some concentration", score: 3 },
          { label: "Yes, heavily concentrated", score: 1 },
        ],
      },
    ],
  },
];

function readinessBand(score: number) {
  if (score >= 80) return "High Readiness";
  if (score >= 60) return "Moderate Readiness";
  if (score >= 40) return "Emerging Readiness";
  return "Low Readiness";
}

function sectionScore(section: Section, answers: Answers) {
  const max = section.questions.length * 5;
  const total = section.questions.reduce((sum, q) => sum + (answers[q.id] ?? 0), 0);
  return max === 0 ? 0 : Math.round((total / max) * 100);
}

function pathwayLabel(pathway: Pathway) {
  if (pathway === "loan") return "Loan Readiness";
  if (pathway === "grant") return "Grant Readiness";
  return "Investment Readiness";
}

function recommendationByCategory(category: CategoryKey, pathway: Pathway) {
  const pathwayHint = {
    loan: "Focus on repayment confidence and cashflow evidence.",
    grant: "Focus on compliance clarity, impact narrative, and documentation.",
    investment: "Focus on growth strategy, governance basics, and market opportunity.",
  }[pathway];

  const base = {
    identity: "Resolve registration and record consistency gaps across CAC, bank, and tax records.",
    financial: "Improve bookkeeping discipline and produce monthly financial statements for the last 3–6 months.",
    compliance: "Close tax and permit gaps; ensure no unresolved compliance issues remain outstanding.",
    operations: "Document operating processes, delivery logs, and customer retention indicators.",
    growth: "Sharpen funding purpose, amount rationale, and measurable outcomes.",
    risk: "Reduce concentration and volatility risks; prepare simple risk mitigation actions.",
  }[category];

  return `${base} ${pathwayHint}`;
}

function bytes(text: string) {
  return new TextEncoder().encode(text);
}

function buildSimpleTextPdf(fileName: string, lines: string[]) {
  const safeLines = lines.map((line) => line.replace(/[()\\]/g, "")).slice(0, 42);
  let y = 790;
  const commands = ["BT", "/F1 11 Tf", "50 810 Td", `(NDMII Finance Readiness Report) Tj`];

  safeLines.forEach((line) => {
    commands.push(`0 -16 Td (${line}) Tj`);
    y -= 16;
    if (y < 40) return;
  });
  commands.push("ET");
  const stream = `${commands.join("\n")}\n`;

  const objects: Array<{ id: number; content: string; stream?: Uint8Array<ArrayBuffer> }> = [
    { id: 1, content: "<< /Type /Catalog /Pages 2 0 R >>" },
    { id: 2, content: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    { id: 3, content: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>" },
    { id: 4, content: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
    { id: 5, content: `<< /Length ${bytes(stream).length} >>`, stream: bytes(stream) },
    { id: 6, content: `<< /Title (${fileName.replace(/[()\\]/g, "")}) >>` },
  ];

  const parts: BlobPart[] = [];
  const header = bytes("%PDF-1.4\n");
  parts.push(header);
  let offset = header.length;
  const xref: number[] = [0];

  for (const obj of objects) {
    xref.push(offset);
    const start = bytes(`${obj.id} 0 obj\n${obj.content}\n`);
    parts.push(start);
    offset += start.length;
    if (obj.stream) {
      const ss = bytes("stream\n");
      const se = bytes("\nendstream\n");
      parts.push(ss, obj.stream, se);
      offset += ss.length + obj.stream.length + se.length;
    }
    const end = bytes("endobj\n");
    parts.push(end);
    offset += end.length;
  }

  const xrefStart = offset;
  let xrefText = `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < xref.length; i += 1) {
    xrefText += `${String(xref[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${xref.length} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  parts.push(bytes(xrefText), bytes(trailer));

  return new Blob(parts, { type: "application/pdf" });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FinanceReadinessDiagnostic() {
  const [pathway, setPathway] = useState<Pathway>("loan");
  const [answers, setAnswers] = useState<Answers>({});
  const [fundingType, setFundingType] = useState("loan");
  const [fundingAmount, setFundingAmount] = useState("");
  const [fundUseNarrative, setFundUseNarrative] = useState("");
  const [currentSection, setCurrentSection] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        pathway?: Pathway;
        answers?: Answers;
        fundingType?: string;
        fundingAmount?: string;
        fundUseNarrative?: string;
      };
      if (parsed.pathway) setPathway(parsed.pathway);
      if (parsed.answers) setAnswers(parsed.answers);
      if (parsed.fundingType) setFundingType(parsed.fundingType);
      if (parsed.fundingAmount) setFundingAmount(parsed.fundingAmount);
      if (parsed.fundUseNarrative) setFundUseNarrative(parsed.fundUseNarrative);
    } catch {
      // ignore bad local cache
    }
  }, []);

  useEffect(() => {
    const payload = {
      pathway,
      answers,
      fundingType,
      fundingAmount,
      fundUseNarrative,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setSavedAt(new Date().toISOString());
  }, [pathway, answers, fundingAmount, fundingType, fundUseNarrative]);

  const completion = useMemo(() => {
    const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);
    const answered = Object.keys(answers).length;
    return Math.round((answered / totalQuestions) * 100);
  }, [answers]);

  const categoryBreakdown = useMemo(() => {
    return sections.map((section) => ({
      category: section,
      score: sectionScore(section, answers),
    }));
  }, [answers]);

  const totalScore = useMemo(() => {
    const weights = pathwayWeights[pathway];
    const weighted = categoryBreakdown.reduce((sum, row) => sum + row.score * weights[row.category.key], 0);
    const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
    return Math.round(weighted / totalWeight);
  }, [categoryBreakdown, pathway]);

  const riskFlags = useMemo(() => {
    const flags: string[] = [];
    sections.forEach((section) => {
      section.questions.forEach((question) => {
        const answer = answers[question.id];
        if (typeof question.riskFlagThreshold === "number" && typeof answer === "number" && answer <= question.riskFlagThreshold && question.riskFlagMessage) {
          flags.push(question.riskFlagMessage);
        }
      });
    });
    return Array.from(new Set(flags));
  }, [answers]);

  const strengths = useMemo(
    () => categoryBreakdown.filter((item) => item.score >= 75).map((item) => `${item.category.title} (${item.score}%)`),
    [categoryBreakdown],
  );

  const gaps = useMemo(
    () => categoryBreakdown.filter((item) => item.score < 50).map((item) => `${item.category.title} (${item.score}%)`),
    [categoryBreakdown],
  );

  const recommendations = useMemo(() => {
    const categoryGaps = categoryBreakdown.filter((item) => item.score < 60).map((item) => recommendationByCategory(item.category.key, pathway));
    return Array.from(new Set([...categoryGaps, ...riskFlags.map((flag) => `Address risk flag: ${flag}`)])).slice(0, 6);
  }, [categoryBreakdown, pathway, riskFlags]);

  const allAnswered = useMemo(() => {
    const questionIds = sections.flatMap((section) => section.questions.map((q) => q.id));
    return questionIds.every((id) => typeof answers[id] === "number");
  }, [answers]);

  const reportLines = useMemo(() => {
    return [
      `Assessment pathway: ${pathwayLabel(pathway)}`,
      `Selected funding type: ${fundingType || "N/A"}`,
      `Funding amount need: ${fundingAmount || "Not provided"}`,
      `AFRI Total Score: ${totalScore}%`,
      `Readiness Band: ${readinessBand(totalScore)}`,
      "",
      "Category breakdown:",
      ...categoryBreakdown.map((item) => `- ${item.category.title}: ${item.score}%`),
      "",
      `Strengths: ${strengths.length ? strengths.join("; ") : "None yet"}`,
      `Gaps: ${gaps.length ? gaps.join("; ") : "No major gaps"}`,
      `Risk flags: ${riskFlags.length ? riskFlags.join("; ") : "None detected"}`,
      "",
      "Next actions:",
      ...recommendations.map((r) => `- ${r}`),
    ];
  }, [categoryBreakdown, fundingAmount, fundingType, gaps, pathway, recommendations, riskFlags, strengths, totalScore]);

  const onDownloadPdf = () => {
    const pdf = buildSimpleTextPdf(`finance-readiness-${Date.now()}.pdf`, reportLines);
    downloadBlob(pdf, `finance-readiness-${Date.now()}.pdf`);
  };

  const activeSection = sections[currentSection];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Access to Finance Readiness Diagnostic</h1>
            <p className="mt-1 text-sm text-slate-600">Complete a lightweight AFRI diagnostic to understand financing readiness, risk signals, and next actions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pathway</label>
            <select
              value={pathway}
              onChange={(event) => {
                setPathway(event.target.value as Pathway);
                setFundingType(event.target.value);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800"
            >
              <option value="loan">Loan Readiness</option>
              <option value="grant">Grant Readiness</option>
              <option value="investment">Investment Readiness</option>
            </select>
          </div>
        </div>

        <div className="mt-4 h-2.5 rounded-full bg-slate-100">
          <div className="h-2.5 rounded-full bg-emerald-600 transition-all" style={{ width: `${completion}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Progress: {completion}% complete</span>
          <span className="inline-flex items-center gap-1">
            <Save className="h-3.5 w-3.5" />
            {savedAt ? `Auto-saved ${new Date(savedAt).toLocaleTimeString("en-NG")}` : "Auto-save enabled"}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section, index) => (
            <button
              key={section.key}
              type="button"
              onClick={() => setCurrentSection(index)}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                currentSection === index ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="block text-xs font-semibold uppercase tracking-wide">Step {index + 1}</span>
              <span className="mt-1 block font-medium">{section.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Section {currentSection + 1} of {sections.length}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{activeSection.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{activeSection.description}</p>
        </div>

        <div className="space-y-4">
          {activeSection.questions.map((question) => (
            <article key={question.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4">
              <p className="text-sm font-semibold text-slate-900">{question.label}</p>
              {question.help ? <p className="mt-1 text-xs text-slate-500">{question.help}</p> : null}
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {question.options.map((option) => {
                  const selected = answers[question.id] === option.score;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.score }))}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                        selected ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </article>
          ))}

          {activeSection.key === "growth" ? (
            <article className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4">
              <p className="text-sm font-semibold text-slate-900">Funding profile details</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Finance type sought</span>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                    value={fundingType}
                    onChange={(event) => setFundingType(event.target.value)}
                  >
                    <option value="loan">Loan</option>
                    <option value="grant">Grant</option>
                    <option value="investment">Investment</option>
                    <option value="procurement_finance">Procurement finance</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Funding amount needed (NGN)</span>
                  <input
                    value={fundingAmount}
                    onChange={(event) => setFundingAmount(event.target.value)}
                    placeholder="e.g. 1500000"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                  />
                </label>
              </div>
              <label className="mt-3 block space-y-1 text-sm text-slate-700">
                <span className="text-xs uppercase tracking-wide text-slate-500">How will funds be used and repaid/show impact?</span>
                <textarea
                  value={fundUseNarrative}
                  onChange={(event) => setFundUseNarrative(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                  placeholder="Brief narrative for fund use, repayment plan, or expected impact metrics"
                />
              </label>
            </article>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setCurrentSection((prev) => Math.max(0, prev - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
            disabled={currentSection === 0}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentSection((prev) => Math.min(sections.length - 1, prev + 1))}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
            disabled={currentSection === sections.length - 1}
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">AFRI Result</h3>
            <p className="text-sm text-slate-600">{pathwayLabel(pathway)} perspective with weighted emphasis applied.</p>
          </div>
          <button
            type="button"
            onClick={onDownloadPdf}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"
          >
            <Download className="h-4 w-4" /> Download PDF Report
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)]">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-end gap-2">
              <p className="text-4xl font-bold text-slate-900">{totalScore}%</p>
              <p className="pb-1 text-sm font-medium text-slate-600">{readinessBand(totalScore)}</p>
            </div>
            <div className="mt-3 h-3 rounded-full bg-slate-200">
              <div className="h-3 rounded-full bg-emerald-600" style={{ width: `${totalScore}%` }} />
            </div>
            {!allAnswered ? <p className="mt-2 text-xs text-amber-700">Complete all questions for a fully reliable score.</p> : null}
          </article>

          <article className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Category breakdown</p>
            <div className="mt-3 space-y-2">
              {categoryBreakdown.map((item) => (
                <div key={item.category.key}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                    <span>{item.category.title}</span>
                    <span>{item.score}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${item.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-sm font-semibold text-emerald-900">Strengths</p>
            <ul className="mt-2 space-y-1 text-sm text-emerald-900">
              {strengths.length ? strengths.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />{item}</li>) : <li>No major strengths yet.</li>}
            </ul>
          </article>

          <article className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <p className="text-sm font-semibold text-amber-900">Gaps & risk flags</p>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {gaps.map((item) => <li key={item}>{item}</li>)}
              {riskFlags.map((flag) => <li key={flag} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4" />{flag}</li>)}
              {!gaps.length && !riskFlags.length ? <li>No major readiness gaps detected.</li> : null}
            </ul>
          </article>
        </div>

        <article className="mt-4 rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">Next actions</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
            {!recommendations.length ? <li>Maintain current discipline and keep records updated monthly.</li> : null}
          </ul>
        </article>
      </section>
    </div>
  );
}
