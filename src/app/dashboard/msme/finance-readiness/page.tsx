"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download, Landmark, PiggyBank, TrendingUp } from "lucide-react";

type Level = "Low" | "Moderate" | "Strong";

type AssessmentState = {
  bookkeeping: Level;
  repaymentHistory: Level;
  collateralReadiness: Level;
  grantCompliance: Level;
  impactEvidence: Level;
  proposalQuality: Level;
  governance: Level;
  growthPlan: Level;
  investorDataRoom: Level;
};

const LEVEL_SCORE: Record<Level, number> = {
  Low: 40,
  Moderate: 68,
  Strong: 92,
};

const DEFAULT_STATE: AssessmentState = {
  bookkeeping: "Moderate",
  repaymentHistory: "Moderate",
  collateralReadiness: "Moderate",
  grantCompliance: "Moderate",
  impactEvidence: "Moderate",
  proposalQuality: "Moderate",
  governance: "Moderate",
  growthPlan: "Moderate",
  investorDataRoom: "Moderate",
};

function score(values: Level[]) {
  const total = values.reduce((sum, value) => sum + LEVEL_SCORE[value], 0);
  return Math.round(total / values.length);
}

function scoreBand(value: number) {
  if (value >= 80) return { label: "Ready for funding", tone: "text-emerald-700 bg-emerald-100" };
  if (value >= 60) return { label: "Near-ready", tone: "text-amber-700 bg-amber-100" };
  return { label: "Needs support", tone: "text-rose-700 bg-rose-100" };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildPdfReport(summary: string, fileName: string) {
  const escaped = summary.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const text = `BT /F1 11 Tf 48 780 Td 14 TL (${escaped}) Tj ET`;
  const content = new TextEncoder().encode(text);

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    `5 0 obj << /Length ${content.length} >> stream\n${text}\nendstream endobj\n`,
  ];

  const parts: BlobPart[] = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  let offset = 9;

  objects.forEach((obj) => {
    offsets.push(offset);
    parts.push(obj);
    offset += obj.length;
  });

  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
  parts.push(xref, trailer);

  downloadBlob(new Blob(parts, { type: "application/pdf" }), fileName);
}

function ReadinessField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Level;
  onChange: (value: Level) => void;
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value as Level)}
      >
        <option value="Low">Low</option>
        <option value="Moderate">Moderate</option>
        <option value="Strong">Strong</option>
      </select>
    </label>
  );
}

export default function FinanceReadinessPage() {
  const [state, setState] = useState<AssessmentState>(DEFAULT_STATE);

  const loan = useMemo(() => score([state.bookkeeping, state.repaymentHistory, state.collateralReadiness]), [state]);
  const grant = useMemo(() => score([state.grantCompliance, state.impactEvidence, state.proposalQuality]), [state]);
  const investment = useMemo(() => score([state.governance, state.growthPlan, state.investorDataRoom]), [state]);
  const afri = Math.round((loan + grant + investment) / 3);
  const band = scoreBand(afri);

  const summary = `AFRI Report | Loan:${loan} Grant:${grant} Investment:${investment} AFRI:${afri} (${band.label})`;

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Business Management</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Access to Finance Readiness</h1>
        <p className="mt-1 text-sm text-slate-600">Complete the Loan, Grant, and Investment assessments to produce your AFRI score and downloadable report.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Landmark className="h-4 w-4 text-emerald-700" />
            <h2 className="font-semibold text-slate-900">Loan Readiness</h2>
          </div>
          <div className="space-y-3">
            <ReadinessField label="Bookkeeping quality" value={state.bookkeeping} onChange={(value) => setState((prev) => ({ ...prev, bookkeeping: value }))} />
            <ReadinessField label="Repayment history" value={state.repaymentHistory} onChange={(value) => setState((prev) => ({ ...prev, repaymentHistory: value }))} />
            <ReadinessField label="Collateral readiness" value={state.collateralReadiness} onChange={(value) => setState((prev) => ({ ...prev, collateralReadiness: value }))} />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-700">Loan score: {loan}</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <PiggyBank className="h-4 w-4 text-emerald-700" />
            <h2 className="font-semibold text-slate-900">Grant Readiness</h2>
          </div>
          <div className="space-y-3">
            <ReadinessField label="Compliance documentation" value={state.grantCompliance} onChange={(value) => setState((prev) => ({ ...prev, grantCompliance: value }))} />
            <ReadinessField label="Social impact evidence" value={state.impactEvidence} onChange={(value) => setState((prev) => ({ ...prev, impactEvidence: value }))} />
            <ReadinessField label="Proposal quality" value={state.proposalQuality} onChange={(value) => setState((prev) => ({ ...prev, proposalQuality: value }))} />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-700">Grant score: {grant}</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-700" />
            <h2 className="font-semibold text-slate-900">Investment Readiness</h2>
          </div>
          <div className="space-y-3">
            <ReadinessField label="Governance maturity" value={state.governance} onChange={(value) => setState((prev) => ({ ...prev, governance: value }))} />
            <ReadinessField label="Growth plan strength" value={state.growthPlan} onChange={(value) => setState((prev) => ({ ...prev, growthPlan: value }))} />
            <ReadinessField label="Investor data room" value={state.investorDataRoom} onChange={(value) => setState((prev) => ({ ...prev, investorDataRoom: value }))} />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-700">Investment score: {investment}</p>
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">AFRI (Access to Finance Readiness Index)</p>
            <div className="mt-1 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-700" />
              <p className="text-3xl font-bold text-slate-900">{afri}</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${band.tone}`}>{band.label}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => buildPdfReport(summary, "afri-readiness-report.pdf")}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            <Download className="h-4 w-4" />
            Download PDF report
          </button>
        </div>
      </article>
    </section>
  );
}
