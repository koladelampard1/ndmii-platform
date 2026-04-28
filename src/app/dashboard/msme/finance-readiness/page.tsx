import Link from "next/link";

export default function FinanceReadinessPage() {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Access to Finance Readiness</h1>
      <p className="text-sm text-slate-600">Assess your business readiness for loans, grants, and investment opportunities.</p>
      <Link href="/dashboard/msme" className="inline-flex rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800">
        Back to MSME Dashboard
      </Link>
    </section>
  );
}
