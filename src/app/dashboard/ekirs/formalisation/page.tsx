import { WorkspacePage, WorkspacePageHeader, WorkspaceSection } from "@/components/workspace/workspace-page";
import { FormalisationJourney, StateRevenueDisclosure } from "@/components/state-revenue/state-revenue-components";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";
import { getEkirsMetrics } from "@/lib/state-revenue/ekirs-demo-data";

export default function EkirsFormalisationPage() {
  const metrics = getEkirsMetrics();
  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Business formalisation"
        title="Formalisation Journey"
        description="A staged readiness pathway from self-declared business records to jurisdiction-verified, identity-linked and field-confirmed operating profiles."
      />
      <FormalisationJourney config={EKIRS_JURISDICTION} />
      <WorkspaceSection title="Current synthetic journey distribution">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">Contact verified</p><p className="mt-2 text-2xl font-black">{metrics.contactVerified}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">Jurisdiction verified</p><p className="mt-2 text-2xl font-black">{metrics.jurisdictionVerified}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">Identity linked</p><p className="mt-2 text-2xl font-black">{metrics.identityLinked}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">Field confirmed</p><p className="mt-2 text-2xl font-black">{metrics.fieldConfirmed}</p></div>
        </div>
      </WorkspaceSection>
      <StateRevenueDisclosure text="Formalisation readiness does not imply tax assessment, liability, registration approval or payment obligation." />
    </WorkspacePage>
  );
}
