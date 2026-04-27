"use client";

import { useState } from "react";

type SubmitState = {
  assessmentId: string;
  downloadUrl: string;
  afri: {
    overallScore: number;
    readinessLevel: string;
  };
};

export function FinanceReadinessSubmit({ disabled }: { disabled: boolean }) {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<SubmitState | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAssessment() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/finance-readiness/submit", { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error ?? "Unable to run assessment.");
        return;
      }

      setState(payload as SubmitState);
      window.location.href = payload.downloadUrl;
    } catch {
      setError("Unable to run assessment right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Check Access to Finance Readiness</h2>
      <p className="mt-2 text-sm text-slate-600">This assessment uses existing DBIN verification, compliance, and transaction records automatically.</p>

      <button
        type="button"
        onClick={runAssessment}
        disabled={disabled || loading}
        className="mt-4 inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Generating report..." : "Run assessment and download PDF"}
      </button>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {state ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Latest AFRI: <strong>{state.afri.overallScore}</strong> ({state.afri.readinessLevel})
        </div>
      ) : null}
    </div>
  );
}
