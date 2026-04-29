import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { FinanceReadinessClient } from "./readiness-client";

export default async function Page() {
  const workspace = await getProviderWorkspaceContext();
  return <FinanceReadinessClient businessName={workspace.msme.business_name || workspace.provider.display_name || "Unnamed MSME"} msmeId={workspace.msme.msme_id || "UNKNOWN"} />;
}
