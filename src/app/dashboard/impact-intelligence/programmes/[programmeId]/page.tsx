import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getImpactProgrammeDetail } from "@/lib/data/impact-intelligence";
import { QuickLink, StatusBadge } from "../../_components";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

export default async function ImpactProgrammeDetailPage({ params }: { params: Promise<{ programmeId: string }> }) {
  const { programmeId } = await params;
  const ctx = await getCurrentUserContext();
  const { programme, interventions, unanchoredInterventions, enrolments, cohorts } = await getImpactProgrammeDetail(ctx, programmeId);

  if (!programme) {
    return (
      <section className="space-y-6">
        <header className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Programme lookup</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Programme unavailable</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            The programme record could not be found or is temporarily unavailable. Reference: {programmeId}
          </p>
          <Link href="/dashboard/impact-intelligence/programmes" className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Back to programmes
          </Link>
        </header>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{programme.programme_code ?? "Programme"}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{programme.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{programme.description ?? "No programme description has been recorded yet."}</p>
          </div>
          <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{programme.status ?? "draft"}</span>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Sponsor</p><p className="mt-1 font-semibold text-slate-950">{programme.sponsor_name ?? "Pending"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Start</p><p className="mt-1 font-semibold text-slate-950">{formatDate(programme.start_date)}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">End</p><p className="mt-1 font-semibold text-slate-950">{formatDate(programme.end_date)}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Cohorts</p><p className="mt-1 font-semibold text-slate-950">{cohorts.length}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Cohort beneficiaries</p><p className="mt-1 font-semibold text-slate-950">{cohorts.reduce((sum, cohort) => sum + (cohort.member_count ?? cohort.current_beneficiaries ?? 0), 0)}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Anchored interventions</p><p className="mt-1 font-semibold text-slate-950">{interventions.filter((item) => item.cohort_id).length}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Unanchored legacy</p><p className="mt-1 font-semibold text-slate-950">{unanchoredInterventions.length}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Legacy linked MSMEs</p><p className="mt-1 font-semibold text-slate-950">{enrolments.length}</p></div>
      </div>

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-950">Linked cohorts</h2>
          <Link href="/dashboard/impact-intelligence/cohorts" className="text-sm font-medium text-emerald-700">Open cohort registry</Link>
        </div>
        {cohorts.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No beneficiary cohorts have been linked to this programme yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Cohort</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Sector</th><th className="px-4 py-3">Beneficiaries</th><th className="px-4 py-3">Interventions</th><th className="px-4 py-3">Assessments</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
              <tbody className="divide-y">
                {cohorts.map((cohort) => (
                  <tr key={cohort.id}>
                    <td className="px-4 py-3"><Link href={`/dashboard/impact-intelligence/cohorts/${cohort.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{cohort.name}</Link></td>
                    <td className="px-4 py-3 text-slate-600">{[cohort.lga, cohort.state].filter(Boolean).join(", ") || "National"}</td>
                    <td className="px-4 py-3 text-slate-600">{cohort.sector ?? "All sectors"}</td>
                    <td className="px-4 py-3 text-slate-600">{cohort.member_count ?? cohort.current_beneficiaries} / {cohort.target_beneficiaries}</td>
                    <td className="px-4 py-3 text-slate-600">{cohort.intervention_count ?? 0}</td>
                    <td className="px-4 py-3 text-slate-600">{cohort.assessment_count ?? 0} total / {cohort.approved_assessment_count ?? 0} approved</td>
                    <td className="px-4 py-3"><StatusBadge value={cohort.status} /></td>
                    <td className="px-4 py-3"><QuickLink href={`/dashboard/impact-intelligence/cohorts/${cohort.id}`}>Open</QuickLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-950">Interventions</h2>
          <Link href="/dashboard/impact-intelligence/interventions" className="text-sm font-medium text-emerald-700">Open intervention registry</Link>
        </div>
        {interventions.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No interventions have been linked to this programme yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Intervention</th><th className="px-4 py-3">Cohort</th><th className="px-4 py-3">MSME</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Amount</th></tr></thead>
              <tbody className="divide-y">
                {interventions.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3"><Link href={`/dashboard/impact-intelligence/interventions/${item.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{item.title}</Link></td>
                    <td className="px-4 py-3 text-slate-600">{item.impact_beneficiary_cohorts?.name ?? "Unanchored legacy"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.msmes?.business_name ?? "Unlinked"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.status ?? "planned"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.approved_amount ? `NGN ${item.approved_amount.toLocaleString()}` : "Not set"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {unanchoredInterventions.length > 0 && (
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="font-semibold text-amber-950">Unanchored legacy interventions</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            These records are linked to the programme but could not be safely matched to one cohort beneficiary during backfill.
          </p>
          <div className="mt-4 grid gap-2">
            {unanchoredInterventions.map((item) => (
              <Link key={item.id} href={`/dashboard/impact-intelligence/interventions/${item.id}`} className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:border-amber-300">
                {item.title} <span className="font-normal text-slate-500">({item.msmes?.business_name ?? "Unlinked MSME"})</span>
              </Link>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}
