import { WorkspacePage, WorkspacePageHeader } from "@/components/workspace/workspace-page";
import { IntegrationCatalogue, StateRevenueDisclosure } from "@/components/state-revenue/state-revenue-components";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";

export default function EkirsIntegrationsPage() {
  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Integration catalogue"
        title="Integrations"
        description="A foundation catalogue for future DBIN identity, TIN linkage, CAC reference, field verification, payments and communications integrations."
        disclosure="All Sprint 0 integrations are configured as foundation-ready, simulated or future capabilities. No external credentials or live revenue feeds are used."
      />
      <IntegrationCatalogue integrations={EKIRS_JURISDICTION.integrations} />
      <StateRevenueDisclosure text="Payment-provider integration remains future-only and does not record collections, liabilities, assessments or remittances." />
    </WorkspacePage>
  );
}
