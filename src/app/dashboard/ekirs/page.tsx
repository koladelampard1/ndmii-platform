import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WorkspaceContentGrid, WorkspacePage, WorkspacePageHeader, WorkspaceSection } from "@/components/workspace/workspace-page";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";
import { getEkirsLgaMetrics, getEkirsMetrics } from "@/lib/state-revenue/ekirs-demo-data";
import { GeographyFoundation, StateRevenueDisclosure, StateRevenueMetricCard } from "@/components/state-revenue/state-revenue-components";
import { getApplicationMetrics, listStateRevenueApplications } from "@/lib/state-revenue/onboarding";

export default async function EkirsDashboardPage() {
  const metrics = getEkirsMetrics();
  const applications = await listStateRevenueApplications({ jurisdictionId: "ekiti" });
  const applicationMetrics = getApplicationMetrics(applications);
  const lgaMetrics = getEkirsLgaMetrics().slice(0, 6);

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Ekiti State Revenue Service"
        title="Executive Overview"
        description="A controlled operating view for EKIRS business formalisation, jurisdiction eligibility, readiness support and integration preparation."
        disclosure={EKIRS_JURISDICTION.demonstration.disclosure}
        lastUpdated="July 2026"
        actions={<Link href="/dashboard/ekirs/applications" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800">Open applications <ArrowRight className="h-4 w-4" /></Link>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StateRevenueMetricCard label="Applications" value={applicationMetrics.total} note="UAT operational records only." />
        <StateRevenueMetricCard label="Under review" value={applicationMetrics.underReview} note="Reviewer queue." />
        <StateRevenueMetricCard label="Approved" value={applicationMetrics.approved} note="Identity/linkage workflow completed." />
        <StateRevenueMetricCard label="Synthetic businesses" value={metrics.totalBusinesses} note="Separate Sprint 0 reference data." />
      </div>
      <WorkspaceContentGrid columns="lg:grid-cols-3">
        {[
          ["Applications", "Review submitted onboarding requests, duplicate flags, evidence and field referrals.", "/dashboard/ekirs/applications"],
          ["Business Registry", "Review Ekiti synthetic business records, LGA context and readiness signals.", "/dashboard/ekirs/businesses"],
          ["Eligibility Policy", "Understand the jurisdiction, evidence and review model before live workflow activation.", "/dashboard/ekirs/verification"],
          ["Pilot Readiness", "Track the controls needed before EKIRS UAT and production preparation.", "/dashboard/ekirs/pilot-readiness"],
        ].map(([title, description, href]) => (
          <Link key={href} href={href} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
            <h2 className="font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-emerald-700">Open <ArrowRight className="h-3.5 w-3.5" /></span>
          </Link>
        ))}
      </WorkspaceContentGrid>
      <WorkspaceSection title="LGA readiness snapshot" description="Top configured LGA slices from deterministic Sprint 0 records.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lgaMetrics.map((lga) => (
            <article key={lga.lga} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-black text-slate-950">{lga.lga}</h3>
              <p className="mt-2 text-sm text-slate-600">{lga.total} records · {lga.jurisdictionVerified} jurisdiction verified · {lga.qualityFlags} flags</p>
            </article>
          ))}
        </div>
      </WorkspaceSection>
      <GeographyFoundation config={EKIRS_JURISDICTION} />
      <StateRevenueDisclosure text="No collection, liability, payment or assessment values are calculated or displayed in the EKIRS Sprint 0 workspace." />
    </WorkspacePage>
  );
}
