import { WorkspacePage, WorkspacePageHeader } from "@/components/workspace/workspace-page";
import { EligibilityPolicyPanel, FormalisationJourney } from "@/components/state-revenue/state-revenue-components";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";

export default function EkirsVerificationPage() {
  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Jurisdiction eligibility"
        title="Onboarding & Verification"
        description="The policy model explains how Ekiti business eligibility, consent-backed evidence, TIN linkage and field review can be handled in a future live workflow."
        disclosure={EKIRS_JURISDICTION.demonstration.disclosure}
      />
      <EligibilityPolicyPanel config={EKIRS_JURISDICTION} />
      <FormalisationJourney config={EKIRS_JURISDICTION} />
    </WorkspacePage>
  );
}
