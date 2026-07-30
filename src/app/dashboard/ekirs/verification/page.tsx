import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WorkspacePage, WorkspacePageHeader } from "@/components/workspace/workspace-page";
import { EligibilityPolicyPanel, FormalisationJourney, StateRevenueMetricCard } from "@/components/state-revenue/state-revenue-components";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";
import { getApplicationMetrics, listStateRevenueApplications } from "@/lib/state-revenue/onboarding";

export default async function EkirsVerificationPage() {
  const applications = await listStateRevenueApplications({ jurisdictionId: "ekiti" });
  const metrics = getApplicationMetrics(applications);
  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Jurisdiction eligibility"
        title="Onboarding & Verification"
        description="Operational queue for EKIRS onboarding applications, eligibility review, duplicate screening, evidence requests and field-verification referrals."
        disclosure={EKIRS_JURISDICTION.demonstration.disclosure}
        actions={<Link href="/dashboard/ekirs/applications" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800">Open applications <ArrowRight className="h-4 w-4" /></Link>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StateRevenueMetricCard label="Submitted" value={metrics.submitted} />
        <StateRevenueMetricCard label="Duplicate review" value={metrics.duplicateReview} />
        <StateRevenueMetricCard label="Field verification" value={metrics.fieldVerification} />
        <StateRevenueMetricCard label="Approved" value={metrics.approved} />
      </div>
      <EligibilityPolicyPanel config={EKIRS_JURISDICTION} />
      <FormalisationJourney config={EKIRS_JURISDICTION} />
    </WorkspacePage>
  );
}
