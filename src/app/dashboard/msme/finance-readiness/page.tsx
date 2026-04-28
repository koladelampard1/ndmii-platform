"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";

type Option = { label: string; value: number };

const options: Option[] = [
  { label: "Not ready", value: 0 },
  { label: "In progress", value: 50 },
  { label: "Ready", value: 100 },
];

const loanInputs = [
  "Financial records",
  "Cashflow stability",
  "Credit history",
  "Collateral readiness",
] as const;

const grantInputs = [
  "Business registration status",
  "Impact documentation",
  "Proposal quality",
  "Grant compliance readiness",
] as const;

const investmentInputs = [
  "Growth strategy",
  "Governance structure",
  "Pitch materials",
  "Market traction",
] as const;

function scoreBand(score: number) {
  if (score >= 80) return { label: "High readiness", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (score >= 50) return { label: "Moderate readiness", tone: "text-amber-700 bg-amber-50 border-amber-200" };
  return { label: "Low readiness", tone: "text-rose-700 bg-rose-50 border-rose-200" };
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((acc, value) => acc + value, 0) / values.length);
}

export default function FinanceReadinessAssessmentPage() {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const seeded: Record<string, number> = {};
    [...loanInputs, ...grantInputs, ...investmentInputs].forEach((item) => {
      seeded[item] = 50;
    });
    return seeded;
  });

  const loanScore = useMemo(() => average(loanInputs.map((item) => values[item] ?? 0)), [values]);
  const grantScore = useMemo(() => average(grantInputs.map((item) => values[item] ?? 0)), [values]);
  const investmentScore = useMemo(() => average(investmentInputs.map((item) => values[item] ?? 0)), [values]);
  const afriScore = useMemo(() => Math.round((loanScore + grantScore + investmentScore) / 3), [loanScore, grantScore, investmentScore]);

  const pdfHref = `/api/msme/finance-readiness/pdf?loan=${loanScore}&grant=${grantScore}&investment=${investmentScore}&afri=${afriScore}`;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Access to Finance Readiness Index (AFRI)</h1>
        <p className="mt-1 text-sm text-slate-600">Complete this diagnostic to estimate your readiness for loan, grant, and investment opportunities.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <AssessmentCard title="Loan readiness inputs" fields={loanInputs} values={values} setValues={setValues} score={loanScore} />
        <AssessmentCard title="Grant readiness inputs" fields={grantInputs} values={values} setValues={setValues} score={grantScore} />
        <AssessmentCard title="Investment readiness inputs" fields={investmentInputs} values={values} setValues={setValues} score={investmentScore} />
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">AFRI Summary</p>
            <p className="mt-1 text-4xl font-semibold text-slate-900">{afriScore}%</p>
            <p className="mt-2 text-sm text-slate-600">Overall readiness based on the average of loan, grant, and investment diagnostics.</p>
          </div>
          <a href={pdfHref} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800">
            <Download className="h-4 w-4" />
            Download PDF
          </a>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${afriScore}%` }} />
        </div>
      </section>
    </section>
  );
}

function AssessmentCard({
  title,
  fields,
  values,
  setValues,
  score,
}: {
  title: string;
  fields: readonly string[];
  values: Record<string, number>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  score: number;
}) {
  const band = scoreBand(score);

  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${band.tone}`}>{score}%</span>
      </div>

      <div className="space-y-3">
        {fields.map((field) => (
          <label key={field} className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{field}</span>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-emerald-200 focus:ring"
              value={values[field] ?? 0}
              onChange={(event) => {
                const next = Number(event.target.value);
                setValues((previous) => ({ ...previous, [field]: next }));
              }}
            >
              {options.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <p className="mt-4 text-xs font-medium text-slate-500">{band.label}</p>
    </article>
  );
}
