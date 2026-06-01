import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { getWorkspaceProfileCompletion } from "@/lib/data/msme-profile-completion";
import { getProfileFeatureGate } from "@/lib/profile-completion";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { ProfileFeatureGateNotice } from "@/components/msme/profile-feature-gate";
import { FinanceReadinessClient } from "./finance-readiness-client";

export default async function Page() {
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const gate = getProfileFeatureGate("funding", await getWorkspaceProfileCompletion(supabase, workspace));
  if (!gate.unlocked) return <ProfileFeatureGateNotice gate={gate} />;
  return (
    <FinanceReadinessClient
      businessName={workspace.msme.business_name || workspace.provider.display_name || "MSME Business"}
      msmeId={workspace.msme.msme_id || "MSME-ID"}
    />
  );
}
