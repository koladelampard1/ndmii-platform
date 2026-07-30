import { WorkspacePage, WorkspacePageHeader, WorkspaceSection } from "@/components/workspace/workspace-page";
import { PilotReadinessList, StateRevenueMetricCard } from "@/components/state-revenue/state-revenue-components";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";

export default function EkirsPilotReadinessPage() {
  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Controlled UAT"
        title="Pilot Readiness"
        description="Deployment preparation controls for EKIRS confirmation, scoped users, authoritative geography, operating procedures and production migration planning."
        disclosure={EKIRS_JURISDICTION.demonstration.disclosure}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StateRevenueMetricCard label="Pilot mode" value="Controlled UAT" note="No live taxpayer operations." />
        <StateRevenueMetricCard label="Target records" value={EKIRS_JURISDICTION.pilot.targetBusinesses} note="Deterministic synthetic data." />
        <StateRevenueMetricCard label="Next gate" value="EKIRS confirmation" note="Users, LCDA and SOP approval." />
      </div>
      <PilotReadinessList config={EKIRS_JURISDICTION} />
      <WorkspaceSection title="Required before live demonstration">
        <ul className="grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-2">
          <li>Apply the Sprint 0 migration to the selected Supabase environment.</li>
          <li>Provision scoped EKIRS UAT users through an authorized administrative process.</li>
          <li>Confirm authoritative LCDA names and operating boundaries.</li>
          <li>Approve EKIRS demonstration script and privacy disclosures.</li>
        </ul>
      </WorkspaceSection>
    </WorkspacePage>
  );
}
