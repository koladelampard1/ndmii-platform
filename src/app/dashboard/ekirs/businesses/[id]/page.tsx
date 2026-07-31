import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WorkspaceContentGrid, WorkspacePage, WorkspacePageHeader, WorkspaceSection } from "@/components/workspace/workspace-page";
import { getEkirsBusiness } from "@/lib/state-revenue/ekirs-demo-data";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";
import { StateRevenueMetricCard, StatusBadge, VerificationLevelBadge } from "@/components/state-revenue/state-revenue-components";

type Params = Promise<{ id: string }>;

export default async function EkirsBusinessProfilePage({ params }: { params: Params }) {
  const { id } = await params;
  const business = getEkirsBusiness(id);
  if (!business) notFound();

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow={business.bin}
        title={business.businessName}
        description={`${business.sector} business in ${business.lga}, ${EKIRS_JURISDICTION.state}. Profile uses controlled reference data for eligibility and readiness review.`}
        disclosure={EKIRS_JURISDICTION.demonstration.disclosure}
        breadcrumbs={[{ label: "Business Registry", href: "/dashboard/ekirs/businesses" }]}
        actions={<Link href="/dashboard/ekirs/businesses" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> Back</Link>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StateRevenueMetricCard label="Verification level" value={business.verificationLevel} note={EKIRS_JURISDICTION.verificationLevels.find((level) => level.level === business.verificationLevel)?.label} />
        <StateRevenueMetricCard label="TIN status" value={business.tinLinkageStatus.replace("_", " ")} note="Readiness signal only." />
        <StateRevenueMetricCard label="Record keeping" value={business.recordKeepingStatus} note="Support pathway indicator." />
        <StateRevenueMetricCard label="Consent" value={business.consentStatus} note="Evidence workflow signal." />
      </div>
      <WorkspaceContentGrid columns="lg:grid-cols-2">
        <WorkspaceSection title="Operating context">
          <dl className="grid gap-3 text-sm">
            {[
              ["Declared jurisdiction", business.declaredJurisdiction],
              ["LGA", business.lga],
              ["LCDA", business.lcda ?? "Pending authoritative LCDA configuration"],
              ["Town", business.town],
              ["Formality status", business.formalityStatus],
              ["Field verification", business.fieldVerificationStatus.replaceAll("_", " ")],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <dt className="font-bold text-slate-500">{label}</dt>
                <dd className="text-right font-black text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </WorkspaceSection>
        <WorkspaceSection title="Eligibility and support">
          <div className="flex flex-wrap gap-2">
            <VerificationLevelBadge level={business.verificationLevel} />
            <StatusBadge tone={business.eligibilityStatus === "eligible" ? "emerald" : business.eligibilityStatus === "not_eligible" ? "rose" : "amber"}>{business.eligibilityStatus.replaceAll("_", " ")}</StatusBadge>
          </div>
          <h3 className="mt-5 text-sm font-black text-slate-950">Support needs</h3>
          <div className="mt-2 flex flex-wrap gap-2">{business.supportNeeds.map((need) => <StatusBadge key={need} tone="sky">{need}</StatusBadge>)}</div>
          <h3 className="mt-5 text-sm font-black text-slate-950">Data quality</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {business.dataQualityFlags.length ? business.dataQualityFlags.map((flag) => <StatusBadge key={flag} tone="amber">{flag}</StatusBadge>) : <StatusBadge tone="emerald">No active exception</StatusBadge>}
          </div>
        </WorkspaceSection>
      </WorkspaceContentGrid>
    </WorkspacePage>
  );
}
