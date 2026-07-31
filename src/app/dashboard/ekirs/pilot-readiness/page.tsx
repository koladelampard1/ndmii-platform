import { WorkspacePage, WorkspacePageHeader, WorkspaceSection } from "@/components/workspace/workspace-page";
import { PilotReadinessList, StateRevenueMetricCard } from "@/components/state-revenue/state-revenue-components";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";

export default function EkirsPilotReadinessPage() {
  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Controlled UAT"
        title="Operational Readiness"
        description="Deployment preparation controls for EKIRS confirmation, scoped users, authoritative geography, operating procedures and production migration planning."
        disclosure={EKIRS_JURISDICTION.demonstration.disclosure}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StateRevenueMetricCard label="Operating mode" value="Controlled UAT" note="No live taxpayer operations." />
        <StateRevenueMetricCard label="Reference records" value={EKIRS_JURISDICTION.pilot.targetBusinesses} note="Controlled synthetic data." classification="Synthetic" />
        <StateRevenueMetricCard label="Next gate" value="EKIRS confirmation" note="Users, LCDA and SOP approval." />
      </div>
      <PilotReadinessList config={EKIRS_JURISDICTION} />
      <WorkspaceSection title="Required before executive UAT">
        <ul className="grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-2">
          <li>Apply the approved state revenue migrations to the selected Supabase environment.</li>
          <li>Provision scoped EKIRS UAT users through an authorized administrative process.</li>
          <li>Confirm authoritative LCDA names and operating boundaries.</li>
          <li>Approve EKIRS UAT script and privacy disclosures.</li>
        </ul>
      </WorkspaceSection>
    </WorkspacePage>
  );
}
