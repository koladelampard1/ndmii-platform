import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { getFinanceReadinessAssessment } from "@/lib/msme/finance-readiness-assessments";

export default async function FinanceReadinessReportPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  const assessment = getFinanceReadinessAssessment(assessmentId);

  if (!assessment) {
    notFound();
  }

  const workspace = await getProviderWorkspaceContext();
  const businessName = workspace.msme.business_name || workspace.provider.display_name || "MSME Business";
  const msmeId = workspace.msme.msme_id || "MSME-ID";

  return (
    <section className="space-y-5 pb-8">
      <div className="rounded-3xl border bg-white p-4 sm:p-6">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Saved Report</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Access to Finance Readiness Index (AFRI)</h1>
            <p className="mt-2 text-sm text-slate-600">Business: {businessName} • {msmeId}</p>
          </div>
          <Link
            href={`/api/msme/finance-readiness/pdf?assessmentId=${encodeURIComponent(assessmentId)}`}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            <Download className="h-4 w-4" />
            Download PDF Report
          </Link>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-emerald-50 p-4">
            <p className="text-sm">AFRI score</p>
            <p className="text-4xl font-bold">{assessment.score}/100</p>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="text-sm">Readiness band</p>
            <p className="mt-2 text-sm font-semibold">{assessment.band}</p>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="text-sm">Current pathway</p>
            <p className="mt-2 text-sm font-semibold capitalize">{assessment.pathway}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Report summary</h2>
        <p className="mt-2 text-sm text-slate-600">
          This saved AFRI report remains available from a stable page URL and can be downloaded as a PDF using the
          button above.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Completion: <span className="font-semibold text-slate-800">{assessment.completion}%</span> • Created:{" "}
          {new Date(assessment.createdAtIso).toLocaleString("en-NG")}
        </p>
      </div>
    </section>
  );
}
