import { FinanceReadinessDiagnostic } from "@/components/msme/finance-readiness-diagnostic";

const ENABLE_FINANCE_READINESS = true;

export default function FinanceReadinessPage() {
  if (!ENABLE_FINANCE_READINESS) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Access to Finance Readiness is currently disabled.
      </section>
    );
  }

  return <FinanceReadinessDiagnostic />;
}
