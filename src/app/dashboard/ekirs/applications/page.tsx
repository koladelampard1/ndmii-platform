import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState, WorkspaceToolbar } from "@/components/workspace/workspace-page";
import { StatusBadge, StateRevenueMetricCard } from "@/components/state-revenue/state-revenue-components";
import { EKIRS_JURISDICTION, EKITI_CONSTITUTIONAL_LGAS } from "@/lib/state-revenue/jurisdictions";
import { getApplicationMetrics, listStateRevenueApplications } from "@/lib/state-revenue/onboarding";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EkirsApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rows = await listStateRevenueApplications({
    jurisdictionId: "ekiti",
    filters: {
      status: first(params.status),
      lga: first(params.lga),
      q: first(params.q),
    },
  });
  const metrics = getApplicationMetrics(rows);

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Operational onboarding"
        title="Applications"
        description="Review EKIRS onboarding applications, duplicate flags, evidence requirements and field-verification referrals. Controlled reference registry data remains separate from submitted applications."
        disclosure="Application records are UAT/test classified until EKIRS authorises live onboarding."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StateRevenueMetricCard label="Applications" value={metrics.total} note="Operational/UAT records only." />
        <StateRevenueMetricCard label="Under review" value={metrics.underReview} />
        <StateRevenueMetricCard label="Evidence required" value={metrics.evidenceRequired} />
        <StateRevenueMetricCard label="Approved" value={metrics.approved} />
      </div>
      <form action="/dashboard/ekirs/applications">
        <WorkspaceToolbar>
          <input name="q" defaultValue={first(params.q) ?? ""} placeholder="Search reference or business" className="h-10 min-w-[16rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
          <select name="status" defaultValue={first(params.status) ?? ""} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
            <option value="">All statuses</option>
            {["submitted", "under_review", "evidence_required", "duplicate_review_required", "field_verification_required", "field_verification_assigned", "approved", "rejected"].map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}
          </select>
          <select name="lga" defaultValue={first(params.lga) ?? ""} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
            <option value="">All LGAs</option>
            {EKITI_CONSTITUTIONAL_LGAS.map((lga) => <option key={lga}>{lga}</option>)}
          </select>
          <button className="h-10 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800">Apply</button>
          <Link href="/dashboard/ekirs/applications" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">Reset</Link>
        </WorkspaceToolbar>
      </form>
      <WorkspaceSection title={`${rows.length} application${rows.length === 1 ? "" : "s"}`} description="No tax liabilities, assessments, payments or collection metrics are displayed.">
        {!rows.length ? (
          <WorkspaceState type="empty" title="No applications yet" description="Applications submitted through the EKIRS application journey will appear here once the live database workflow is enabled." />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Application</th>
                    <th className="px-5 py-4">Location</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Duplicate</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row: any) => {
                    const location = row.state_revenue_operating_locations?.[0];
                    return (
                      <tr key={row.id} className="align-top transition hover:bg-emerald-50/30">
                        <td className="px-5 py-4">
                          <p className="font-black text-slate-950">{row.proposed_business_name ?? "Unnamed business"}</p>
                          <p className="mt-1 text-xs text-slate-500">{row.application_reference}</p>
                        </td>
                        <td className="px-5 py-4 text-slate-700">{location ? `${location.lga_name} · ${location.town}` : EKIRS_JURISDICTION.geography.state}</td>
                        <td className="px-5 py-4"><StatusBadge tone={row.current_status === "approved" ? "emerald" : row.current_status === "rejected" ? "rose" : "amber"}>{row.current_status.replace(/_/g, " ")}</StatusBadge></td>
                        <td className="px-5 py-4"><StatusBadge tone={row.duplicate_status.includes("match") ? "amber" : "slate"}>{row.duplicate_status.replace(/_/g, " ")}</StatusBadge></td>
                        <td className="px-5 py-4">
                          <Link href={`/dashboard/ekirs/applications/${row.id}`} className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:text-emerald-950">Open <ArrowRight className="h-3.5 w-3.5" /></Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </WorkspaceSection>
    </WorkspacePage>
  );
}
