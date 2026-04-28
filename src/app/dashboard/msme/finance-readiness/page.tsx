import Link from "next/link";

export default function FinanceReadinessPage() {
  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Access to Finance Readiness</h1>
        <p className="mt-2 text-sm text-slate-600">
          Complete your readiness assessment to understand eligibility for lending, grant and investment opportunities.
        </p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-700">
          This module is available and ready. Continue your assessment workflow from the finance readiness workspace.
        </p>
        <Link
          href="/dashboard/msme"
          className="mt-4 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
        >
          Back to dashboard
        </Link>
      </article>
    </section>
  );
}
