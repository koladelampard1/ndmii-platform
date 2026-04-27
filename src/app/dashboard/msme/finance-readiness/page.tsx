import Link from "next/link";

const readinessChecklist = [
  "Maintain complete and up-to-date business profile records.",
  "Keep digital identity credentials and verification status current.",
  "Track complaint resolution and customer trust performance.",
  "Prepare basic turnover and expense records for lender review.",
  "Maintain tax and VAT readiness across filed periods.",
];

export default function FinanceReadinessPage() {
  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Access to Finance Readiness</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Review your business readiness signals before applying for credit, grants, or procurement opportunities.
        </p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Readiness Checklist</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {readinessChecklist.map((item) => (
            <li key={item} className="rounded-xl bg-slate-50 px-4 py-3">
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-5">
          <Link href="/dashboard/msme" className="inline-flex items-center rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">
            Back to Dashboard
          </Link>
        </div>
      </article>
    </section>
  );
}
